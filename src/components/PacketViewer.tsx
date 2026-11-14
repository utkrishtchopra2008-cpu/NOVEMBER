import { useMemo, useState } from "react";
import { Copy, Download, FileCode2, FileJson, FileText, Check, ExternalLink } from "lucide-react";
import type { Finding } from "../types";
import { useToast } from "../context/ToastContext";
import { CodeSnippet } from "./CodeSnippet";

function buildMarkdown(finding: Finding) {
  return `# ${finding.title}\n\n**Finding:** ${finding.id}  \n**Severity:** ${finding.severity}  \n**Status:** ${finding.lifecycle}  \n**Repository:** ${finding.repository}  \n**Commit:** \`${finding.commitSha}\`\n\n## Original report\n\n${finding.originalReport}\n\n## Claims and verification\n\n${finding.claims.map((claim) => `### ${claim.id} — ${claim.title}\n\n- **Status:** ${claim.status}\n- **Reference:** \`${claim.filePath}:${claim.lineStart}-${claim.lineEnd}\`\n- **Function:** \`${claim.functionName}\`\n- **Assertion:** ${claim.assertion}\n- **Reason:** ${claim.reason}\n\n\`\`\`text\n${claim.snippet.join("\n")}\n\`\`\`\n`).join("\n")}\n## Missing evidence\n\n${finding.missingEvidence.map((item) => `- ${item}`).join("\n") || "- None recorded"}\n\n## Reviewer decision\n\n${finding.decision || "Pending review"}\n\n${finding.reviewerNotes || "No reviewer notes recorded."}\n\n---\n*Reference verification does not establish exploitability. Code changes do not establish remediation.*\n`;
}
export function PacketViewer({ finding }: { finding: Finding }) {
  const [tab, setTab] = useState<"rendered" | "markdown" | "json">("rendered");
  const [copied, setCopied] = useState(false);
  const { notify } = useToast();
  const markdown = useMemo(() => buildMarkdown(finding), [finding]);
  const json = useMemo(() => JSON.stringify({ ...finding, packetVersion: "1.0", evidenceDisclaimer: "Reference verification does not establish exploitability." }, null, 2), [finding]);
  const raw = tab === "json" ? json : markdown;
  async function copy() {
    try { await navigator.clipboard.writeText(raw); setCopied(true); notify("Packet copied to clipboard."); window.setTimeout(() => setCopied(false), 1500); }
    catch { notify("Clipboard access was unavailable.", "error"); }
  }
  function download() {
    const blob = new Blob([tab === "json" ? json : markdown], { type: tab === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${finding.id}-investigation.${tab === "json" ? "json" : "md"}`; anchor.click();
    URL.revokeObjectURL(url);
    notify("Investigation packet exported.");
  }
  return <div className="packet-viewer">
    <div className="packet-toolbar"><div className="packet-tabs">
      <button className={tab === "rendered" ? "active" : ""} onClick={() => setTab("rendered")}><FileText size={15} /> Rendered</button>
      <button className={tab === "markdown" ? "active" : ""} onClick={() => setTab("markdown")}><FileCode2 size={15} /> Markdown</button>
      <button className={tab === "json" ? "active" : ""} onClick={() => setTab("json")}><FileJson size={15} /> JSON</button>
    </div><div className="packet-actions"><button className="button button-secondary button-small" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button><button className="button button-primary button-small" onClick={download}><Download size={14} /> Export</button></div></div>
    {tab === "rendered" ? <div className="packet-document">
      <div className="packet-doc-top"><span className="eyebrow">VULNFLOW · INVESTIGATION PACKET</span><span className="packet-doc-id">{finding.id}</span></div>
      <h2>{finding.title}</h2><div className="packet-doc-meta"><span>{finding.repository}</span><code>{finding.commitSha.slice(0, 12)}…</code><span>{finding.severity} SEVERITY</span></div>
      <h3>Original report</h3><p>{finding.originalReport}</p>
      <h3>Evidence and verification</h3>
      {finding.claims.map((claim) => <div className="packet-claim" key={claim.id}><div className="packet-claim-head"><strong>{claim.title}</strong><span className="packet-status">{claim.status.replaceAll("_", " ")}</span></div><p>{claim.assertion}</p><div className="packet-reference"><code>{claim.filePath}:{claim.lineStart}-{claim.lineEnd}</code><span>{claim.functionName}</span></div><CodeSnippet lines={claim.snippet} startLine={claim.lineStart} compact /><p className="packet-reason">{claim.reason}</p></div>)}
      <h3>Missing evidence</h3><ul>{finding.missingEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
      <h3>Reviewer outcome</h3><p>{finding.decision || "Pending human review"} {finding.reviewerNotes ? `— ${finding.reviewerNotes}` : ""}</p>
      <div className="packet-disclaimer">Reference verification establishes source-reference consistency only. It does not prove exploitability. A changed code path does not prove remediation.</div>
      <button className="text-link" onClick={() => notify("Issue-tracker integration is not connected in this build.", "info")}>Push to Jira / GitHub Issue <ExternalLink size={14} /></button>
    </div> : <pre className="packet-raw">{raw}</pre>}
  </div>;
}