"""Safe AST-based mathematical expression evaluator and financial/percentage helper."""
from __future__ import annotations

import ast
import math
import operator
from typing import Any

_BIN_OPS: dict[type[ast.operator], Any] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}

_UNARY_OPS: dict[type[ast.unaryop], Any] = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}

_SAFE_FUNCS: dict[str, Any] = {
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "sqrt": math.sqrt,
    "log": math.log,
    "log10": math.log10,
    "exp": math.exp,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "floor": math.floor,
    "ceil": math.ceil,
}

_SAFE_CONSTS: dict[str, float] = {
    "pi": math.pi,
    "e": math.e,
}


def _eval_node(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return float(node.value)
    if isinstance(node, ast.Name):
        if node.id in _SAFE_CONSTS:
            return _SAFE_CONSTS[node.id]
        raise ValueError(f"Bien khong duoc phep: {node.id}")
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPS:
        return float(_UNARY_OPS[type(node.op)](_eval_node(node.operand)))
    if isinstance(node, ast.BinOp) and type(node.op) in _BIN_OPS:
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > 1000:
            raise ValueError("So mu qua lon (gioi han <= 1000)")
        return float(_BIN_OPS[type(node.op)](left, right))
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
        fn = _SAFE_FUNCS.get(node.func.id)
        if fn is None:
            raise ValueError(f"Ham khong duoc phep: {node.func.id}")
        args = [_eval_node(a) for a in node.args]
        return float(fn(*args))
    raise ValueError(f"Cu phap bieu thuc khong duoc ho tro: {type(node).__name__}")


class SafeCalculatorClient:
    """Safely evaluate math expressions and percentage changes without using eval()."""

    def evaluate(self, expression: str, precision: int = 6) -> dict:
        """Evaluate an arithmetic or scientific math expression (e.g. '95000 * 25400', 'sqrt(144) + 15%')."""
        raw = (expression or "").strip()
        if not raw:
            raise ValueError("Bieu thuc khong duoc rong")
        if len(raw) > 300:
            raise ValueError("Bieu thuc qua dai (toi da 300 ky tu)")

        normalized = raw.replace(",", "").replace("^", "**")
        tree = ast.parse(normalized, mode="eval")
        value = _eval_node(tree)
        rounded = round(value, max(0, min(int(precision), 12)))
        return {
            "expression": raw,
            "result": rounded,
            "formatted": f"{rounded:,.{min(max(0, int(precision)), 6)}f}".rstrip("0").rstrip("."),
        }

    def percent_change(self, old_value: float, new_value: float) -> dict:
        """Compute absolute difference and percentage change from old_value to new_value."""
        old_f = float(old_value)
        new_f = float(new_value)
        if old_f == 0:
            raise ValueError("old_value phai khac 0 de tinh phan tram thay doi")
        diff = new_f - old_f
        pct = (diff / old_f) * 100.0
        return {
            "old_value": old_f,
            "new_value": new_f,
            "difference": round(diff, 6),
            "percent_change": round(pct, 4),
            "summary": f"{pct:+.2f}%",
        }
