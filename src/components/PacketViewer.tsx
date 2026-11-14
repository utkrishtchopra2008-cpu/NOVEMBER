import { useMemo, useState } from "react";
import { Copy, Download, FileCode2, FileJson, FileText, Check, ExternalLink } from "lucide-react";
import type { CorrelationCandidate, Finding, IssueDraft } from "../types";
import { useToast } from "../context/ToastContext";
import { CodeSnippet } from "./CodeSnippet";

function buildMarkdown(finding: Finding, relatedReports: CorrelationCandidate[]) {
  return `# ${finding.title}\n\n**Finding:** ${finding.id}  \n**Severity:** ${finding.severity}  \n**Status:** ${finding.lifecycle}  \n**Repository:** ${finding.repository}  \n**Commit:** \`${finding.commitSha}\`\n\n## Original report\n\n${finding.originalReport}\n\n## Business impact\n\n${finding.businessImpact || "Requires reviewer assessment"}\n\n## Related reports\n\n${relatedReports.map((pair) => `- ${pair.id}: ${pair.findingIds.join(", ")} — ${pair.reasons.join(" ")}`).join("\n") || "- No related reports recorded"}\n\n## Claims and verification\n\n${finding.claims.map((claim) => `### ${claim.id} — ${claim.title}\n\n- **Status:** ${claim.status}\n- **Reference:** \`${claim.filePath}:${claim.lineStart}-${claim.lineEnd}\`\n- **Function:** \`${claim.functionName}\`\n- **Assertion:** ${claim.assertion}\n- **Reason:** ${claim.reason}\n\n\`\`\`text\n${claim.snippet.join("\n")}\n\`\`\`\n`).join("\n")}\n## Missing evidence\n\n${finding.missingEvidence.map((item) => `- ${item}`).join("\n") || "- None recorded"}\n\n## Investigation steps\n\n${(finding.investigationSteps || []).map((item) => `- ${item}`).join("\n") || "- No investigation steps recorded"}\n\n## Reviewer decision\n\n${finding.decision || "Pending review"}\n\n${finding.reviewerNotes || "No reviewer notes recorded."}\n\n---\n*Reference verification does not establish exploitability. Code changes do not establish remediation.*\n`;
}
export function PacketViewer({ finding, relatedReports = [], packetMarkdown, issueDraft }: { finding: Finding; relatedReports?: CorrelationCandidate[]; packetMarkdown?: string; issueDraft?: IssueDraft | null }) {
  const [tab, setTab] = useState<"rendered" | "markdown" | "json">("rendered");
  const [copied, setCopied] = useState(false);
  const { notify } = useToast();
  const markdown = useMemo(() => packetMarkdown || buildMarkdown(finding, relatedReports), [finding, packetMarkdown, relatedReports]);
  const json = useMemo(() => JSON.stringify({ finding, relatedReports, packetVersion: "1.0", evidenceDisclaimer: "Reference verification does not establish exploitability." }, null, 2), [finding, relatedReports]);
  const raw = tab === "json" ? json : markdown;
  async function copy(text = raw, success = "Packet copied to clipboard.") {
    try { await navigator.clipboard.writeText(text); setCopied(true); notify(success); window.setTimeout(() => setCopied(false), 1500); }
    catch { notify("Clipboard access was unavailable.", "error"); }
  }
  function download() {
    const blob = new Blob([tab === "json" ? json : markdown], { type: tab === "json" ? "application/json" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${finding.id}-investigation.${tab === "json" ? "json" : "md"}`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Investigation packet exported.");
  }
  async function prepareIssue() {
    if (!issueDraft) { notify("Issue draft is not available yet.", "info"); return; }
    if (issueDraft.githubUrl) {
      window.open(issueDraft.githubUrl, "_blank", "noopener,noreferrer");
      notify("Review the prepared issue in GitHub and submit it there.");
    } else if (issueDraft.body) {
      await copy(issueDraft.body, "Issue draft copied. No ticket was created.");
    } else notify(issueDraft.message, "info");
  }
  return <div className="packet-viewer">
    <div className="packet-toolbar"><div className="packet-tabs">
      <button className={tab === "rendered" ? "active" : ""} onClick={() => setTab("rendered")}><FileText size={15} /> Rendered</button>
      <button className={tab === "markdown" ? "active" : ""} onClick={() => setTab("markdown")}><FileCode2 size={15} /> Markdown</button>
      <button className={tab === "json" ? "active" : ""} onClick={() => setTab("json")}><FileJson size={15} /> JSON</button>
    </div><div className="packet-actions"><button className="button button-secondary button-small" onClick={() => void copy()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button><button className="button button-primary button-small" onClick={download}><Download size={14} /> Export</button></div></div>
    {tab === "rendered" ? <div className="packet-document">
      <div className="packet-doc-top"><span className="eyebrow">VULNFLOW · INVESTIGATION PACKET</span><span className="packet-doc-id">{finding.id}</span></div>
      <h2>{finding.title}</h2><div className="packet-doc-meta"><span>{finding.repository}</span><code>{finding.commitSha.slice(0, 12)}…</code><span>{finding.severity} SEVERITY</span></div>
      <h3>Original report</h3><p>{finding.originalReport}</p>
      <h3>Business impact</h3><p>{finding.businessImpact || "Requires reviewer assessment."}</p>\n      <h3>Related reports</h3>{relatedReports.length ? <ul>{relatedReports.map((pair) => <li key={pair.id}><strong>{pair.id}</strong> · {pair.findingIds.join(", ")} — {pair.reasons.join(" ")}</li>)}</ul> : <p>No related reports recorded.</p>}\n      <h3>Evidence and verification</h3>
      {finding.claims.map((claim) => <div className="packet-claim" key={claim.id}><div className="packet-claim-head"><strong>{claim.title}</strong><span className="packet-status">{claim.status.replaceAll("_", " ")}</span></div><p>{claim.assertion}</p><div className="packet-reference"><code>{claim.filePath}:{claim.lineStart}-{claim.lineEnd}</code><span>{claim.functionName}</span></div><CodeSnippet lines={claim.snippet} startLine={claim.lineStart} compact /><p className="packet-reason">{claim.reason}</p></div>)}
      <h3>Missing evidence</h3><ul>{finding.missingEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
      <h3>Investigation steps</h3><ul>{(finding.investigationSteps || []).map((item) => <li key={item}>{item}</li>)}</ul>
      <h3>Reviewer outcome</h3><p>{finding.decision || "Pending human review"} {finding.reviewerNotes ? `— ${finding.reviewerNotes}` : ""}</p>
      <div className="packet-disclaimer">Reference verification establishes source-reference consistency only. It does not prove exploitability. A changed code path does not prove remediation.</div>
      <button className="button button-secondary button-small" onClick={() => void prepareIssue()}>Prepare issue draft <ExternalLink size={14} /></button>
      {issueDraft && <p className="packet-reason">{issueDraft.message}</p>}
    </div> : <pre className="packet-raw">{raw}</pre>}
  </div>;
}