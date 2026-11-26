"""Multi-pack skill discovery and registry.

Automatically scans every skill pack subdirectory under `skills/` (e.g., `skills/search_skills`,
`skills/new_skills`, or any future domain pack) and registers all public skill methods.
"""
from __future__ import annotations

import importlib.util
import inspect
import json
import sys
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Sequence

from google.genai import types

from agent_runtime.config import OUTPUTS_DIR, SKIP_MODULES, SKILLS_ROOT
from agent_runtime.schema_builder import (
    build_schema_for_annotation,
    build_schema_from_json_dict,
    coerce_arg,
    safe_serialize,
)

# Self-explanatory parameter names that don't need verbose descriptions (saves ~15-25 tokens/tool)
_SELF_EXPLANATORY_PARAMS = frozenset(
    {
        "query", "q", "url", "city", "symbol", "topic", "text", "path", "source",
        "filename", "limit", "max_results", "max_chars", "max_pages", "package_name",
        "ip_address", "from_currency", "to_currency", "expression", "key", "value",
    }
)


def _compact_doc(raw_doc: str, max_len: int = 88) -> str:
    first = (raw_doc or "").strip().splitlines()[0].strip() if raw_doc else ""
    if len(first) > max_len:
        return first[: max_len - 3].rstrip() + "..."
    return first


def _make_function_skill_handler(execute_fn: Callable[..., Any]) -> Callable[..., dict[str, Any]]:
    def _run(**kwargs: Any) -> dict[str, Any]:
        try:
            result = execute_fn(**kwargs)
            if isinstance(result, dict) and "ok" in result:
                return result
            return {"ok": True, "data": result}
        except Exception as exc:
            return {
                "ok": False,
                "error": f"{type(exc).__name__}: {exc}",
                "traceback": traceback.format_exc()[-900:],
            }

    return _run


@dataclass(frozen=True)
class ToolEntry:
    name: str
    pack: str
    module_name: str
    declaration: types.FunctionDeclaration
    handler: Callable[..., dict[str, Any]]


def _load_module_from_path(module_key: str, file_path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(module_key, file_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not create module spec for {file_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_key] = module
    spec.loader.exec_module(module)
    return module


def _make_handler(
    cls_ref: type,
    fn_name: str,
    param_meta: list[tuple[str, types.Schema, inspect.Parameter]],
) -> Callable[..., dict[str, Any]]:
    def _run(**kwargs: Any) -> dict[str, Any]:
        clean_kwargs: dict[str, Any] = {}
        for name, schema, param in param_meta:
            if name in kwargs and kwargs[name] is not None:
                clean_kwargs[name] = coerce_arg(kwargs[name], schema)
            elif param.default is not inspect._empty:
                clean_kwargs[name] = param.default

        try:
            init_sig = inspect.signature(cls_ref.__init__)
            if "output_dir" in init_sig.parameters:
                OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
                instance = cls_ref(output_dir=str(OUTPUTS_DIR))
            else:
                instance = cls_ref()
            result = getattr(instance, fn_name)(**clean_kwargs)
            serialized = safe_serialize(result)
            try:
                data_obj = json.loads(serialized)
            except json.JSONDecodeError:
                data_obj = serialized
            return {"ok": True, "data": data_obj}
        except Exception as exc:
            return {
                "ok": False,
                "error": f"{type(exc).__name__}: {exc}",
                "traceback": traceback.format_exc()[-900:],
            }

    return _run


class SkillRegistry:
    """Discovers and manages skill tools across all packs under `skills/`."""

    def __init__(
        self,
        skills_root: Path = SKILLS_ROOT,
        packs: Sequence[str] | None = None,
        skip_modules: frozenset[str] = SKIP_MODULES,
    ):
        self.skills_root = skills_root
        self._packs_filter = list(packs) if packs else None
        self.skip_modules = skip_modules
        self.entries: list[ToolEntry] = []
        self._by_name: dict[str, ToolEntry] = {}
        self.loaded_packs: list[str] = []
        self._discover(packs=self._packs_filter)

    def reload(self) -> int:
        """Hot-reload all skill modules from disk and rebuild tool declarations/handlers."""
        import importlib

        importlib.invalidate_caches()
        for entry in self.entries:
            sys.modules.pop(entry.module_name, None)
            sys.modules.pop(f"skills_{entry.pack}_{entry.module_name}", None)

        self.entries.clear()
        self._by_name.clear()
        self.loaded_packs.clear()
        self._discover(packs=self._packs_filter)
        return len(self.entries)

    def list_skill_files(self) -> list[dict[str, Any]]:
        """List all editable skill_*.py files across packs (excluding SKIP_MODULES)."""
        items: list[dict[str, Any]] = []
        for pack_dir in self._iter_pack_dirs(self._packs_filter):
            pack_name = pack_dir.name
            for file_path in sorted(pack_dir.glob("skill_*.py")):
                mod_name = file_path.stem
                if mod_name in self.skip_modules:
                    continue
                test_path = pack_dir / f"test_{mod_name}.py"
                tools = [e.name for e in self.entries if e.pack == pack_name and e.module_name == mod_name]
                items.append(
                    {
                        "id": f"{pack_name}/{file_path.name}",
                        "pack": pack_name,
                        "module_name": mod_name,
                        "skill_path": str(file_path),
                        "test_path": str(test_path),
                        "has_test": test_path.exists(),
                        "tools": tools,
                    }
                )
        return items

    def _iter_pack_dirs(self, packs: Sequence[str] | None) -> list[Path]:
        if not self.skills_root.exists():
            return []
        if packs:
            result = []
            for p in packs:
                cand = self.skills_root / p
                if cand.is_dir():
                    result.append(cand)
                else:
                    print(f"[WARN] Skill pack not found: {cand}")
            return result

        return sorted(
            d
            for d in self.skills_root.iterdir()
            if d.is_dir() and not d.name.startswith((".", "_"))
        )

    def _discover(self, packs: Sequence[str] | None) -> None:
        if str(self.skills_root) not in sys.path:
            sys.path.insert(0, str(self.skills_root))

        for pack_dir in self._iter_pack_dirs(packs):
            pack_name = pack_dir.name
            if str(pack_dir) not in sys.path:
                sys.path.insert(0, str(pack_dir))

            pack_tool_count = 0
            for file_path in sorted(pack_dir.glob("skill_*.py")):
                mod_name = file_path.stem
                if mod_name in self.skip_modules:
                    continue

                module_key = f"skills_{pack_name}_{mod_name}"
                try:
                    mod = _load_module_from_path(module_key, file_path)
                except Exception as exc:
                    print(
                        f"[WARN] Skipped {pack_name}/{mod_name} due to import error: "
                        f"{type(exc).__name__}: {exc}"
                    )
                    continue

                # Convention B: Module-level TOOL_SCHEMA dict + execute(action, **kwargs) (e.g., automationPc_skills)
                tool_schema = getattr(mod, "TOOL_SCHEMA", None)
                execute_fn = getattr(mod, "execute", None)
                if isinstance(tool_schema, dict) and callable(execute_fn):
                    raw_tool_name = str(tool_schema.get("name") or mod_name).replace("skill_", "")
                    tool_fn_name = f"{raw_tool_name}__execute"
                    if tool_fn_name not in self._by_name:
                        desc = _compact_doc(str(tool_schema.get("description") or f"Execute {mod_name}"))
                        params_schema = build_schema_from_json_dict(tool_schema.get("parameters") or {"type": "object"})
                        decl = types.FunctionDeclaration(
                            name=tool_fn_name,
                            description=desc,
                            parameters=params_schema,
                        )
                        entry = ToolEntry(
                            name=tool_fn_name,
                            pack=pack_name,
                            module_name=mod_name,
                            declaration=decl,
                            handler=_make_function_skill_handler(execute_fn),
                        )
                        self.entries.append(entry)
                        self._by_name[tool_fn_name] = entry
                        pack_tool_count += 1
                    continue

                # Convention A: Public class with public methods (e.g., search_skills, new_skills, auto_skills)
                for cls_name, cls_obj in inspect.getmembers(mod, inspect.isclass):
                    if cls_obj.__module__ != module_key or cls_name.startswith("_"):
                        continue

                    for m_name, method in inspect.getmembers(cls_obj, predicate=inspect.isfunction):
                        if m_name.startswith("_") or m_name not in cls_obj.__dict__:
                            continue

                        tool_fn_name = f"{mod_name.replace('skill_', '')}__{m_name}"
                        if tool_fn_name in self._by_name:
                            print(
                                f"[WARN] Duplicate tool name '{tool_fn_name}' in {pack_name}/{mod_name}; skipping."
                            )
                            continue

                        sig = inspect.signature(method)
                        properties: dict[str, types.Schema] = {}
                        required: list[str] = []
                        param_meta: list[tuple[str, types.Schema, inspect.Parameter]] = []

                        for p_name, param in sig.parameters.items():
                            if p_name == "self" or param.kind in (
                                inspect.Parameter.VAR_POSITIONAL,
                                inspect.Parameter.VAR_KEYWORD,
                            ):
                                continue
                            has_default = param.default is not inspect._empty
                            # Compact schema: omit verbose descriptions for self-explanatory parameter names
                            if p_name in _SELF_EXPLANATORY_PARAMS and not has_default:
                                desc_p = ""
                            elif has_default:
                                desc_p = f"default={param.default}"
                            else:
                                desc_p = ""
                            schema = build_schema_for_annotation(param.annotation, description=desc_p)
                            properties[p_name] = schema
                            if not has_default:
                                required.append(p_name)
                            param_meta.append((p_name, schema, param))

                        raw_doc = (
                            inspect.getdoc(method)
                            or inspect.getdoc(cls_obj)
                            or f"Call {cls_name}.{m_name}"
                        )
                        doc_first = _compact_doc(raw_doc)

                        decl = types.FunctionDeclaration(
                            name=tool_fn_name,
                            description=doc_first,
                            parameters=types.Schema(
                                type=types.Type.OBJECT,
                                properties=properties,
                                required=required,
                            ),
                        )

                        entry = ToolEntry(
                            name=tool_fn_name,
                            pack=pack_name,
                            module_name=mod_name,
                            declaration=decl,
                            handler=_make_handler(cls_obj, m_name, param_meta),
                        )
                        self.entries.append(entry)
                        self._by_name[tool_fn_name] = entry
                        pack_tool_count += 1

            if pack_tool_count > 0:
                self.loaded_packs.append(f"{pack_name}({pack_tool_count})")

    @property
    def declarations(self) -> list[types.FunctionDeclaration]:
        return [e.declaration for e in self.entries]

    @property
    def handlers(self) -> dict[str, Callable[..., dict[str, Any]]]:
        return {e.name: e.handler for e in self.entries}

    @property
    def names(self) -> list[str]:
        return [e.name for e in self.entries]

    def get_handler(self, name: str) -> Callable[..., dict[str, Any]] | None:
        entry = self._by_name.get(name)
        return entry.handler if entry else None
