import { useRef, useState, type FormEvent, type ChangeEvent, type DragEvent } from "react";
import { UploadCloud, Github, FileText, X, Plus, ArrowRight, LoaderCircle, CheckCircle2, GitCommitHorizontal, Sparkles } from "lucide-react";
import { demoFindings } from "../data/demo";
import { demoDefaults } from "../api/mock";

interface IntakeReport { name: string; content: string }
interface Props { onSubmit: (payload: { repositoryUrl: string; commitSha: string; reports: IntakeReport[] }) => Promise<void>; busy: boolean }
const demoReports = demoFindings.map((finding) => ({ name: finding.reportTitle, content: finding.originalReport }));

export function IntakeForm({ onSubmit, busy }: Props) {
  const [repositoryUrl, setRepositoryUrl] = useState(demoDefaults.repository);
  const [commitSha, setCommitSha] = useState(demoDefaults.commitSha);
  const [reports, setReports] = useState<IntakeReport[]>(demoReports);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shaValid = /^[a-f0-9]{40}$/i.test(commitSha);
  const repoValid = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(repositoryUrl.trim());

  function updateReport(index: number, value: string) {
    setReports((current) => current.map((item, i) => i === index ? { ...item, content: value } : item));
  }
  function removeReport(index: number) {
    setReports((current) => current.filter((_, i) => i !== index));
  }
  async function addFiles(selected: File[]) {
    const remaining = Math.max(0, 3 - reports.length);
    const accepted = selected.filter((file) => /\.(md|txt|json)$/i.test(file.name)).slice(0, remaining);
    const parsed = await Promise.all(accepted.map(async (file) => ({ name: file.name, content: await file.text() })));
    setReports((current) => [...current, ...parsed].slice(0, 3));
    if (selected.length > accepted.length) setError("Only .md, .txt and .json files are accepted; up to three reports are allowed.");
    else setError("");
  }
  async function readFiles(event: ChangeEvent<HTMLInputElement>) {
    await addFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }
  function loadSamples() {
    setRepositoryUrl(demoDefaults.repository);
    setCommitSha(demoDefaults.commitSha);
    setReports(demoReports);
    setError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!repoValid) return setError("Enter a valid GitHub repository URL, such as https://github.com/owner/repository.");
    if (!shaValid) return setError("The commit SHA must contain exactly 40 hexadecimal characters.");
    if (!reports.length || reports.some((report) => !report.content.trim())) return setError("Add at least one non-empty vulnerability report.");
    setError("");
    await onSubmit({ repositoryUrl: repositoryUrl.trim().replace(/\/$/, ""), commitSha: commitSha.toLowerCase(), reports });
  }
  return <form className="intake-form" onSubmit={submit}>
    <div className="form-section">
      <div className="section-index">01</div>
      <div className="form-section-body">
        <div className="form-section-title"><div><h3>Repository target</h3><p>Pin this investigation to an immutable source revision.</p></div><span className="required-tag">REQUIRED</span></div>
        <label className="field-label" htmlFor="repo-url">GitHub repository URL</label>
        <div className={`input-with-icon ${repositoryUrl && !repoValid ? "field-invalid" : ""}`}><Github size={17} /><input id="repo-url" value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} placeholder="https://github.com/owner/repository" /></div>
        <label className="field-label" htmlFor="commit-sha">Exact commit SHA <span className="field-hint">40 CHARACTERS</span></label>
        <div className={`input-with-icon mono-input ${commitSha && !shaValid ? "field-invalid" : ""}`}><GitCommitHorizontal size={17} /><input id="commit-sha" value={commitSha} onChange={(event) => setCommitSha(event.target.value)} placeholder="40-character hexadecimal SHA" maxLength={40} /><span className={shaValid ? "valid-indicator" : "invalid-indicator"}>{shaValid ? <CheckCircle2 size={16} /> : `${commitSha.length}/40`}</span></div>
        <p className="field-footnote">Source references are checked against this revision—not the repository's latest default branch.</p>
      </div>
    </div>
    <div className="form-divider" />
    <div className="form-section">
      <div className="section-index">02</div>
      <div className="form-section-body">
        <div className="form-section-title"><div><h3>Vulnerability reports</h3><p>Upload or paste existing findings. Maximum three reports per analysis.</p></div><span className="count-pill">{reports.length} / 3</span></div>
        {reports.map((report, index) => <div className="report-input-card" key={index}>
          <div className="report-input-head"><div><FileText size={16} /><strong>{report.name || `Report ${index + 1}`}</strong><span className="report-number">REPORT 0{index + 1}</span></div><button type="button" className="icon-button" onClick={() => removeReport(index)} aria-label="Remove report"><X size={15} /></button></div>
          <textarea value={report.content} onChange={(event) => updateReport(index, event.target.value)} rows={4} placeholder="Paste the original vulnerability report. Keep the researcher's wording intact." aria-label={`Report ${index + 1} content`} />
          <div className="report-input-foot"><span>{report.content.length.toLocaleString()} characters</span><span>RAW INPUT PRESERVED</span></div>
        </div>)}
        <div className="upload-actions">
          <button type="button" className="button button-secondary" onClick={() => fileRef.current?.click()} disabled={reports.length >= 3}><UploadCloud size={16} /> Upload reports</button>
          <button type="button" className="button button-ghost" onClick={() => setReports((current) => current.length < 3 ? [...current, { name: `Report ${current.length + 1}.md`, content: "" }] : current)} disabled={reports.length >= 3}><Plus size={16} /> Add blank report</button>
          <button type="button" className="button button-ghost sample-button" onClick={loadSamples}><Sparkles size={15} /> Load demo set</button>
          <input ref={fileRef} type="file" accept=".md,.txt,.json" multiple hidden onChange={readFiles} />
        </div>
        <div className={`drop-hint ${dragging ? "drop-hint-active" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") fileRef.current?.click(); }}>
          <UploadCloud size={19} /><span><strong>{dragging ? "Release to add reports" : "Drop reports here"}</strong><small> .md, .txt or .json · Maximum 3 files · Or click to browse</small></span>
        </div>
      </div>
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="intake-submit-row">
      <div className="submit-assurance"><span className="assurance-dot" /> Evidence-first processing · No exploitability verdicts</div>
      <button className="button button-primary button-large" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} /> Analyzing reports…</> : <>Decompose &amp; verify claims <ArrowRight size={17} /></>}</button>
    </div>
  </form>;
}