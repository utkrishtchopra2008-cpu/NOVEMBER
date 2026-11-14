import { Copy, Check } from "lucide-react";
import { useState } from "react";

export interface CodeDisplayLine { number: number; text: string; kind?: "context" | "added" | "removed" }

export function CodeSnippet({ lines, startLine = 1, compact = false }: { lines: Array<string | CodeDisplayLine>; startLine?: number; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const normalized = lines.map((line, index) => typeof line === "string"
    ? { number: startLine + index, text: line, kind: "context" as const }
    : { number: line.number, text: line.text, kind: line.kind || "context" as const });
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(normalized.map((line) => line.text).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { setCopied(false); }
  }
  return <div className={`code-window ${compact ? "code-compact" : ""}`}>
    <div className="code-window-head"><span><i className="code-dot" /> SOURCE EXCERPT</span><button onClick={() => void copyCode()} className="code-copy">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}</button></div>
    <pre>{normalized.map((line, index) => <div className={`code-line code-line-${line.kind}`} key={index}><span className="line-number">{line.number}</span><span className="line-change-marker">{line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}</span><code>{line.text || " "}</code></div>)}</pre>
  </div>;
}