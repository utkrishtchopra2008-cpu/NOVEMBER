from datetime import datetime, timezone
from typing import Annotated, Literal
from urllib.parse import urlsplit
from uuid import uuid4
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SHA = Annotated[str, Field(pattern=r"^[0-9a-fA-F]{40}$")]
Status = Literal['Verified reference', 'Inconsistent reference', 'Requires manual investigation']
Decision = Literal['APPROVED', 'REJECTED', 'MORE_EVIDENCE']
Lifecycle = Literal['New', 'Investigating', 'Validated', 'Resolved']


def uid() -> str:
    return str(uuid4())


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid')


def repository(value: str) -> str:
    url = urlsplit(value)
    if url.scheme != 'https' or url.netloc != 'github.com' or url.query or url.fragment:
        raise ValueError('Use an HTTPS github.com owner/repository URL')
    path = url.path.rstrip('/')
    if path.endswith('.git'):
        path = path[:-4]
    if not re.fullmatch(r'/[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+', path) or path.split('/')[-1] in ('.', '..'):
        raise ValueError('Expected github.com/owner/repository')
    return 'https://github.com' + path


class Reference(Model):
    file_path: str | None = Field(default=None, max_length=500)
    function_name: str | None = Field(default=None, max_length=200)
    start_line: int | None = Field(default=None, ge=1, le=1000000)
    end_line: int | None = Field(default=None, ge=1, le=1000000)

    @field_validator('file_path')
    @classmethod
    def safe_path(cls, value):
        if value is not None and (not value or value.startswith('/') or '\\' in value or any(p in ('', '.', '..') for p in value.split('/')) or any(ord(c) < 32 for c in value)):
            raise ValueError('Expected a relative repository file path without traversal')
        return value

    @model_validator(mode='after')
    def line_range(self):
        if self.end_line is not None and (self.start_line is None or self.end_line < self.start_line):
            raise ValueError('end_line requires start_line and must not precede it')
        return self


class ClaimInput(Model):
    original_excerpt: str = Field(min_length=1, max_length=10000)
    assertion: str = Field(min_length=1, max_length=4000)
    component: str = Field(default='Unspecified', max_length=200)
    reference: Reference = Field(default_factory=Reference)
    assumptions: list[str] = Field(default_factory=list, max_length=20)


class Report(Model):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=100000)
    format: Literal['markdown', 'text', 'json'] = 'text'


class Intake(Model):
    repo_url: str
    commit_sha: SHA
    reports: list[Report] = Field(min_length=1, max_length=3)
    _repo = field_validator('repo_url')(repository)


class CodeLine(Model):
    number: int
    text: str
    kind: Literal['context', 'added', 'removed'] = 'context'


class Claim(ClaimInput):
    id: str = Field(default_factory=uid)
    verification_status: Status
    verification_reason: str
    snippet: list[CodeLine] = Field(default_factory=list)
    source_url: str | None = None


class ReviewInput(Model):
    decision: Decision
    notes: str = Field(min_length=1, max_length=10000)


class Review(ReviewInput):
    id: str = Field(default_factory=uid)
    reviewer_id: str
    created_at: str = Field(default_factory=now)


class Finding(Model):
    id: str = Field(default_factory=uid)
    analysis_id: str
    repo_url: str
    commit_sha: SHA
    report: Report
    claims: list[Claim]
    lifecycle: Lifecycle = 'New'
    severity: Literal['Unassessed', 'Low', 'Medium', 'High', 'Critical'] = 'Unassessed'
    business_impact: str = 'Requires reviewer assessment'
    reviews: list[Review] = Field(default_factory=list)
    verification_jobs: list['MaritimeJob'] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)
    investigation_steps: list[str] = Field(default_factory=lambda: ['Establish reproduction prerequisites and affected permissions.', 'Reproduce the claimed behavior in an authorized environment.'])
    extraction_metadata: dict = Field(default_factory=dict)
    created_at: str = Field(default_factory=now)


class CorrelationDecision(Model):
    decision: Literal['CONFIRMED_DUPLICATE', 'KEPT_SEPARATE']


class Correlation(Model):
    id: str = Field(default_factory=uid)
    finding_ids: list[str]
    shared_files: list[str]
    shared_functions: list[str]
    reasons: list[str]
    decision: Literal['PENDING', 'CONFIRMED_DUPLICATE', 'KEPT_SEPARATE'] = 'PENDING'
    decided_at: str | None = None
    reviewer_id: str | None = None


class Analysis(Model):
    id: str = Field(default_factory=uid)
    mode: Literal['demo', 'live']
    status: Literal['completed'] = 'completed'
    findings: list[Finding] = Field(default_factory=list)
    correlations: list[Correlation] = Field(default_factory=list)
    impact_history: list['ImpactHistoryEntry'] = Field(default_factory=list)
    created_at: str = Field(default_factory=now)


class LifecycleInput(Model):
    lifecycle: Lifecycle
    notes: str = Field(min_length=1, max_length=10000)


class ImpactInput(Model):
    analysis_id: str
    pr_url: str | None = None
    pr_number: int | None = Field(default=None, gt=0)
    new_commit_sha: str | None = Field(default=None, min_length=1, max_length=200)

    @model_validator(mode='after')
    def one_target(self):
        if sum(x is not None for x in (self.pr_url, self.pr_number, self.new_commit_sha)) != 1:
            raise ValueError('Provide exactly one of pr_url, pr_number, new_commit_sha (SHA or ref)')
        return self


class ImpactItem(Model):
    finding_id: str
    claim_id: str
    file_path: str | None
    flag: Literal['RETEST_REQUIRED', 'NO_REFERENCE_CHANGE', 'MANUAL_MAPPING_REQUIRED']
    reason: str
    original: list[CodeLine]
    current: list[CodeLine]
    diff: str
    current_verification_status: Status


class ImpactResult(Model):
    analysis_id: str
    original_commit_sha: SHA
    current_commit_sha: SHA
    changed_files: list[str]
    changed_files_scope: Literal['referenced_files'] = 'referenced_files'
    impacts: list[ImpactItem]
    warning: str = 'Code changes require retesting; no finding has been resolved automatically.'


class ImpactHistoryEntry(Model):
    id: str = Field(default_factory=uid)
    created_at: str = Field(default_factory=now)
    result: ImpactResult


class MaritimeJobInput(Model):
    claim_id: str


class MaritimeJob(Model):
    id: str = Field(default_factory=uid)
    finding_id: str
    claim_id: str
    file_path: str
    commit_sha: SHA
    sandbox_id: str
    status: Literal['PASSED', 'FAILED']
    exit_code: int
    created_at: str = Field(default_factory=now)
    message: str


class Packet(Model):
    finding: Finding
    related_reports: list[Correlation]
    markdown: str
    warning: str = 'Source-reference verification does not prove exploitability.'
