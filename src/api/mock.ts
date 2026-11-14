import { demoFindings, DEMO_REPOSITORY, DEMO_SHA, demoImpact } from "../data/demo";
import type { Finding, ImpactPayload, ImpactResult, IntakePayload, IntakeResponse, ReviewPayload } from "../types";

const STORAGE_KEY = "vulnflow-demo-state";

interface DemoState {
  findings: Finding[];
  impact: ImpactResult;
}

function loadState(): DemoState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as DemoState;
  } catch {
    // Recover with the bundled, deterministic demo state.
  }
  return { findings: demoFindings, impact: demoImpact };
}

function saveState(state: DemoState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getDemoState() {
  return loadState();
}

export async function mockIntake(payload: IntakePayload): Promise<IntakeResponse> {
  await new Promise((resolve) => window.setTimeout(resolve, 1200));
  const state = loadState();
  const reportFindings = state.findings.slice(0, Math.max(1, Math.min(payload.reports.length, 3)));
  const findings = reportFindings.map((finding, index) => ({
    ...finding,
    id: `VF-${Date.now().toString().slice(-5)}${index}`,
    repository: payload.repositoryUrl.replace("https://github.com/", ""),
    commitSha: payload.commitSha,
    reportTitle: payload.reports[index]?.name || finding.reportTitle,
    originalReport: payload.reports[index]?.content || finding.originalReport,
    createdAt: "Just now",
  }));
  const next = { ...state, findings: [...findings, ...state.findings] };
  saveState(next);
  return { analysisId: `AN-${Date.now()}`, findings };
}

export async function mockReview(findingId: string, payload: ReviewPayload): Promise<Finding> {
  const state = loadState();
  const finding = state.findings.find((item) => item.id === findingId) || demoFindings[0];
  const lifecycle = payload.decision === "APPROVED" ? "VALIDATED" : payload.decision === "REJECTED" ? "RESOLVED" : "INVESTIGATING";
  const updated = { ...finding, lifecycle, decision: payload.decision, reviewerNotes: payload.notes };
  saveState({ ...state, findings: state.findings.map((item) => item.id === findingId ? updated : item) });
  return updated;
}

export async function mockImpact(payload: ImpactPayload): Promise<ImpactResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 900));
  const result = {
    ...demoImpact,
    reference: payload.pullRequestUrl ? payload.pullRequestUrl.split("/").slice(-1)[0] : payload.commitSha || "Submitted revision",
  };
  const next = loadState();
  saveState({ ...next, impact: result });
  return result;
}

export function resetDemoState() {
  saveState({ findings: demoFindings, impact: demoImpact });
}

export const demoDefaults = { repository: DEMO_REPOSITORY, commitSha: DEMO_SHA };
