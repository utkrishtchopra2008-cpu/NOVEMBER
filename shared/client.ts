import type { components } from './api-schema';

export type Schemas = components['schemas'];
export type Finding = Schemas['Finding'];
export type Claim = Schemas['Claim'];
export type Analysis = Schemas['Analysis'];
export type Intake = Schemas['Intake'];
export type ImpactResult = Schemas['ImpactResult'];
export type ImpactHistoryEntry = Schemas['ImpactHistoryEntry'];

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Pass VITE_API_BASE_URL as baseUrl; never pass provider or database secrets. */
export function createApi(baseUrl: string, getAccessToken: () => Promise<string | null> = async () => null) {
  const root = baseUrl.replace(/\/$/, '');
  const id = encodeURIComponent;
  async function request<T>(path: string, body?: unknown, text = false): Promise<T> {
    const token = await getAccessToken();
    const response = await fetch(root + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new ApiError(response.status, payload?.error?.code ?? String(response.status), payload?.error?.message ?? 'API request failed');
    }
    return text ? await response.text() as T : await response.json() as T;
  }
  return {
    demo: () => request<Intake>('/api/demo'),
    intake: (input: Intake) => request<Analysis>('/api/intake', input),
    findings: () => request<Finding[]>('/api/findings'),
    finding: (findingId: string) => request<Finding>(`/api/findings/${id(findingId)}`),
    review: (findingId: string, input: Schemas['ReviewInput']) => request<Finding>(`/api/findings/${id(findingId)}/review`, input),
    lifecycle: (findingId: string, input: Schemas['LifecycleInput']) => request<Finding>(`/api/findings/${id(findingId)}/lifecycle`, input),
    correlations: (analysisId: string) => request<Schemas['Correlation'][]>(`/api/correlations?analysis_id=${id(analysisId)}`),
    decide: (analysisId: string, pairId: string, input: Schemas['CorrelationDecision']) => request<Schemas['Correlation']>(`/api/correlations/${id(pairId)}/decision?analysis_id=${id(analysisId)}`, input),
    packet: (findingId: string) => request<Schemas['Packet']>(`/api/findings/${id(findingId)}/packet`),
    markdown: (findingId: string) => request<string>(`/api/findings/${id(findingId)}/packet.md`, undefined, true),
    impact: (input: Schemas['ImpactInput']) => request<ImpactResult>('/api/impact-analysis', input),
    impactHistory: (analysisId: string) => request<ImpactHistoryEntry[]>(`/api/analyses/${id(analysisId)}/impact-history`),
    sandboxCheck: (findingId: string, claimId: string) => request<Schemas['MaritimeJob']>(`/api/findings/${id(findingId)}/sandbox-check`, { claim_id: claimId }),
    issueDraft: (findingId: string) => request<{title: string; body: string; github_url: string | null; published: boolean; message: string}>(`/api/findings/${id(findingId)}/issue-draft`),
    capabilities: () => request<{mode: 'demo' | 'live'; github_issue_push: boolean; jira_issue_push: boolean; maritime_execution: boolean; claim_extraction: string; intake_response: string}>('/api/capabilities'),
  };
}
