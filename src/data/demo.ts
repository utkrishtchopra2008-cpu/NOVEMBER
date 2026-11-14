import type { Finding, ImpactResult } from "../types";

export const DEMO_REPOSITORY = "https://github.com/acme/auth-service";
export const DEMO_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

export const demoFindings: Finding[] = [
  {
    id: "VF-1042", analysisId: "AN-LOCAL-DEMO",
    title: "Possible SQL injection in user lookup",
    reportTitle: "AI Security Review — Authentication",
    category: "Injection", severity: "HIGH", lifecycle: "INVESTIGATING",
    repository: "acme/auth-service", commitSha: DEMO_SHA, createdAt: "2 hours ago",
    originalReport: "The user lookup flow may pass externally supplied values into a database operation. The report points to lookup_user in auth.py and asks the team to verify how the query is constructed.",
    reviewerNotes: "", missingEvidence: ["A reproducible request and response pair", "Database driver and query execution context"],
    investigationSteps: ["Trace the user value from request parsing to the data layer.", "Confirm parameter-binding behavior across call paths."],
    businessImpact: "Requires reviewer assessment",
    claims: [
      { id: "CL-1042-A", title: "User-controlled value reaches the lookup query", excerpt: "The username supplied to the login flow is used by the user lookup operation.", assertion: "Trace the username value into the database call and inspect the query binding strategy.", component: "Authentication / user lookup", filePath: "auth.py", functionName: "lookup_user", lineStart: 88, lineEnd: 96, status: "VERIFIED_REFERENCE", reason: "The referenced file and function are present at the supplied commit. This check establishes the reference only; query safety requires separate review.", snippet: ["def lookup_user(username: str):", "    query = \"SELECT id, role FROM users WHERE username = %s\"", "    cursor = db.cursor()", "    cursor.execute(query, (username,))", "    return cursor.fetchone()"] },
      { id: "CL-1042-B", title: "Query construction requires security review", excerpt: "The report describes possible unsafe query construction.", assertion: "Confirm whether the query uses parameter binding consistently across all call paths.", component: "Database access", filePath: "auth.py", functionName: "lookup_user", lineStart: 88, lineEnd: 96, status: "MANUAL_INVESTIGATION", reason: "The source reference exists, but the submitted report does not establish the full call path or database-driver behavior.", snippet: ["def lookup_user(username: str):", "    query = \"SELECT id, role FROM users WHERE username = %s\"", "    cursor.execute(query, (username,))"], missingEvidence: ["Call-site trace", "Database adapter configuration"] }
    ]
  },
  {
    id: "VF-1043", analysisId: "AN-LOCAL-DEMO",
    title: "Admin route may omit an authorization check", reportTitle: "Manual Review — Admin Access",
    category: "Broken access control", severity: "CRITICAL", lifecycle: "NEW",
    repository: "acme/auth-service", commitSha: DEMO_SHA, createdAt: "Yesterday",
    originalReport: "The report claims that get_admin_records in admin.py returns administrative records without checking the caller's role. The referenced function name could not be located in the supplied revision.",
    reviewerNotes: "", missingEvidence: ["Correct route or function reference", "Expected authorization policy", "Reproduction context"],
    investigationSteps: ["Locate the relevant administrative route.", "Compare its authorization requirements with product policy."],
    businessImpact: "Requires reviewer assessment",
    claims: [
      { id: "CL-1043-A", title: "Referenced admin function cannot be located", excerpt: "admin.py:get_admin_records is reported as lacking a role check.", assertion: "Verify that get_admin_records exists at the specified revision and line range.", component: "Administration / records", filePath: "admin.py", functionName: "get_admin_records", lineStart: 140, lineEnd: 148, status: "INCONSISTENT_REFERENCE", reason: "The file exists, but the named function and supplied line range do not match this revision. A nearby list_admin_records symbol may be related; a reviewer must confirm.", snippet: ["def list_admin_records(actor):", "    require_role(actor, \"admin\")", "    return records.list_visible_to(actor)"], missingEvidence: ["Confirm whether the report references an older function name"] }
    ]
  },
  {
    id: "VF-1044", analysisId: "AN-LOCAL-DEMO",
    title: "Potential unsafe object deserialization in worker", reportTitle: "Automated Triage — Background Worker",
    category: "Insecure deserialization", severity: "MEDIUM", lifecycle: "NEW",
    repository: "acme/auth-service", commitSha: DEMO_SHA, createdAt: "Yesterday",
    originalReport: "An automated report flags a dynamic object-loading path in worker.py. It does not identify the accepted input format, trust boundary, or whether untrusted data can reach the deserializer.",
    reviewerNotes: "", missingEvidence: ["Input trust boundary", "Accepted serialization format", "A safe reproduction demonstrating reachability"],
    investigationSteps: ["Identify the concrete decoder implementation.", "Establish who can supply payload bytes and how they are validated."],
    businessImpact: "Requires reviewer assessment",
    claims: [
      { id: "CL-1044-A", title: "Worker contains a dynamic payload-loading path", excerpt: "The background worker loads a serialized payload before dispatch.", assertion: "Identify the exact decoder implementation and determine whether external data can reach it.", component: "Background processing", filePath: "worker.py", functionName: "load_job_payload", lineStart: 51, lineEnd: 62, status: "MANUAL_INVESTIGATION", reason: "The file and entry point are present in the demo source map, but the report omits the decoder and input provenance needed for a reliable classification.", snippet: ["def load_job_payload(payload, decoder):", "    if not payload:", "        raise ValueError(\"empty payload\")", "    return decoder(payload)"], missingEvidence: ["Concrete decoder implementation", "Who controls payload bytes", "Validation performed before decoding"] }
    ]
  }
];

export const demoCorrelationFinding: Finding = {
  ...demoFindings[0],
  id: "VF-1042-ALT",
  title: "Query parameter handling in user lookup",
  reportTitle: "Independent query-handling report",
  originalReport: "A second independent report describes the same lookup_user path from a database query-handling perspective. Its evidence is retained separately for reviewer comparison.",
  claims: demoFindings[0].claims.map((claim) => ({ ...claim, id: `${claim.id}-ALT`, title: "Review query parameter binding" })),
};

export const demoImpact: ImpactResult = {
  analysisId: "AN-LOCAL-DEMO",
  reference: "LOCAL DEMO · Patch preview",
  summary: "The referenced authentication function changed in this illustrative patch. Retesting is required; no finding is resolved automatically.",
  originalCommitSha: DEMO_SHA,
  currentCommitSha: "b".repeat(40),
  changedFilesScope: "referenced_files",
  warning: "Local mock only: code changes require retesting; no finding has been resolved automatically.",
  changedFiles: [
    { path: "auth.py", claimsAffected: 2, linkedFindingIds: ["VF-1042"], retestRequired: true, manualReviewRequired: false },
    { path: "admin.py", claimsAffected: 1, linkedFindingIds: ["VF-1043"], retestRequired: false, manualReviewRequired: true },
    { path: "worker.py", claimsAffected: 1, linkedFindingIds: ["VF-1044"], retestRequired: false, manualReviewRequired: true }
  ],
  impacts: [{
    findingId: "VF-1042", claimId: "CL-1042-A", filePath: "auth.py", flag: "RETEST_REQUIRED",
    reason: "Referenced function changed; reviewer must retest.",
    original: [
      { number: 88, text: "def lookup_user(username: str):", kind: "context" },
      { number: 89, text: "    query = \"SELECT id, role FROM users WHERE username = %s\"", kind: "removed" },
      { number: 90, text: "    cursor.execute(query, (username,))", kind: "context" }
    ],
    current: [
      { number: 88, text: "def lookup_user(username: str):", kind: "context" },
      { number: 89, text: "    normalized = username.strip()", kind: "added" },
      { number: 90, text: "    query = \"SELECT id, role FROM users WHERE username = %s\"", kind: "context" },
      { number: 91, text: "    cursor.execute(query, (normalized,))", kind: "context" }
    ],
    diff: "- old query call\n+ normalized lookup",
    currentVerificationStatus: "Verified reference"
  }]
};
