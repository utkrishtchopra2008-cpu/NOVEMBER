import { demoFindings, demoCorrelationFinding, DEMO_REPOSITORY, DEMO_SHA, demoImpact } from "../data/demo";
import type { CorrelationCandidate, Finding, ImpactPayload, ImpactResult, IntakePayload, IntakeResponse, LifecycleStatus, ReviewPayload } from "../types";

const STORAGE_KEY = "vulnflow-demo-state";
interface DemoState { findings: Finding[]; impact: ImpactResult; correlations: CorrelationCandidate[] }
function initialState(): DemoState {
  return {
    findings: [...demoFindings, demoCorrelationFinding],
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
      if (parsed.findings && parsed.impact && parsed.correlations) {
        const state = parsed as DemoState;
        // Migrate older demo sessions without erasing user-entered findings or review decisions.
        const needsCorrelationFixture = state.correlations.some((pair) =>
          pair.findingIds.includes(demoCorrelationFinding.id)
        ) && !state.findings.some((finding) => finding.id === demoCorrelationFinding.id);
        if (needsCorrelationFixture) {
          const migrated = { ...state, findings: [...state.findings, demoCorrelationFinding] };
          saveState(migrated);
          return migrated;
        }
        return state;
      }
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
  const findings: Finding[] = payload.reports.map((report, index) => {
    const id = `VF-${Date.now().toString().slice(-5)}${index}`;
    return {
      id,
      analysisId,
      title: report.name || `Submitted report ${index + 1}`,
      reportTitle: report.name || `Submitted report ${index + 1}`,
      category: "Not decomposed",
      severity: "UNASSESSED",
      lifecycle: "NEW",
      repository: payload.repositoryUrl.replace("https://github.com/", ""),
      commitSha: payload.commitSha,
      originalReport: report.content,
      createdAt: "Just now",
      reviewerNotes: "",
      missingEvidence: [
        "Local mock mode does not fetch GitHub code or verify source references.",
        "Connect FastAPI to extract claims and perform deterministic source checks."
      ],
      investigationSteps: ["Submit the original report to a running FastAPI instance."],
      businessImpact: "Not assessed",
      claims: [{
        id: `${id}-PENDING`,
        title: "Claim extraction and source verification pending",
        excerpt: report.content.slice(0, 180),
        assertion: "No individual technical claims were extracted from this report.",
        component: "Not analyzed",
        filePath: "Unverified",
        functionName: "Not extracted",
        lineStart: 1,
        lineEnd: 1,
        status: "MANUAL_INVESTIGATION",
        reason: "Offline local mode is a UI demonstration only. No repository was fetched and no verification was performed.",
        snippet: [],
        missingEvidence: ["Run backend intake to obtain source-locked evidence."]
      }]
    };
  });
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
  if (payload.analysisId !== "AN-LOCAL-DEMO") {
    const original = state.findings.find((finding) => finding.analysisId === payload.analysisId);
    return {
      ...demoImpact,
      analysisId: payload.analysisId,
      originalCommitSha: original?.commitSha || "NOT_VERIFIED",
      currentCommitSha: payload.commitSha || "NOT_VERIFIED",
      reference: "Unverified local input",
      summary: "No source comparison was performed. Configure FastAPI for actual commit or PR impact analysis.",
      changedFiles: [],
      impacts: [],
      warning: "Offline local mode cannot analyze changes to arbitrary repositories. No retest conclusion was produced."
    };
  }
  // Only the bundled fixed fixture contains an illustrative, prebuilt temporal diff.
  return demoImpact;
}

export async function mockCorrelationDecision(id: string, decision: "CONFIRMED_DUPLICATE" | "KEPT_SEPARATE") {
  const state = loadState();
  const correlations = state.correlations.map((pair) => pair.id === id ? { ...pair, decision } : pair);
  saveState({ ...state, correlations });
  return correlations.find((pair) => pair.id === id);
}
export function resetDemoState() { saveState(initialState()); }
export const demoDefaults = { repository: DEMO_REPOSITORY, commitSha: DEMO_SHA };
