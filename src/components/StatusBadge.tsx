import { AlertCircle, CheckCircle2, Clock3, GitPullRequest, ShieldAlert, CircleDot } from "lucide-react";
import type { LifecycleStatus, Severity, VerificationStatus } from "../types";

type BadgeValue = VerificationStatus | LifecycleStatus | Severity | "RETEST_REQUIRED" | "POSSIBLE_DUPLICATE" | "SEPARATE";
const config: Record<BadgeValue, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  VERIFIED_REFERENCE: { label: "Verified reference", tone: "verified", icon: CheckCircle2 },
  INCONSISTENT_REFERENCE: { label: "Inconsistent reference", tone: "inconsistent", icon: AlertCircle },
  MANUAL_INVESTIGATION: { label: "Manual investigation", tone: "manual", icon: Clock3 },
  NEW: { label: "New", tone: "neutral", icon: CircleDot },
  INVESTIGATING: { label: "Investigating", tone: "manual", icon: Clock3 },
  VALIDATED: { label: "Validated", tone: "verified", icon: CheckCircle2 },
  RESOLVED: { label: "Resolved", tone: "neutral", icon: CheckCircle2 },
  CRITICAL: { label: "Critical", tone: "inconsistent", icon: ShieldAlert },
  HIGH: { label: "High", tone: "high", icon: ShieldAlert },
  MEDIUM: { label: "Medium", tone: "manual", icon: AlertCircle },
  LOW: { label: "Low", tone: "neutral", icon: CircleDot },
  RETEST_REQUIRED: { label: "Retest required", tone: "manual", icon: GitPullRequest },
  POSSIBLE_DUPLICATE: { label: "Possible duplicate", tone: "manual", icon: CircleDot },
  SEPARATE: { label: "Kept separate", tone: "neutral", icon: CircleDot },
};

export function StatusBadge({ value, compact = false }: { value: BadgeValue; compact?: boolean }) {
  const item = config[value];
  const Icon = item.icon;
  return <span className={`status-badge status-${item.tone} ${compact ? "status-compact" : ""}`}><Icon size={13} strokeWidth={2.2} />{item.label}</span>;
}