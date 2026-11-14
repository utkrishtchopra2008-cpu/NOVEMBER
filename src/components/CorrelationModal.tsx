import { X, Link2, GitCompareArrows, CheckCircle2 } from "lucide-react";
import type { Finding } from "../types";
import { StatusBadge } from "./StatusBadge";
import { useToast } from "../context/ToastContext";

export function CorrelationModal({ findings, onClose, onDecision }: { findings: Finding[]; onClose: () => void; onDecision: (decision: "linked" | "separate") => void }) {
  const { notify } = useToast();
  const first = findings[0];
  const second = findings[1];
  function decide(decision: "linked" | "separate") {
    onDecision(decision);
    notify(decision === "linked" ? "Reports linked as a reviewer-confirmed relationship." : "Reports retained as separate findings.", "success");
    onClose();
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="correlation-title">
      <div className="modal-head"><div><span className="eyebrow">CORRELATION REVIEW</span><h2 id="correlation-title">Compare candidate findings</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
      <div className="modal-overlap"><GitCompareArrows size={17} /><span>Shared code anchor detected</span><strong>auth.py · lookup_user</strong></div>
      <div className="comparison-grid">
        {[first, second].map((finding, index) => <div className="comparison-column" key={finding.id}><span className="micro-label">REPORT 0{index + 1} · {finding.id}</span><h3>{finding.title}</h3><p>{finding.originalReport}</p><div className="comparison-meta"><code>{finding.repository}</code><code>{finding.commitSha.slice(0, 12)}…</code></div><StatusBadge value={finding.claims[0].status} /></div>)}
      </div>
      <div className="correlation-explanation"><strong>Why these reports may be related</strong><p>Both reports reference the same authentication component and overlap on the <code>lookup_user</code> code path. Similarity is a candidate signal only; separate evidence is preserved either way.</p></div>
      <div className="modal-actions"><button className="button button-secondary" onClick={() => decide("separate")}>Keep separate</button><button className="button button-primary" onClick={() => decide("linked")}><Link2 size={16} /> Confirm relationship</button></div>
      <p className="modal-disclaimer"><CheckCircle2 size={14} /> Human confirmation required. No automatic merging occurs.</p>
    </section>
  </div>;
}