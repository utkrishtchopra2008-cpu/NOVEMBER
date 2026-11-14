export type VerificationStatus =
  | "VERIFIED_REFERENCE"
  | "INCONSISTENT_REFERENCE"
  | "MANUAL_INVESTIGATION";

export type LifecycleStatus = "NEW" | "INVESTIGATING" | "VALIDATED" | "RESOLVED";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ReviewDecision = "APPROVED" | "REJECTED" | "MORE_EVIDENCE";

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
  missingEvidence?: string[];
}

export interface Finding {
  id: string;
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
  reviewerNotes: string;
  decision?: ReviewDecision;
  createdAt: string;
}

export interface IntakePayload {
  repositoryUrl: string;
  commitSha: string;
  reports: Array<{ name: string; content: string }>;
}

export interface IntakeResponse {
  analysisId: string;
  findings: Finding[];
}

export interface ReviewPayload {
  decision: ReviewDecision;
  notes: string;
}

export interface ImpactPayload {
  pullRequestUrl?: string;
  commitSha?: string;
}

export interface ImpactResult {
  reference: string;
  changedFiles: Array<{
    path: string;
    changes: number;
    linkedFindingIds: string[];
    retestRequired: boolean;
  }>;
  summary: string;
}
