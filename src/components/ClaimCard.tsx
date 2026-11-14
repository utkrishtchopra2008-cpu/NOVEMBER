import { ArrowUpRight, FileCode2, Info, ShieldCheck, RefreshCw } from "lucide-react";
import type { Claim } from "../types";
import { StatusBadge } from "./StatusBadge";
import { CodeSnippet } from "./CodeSnippet";

export function ClaimCard({ claim, onReview, onSandboxCheck, sandboxBusy, sandboxStatus, sandboxMessage }: { claim: Claim; onReview?: () => void; onSandboxCheck?: () => void; sandboxBusy?: boolean; sandboxStatus?: string; sandboxMessage?: string }) {
  return <article className="claim-card">
    <div className="claim-card-top">
      <div><div className="eyebrow">{claim.id}</div><h3>{claim.title}</h3></div>
      <StatusBadge value={claim.status} />
    </div>
    <div className="claim-compare">
      <div><span className="micro-label">ORIGINAL EXCERPT</span><p className="quoted-text">“{claim.excerpt}”</p></div>
      <div><span className="micro-label">STRUCTURED ASSERTION</span><p>{claim.assertion}</p></div>
    </div>
    <div className="claim-anchor">
      <span className="anchor-icon"><FileCode2 size={16} /></span>
      <div><strong>{claim.filePath}</strong><span>{claim.functionName} · lines {claim.lineStart}–{claim.lineEnd}</span></div>
      {claim.sourceUrl?.startsWith("https://github.com/") ? <a className="text-link" href={claim.sourceUrl} target="_blank" rel="noreferrer">Open pinned source <ArrowUpRight size={14} /></a> : <button className="text-link" onClick={onReview}>Inspect <ArrowUpRight size={14} /></button>}
    </div>
    <CodeSnippet lines={claim.snippet} startLine={claim.lineStart} compact />
    <div className="claim-reason"><Info size={15} /><span>{claim.reason}</span></div>
    {claim.missingEvidence?.length ? <div className="missing-inline"><span className="micro-label">MISSING EVIDENCE</span>{claim.missingEvidence.join(" · ")}</div> : null}
    {onSandboxCheck && <div className="sandbox-check-row"><button className="button button-secondary button-small" onClick={onSandboxCheck} disabled={sandboxBusy}>{sandboxBusy ? <RefreshCw className="spin" size={14} /> : <ShieldCheck size={14} />}{sandboxBusy ? "Checking in Maritime…" : "Run isolated syntax check"}</button><span>{sandboxMessage || "Parses the pinned Python source only; does not run repository code or verify exploitability."}</span>{sandboxStatus && <strong className={sandboxStatus === "PASSED" ? "sandbox-passed" : "sandbox-failed"}>{sandboxStatus}</strong>}</div>}
  </article>;
}
