import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Activity, AlertTriangle, ArrowUpRight, BadgeCheck, BookOpen, Braces, Check, CheckCircle2, ChevronRight, Clock3, FileCode2, FileSearch, GitBranch, GitCommitHorizontal, GitPullRequest, Layers3, ListFilter, Network, Plus, RefreshCw, ShieldAlert, ShieldCheck, Sparkles, Target, UploadCloud, XCircle } from "lucide-react";
import { analyzeImpact, getFinding, getFindings, submitIntake, submitReview } from "../api/client";
import { DEMO_SHA } from "../data/demo";
import type { Finding, ImpactResult, ReviewDecision, ReviewPayload } from "../types";
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
  useEffect(() => { let active = true; getFindings().then((data) => { if (active) setFindings(data); }).catch(() => { if (active) setFindings([]); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  return { findings, setFindings, loading };
}
function PageHeading({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
function StatCard({ label, value, caption, icon: Icon, tone = "green" }: { label: string; value: string; caption: string; icon: typeof Activity; tone?: string }) {
  return <div className="stat-card"><div className={`stat-icon stat-${tone}`}><Icon size={18} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{caption}</small></div></div>;
}

export function OverviewPage() {
  const { findings, loading } = useFindings();
  const navigate = useNavigate();
  const verified = findings.flatMap((f) => f.claims).filter((c) => c.status === "VERIFIED_REFERENCE").length;
  const manual = findings.flatMap((f) => f.claims).filter((c) => c.status === "MANUAL_INVESTIGATION").length;
  return <div className="page-stack">
    <PageHeading kicker="COMMAND CENTER / WORKSPACE OVERVIEW" title="Investigation overview" description="A traceable view of reported claims, source evidence, and reviewer actions." action={<Link className="button button-primary" to="/intake"><Plus size={16} /> New investigation</Link>} />
    <div className="overview-banner"><div className="banner-icon"><Activity size={20} /></div><div><strong>Evidence engine operational</strong><p>Analysis is pinned to immutable commit references. Review every claim before treating it as actionable.</p></div><span className="banner-meta">WORKSPACE / ACME</span></div>
    <div className="stats-grid">
      <StatCard label="Total findings" value={loading ? "—" : String(findings.length).padStart(2, "0")} caption="Across active investigations" icon={Layers3} />
      <StatCard label="Verified references" value={loading ? "—" : String(verified).padStart(2, "0")} caption="Source references confirmed" icon={ShieldCheck} />
      <StatCard label="Manual review" value={loading ? "—" : String(manual).padStart(2, "0")} caption="Evidence gap or ambiguity" icon={Clock3} tone="amber" />
      <StatCard label="Retest triggers" value="01" caption="From latest demo changeset" icon={GitPullRequest} tone="red" />
    </div>
    <div className="overview-grid">
      <section className="panel findings-panel"><div className="panel-heading"><div><span className="eyebrow">ACTIVE INVESTIGATIONS</span><h2>Recent findings</h2></div><Link to="/review" className="text-link">Open review queue <ArrowUpRight size={14} /></Link></div>
        <div className="finding-table">
          <div className="table-head"><span>FINDING</span><span>SEVERITY</span><span>VERIFICATION</span><span>STATUS</span><span /></div>
          {findings.map((finding) => <button className="finding-row" key={finding.id} onClick={() => navigate(`/matrix/${finding.id}`)}><span className="finding-name"><strong>{finding.title}</strong><small>{finding.id} · {finding.category}</small></span><span><StatusBadge value={finding.severity} compact /></span><span><StatusBadge value={finding.claims[0].status} compact /></span><span><StatusBadge value={finding.lifecycle} compact /></span><ChevronRight size={16} /></button>)}
          {!findings.length && <div className="empty-state">No findings yet. Start by submitting a report.</div>}
        </div>
      </section>
      <section className="panel workflow-panel"><div className="panel-heading"><div><span className="eyebrow">WORKFLOW</span><h2>Investigation path</h2></div><span className="micro-tag">MVP</span></div>
        {[
          ["01", "Report intake", "Repository + commit + reports", "/intake", UploadCloud],
          ["02", "Evidence matrix", "Commit-locked source checks", "/matrix/VF-1042", FileSearch],
          ["03", "Correlation", "Explainable duplicate candidates", "/correlation", Network],
          ["04", "Human review", "Explicit reviewer decision", "/review", BadgeCheck],
          ["05", "Investigation packet", "Engineering-ready export", "/packet/VF-1042", BookOpen],
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
  const [stage, setStage] = useState(0);
  const navigate = useNavigate();
  const { notify } = useToast();
  async function handleSubmit(payload: { repositoryUrl: string; commitSha: string; reports: Array<{ name: string; content: string }> }) {
    setBusy(true); setStage(1);
    const timer = window.setTimeout(() => setStage(2), 400);
    try {
      const result = await submitIntake(payload);
      window.clearTimeout(timer);
      setStage(3);
      notify(`Analysis complete · ${result.findings.length} findings created.`);
      navigate(`/matrix/${result.findings[0].id}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Intake failed. Check the API connection.", "error");
    } finally { setBusy(false); window.setTimeout(() => setStage(0), 700); }
  }
  return <div className="page-stack">
    <PageHeading kicker="INVESTIGATION / NEW ANALYSIS" title="Report intake" description="Anchor up to three existing vulnerability reports to one exact GitHub revision." action={<span className="step-indicator"><span>01</span> INTAKE</span>} />
    <div className="intake-layout">
      <div className="intake-main"><div className="panel form-panel"><IntakeForm onSubmit={handleSubmit} busy={busy} /></div>
        {busy && <div className="progress-panel"><div className="progress-top"><div><span className="eyebrow">ANALYSIS RUNNING</span><strong>Decomposing and verifying claims</strong></div><span className="progress-percent">{stage === 1 ? "28%" : "72%"}</span></div><div className="progress-track"><span style={{ width: stage === 1 ? "28%" : "72%" }} /></div><div className="progress-steps"><span className="done"><Check size={13} /> Input validated</span><span className={stage >= 2 ? "done" : "active"}><Sparkles size={13} /> Claim extraction</span><span>Source verification</span><span>Evidence matrix</span></div></div>}
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
  useEffect(() => { let active = true; setLoading(true); getFinding(findingId).then((value) => active && setFinding(value)).catch(() => active && setFinding(null)).finally(() => active && setLoading(false)); return () => { active = false; }; }, [findingId]);
  if (loading) return <div className="loading-panel"><RefreshCw className="spin" /> Loading commit-locked evidence…</div>;
  if (!finding) return <div className="empty-state">Finding not found. <Link to="/review">Return to review queue</Link></div>;
  const claims = finding.claims.filter((claim) => filter === "ALL" || claim.status === filter);
  return <div className="page-stack">
    <PageHeading kicker="INVESTIGATION / SOURCE EVIDENCE" title="Claim evidence matrix" description="Each assertion is evaluated independently against the exact source revision." action={<Link className="button button-secondary" to={`/packet/${finding.id}`}><BookOpen size={15} /> View packet</Link>} />
    <div className="finding-context panel"><div className="finding-context-main"><div className="finding-title-line"><span className="finding-id">{finding.id}</span><StatusBadge value={finding.severity} /><StatusBadge value={finding.lifecycle} /></div><h2>{finding.title}</h2><p>{finding.repository}</p><div className="commit-context"><GitCommitHorizontal size={15} /><span>LOCKED COMMIT</span><code>{finding.commitSha}</code></div></div><div className="finding-context-side"><span className="micro-label">ORIGINAL REPORT</span><p>{finding.originalReport}</p><Link to={`/review/${finding.id}`} className="text-link">Review finding <ArrowUpRight size={14} /></Link></div></div>
    <div className="callout-banner"><ShieldCheck size={18} /><div><strong>Reference verification is not an exploitability verdict.</strong><span>These checks establish whether source references are consistent at this SHA. They do not prove that the described behavior is reachable or exploitable.</span></div></div>
    <div className="matrix-toolbar"><div><span className="eyebrow">ATOMIC CLAIMS</span><h2>{finding.claims.length} claims extracted</h2></div><div className="filter-tabs"><button className={filter === "ALL" ? "selected" : ""} onClick={() => setFilter("ALL")}>All <b>{finding.claims.length}</b></button><button className={filter === "VERIFIED_REFERENCE" ? "selected" : ""} onClick={() => setFilter("VERIFIED_REFERENCE")}>Verified</button><button className={filter === "INCONSISTENT_REFERENCE" ? "selected" : ""} onClick={() => setFilter("INCONSISTENT_REFERENCE")}>Inconsistent</button><button className={filter === "MANUAL_INVESTIGATION" ? "selected" : ""} onClick={() => setFilter("MANUAL_INVESTIGATION")}>Manual</button></div></div>
    <div className="claim-list">{claims.map((claim) => <ClaimMatrixCard key={claim.id} claim={claim} onReview={() => window.location.assign(`/review/${finding.id}`)} />)}{!claims.length && <div className="empty-state">No claims match this verification filter.</div>}</div>
  </div>;
}

export function CorrelationPage() {
  const { findings } = useFindings();
  const [modal, setModal] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const candidates = findings.filter((finding) => finding.claims.some((claim) => claim.filePath === "auth.py" || claim.functionName === "lookup_user"));
  const primary = candidates[0] || findings[0];
  const secondary = primary ? { ...primary, id: "VF-1042-B", title: "Database lookup claim from automated report", reportTitle: "Automated Finding — Query Handling", originalReport: "A second report flags the same lookup path and asks for a separate review of query parameter handling.", claims: primary.claims.map((claim) => ({ ...claim, id: "CL-1042-B", title: "Query parameter binding in lookup_user" })) } : null;
  return <div className="page-stack">
    <PageHeading kicker="INVESTIGATION / RELATIONSHIP ANALYSIS" title="Duplicate correlation" description="Inspect overlapping claims and decide whether findings should be linked. No automatic merging." />
    <div className="correlation-summary"><div><span className="eyebrow">CANDIDATE CLUSTERS</span><strong>01</strong><small>Awaiting reviewer confirmation</small></div><div><span className="eyebrow">MATCH SIGNALS</span><strong>02</strong><small>Shared file + function reference</small></div><div><span className="eyebrow">MERGE POLICY</span><strong>MANUAL</strong><small>Evidence is retained independently</small></div></div>
    <div className="panel candidate-panel"><div className="candidate-top"><div><span className="eyebrow">CANDIDATE PAIR / COR-008</span><h2>Overlapping authentication lookup claims</h2></div><StatusBadge value="POSSIBLE_DUPLICATE" /></div>
      <div className="candidate-columns"><div className="candidate-card"><span className="micro-label">SOURCE REPORT A · {primary?.id || "VF-1042"}</span><h3>{primary?.title || "SQL injection in user lookup"}</h3><p>{primary?.originalReport}</p><div className="candidate-anchor"><FileCode2 size={15} /><code>auth.py / lookup_user</code><span>Lines 88–96</span></div></div><div className="candidate-vs">VS</div><div className="candidate-card"><span className="micro-label">SOURCE REPORT B · VF-1042-B</span><h3>{secondary?.title || "Related query-handling claim"}</h3><p>{secondary?.originalReport}</p><div className="candidate-anchor"><FileCode2 size={15} /><code>auth.py / lookup_user</code><span>Lines 88–96</span></div></div></div>
      <div className="overlap-reasons"><strong><Network size={15} /> MATCH EXPLANATION</strong><span>Both claims reference the same file and function, with overlapping line anchors. The source overlap is a triage signal—not proof that the reports describe the same root cause.</span></div>
      <div className="candidate-actions"><div>{decisions["COR-008"] ? <StatusBadge value={decisions["COR-008"] === "linked" ? "VALIDATED" : "SEPARATE"} /> : <span className="pending-decision"><Clock3 size={14} /> Awaiting decision</span>}</div><button className="button button-secondary" onClick={() => setDecisions((current) => ({ ...current, "COR-008": "separate" }))}>Keep as separate</button><button className="button button-primary" onClick={() => setModal(true)}><GitBranch size={15} /> Review &amp; link</button></div>
    </div>
    <div className="bottom-note"><ShieldAlert size={16} /><span>Correlation suggests relationships; reviewers decide whether findings share a root cause. Original evidence is never discarded.</span></div>
    {modal && primary && secondary && <CorrelationModal findings={[primary, secondary]} onClose={() => setModal(false)} onDecision={(decision) => setDecisions((current) => ({ ...current, "COR-008": decision }))} />}
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
    setSubmitting(true);
    try {
      const updated = await submitReview(selected.id, { decision, notes } satisfies ReviewPayload);
      setSelected(updated);
      setFindings((current) => current.map((item) => item.id === updated.id ? updated : item));
      notify(decision === "APPROVED" ? "Finding approved and marked validated." : decision === "REJECTED" ? "Finding rejected; evidence retained." : "More evidence requested.");
    } catch (error) { notify(error instanceof Error ? error.message : "Review submission failed.", "error"); }
    finally { setSubmitting(false); }
  }
  const queue = findings;
  if (loading) return <div className="loading-panel"><RefreshCw className="spin" /> Loading review queue…</div>;
  return <div className="page-stack">
    <PageHeading kicker="INVESTIGATION / REVIEW GATE" title="Human review queue" description="A reviewer owns every disposition. AI extraction and source checks do not make final decisions." />
    <div className="review-layout">
      <section className="panel review-queue"><div className="panel-heading"><div><span className="eyebrow">INCOMING FINDINGS</span><h2>Review queue <span className="count-pill">{queue.length}</span></h2></div><ListFilter size={17} /></div>
        {queue.map((finding) => <button className={`review-queue-item ${selected?.id === finding.id ? "active" : ""}`} key={finding.id} onClick={() => { setSelected(finding); setNotes(finding.reviewerNotes || ""); navigate(`/review/${finding.id}`, { replace: true }); }}><div className="review-queue-item-top"><span className="finding-id">{finding.id}</span><StatusBadge value={finding.severity} compact /></div><strong>{finding.title}</strong><div className="review-queue-item-foot"><StatusBadge value={finding.lifecycle} compact /><span>{finding.createdAt}</span></div></button>)}
      </section>
      <section className="panel review-detail">
        {selected ? <>
          <div className="review-detail-head"><div><span className="eyebrow">REVIEW DETAIL / {selected.id}</span><h2>{selected.title}</h2><p>{selected.repository} · <code>{selected.commitSha.slice(0, 12)}…</code></p></div><StatusBadge value={selected.lifecycle} /></div>
          <div className="review-evidence"><div className="review-evidence-head"><strong>Evidence snapshot</strong><StatusBadge value={selected.claims[0].status} compact /></div><p>{selected.claims[0].assertion}</p><div className="review-reference"><FileCode2 size={15} /><code>{selected.claims[0].filePath}:{selected.claims[0].lineStart}-{selected.claims[0].lineEnd}</code><span>{selected.claims[0].functionName}</span></div></div>
          <label className="field-label" htmlFor="review-notes">Reviewer notes <span className="field-hint">AUDIT TRAIL</span></label><textarea id="review-notes" className="review-notes" rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record what was verified, which assumptions remain, and what evidence is needed…" />
          <div className="review-note-hint">Notes are stored with this review decision. They are not automatically used to train a model.</div>
          <div className="review-actions"><button disabled={submitting} className="button button-danger-outline" onClick={() => decide("REJECTED")}><XCircle size={16} /> Reject</button><button disabled={submitting} className="button button-secondary" onClick={() => decide("MORE_EVIDENCE")}><AlertTriangle size={16} /> Request more evidence</button><button disabled={submitting} className="button button-primary" onClick={() => decide("APPROVED")}><CheckCircle2 size={16} /> Approve finding</button></div>
          {selected.decision && <div className="last-decision"><CheckCircle2 size={15} /> Last decision: <strong>{selected.decision.replaceAll("_", " ")}</strong></div>}
        </> : <div className="empty-state">Select a finding to review.</div>}
      </section>
    </div>
  </div>;
}

export function PacketPage() {
  const { findingId = "VF-1042" } = useParams();
  const [finding, setFinding] = useState<Finding | null>(null);
  useEffect(() => { getFinding(findingId).then(setFinding).catch(() => setFinding(null)); }, [findingId]);
  return <div className="page-stack">
    <PageHeading kicker="INVESTIGATION / ENGINEERING HANDOFF" title="Investigation packet" description="A portable, evidence-linked record for the engineering team." action={<span className="export-format-pill"><Braces size={14} /> MARKDOWN / JSON</span>} />
    {finding ? <><div className="packet-context"><div><span className="eyebrow">PACKET PREVIEW</span><strong>{finding.id} · {finding.repository}</strong></div><StatusBadge value={finding.lifecycle} /></div><PacketViewer finding={finding} /></> : <div className="empty-state">Finding not found. <Link to="/review">Open review queue</Link></div>}
  </div>;
}

export function ImpactPage() {
  const { findings } = useFindings();
  const [reference, setReference] = useState("https://github.com/acme/auth-service/pull/284");
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [diffMode, setDiffMode] = useState<"split" | "timeline">("split");
  const { notify } = useToast();
  useEffect(() => { import("../data/demo").then((module) => setResult(module.demoImpact)); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const isPr = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+\/?$/.test(reference.trim());
    const isSha = /^[a-f0-9]{40}$/i.test(reference.trim());
    if (!isPr && !isSha) return setError("Enter a GitHub pull request URL or an exact 40-character commit SHA.");
    setError(""); setBusy(true);
    try { const next = await analyzeImpact(isPr ? { pullRequestUrl: reference.trim() } : { commitSha: reference.trim() }); setResult(next); notify("Impact analysis updated. Review retest flags before closing any finding."); }
    catch (issue) { notify(issue instanceof Error ? issue.message : "Impact analysis failed.", "error"); }
    finally { setBusy(false); }
  }
  return <div className="page-stack">
    <PageHeading kicker="CONTINUOUS / PATCH INTELLIGENCE" title="Patch-to-finding impact" description="Compare a later PR or commit with historical evidence and identify findings that need retesting." />
    <form className="impact-input-panel panel" onSubmit={submit}><div className="impact-input-copy"><span className="eyebrow">CHANGESET TARGET</span><strong>Which revision changed?</strong><small>Paste a GitHub pull request URL or exact commit SHA.</small></div><div className="impact-input-control"><div className="input-with-icon"><GitPullRequest size={17} /><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="GitHub PR URL or 40-character SHA" /></div>{error && <span className="field-error">{error}</span>}</div><button className="button button-primary" disabled={busy}>{busy ? <RefreshCw className="spin" size={16} /> : <Target size={16} />}{busy ? "Analyzing…" : "Analyze impact"}</button></form>
    {result && <>
      <div className="impact-summary-grid"><StatCard label="Changed files" value={String(result.changedFiles.length).padStart(2, "0")} caption="In submitted changeset" icon={FileCode2} /><StatCard label="Linked findings" value={String(new Set(result.changedFiles.flatMap((file) => file.linkedFindingIds)).size).padStart(2, "0")} caption="Historical evidence overlaps" icon={ShieldCheck} /><StatCard label="Retest required" value={String(result.changedFiles.filter((file) => file.retestRequired).length).padStart(2, "0")} caption="Requires reviewer reassessment" icon={GitPullRequest} tone="amber" /></div>
      <section className="panel impact-graph-panel"><div className="panel-heading"><div><span className="eyebrow">CHANGE BLAST RADIUS</span><h2>Impact map</h2></div><span className="impact-legend"><i /> Retest required</span></div><ImpactTree result={result} findings={findings} /></section>
      <section className="panel temporal-panel"><div className="panel-heading"><div><span className="eyebrow">FEATURE 06 / HISTORICAL EVIDENCE</span><h2>Temporal evidence diff</h2></div><div className="filter-tabs"><button className={diffMode === "split" ? "selected" : ""} onClick={() => setDiffMode("split")}>Side by side</button><button className={diffMode === "timeline" ? "selected" : ""} onClick={() => setDiffMode("timeline")}>Timeline</button></div></div>
        {diffMode === "split" ? <div className="diff-grid"><div className="diff-column"><div className="diff-column-head"><span>ORIGINAL COMMIT</span><code>{DEMO_SHA.slice(0, 12)}</code></div><CodeSnippet startLine={88} lines={["def lookup_user(username: str):", "    query = \"SELECT id, role FROM users WHERE username = %s\"", "    cursor = db.cursor()", "    cursor.execute(query, (username,))", "    return cursor.fetchone()"]} /></div><div className="diff-column"><div className="diff-column-head"><span>PR REVISION</span><code>PR #284 · UPDATED</code></div><CodeSnippet startLine={88} lines={["def lookup_user(username: str):", "    normalized = username.strip()", "    query = \"SELECT id, role FROM users WHERE username = %s\"", "    cursor.execute(query, (normalized,))", "    return cursor.fetchone()"]} /></div></div> : <div className="temporal-timeline"><div className="timeline-item"><span className="timeline-dot done" /><div><strong>Original evidence captured</strong><small>{DEMO_SHA.slice(0, 12)} · Source reference recorded</small></div><StatusBadge value="VERIFIED_REFERENCE" compact /></div><div className="timeline-item"><span className="timeline-dot warning" /><div><strong>Later revision modifies lookup_user</strong><small>PR #284 · auth.py · Function overlap detected</small></div><StatusBadge value="RETEST_REQUIRED" compact /></div><div className="timeline-item"><span className="timeline-dot" /><div><strong>Reviewer reassessment pending</strong><small>Historical decision remains preserved</small></div><span className="pending-decision">PENDING</span></div></div>}
      </section>
    </>}
    <div className="bottom-note"><AlertTriangle size={16} /><span>File/function overlap is a retest trigger, not proof of remediation. Findings remain open until a reviewer reassesses the evidence.</span></div>
  </div>;
}
