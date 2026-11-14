export type VerificationStatus = "VERIFIED_REFERENCE" | "INCONSISTENT_REFERENCE" | "MANUAL_INVESTIGATION";
export type LifecycleStatus = "NEW" | "INVESTIGATING" | "VALIDATED" | "RESOLVED";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNASSESSED";
export type ReviewDecision = "APPROVED" | "REJECTED" | "MORE_EVIDENCE";
export type CorrelationDecision = "CONFIRMED_DUPLICATE" | "KEPT_SEPARATE";

export interface Claim {
  id: string;
  title: string;
  excerpt: string;
  assertion: string;
  component: string;
  filePath: string;
  functionName: string;
  lineStart: number;
  lineEnd: number;
  status: VerificationStatus;
  reason: string;
  snippet: string[];
  sourceUrl?: string;
  assumptions?: string[];
  missingEvidence?: string[];
}

export interface Finding {
  id: string;
  analysisId: string;
  title: string;
  reportTitle: string;
  category: string;
  severity: Severity;
  lifecycle: LifecycleStatus;
  repository: string;
  commitSha: string;
  originalReport: string;
  claims: Claim[];
  missingEvidence: string[];
  investigationSteps?: string[];
  businessImpact?: string;
  reviewerNotes: string;
  decision?: ReviewDecision;
  reviewHistory?: Array<{ id: string; decision: ReviewDecision; notes: string; reviewerId: string; createdAt: string }>;
  verificationJobs?: SandboxCheck[];
  createdAt: string;
}
export interface SandboxCheck {
  id?: string;
  finding_id: string;
  claim_id: string;
  file_path: string;
  commit_sha: string;
  sandbox_id: string;
  status: "PASSED" | "FAILED";
  exit_code: number;
  created_at?: string;
  message: string;
}

export interface IntakeReport {
  name: string;
  content: string;
  format?: "markdown" | "text" | "json";
}
export interface IntakePayload {
  repositoryUrl: string;
  commitSha: string;
  reports: IntakeReport[];
}
export interface IntakeResponse {
  analysisId: string;
  mode: "demo" | "live" | "local";
  findings: Finding[];
  correlations: CorrelationCandidate[];
}
export interface ReviewPayload { decision: ReviewDecision; notes: string }

export interface CorrelationCandidate {
  id: string;
  analysisId: string;
  findingIds: string[];
  sharedFiles: string[];
  sharedFunctions: string[];
  reasons: string[];
  decision: "PENDING" | CorrelationDecision;
}

export interface ImpactPayload {
  analysisId: string;
  pullRequestUrl?: string;
  commitSha?: string;
}
export interface ImpactLine {
  number: number;
  text: string;
  kind: "context" | "added" | "removed";
}
export interface ImpactItem {
  findingId: string;
  claimId: string;
  filePath: string | null;
  flag: "RETEST_REQUIRED" | "NO_REFERENCE_CHANGE" | "MANUAL_MAPPING_REQUIRED";
  reason: string;
  original: ImpactLine[];
  current: ImpactLine[];
  diff: string;
  currentVerificationStatus: string;
}
export interface ImpactResult {
  analysisId: string;
  reference: string;
  summary: string;
  originalCommitSha: string;
  currentCommitSha: string;
  changedFiles: Array<{
    path: string;
    claimsAffected: number;
    linkedFindingIds: string[];
    retestRequired: boolean;
    manualReviewRequired: boolean;
  }>;
  impacts: ImpactItem[];
  warning: string;
  changedFilesScope: "referenced_files";
}
export interface ImpactHistoryEntry {
  id: string;
  createdAt: string;
  result: ImpactResult;
}
export interface PacketData {
  finding: Finding;
  relatedReports: CorrelationCandidate[];
  markdown: string;
  warning: string;
  jsonPayload?: unknown;
}
export interface IssueDraft {
  title: string;
  body: string;
  githubUrl: string | null;
  published: boolean;
  message: string;
}
