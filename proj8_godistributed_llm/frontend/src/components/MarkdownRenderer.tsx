"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, Terminal } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
}

interface ContentSegment {
  type: "text" | "code";
  lang?: string;
  value: string;
}

function splitCodeBlocks(input: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const fenceRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: input.slice(lastIndex, match.index),
      });
    }
    segments.push({
      type: "code",
      lang: match[1] || "text",
      value: match[2].replace(/\n$/, ""),
    });
    lastIndex = fenceRegex.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({
      type: "text",
      value: input.slice(lastIndex),
    });
  }

  return segments;
}

function renderInlineFormatting(text: string): ReactNode[] {
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={idx}
          className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[12px] text-indigo-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-zinc-50">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] text-zinc-400">
        <span className="inline-flex items-center gap-1.5 font-mono uppercase">
          <Terminal className="h-3 w-3 text-indigo-400" />
          {lang}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-100"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const segments = splitCodeBlocks(content);

  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {segments.map((seg, idx) => {
        if (seg.type === "code") {
          return <CodeBlock key={idx} lang={seg.lang ?? "text"} code={seg.value} />;
        }

        const lines = seg.value.split(/\r?\n/);
        return (
          <div key={idx} className="space-y-1">
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={lineIdx} className="h-1" />;
              }
              if (trimmed.startsWith("### ")) {
                return (
                  <h4 key={lineIdx} className="pt-1 text-sm font-semibold text-zinc-100">
                    {renderInlineFormatting(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith("## ")) {
                return (
                  <h3 key={lineIdx} className="pt-1 text-base font-semibold text-zinc-50">
                    {renderInlineFormatting(trimmed.slice(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith("# ")) {
                return (
                  <h2 key={lineIdx} className="pt-1 text-base font-bold text-white">
                    {renderInlineFormatting(trimmed.slice(2))}
                  </h2>
                );
              }
              if (/^[-*]\s+/.test(trimmed)) {
                return (
                  <div key={lineIdx} className="flex gap-2 pl-2">
                    <span className="text-indigo-400">-</span>
                    <span>{renderInlineFormatting(trimmed.replace(/^[-*]\s+/, ""))}</span>
                  </div>
                );
              }
              if (/^\d+\.\s+/.test(trimmed)) {
                const match = /^(\d+\.)\s+(.*)$/.exec(trimmed);
                if (match) {
                  return (
                    <div key={lineIdx} className="flex gap-2 pl-2">
                      <span className="font-mono text-xs text-indigo-400">{match[1]}</span>
                      <span>{renderInlineFormatting(match[2])}</span>
                    </div>
                  );
                }
              }
              return <p key={lineIdx}>{renderInlineFormatting(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

