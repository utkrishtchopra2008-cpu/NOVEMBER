import { createApi, type Analysis as ApiAnalysis, type Finding as ApiFinding, type Schemas as ApiSchemas } from "../../shared/client";
import { demoFindings, DEMO_REPOSITORY, DEMO_SHA } from "../data/demo";
import { getDemoState, mockCorrelationDecision, mockImpact, mockIntake, mockLifecycle, mockReview } from "./mock";
import type {
  CorrelationCandidate, Finding, ImpactPayload, ImpactResult, IntakePayload, IntakeResponse,
  IssueDraft, LifecycleStatus, PacketData, ReviewPayload
} from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
export const isDemoMode = !API_BASE;
export type ApiMode = "local" | "demo" | "live";
let accessTokenProvider: () => Promise<string | null> = async () => null;
const api = API_BASE ? createApi(API_BASE, () => accessTokenProvider()) : null;

export function configureAccessTokenProvider(provider: () => Promise<string | null>) {
  accessTokenProvider = provider;
}
function apiClient() {
  if (!api) throw new Error("FastAPI is not configured.");
  return api;
}

// Never silently fall back to local fixtures when a configured API is unavailable.
export async function getApiMode(): Promise<ApiMode> {
  if (!api) return "local";
  const capabilities = await apiClient().capabilities();
  if (capabilities.mode !== "demo" && capabilities.mode !== "live") {
    throw new Error("Unexpected backend mode.");
  }
  return capabilities.mode;
}

const verificationMap = {
  "Verified reference": "VERIFIED_REFERENCE",
  "Inconsistent reference": "INCONSISTENT_REFERENCE",
  "Requires manual investigation": "MANUAL_INVESTIGATION",
} as const;

function mapFinding(source: ApiFinding): Finding {
  const latestReview = source.reviews?.[source.reviews.length - 1];
  const claims = source.claims.map((claim) => {
    const reference = claim.reference;
    const lineStart = reference?.start_line ?? claim.snippet?.[0]?.number ?? 1;
    const lineEnd = reference?.end_line ?? claim.snippet?.[claim.snippet.length - 1]?.number ?? lineStart;
    return {
      id: claim.id || `CL-${source.id || "UNKNOWN"}`,
      title: claim.assertion,
      excerpt: claim.original_excerpt,
      assertion: claim.assertion,
      component: claim.component,
      filePath: reference?.file_path || "Unspecified",
      functionName: reference?.function_name || "Not specified",
      lineStart,
      lineEnd,
      status: verificationMap[claim.verification_status],
      reason: claim.verification_reason,
      snippet: (claim.snippet || []).map((line) => line.text),
      sourceUrl: claim.source_url || undefined,
      assumptions: claim.assumptions || [],
    };
  });
  return {
    id: source.id || "UNKNOWN",
    analysisId: source.analysis_id,
    title: source.report.title,
    reportTitle: source.report.title,
    category: claims[0]?.component || "Unspecified",
    severity: source.severity.toUpperCase() as Finding["severity"],
    lifecycle: source.lifecycle.toUpperCase() as Finding["lifecycle"],
    repository: source.repo_url.replace("https://github.com/", ""),
    commitSha: source.commit_sha,
    originalReport: source.report.content,
    claims,
    missingEvidence: source.missing_evidence || [],
    investigationSteps: source.investigation_steps || [],
    businessImpact: source.business_impact,
    reviewerNotes: latestReview?.notes || "",
    decision: latestReview?.decision,
    createdAt: source.created_at ? new Date(source.created_at).toLocaleString() : "Imported",
  };
}

function mapCorrelation(source: ApiSchemas["Correlation"], analysisId: string): CorrelationCandidate {
  return {
    id: source.id || "COR-UNKNOWN",
    analysisId,
    findingIds: source.finding_ids,
    sharedFiles: source.shared_files,
    sharedFunctions: source.shared_functions,
    reasons: source.reasons,
    decision: source.decision,
  };
}

function mapAnalysis(source: ApiAnalysis): IntakeResponse {
  const analysisId = source.id || "";
  return {
    analysisId,
    mode: source.mode,
    findings: (source.findings || []).map(mapFinding),
    correlations: (source.correlations || []).map((pair) => mapCorrelation(pair, analysisId)),
  };
}

export async function getDemoIntake(): Promise<IntakePayload | null> {
  if (!api) {
    return {
      repositoryUrl: DEMO_REPOSITORY,
      commitSha: DEMO_SHA,
      reports: demoFindings.map((finding) => ({
        name: finding.reportTitle,
        content: finding.originalReport,
        format: "text",
      })),
    };
  }
  const capabilities = await apiClient().capabilities();
  if (capabilities.mode !== "demo") return null;
  const data = await apiClient().demo();
  return {
    repositoryUrl: data.repo_url,
    commitSha: data.commit_sha,
    reports: data.reports.map((report) => ({
      name: report.title,
      content: report.content,
      format: report.format,
    })),
  };
}

export async function submitIntake(payload: IntakePayload): Promise<IntakeResponse> {
  if (!api) return mockIntake(payload);
  const input: ApiSchemas["Intake"] = {
    repo_url: payload.repositoryUrl,
    commit_sha: payload.commitSha,
    reports: payload.reports.map((report) => ({
      title: report.name || "Untitled report",
      content: report.content,
      format: report.format || (/\.md$/i.test(report.name) ? "markdown" : /\.json$/i.test(report.name) ? "json" : "text"),
    })),
  };
  return mapAnalysis(await apiClient().intake(input));
}

export async function getFindings(): Promise<Finding[]> {
  return api ? (await apiClient().findings()).map(mapFinding) : getDemoState().findings;
}

export async function getFinding(id: string): Promise<Finding> {
  if (api) return mapFinding(await apiClient().finding(id));
  const finding = getDemoState().findings.find((item) => item.id === id);
  if (!finding) throw new Error("Finding not found");
  return finding;
}

export async function submitReview(id: string, payload: ReviewPayload): Promise<Finding> {
  return api ? mapFinding(await apiClient().review(id, payload)) : mockReview(id, payload);
}

export async function updateLifecycle(id: string, lifecycle: "Resolved" | "Investigating", notes: string): Promise<Finding> {
  if (!api) return mockLifecycle(id, lifecycle.toUpperCase() as LifecycleStatus, notes);
  return mapFinding(await apiClient().lifecycle(id, { lifecycle, notes }));
}

export async function getCorrelations(analysisId?: string): Promise<CorrelationCandidate[]> {
  if (api) {
    return analysisId
      ? (await apiClient().correlations(analysisId)).map((pair) => mapCorrelation(pair, analysisId))
      : [];
  }
  return getDemoState().correlations.filter((pair) => !analysisId || pair.analysisId === analysisId);
}

export async function submitCorrelationDecision(
  analysisId: string,
  id: string,
  decision: "CONFIRMED_DUPLICATE" | "KEPT_SEPARATE",
) {
  if (api) return apiClient().decide(analysisId, id, { decision });
  return mockCorrelationDecision(id, decision);
}

export async function getPacket(id: string): Promise<PacketData> {
  if (!api) {
    return {
      finding: await getFinding(id),
      relatedReports: [],
      markdown: "",
      warning: "Local demo packet; no backend evidence was retrieved.",
    };
  }
  const packet = await apiClient().packet(id);
  return {
    finding: mapFinding(packet.finding),
    relatedReports: (packet.related_reports || []).map((pair) => mapCorrelation(pair, packet.finding.analysis_id)),
    markdown: packet.markdown,
    warning: packet.warning,
  };
}

export async function getIssueDraft(id: string): Promise<IssueDraft> {
  if (!api) {
    return {
      title: "Demo issue draft",
      body: "",
      githubUrl: null,
      published: false,
      message: "Local demo mode does not publish external issues.",
    };
  }
  const draft = await apiClient().issueDraft(id);
  return {
    title: draft.title,
    body: draft.body,
    githubUrl: draft.github_url,
    published: draft.published,
    message: draft.message,
  };
}

export async function analyzeImpact(payload: ImpactPayload): Promise<ImpactResult> {
  if (!api) return mockImpact(payload);
  if (!payload.analysisId) throw new Error("Run an intake analysis before comparing a later revision.");
  const input: ApiSchemas["ImpactInput"] = {
    analysis_id: payload.analysisId,
    ...(payload.pullRequestUrl ? { pr_url: payload.pullRequestUrl } : { new_commit_sha: payload.commitSha }),
  };
  const result = await apiClient().impact(input);
  const impacts = result.impacts.map((item) => ({
    findingId: item.finding_id,
    claimId: item.claim_id,
    filePath: item.file_path,
    flag: item.flag,
    reason: item.reason,
    original: item.original,
    current: item.current,
    diff: item.diff,
    currentVerificationStatus: item.current_verification_status,
  }));
  const changedFiles = result.changed_files.map((path) => {
    const related = impacts.filter((item) => item.filePath === path);
    return {
      path,
      claimsAffected: related.length,
      linkedFindingIds: [...new Set(related.map((item) => item.findingId))],
      retestRequired: related.some((item) => item.flag === "RETEST_REQUIRED"),
      manualReviewRequired: related.some((item) => item.flag === "MANUAL_MAPPING_REQUIRED"),
    };
  });
  return {
    analysisId: result.analysis_id,
    reference: payload.pullRequestUrl || result.current_commit_sha,
    summary: result.warning,
    originalCommitSha: result.original_commit_sha,
    currentCommitSha: result.current_commit_sha,
    changedFiles,
    impacts,
    warning: result.warning,
    changedFilesScope: result.changed_files_scope,
  };
}
