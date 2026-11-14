import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Activity, AlertTriangle, ArrowUpRight, BadgeCheck, BookOpen, Braces, Check, CheckCircle2, ChevronRight, Clock3, FileCode2, FileSearch, GitBranch, GitCommitHorizontal, GitPullRequest, Layers3, ListFilter, Network, Plus, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Target, UploadCloud, XCircle, ArrowRight } from "lucide-react";
import { analyzeImpact, getCorrelations, getFinding, getFindings, getIssueDraft, getPacket, isDemoMode, submitCorrelationDecision, submitIntake, submitReview, updateLifecycle } from "../api/client";
import type { CorrelationCandidate, Finding, ImpactResult, ReviewDecision } from "../types";
import { useToast } from "../context/ToastContext";
import { IntakeForm } from "../components/IntakeForm";
import { ClaimMatrixCard } from "../components/ClaimMatrixCard";
import { StatusBadge } from "../components/StatusBadge";
import { CorrelationModal } from "../components/CorrelationModal";
import { ImpactTree } from "../components/ImpactTree";
import { PacketViewer } from "../components/PacketViewer";
import { CodeSnippet } from "../components/CodeSnippet";

function useFindings() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getFindings().then((data) => { if (active) { setFindings(data); setError(""); } })
      .catch((issue) => { if (active) { setFindings([]); setError(issue instanceof Error ? issue.message : "Could not load findings"); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { findings, setFindings, loading, error };
}
function PageHeading({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
function StatCard({ label, value, caption, icon: Icon, tone = "green" }: { label: string; value: string; caption: string; icon: typeof Activity; tone?: string }) {
  return <div className="stat-card"><div className={`stat-icon stat-${tone}`}><Icon size={18} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{caption}</small></div></div>;
}

export function OverviewPage() {
  const { findings, loading, error } = useFindings();
  const navigate = useNavigate();
  const verified = findings.flatMap((finding) => finding.claims).filter((claim) => claim.status === "VERIFIED_REFERENCE").length;
  const manual = findings.flatMap((finding) => finding.claims).filter((claim) => claim.status === "MANUAL_INVESTIGATION").length;
  const retest = isDemoMode ? 1 : 0;
  return <div className="page-stack">
    <PageHeading kicker="COMMAND CENTER / WORKSPACE OVERVIEW" title="Investigation overview" description="A traceable view of reported claims, source evidence, and reviewer actions." action={<Link className="button button-primary" to="/intake"><Plus size={16} /> New investigation</Link>} />
    <div className="overview-banner"><div className="banner-icon"><Activity size={20} /></div><div><strong>{isDemoMode ? "Local mock investigation" : "Evidence workbench"}</strong><p>Analysis is pinned to immutable commit references. Review every claim before treating it as actionable.</p></div><span className="banner-meta">{isDemoMode ? "LOCAL DEMO" : "CONNECTED API"}</span></div>
    <div className="stats-grid">
      <StatCard label="Total findings" value={loading ? "—" : String(findings.length).padStart(2, "0")} caption="Across loaded investigations" icon={Layers3} />
      <StatCard label={isDemoMode ? "Sample reference checks" : "Verified references"} value={loading ? "—" : String(verified).padStart(2, "0")} caption="Source references confirmed" icon={ShieldCheck} />
      <StatCard label="Manual review" value={loading ? "—" : String(manual).padStart(2, "0")} caption="Evidence gap or ambiguity" icon={Clock3} tone="amber" />
      <StatCard label="Retest triggers" value={isDemoMode ? "01" : "—"} caption={isDemoMode ? "Illustrative local demo" : "Run impact analysis"} icon={GitPullRequest} tone="red" />
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="overview-grid">
      <section className="panel findings-panel"><div className="panel-heading"><div><span className="eyebrow">ACTIVE INVESTIGATIONS</span><h2>Recent findings</h2></div><Link to="/review" className="text-link">Open review queue <ArrowUpRight size={14} /></Link></div>
        <div className="finding-table">
          <div className="table-head"><span>FINDING</span><span>SEVERITY</span><span>VERIFICATION</span><span>STATUS</span><span /></div>
          {findings.map((finding) => <button className="finding-row" key={finding.id} onClick={() => navigate(`/matrix/${finding.id}`)}><span className="finding-name"><strong>{finding.title}</strong><small>{finding.id} · {finding.category}</small></span><span><StatusBadge value={finding.severity} compact /></span><span><StatusBadge value={finding.claims[0]?.status || "MANUAL_INVESTIGATION"} compact /></span><span><StatusBadge value={finding.lifecycle} compact /></span><ChevronRight size={16} /></button>)}
          {!findings.length && <div className="empty-state">{loading ? "Loading findings…" : "No findings loaded. Start by submitting a report."}</div>}
        </div>
      </section>
      <section className="panel workflow-panel"><div className="panel-heading"><div><span className="eyebrow">WORKFLOW</span><h2>Investigation path</h2></div><span className="micro-tag">MVP</span></div>
        {[
          ["01", "Report intake", "Repository + commit + reports", "/intake", UploadCloud],
          ["02", "Evidence matrix", "Commit-locked source checks", findings[0] ? `/matrix/${findings[0].id}` : "/intake", FileSearch],
          ["03", "Correlation", "Explainable duplicate candidates", "/correlation", Network],
          ["04", "Human review", "Explicit reviewer decision", "/review", BadgeCheck],
          ["05", "Investigation packet", "Engineering-ready export", findings[0] ? `/packet/${findings[0].id}` : "/intake", BookOpen],
          ["06", "Impact analysis", "PR overlap and temporal diff", "/impact", GitPullRequest],
        ].map(([number, label, detail, to, Icon]) => {
          const ItemIcon = Icon as typeof Activity;
          return <Link className="workflow-step" to={String(to)} key={String(number)}><span className="workflow-number">{String(number)}</span><span className="workflow-icon"><ItemIcon size={16} /></span><span className="workflow-copy"><strong>{String(label)}</strong><small>{String(detail)}</small></span><ArrowUpRight size={15} /></Link>;
        })}
      </section>
    </div>
    <div className="bottom-note"><ShieldAlert size={16} /><span>VulnFlow verifies references and organizes evidence. It does not determine exploitability or automatically close findings.</span></div>
  </div>;
}

export function IntakePage() {
  const [busy, setBusy] = useState(false);
  const [analysisId, setAnalysisId] = useState("");
  const navigate = useNavigate();
  const { notify } = useToast();
  async function handleSubmit(payload: { repositoryUrl: string; commitSha: string; reports: Array<{ name: string; content: string; format?: "markdown" | "text" | "json" }> }) {
    setBusy(true);
    try {
      const result = await submitIntake(payload);
      setAnalysisId(result.analysisId);
      notify(isDemoMode ? `Local mock created ${result.findings.length} example findings; uploaded text was not independently analyzed.` : `Analysis complete · ${result.findings.length} findings created.`, isDemoMode ? "info" : "success");
      if (result.findings[0]) navigate(`/matrix/${result.findings[0].id}`);
    } catch (issue) {
      notify(issue instanceof Error ? issue.message : "Intake failed. Check the API connection.", "error");
    } finally { setBusy(false); }
  }
  return <div className="page-stack">
    <PageHeading kicker="INVESTIGATION / NEW ANALYSIS" title="Report intake" description="Anchor up to three existing vulnerability reports to one exact GitHub revision." action={<span className="step-indicator"><span>01</span> INTAKE</span>} />
    <div className="intake-layout">
      <div className="intake-main"><div className="panel form-panel"><IntakeForm onSubmit={handleSubmit} busy={busy} /></div>
        {busy && <div className="progress-panel"><div className="progress-top"><div><span className="eyebrow">ANALYSIS RUNNING</span><strong>Decomposing and verifying claims</strong><small className="progress-subtext">The API completes intake synchronously. This may take up to 180 seconds.</small></div><RefreshCw className="spin" size={18} /></div><div className="progress-track progress-indeterminate"><span /></div><div className="progress-steps"><span className="active"><Sparkles size={13} /> Claim extraction and deterministic source checks</span></div></div>}
        {analysisId && <p className="field-footnote">Last analysis ID: <code>{analysisId}</code></p>}
      </div>
      <aside className="intake-aside"><div className="aside-card aside-dark"><span className="eyebrow">PROCESSING CONTRACT</span><h3>One source of truth.</h3><p>Every claim is checked against the same immutable repository revision.</p><div className="aside-rule" /><div className="aside-metric"><strong>01</strong><span>GitHub repository</span></div><div className="aside-metric"><strong>01</strong><span>Exact commit SHA</span></div><div className="aside-metric"><strong>03</strong><span>Maximum reports</span></div></div><div className="aside-card"><span className="micro-label">WHAT HAPPENS NEXT</span><div className="aside-list"><span><i>01</i> AI extracts atomic claims</span><span><i>02</i> Backend checks source references</span><span><i>03</i> Reviewer inspects evidence</span></div></div><div className="aside-disclaimer"><ShieldCheck size={16} /><span>Reference verification does not prove exploitability. The original report is preserved.</span></div></aside>
    </div>
  </div>;
}

export function MatrixPage() {
  const { findingId = "VF-1042" } = useParams();
  const [finding, setFinding] = useState<Finding | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  useEffect(() => { let active = true; setLoading(true); getFinding(findingId).then((value) => active && setFinding(value)).catch(() => active && setFinding(null)).finally(() => active && setLoading(false)); return () => { active = false; }; }, [findingId]);
  if (loading) return <div className="loading-panel"><RefreshCw className="spin" /> Loading commit-locked evidence…</div>;
  if (!finding) return <div className="empty-state">Finding not found. <Link to="/review">Return to review queue</Link></div>;
  const claims = finding.claims.filter((claim) => filter === "ALL" || claim.status === filter);
  return <div className="page-stack">
    <PageHeading kicker="INVESTIGATION / SOURCE EVIDENCE" title="Claim evidence matrix" description="Each assertion is evaluated independently against the exact source revision." action={<Link className="button button-secondary" to={`/packet/${finding.id}`}><BookOpen size={15} /> View packet</Link>} />
    <div className="finding-context panel"><div className="finding-context-main"><div className="finding-title-line"><span className="finding-id">{finding.id}</span><StatusBadge value={finding.severity} /><StatusBadge value={finding.lifecycle} /></div><h2>{finding.title}</h2><p>{finding.repository}</p><div className="commit-context"><GitCommitHorizontal size={15} /><span>LOCKED COMMIT</span><code>{finding.commitSha}</code></div></div><div className="finding-context-side"><span className="micro-label">ORIGINAL REPORT</span><p>{finding.originalReport}</p><Link to={`/review/${finding.id}`} className="text-link">Review finding <ArrowUpRight size={14} /></Link></div></div>
    <div className="callout-banner"><ShieldCheck size={18} /><div><strong>{isDemoMode ? "Illustrative local evidence — not independently verified" : "Reference verification is not an exploitability verdict."}</strong><span>{isDemoMode ? "Sample references are prebuilt UI examples. Newly entered reports are not checked until you connect FastAPI." : "These checks establish whether source references are consistent at this SHA. They do not prove that the described behavior is reachable or exploitable."}</span></div></div>
    <div className="matrix-toolbar"><div><span className="eyebrow">ATOMIC CLAIMS</span><h2>{finding.claims.length} claims extracted</h2></div><div className="filter-tabs"><button className={filter === "ALL" ? "selected" : ""} onClick={() => setFilter("ALL")}>All <b>{finding.claims.length}</b></button><button className={filter === "VERIFIED_REFERENCE" ? "selected" : ""} onClick={() => setFilter("VERIFIED_REFERENCE")}>Verified</button><button className={filter === "INCONSISTENT_REFERENCE" ? "selected" : ""} onClick={() => setFilter("INCONSISTENT_REFERENCE")}>Inconsistent</button><button className={filter === "MANUAL_INVESTIGATION" ? "selected" : ""} onClick={() => setFilter("MANUAL_INVESTIGATION")}>Manual</button></div></div>
    <div className="claim-list">{claims.map((claim) => <ClaimMatrixCard key={claim.id} claim={claim} onReview={() => navigate(`/review/${finding.id}`)} />)}{!claims.length && <div className="empty-state">No claims match this verification filter.</div>}</div>
  </div>;
}

export function CorrelationPage() {
  const { findings } = useFindings();
  const [pairs, setPairs] = useState<CorrelationCandidate[]>([]);
  const [modalPair, setModalPair] = useState<CorrelationCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const { notify } = useToast();
  useEffect(() => {
    let active = true;
    const analysisIds = [...new Set(findings.map((finding) => finding.analysisId).filter(Boolean))];
    Promise.all(analysisIds.map((id) => getCorrelations(id))).then((groups) => { if (active) setPairs(groups.flat()); })
      .catch((issue) => { if (active) notify(issue instanceof Error ? issue.message : "Could not load correlation candidates.", "error"); })
      .finally(() => { if (active) setLoading(false); });
    if (!findings.length) setLoading(false);
    return () => { active = false; };
  }, [findings, notify]);
  async function decide(pair: CorrelationCandidate, decision: "CONFIRMED_DUPLICATE" | "KEPT_SEPARATE") {
    const analysisId = pair.analysisId || findings.find((finding) => pair.findingIds.includes(finding.id))?.analysisId || "";
    if (!analysisId) throw new Error("This correlation is not linked to an analysis.");
    await submitCorrelationDecision(analysisId, pair.id, decision);
    setPairs((current) => current.map((item) => item.id === pair.id ? { ...item, decision } : item));
  }
  return <div className="page-stack">
    <PageHeading kicker="INVESTIGATION / RELATIONSHIP ANALYSIS" title="Duplicate correlation" description="Inspect overlapping claims and decide whether findings should be linked. No automatic merging." />
    <div className="correlation-summary"><div><span className="eyebrow">CANDIDATE PAIRS</span><strong>{String(pairs.length).padStart(2, "0")}</strong><small>From stored analysis results</small></div><div><span className="eyebrow">PENDING REVIEW</span><strong>{String(pairs.filter((pair) => pair.decision === "PENDING").length).padStart(2, "0")}</strong><small>Awaiting human decision</small></div><div><span className="eyebrow">MERGE POLICY</span><strong>MANUAL</strong><small>Evidence is retained independently</small></div></div>
    {loading ? <div className="loading-panel"><RefreshCw className="spin" /> Loading correlation candidates…</div> : pairs.length ? pairs.map((pair) => {
      const left = findings.find((finding) => finding.id === pair.findingIds[0]);
      const right = findings.find((finding) => finding.id === pair.findingIds[1]);
      return <div className="panel candidate-panel" key={pair.id}>
        <div className="candidate-top"><div><span className="eyebrow">CANDIDATE PAIR / {pair.id}</span><h2>{pair.sharedFunctions.join(" · ") || pair.sharedFiles.join(" · ") || "Related source references"}</h2></div><span className="decision-state">{pair.decision === "PENDING" ? "AWAITING REVIEW" : pair.decision.replaceAll("_", " ")}</span></div>
        <div className="candidate-columns"><div className="candidate-card"><span className="micro-label">REPORT A · {left?.id || pair.findingIds[0]}</span><h3>{left?.title || "Finding not loaded"}</h3><p>{left?.originalReport || "No report detail available in this queue."}</p><div className="candidate-anchor"><FileCode2 size={15} /><code>{pair.sharedFiles.join(", ") || "No shared file path"}</code></div></div><div className="candidate-vs">VS</div><div className="candidate-card"><span className="micro-label">REPORT B · {right?.id || pair.findingIds[1]}</span><h3>{right?.title || "Finding not loaded"}</h3><p>{right?.originalReport || "No report detail available in this queue."}</p><div className="candidate-anchor"><FileCode2 size={15} /><code>{pair.sharedFunctions.join(", ") || pair.sharedFiles.join(", ") || "No shared function"}</code></div></div></div>
        <div className="overlap-reasons"><strong><Network size={15} /> MATCH EXPLANATION</strong><span>{pair.reasons.join(" ")}</span></div>
        <div className="candidate-actions"><div>{pair.decision === "PENDING" ? <span className="pending-decision"><Clock3 size={14} /> Awaiting decision</span> : <strong className="decision-state">{pair.decision.replaceAll("_", " ")}</strong>}</div><button className="button button-secondary" disabled={pair.decision !== "PENDING"} onClick={() => void decide(pair, "KEPT_SEPARATE").then(() => notify("Findings retained separately." )).catch((error) => notify(error.message, "error"))}>Keep separate</button><button className="button button-primary" disabled={pair.decision !== "PENDING"} onClick={() => setModalPair(pair)}><GitBranch size={15} /> Review pair</button></div>
      </div>;
    }) : <div className="panel empty-state">No correlation candidates were returned for the loaded analyses.</div>}
    <div className="bottom-note"><ShieldAlert size={16} /><span>Correlation suggests relationships; reviewers decide whether findings share a root cause. Confirmation links evidence and does not delete or merge findings.</span></div>
    {modalPair && <CorrelationModal pair={modalPair} findings={findings} onClose={() => setModalPair(null)} onDecision={(decision) => decide(modalPair, decision)} />}
  </div>;
}

export function ReviewPage() {
  const { findingId } = useParams();
  const { findings, setFindings, loading } = useFindings();
  const [selected, setSelected] = useState<Finding | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { notify } = useToast();
  useEffect(() => {
    if (findingId) {
      getFinding(findingId).then((finding) => { setSelected(finding); setNotes(finding.reviewerNotes || ""); }).catch(() => setSelected(null));
    } else if (findings.length) {
      setSelected((current) => current || findings[0]);
      setNotes((current) => current || findings[0].reviewerNotes || "");
    }
  }, [findingId, findings]);
  async function decide(decision: ReviewDecision) {
    if (!selected) return;
    if (!notes.trim()) { notify("Reviewer notes are required for every decision.", "error"); return; }
    setSubmitting(true);
    try {
      const updated = await submitReview(selected.id, { decision, notes });
      setSelected(updated);
      setFindings((current) => current.map((item) => item.id === updated.id ? updated : item));
      notify(decision === "APPROVED" ? "Finding approved and marked validated." : decision === "REJECTED" ? "Finding rejected; lifecycle remains under investigation." : "More evidence requested.");
    } catch (error) { notify(error instanceof Error ? error.message : "Review submission failed.", "error"); }
    finally { setSubmitting(false); }
  }
  async function markResolved() {
    if (!selected) return;
    if (!notes.trim()) { notify("Record the retest evidence in reviewer notes before resolving.", "error"); return; }
    setSubmitting(true);
    try {
      const updated = await updateLifecycle(selected.id, "Resolved", notes.trim());
      setSelected(updated);
      setFindings((current) => current.map((item) => item.id === updated.id ? updated : item));
      notify("Finding lifecycle moved to Resolved.");
    } catch (error) { notify(error instanceof Error ? error.message : "Lifecycle update failed.", "error"); }
    finally { setSubmitting(false); }
  }
  if (loading) return <div className="loading-panel"><RefreshCw className="spin" /> Loading review queue…</div>;
  return <div className="page-stack">
    <PageHeading kicker="INVESTIGATION / REVIEW GATE" title="Human review queue" description="A reviewer owns every disposition. AI extraction and source checks do not make final decisions." />
    <div className="review-layout">
      <section className="panel review-queue"><div className="panel-heading"><div><span className="eyebrow">INCOMING FINDINGS</span><h2>Review queue <span className="count-pill">{findings.length}</span></h2></div><ListFilter size={17} /></div>
        {findings.map((finding) => <button className={`review-queue-item ${selected?.id === finding.id ? "active" : ""}`} key={finding.id} onClick={() => { setSelected(finding); setNotes(finding.reviewerNotes || ""); navigate(`/review/${finding.id}`, { replace: true }); }}><div className="review-queue-item-top"><span className="finding-id">{finding.id}</span><StatusBadge value={finding.severity} compact /></div><strong>{finding.title}</strong><div className="review-queue-item-foot"><StatusBadge value={finding.lifecycle} compact /><span>{finding.createdAt}</span></div></button>)}
        {!findings.length && <div className="empty-state">No findings available to review.</div>}
      </section>
      <section className="panel review-detail">
        {selected ? <>
          <div className="review-detail-head"><div><span className="eyebrow">REVIEW DETAIL / {selected.id}</span><h2>{selected.title}</h2><p>{selected.repository} · <code>{selected.commitSha.slice(0, 12)}…</code></p></div><StatusBadge value={selected.lifecycle} /></div>
          <div className="review-evidence"><div className="review-evidence-head"><strong>Evidence snapshot</strong><StatusBadge value={selected.claims[0]?.status || "MANUAL_INVESTIGATION"} compact /></div><p>{selected.claims[0]?.assertion || "No structured claim was returned."}</p><div className="review-reference"><FileCode2 size={15} /><code>{selected.claims[0]?.filePath}:{selected.claims[0]?.lineStart}-{selected.claims[0]?.lineEnd}</code><span>{selected.claims[0]?.functionName}</span></div></div>
          <label className="field-label" htmlFor="review-notes">Reviewer notes <span className="field-hint">REQUIRED AUDIT TRAIL</span></label><textarea id="review-notes" className="review-notes" rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record what was verified, which assumptions remain, and what evidence is needed…" />
          <div className="review-note-hint">Notes are stored with this review decision. They are not automatically used to train a model.</div>
          <div className="review-actions"><button disabled={submitting || !notes.trim()} className="button button-danger-outline" onClick={() => void decide("REJECTED")}><XCircle size={16} /> Reject</button><button disabled={submitting || !notes.trim()} className="button button-secondary" onClick={() => void decide("MORE_EVIDENCE")}><AlertTriangle size={16} /> Request more evidence</button><button disabled={submitting || !notes.trim()} className="button button-primary" onClick={() => void decide("APPROVED")}><CheckCircle2 size={16} /> Approve finding</button></div>
          {selected.decision && <div className="last-decision"><CheckCircle2 size={15} /> Last decision: <strong>{selected.decision.replaceAll("_", " ")}</strong></div>}
          {selected.lifecycle === "VALIDATED" && <button disabled={submitting || !notes.trim()} className="button button-secondary resolved-action" onClick={() => void markResolved()}><CheckCircle2 size={15} /> Mark resolved after retest</button>}
        </> : <div className="empty-state">Select a finding to review.</div>}
      </section>
    </div>
  </div>;
}

export function PacketPage() {
  const { findingId = "VF-1042" } = useParams();
  const [packet, setPacket] = useState<Awaited<ReturnType<typeof getPacket>> | null>(null);
  const [issueDraft, setIssueDraft] = useState<Awaited<ReturnType<typeof getIssueDraft>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    Promise.all([getPacket(findingId), getIssueDraft(findingId)]).then(([packetData, draft]) => {
      if (active) { setPacket(packetData); setIssueDraft(draft); }
    }).catch((issue) => { if (active) setError(issue instanceof Error ? issue.message : "Packet could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [findingId]);
  return <div className="page-stack">
    <PageHeading kicker="INVESTIGATION / ENGINEERING HANDOFF" title="Investigation packet" description="A portable, evidence-linked record for the engineering team." action={<span className="export-format-pill"><Braces size={14} /> MARKDOWN / JSON</span>} />
    {loading ? <div className="loading-panel"><RefreshCw className="spin" /> Building investigation packet…</div> : packet ? <><div className="packet-context"><div><span className="eyebrow">PACKET PREVIEW</span><strong>{packet.finding.id} · {packet.finding.repository}</strong></div><StatusBadge value={packet.finding.lifecycle} /></div><div className="callout-banner"><ShieldCheck size={17} /><div><strong>Packet warning</strong><span>{packet.warning}</span></div></div><PacketViewer finding={packet.finding} relatedReports={packet.relatedReports} packetMarkdown={packet.markdown} issueDraft={issueDraft} /></> : <div className="empty-state">{error || "Finding not found."} <Link to="/review">Open review queue</Link></div>}
  </div>;
}

export function ImpactPage() {
  const { findings } = useFindings();
  const analysisIds = useMemo(() => [...new Set(findings.map((finding) => finding.analysisId).filter(Boolean))], [findings]);
  const [analysisId, setAnalysisId] = useState("");
  const [reference, setReference] = useState(isDemoMode ? "DEMO" : "HEAD");
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [diffMode, setDiffMode] = useState<"split" | "timeline">("split");
  const [selectedImpactKey, setSelectedImpactKey] = useState("");
  const { notify } = useToast();
  const selectedImpact = result?.impacts.find((item) => `${item.findingId}:${item.claimId}` === selectedImpactKey) || result?.impacts[0];
  useEffect(() => {
    setSelectedImpactKey("");
    setResult(null);
  }, [analysisId]);
  useEffect(() => {
    if (!analysisId && analysisIds.length) setAnalysisId(analysisIds[0]);
  }, [analysisIds, analysisId]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!analysisId) return setError("Submit an intake analysis before comparing a later revision.");
    const isPr = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/[1-9][0-9]*\/?$/.test(reference.trim());
    const isRef = /^[A-Za-z0-9._/-]{1,200}$/.test(reference.trim()) && !reference.includes("..");
    if (!isPr && !isRef) return setError("Enter a GitHub pull request URL, branch, tag or commit SHA.");
    setError(""); setBusy(true);
    try {
      const next = await analyzeImpact(isPr ? { analysisId, pullRequestUrl: reference.trim() } : { analysisId, commitSha: reference.trim() });
      setResult(next);
      notify(isDemoMode ? "Local preview only; no GitHub change was checked." : "Impact analysis updated. Review retest and manual-mapping flags.", isDemoMode ? "info" : "success");
    } catch (issue) { notify(issue instanceof Error ? issue.message : "Impact analysis failed.", "error"); }
    finally { setBusy(false); }
  }
  return <div className="page-stack">
    <PageHeading kicker="CONTINUOUS / PATCH INTELLIGENCE" title="Patch-to-finding impact" description="Compare a later PR or commit with historical evidence and identify claims that need retesting." />
    <form className="impact-input-panel panel" onSubmit={submit}>
      <div className="impact-input-copy"><span className="eyebrow">CHANGESET TARGET</span><strong>Which revision changed?</strong><small>{isDemoMode ? "Use DEMO for the illustrative stored fixture. Other revisions are not checked offline." : "Use a PR URL or branch, tag or commit ref (for example HEAD)."}</small></div>
      <div className="impact-input-control">
        <label className="field-label" htmlFor="impact-analysis">Source analysis</label>
        <select id="impact-analysis" className="impact-select" value={analysisId} onChange={(event) => setAnalysisId(event.target.value)} disabled={!analysisIds.length}>
          {analysisIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <label className="field-label" htmlFor="impact-target">PR URL or new revision</label>
        <div className="input-with-icon"><GitPullRequest size={17} /><input id="impact-target" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="PR URL, HEAD, branch, tag or SHA" /></div>
        {error && <span className="field-error">{error}</span>}
      </div>
      <button className="button button-primary" disabled={busy || !analysisIds.length}>{busy ? <RefreshCw className="spin" size={16} /> : <Target size={16} />}{busy ? "Analyzing…" : "Analyze impact"}</button>
    </form>
    {result ? <>
      <div className="impact-context-note"><span>ORIGINAL <code>{result.originalCommitSha.slice(0, 12)}…</code></span><ArrowRight size={14} /><span>CURRENT <code>{result.currentCommitSha.slice(0, 12)}…</code></span><span className="impact-scope">{result.changedFilesScope.replaceAll("_", " ").toUpperCase()} SCOPE</span></div>
      <div className="impact-summary-grid"><StatCard label="Referenced files changed" value={String(result.changedFiles.length).padStart(2, "0")} caption="Not a complete PR file inventory" icon={FileCode2} /><StatCard label="Linked findings" value={String(new Set(result.changedFiles.flatMap((file) => file.linkedFindingIds)).size).padStart(2, "0")} caption="Historical evidence overlaps" icon={ShieldCheck} /><StatCard label="Retest required" value={String(result.impacts.filter((item) => item.flag === "RETEST_REQUIRED").length).padStart(2, "0")} caption="Per-claim retest flags" icon={GitPullRequest} tone="amber" /></div>
      <section className="panel impact-graph-panel"><div className="panel-heading"><div><span className="eyebrow">CHANGE BLAST RADIUS</span><h2>Impact map</h2></div><span className="impact-legend"><i /> Retest / manual mapping</span></div><ImpactTree result={result} findings={findings} /></section>
      <section className="panel temporal-panel"><div className="panel-heading"><div><span className="eyebrow">FEATURE 06 / HISTORICAL EVIDENCE</span><h2>Temporal evidence diff</h2></div><div className="filter-tabs"><button className={diffMode === "split" ? "selected" : ""} onClick={() => setDiffMode("split")}>Side by side</button><button className={diffMode === "timeline" ? "selected" : ""} onClick={() => setDiffMode("timeline")}>Timeline</button></div></div>
        {result.impacts.length > 0 && <div className="impact-claim-picker">
          <label className="field-label" htmlFor="impact-claim">Affected claim ({result.impacts.length} total)</label>
          <select
            id="impact-claim"
            className="impact-select"
            value={selectedImpact ? `${selectedImpact.findingId}:${selectedImpact.claimId}` : ""}
            onChange={(event) => setSelectedImpactKey(event.target.value)}
          >
            {result.impacts.map((item) => <option
              key={`${item.findingId}:${item.claimId}`}
              value={`${item.findingId}:${item.claimId}`}
            >{`${item.findingId} · ${item.claimId} · ${item.filePath || "Unmapped"} · ${item.flag.replaceAll("_", " ")}`}</option>)}
          </select>
        </div>}
        {diffMode === "split" ? selectedImpact ? <div className="diff-grid">
          <div className="diff-column"><div className="diff-column-head"><span>ORIGINAL EVIDENCE</span><code>{result.originalCommitSha.slice(0, 12)}</code></div><CodeSnippet lines={selectedImpact.original} /></div>
          <div className="diff-column"><div className="diff-column-head"><span>CURRENT EVIDENCE</span><code>{result.currentCommitSha.slice(0, 12)}</code></div><CodeSnippet lines={selectedImpact.current} /></div>
          <div className="diff-explanation"><StatusBadge value={selectedImpact.flag === "RETEST_REQUIRED" ? "RETEST_REQUIRED" : selectedImpact.flag === "MANUAL_MAPPING_REQUIRED" ? "MANUAL_INVESTIGATION" : "SEPARATE"} /><strong>{selectedImpact.filePath || "Unmapped source"} · {selectedImpact.claimId}</strong><p>{selectedImpact.reason}</p><pre>{selectedImpact.diff || "No textual diff returned."}</pre></div>
        </div> : <div className="empty-state">No claim-level impacts were returned for this revision.</div> : <div className="temporal-timeline">
          <div className="timeline-item"><span className="timeline-dot done" /><div><strong>Original evidence preserved</strong><small>{result.originalCommitSha} · Claims remain anchored to this revision</small></div></div>
          {result.impacts.map((impact) => <div className="timeline-item" key={`${impact.findingId}:${impact.claimId}`}><span className={`timeline-dot ${impact.flag === "RETEST_REQUIRED" ? "warning" : "done"}`} /><div><strong>{impact.filePath || "Unmapped reference"} · {impact.claimId}</strong><small>{impact.reason}</small></div><StatusBadge value={impact.flag === "RETEST_REQUIRED" ? "RETEST_REQUIRED" : impact.flag === "MANUAL_MAPPING_REQUIRED" ? "MANUAL_INVESTIGATION" : "SEPARATE"} compact /></div>)}
          <div className="timeline-item"><span className="timeline-dot" /><div><strong>Reviewer reassessment</strong><small>Historical review decisions remain unchanged until a reviewer acts.</small></div><span className="pending-decision">PENDING</span></div>
        </div>}
      </section>
    </> : <div className="panel empty-state">{analysisIds.length ? "Submit a PR, branch or later commit to compare it with stored findings." : "Run Report Intake first. Impact analysis requires an analysis ID and its stored evidence."}</div>}
    <div className="bottom-note"><AlertTriangle size={16} /><span>{result?.warning || "Code changes never automatically resolve findings."} Findings remain open until a reviewer reassesses the evidence.</span></div>
  </div>;
}
