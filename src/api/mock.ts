import { demoFindings, DEMO_REPOSITORY, DEMO_SHA, demoImpact } from "../data/demo";
import type { CorrelationCandidate, Finding, ImpactPayload, ImpactResult, IntakePayload, IntakeResponse, LifecycleStatus, ReviewPayload } from "../types";

const STORAGE_KEY = "vulnflow-demo-state";
interface DemoState { findings: Finding[]; impact: ImpactResult; correlations: CorrelationCandidate[] }
function initialState(): DemoState {
  return {
    findings: demoFindings,
    impact: demoImpact,
    correlations: [{
      id: "COR-LOCAL-01",
      analysisId: "AN-LOCAL-DEMO",
      findingIds: ["VF-1042", "VF-1042-ALT"],
      sharedFiles: ["auth.py"],
      sharedFunctions: ["auth.py:lookup_user"],
      reasons: [
        "Both reports reference auth.py.",
        "Both reports identify lookup_user as the affected function.",
        "Shared source references are a triage signal, not proof of a duplicate."
      ],
      decision: "PENDING"
    }]
  };
}
function loadState(): DemoState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<DemoState>;
      if (parsed.findings && parsed.impact && parsed.correlations) return parsed as DemoState;
    }
  } catch { /* Reset malformed or unavailable local data to bundled fixtures. */ }
  return initialState();
}
function saveState(state: DemoState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Browser storage may be disabled. */ }
}
export function getDemoState() { return loadState(); }

export async function mockIntake(payload: IntakePayload): Promise<IntakeResponse> {
  await new Promise((resolve) => window.setTimeout(resolve, 650));
  const state = loadState();
  const analysisId = `AN-LOCAL-${Date.now()}`;
  const findings = demoFindings.slice(0, Math.max(1, Math.min(payload.reports.length, 3))).map((finding, index) => ({
    ...finding,
    id: `VF-${Date.now().toString().slice(-5)}${index}`,
    analysisId,
    repository: payload.repositoryUrl.replace("https://github.com/", ""),
    commitSha: payload.commitSha,
    reportTitle: payload.reports[index]?.name || finding.reportTitle,
    originalReport: payload.reports[index]?.content || finding.originalReport,
    createdAt: "Just now",
  }));
  saveState({ ...state, findings: [...findings, ...state.findings] });
  return { analysisId, mode: "local", findings, correlations: [] };
}
export async function mockReview(findingId: string, payload: ReviewPayload): Promise<Finding> {
  const state = loadState();
  const finding = state.findings.find((item) => item.id === findingId);
  if (!finding) throw new Error("Finding not found");
  const updated: Finding = {
    ...finding,
    lifecycle: payload.decision === "APPROVED" ? "VALIDATED" : "INVESTIGATING",
    decision: payload.decision,
    reviewerNotes: payload.notes
  };
  saveState({ ...state, findings: state.findings.map((item) => item.id === findingId ? updated : item) });
  return updated;
}
export async function mockLifecycle(findingId: string, lifecycle: LifecycleStatus, notes: string): Promise<Finding> {
  const state = loadState();
  const finding = state.findings.find((item) => item.id === findingId);
  if (!finding) throw new Error("Finding not found");
  if (lifecycle === "RESOLVED" && finding.lifecycle !== "VALIDATED") {
    throw new Error("Only a validated finding can be resolved after retesting.");
  }
  const updated = { ...finding, lifecycle, reviewerNotes: notes };
  saveState({ ...state, findings: state.findings.map((item) => item.id === findingId ? updated : item) });
  return updated;
}
export async function mockImpact(payload: ImpactPayload): Promise<ImpactResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 650));
  const state = loadState();
  const analysisFindings = state.findings.filter((finding) => finding.analysisId === payload.analysisId);
  const changedFiles = ["auth.py", "admin.py", "worker.py"].map((path) => {
    const linked = analysisFindings.filter((finding) => finding.claims.some((claim) => claim.filePath === path));
    return {
      path,
      claimsAffected: linked.reduce((sum, finding) => sum + finding.claims.filter((claim) => claim.filePath === path).length, 0),
      linkedFindingIds: linked.map((finding) => finding.id),
      retestRequired: path === "auth.py" && linked.length > 0,
      manualReviewRequired: path !== "auth.py" && linked.length > 0
    };
  }).filter((item) => item.linkedFindingIds.length > 0);
  const sourceImpact = state.impact.impacts[0];
  const authFinding = analysisFindings.find((finding) => finding.claims.some((claim) => claim.filePath === "auth.py"));
  const authClaim = authFinding?.claims.find((claim) => claim.filePath === "auth.py");
  const impacts = sourceImpact && authFinding && authClaim
    ? [{ ...sourceImpact, findingId: authFinding.id, claimId: authClaim.id }]
    : [];
  const result: ImpactResult = {
    ...state.impact,
    analysisId: payload.analysisId,
    reference: payload.pullRequestUrl ? `PR #${payload.pullRequestUrl.split("/").slice(-1)[0]}` : payload.commitSha || "Submitted revision",
    changedFiles,
    impacts,
    summary: "Local demo patch preview. Referenced functions may need retesting; no finding is resolved automatically."
  };
  saveState({ ...state, impact: result });
  return result;
}
export async function mockCorrelationDecision(id: string, decision: "CONFIRMED_DUPLICATE" | "KEPT_SEPARATE") {
  const state = loadState();
  const correlations = state.correlations.map((pair) => pair.id === id ? { ...pair, decision } : pair);
  saveState({ ...state, correlations });
  return correlations.find((pair) => pair.id === id);
}
export function resetDemoState() { saveState(initialState()); }
export const demoDefaults = { repository: DEMO_REPOSITORY, commitSha: DEMO_SHA };
