import type { Finding, ImpactPayload, ImpactResult, IntakePayload, IntakeResponse, ReviewPayload } from "../types";
import { getDemoState, mockImpact, mockIntake, mockReview } from "./mock";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
export const isDemoMode = !API_BASE;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function submitIntake(payload: IntakePayload): Promise<IntakeResponse> {
  if (isDemoMode) return mockIntake(payload);
  return request<IntakeResponse>("/api/intake", { method: "POST", body: JSON.stringify(payload) });
}

export async function getFindings(): Promise<Finding[]> {
  if (isDemoMode) return getDemoState().findings;
  return request<Finding[]>("/api/findings");
}

export async function getFinding(id: string): Promise<Finding> {
  if (isDemoMode) {
    const finding = getDemoState().findings.find((item) => item.id === id);
    if (finding) return finding;
    throw new Error("Finding not found");
  }
  return request<Finding>(`/api/findings/${encodeURIComponent(id)}`);
}

export async function submitReview(id: string, payload: ReviewPayload): Promise<Finding> {
  if (isDemoMode) return mockReview(id, payload);
  return request<Finding>(`/api/findings/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify(payload) });
}

export async function analyzeImpact(payload: ImpactPayload): Promise<ImpactResult> {
  if (isDemoMode) return mockImpact(payload);
  return request<ImpactResult>("/api/impact-analysis", { method: "POST", body: JSON.stringify(payload) });
}
