import { Copy, Check } from "lucide-react";
import { useState } from "react";

export function CodeSnippet({ lines, startLine = 1, compact = false }: { lines: string[]; startLine?: number; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }
  return <div className={`code-window ${compact ? "code-compact" : ""}`}>
    <div className="code-window-head"><span><i className="code-dot" /> SOURCE EXCERPT</span><button onClick={copyCode} className="code-copy">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}</button></div>
    <pre>{lines.map((line, index) => <div className="code-line" key={index}><span className="line-number">{startLine + index}</span><code>{line || " "}</code></div>)}</pre>
  </div>;
}