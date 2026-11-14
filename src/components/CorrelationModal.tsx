import { useState } from "react";
import { X, Link2, GitCompareArrows, CheckCircle2, FileCode2 } from "lucide-react";
import type { CorrelationCandidate, Finding } from "../types";
import { StatusBadge } from "./StatusBadge";
import { useToast } from "../context/ToastContext";

export function CorrelationModal({ pair, findings, onClose, onDecision }: {
  pair: CorrelationCandidate; findings: Finding[]; onClose: () => void;
  onDecision: (decision: "CONFIRMED_DUPLICATE" | "KEPT_SEPARATE") => Promise<void>;
}) {
  const { notify } = useToast();
  const left = findings.find((finding) => finding.id === pair.findingIds[0]);
  const right = findings.find((finding) => finding.id === pair.findingIds[1]);
  const [busy, setBusy] = useState(false);
  async function decide(decision: "CONFIRMED_DUPLICATE" | "KEPT_SEPARATE") {
    setBusy(true);
    try {
      await onDecision(decision);
      notify(decision === "CONFIRMED_DUPLICATE" ? "Relationship confirmed. Findings and evidence remain separate." : "Findings retained as separate reports.");
      onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save correlation decision.", "error");
    } finally { setBusy(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="correlation-title">
      <div className="modal-head"><div><span className="eyebrow">CORRELATION REVIEW / {pair.id}</span><h2 id="correlation-title">Compare candidate findings</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
      <div className="modal-overlap"><GitCompareArrows size={17} /><span>Shared references detected</span><strong>{pair.sharedFiles.join(", ") || "No shared file paths"}</strong></div>
      <div className="comparison-grid">
        {[left, right].map((finding, index) => <div className="comparison-column" key={finding?.id || index}>
          <span className="micro-label">REPORT 0{index + 1} · {finding?.id || pair.findingIds[index]}</span>
          <h3>{finding?.title || "Finding unavailable"}</h3>
          <p>{finding?.originalReport || "This finding is not in the current queue response."}</p>
          <div className="comparison-meta"><code>{finding?.repository || "Repository not loaded"}</code><code>{finding?.commitSha.slice(0, 12) || "—"}…</code></div>
          {finding?.claims[0] && <StatusBadge value={finding.claims[0].status} />}
        </div>)}
      </div>
      <div className="correlation-explanation"><strong>Why these reports may be related</strong><p>{pair.reasons.join(" ")}</p>{pair.sharedFunctions.length > 0 && <p className="shared-function-list"><FileCode2 size={14} /> {pair.sharedFunctions.join(" · ")}</p>}</div>
      <div className="modal-actions"><button className="button button-secondary" disabled={busy} onClick={() => void decide("KEPT_SEPARATE")}>Keep separate</button><button className="button button-primary" disabled={busy} onClick={() => void decide("CONFIRMED_DUPLICATE")}><Link2 size={16} /> Confirm relationship</button></div>
      <p className="modal-disclaimer"><CheckCircle2 size={14} /> Reviewer confirmation links evidence; it does not delete or merge reports.</p>
    </section>
  </div>;
}