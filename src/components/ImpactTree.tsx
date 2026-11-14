import { ArrowDown, FileCode2, GitPullRequest, GitCommitHorizontal, ShieldCheck } from "lucide-react";
import type { Finding, ImpactResult } from "../types";
import { StatusBadge } from "./StatusBadge";

export function ImpactTree({ result, findings }: { result: ImpactResult; findings: Finding[] }) {
  return <div className="impact-tree">
    <div className="impact-node impact-root"><div className="impact-node-icon"><GitPullRequest size={18} /></div><div><span className="micro-label">CHANGESET UNDER REVIEW</span><strong>{result.reference}</strong><small>{result.summary}</small></div><StatusBadge value="RETEST_REQUIRED" /></div>
    <div className="impact-connector"><ArrowDown size={16} /></div>
    <div className="impact-children">
      {result.changedFiles.map((file) => {
        const linked = findings.filter((finding) => file.linkedFindingIds.includes(finding.id));
        return <div className="impact-file-group" key={file.path}>
          <div className="impact-file"><FileCode2 size={17} /><strong>{file.path}</strong><span className="change-count">{file.changes} changed lines</span><span className={file.retestRequired ? "file-impact warning" : "file-impact muted"}>{file.retestRequired ? "RETEST" : "NO OVERLAP"}</span></div>
          {linked.length > 0 ? <div className="impact-linked">{linked.map((finding) => <div className="impact-finding" key={finding.id}><span className="impact-link-stem" /><div className="impact-finding-icon"><ShieldCheck size={15} /></div><div className="impact-finding-copy"><strong>{finding.id} · {finding.title}</strong><small>{finding.claims[0]?.filePath} · {finding.claims[0]?.functionName}</small></div><StatusBadge value={file.retestRequired ? "RETEST_REQUIRED" : "SEPARATE"} compact /></div>)}</div> : <div className="impact-empty"><GitCommitHorizontal size={14} /> No stored findings matched this file.</div>}
        </div>;
      })}
    </div>
    <div className="impact-footnote"><ShieldCheck size={15} /><span>Code overlap triggers reassessment only. A patch never automatically marks a finding resolved.</span></div>
  </div>;
}