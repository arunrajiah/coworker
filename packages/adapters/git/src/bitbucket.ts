import { createHmac, timingSafeEqual } from 'crypto'
import type {
  GitAdapter, GitIssue, GitPullRequest, GitRepo,
  CreateIssueInput, UpdateIssueInput, WebhookEvent,
} from './types.js'

const BASE = 'https://api.bitbucket.org/2.0'

export class BitbucketAdapter implements GitAdapter {
  readonly provider = 'bitbucket' as const

  constructor(private token: string) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(`Bitbucket API ${res.status}: ${err.error?.message ?? res.statusText}`)
    }
    return res.json() as Promise<T>
  }

  async getRepo(owner: string, name: string): Promise<GitRepo> {
    const r = await this.request<any>(`/repositories/${owner}/${name}`)
    return {
      owner, name,
      fullName: r.full_name,
      description: r.description,
      url: r.links?.html?.href ?? '',
      defaultBranch: r.mainbranch?.name ?? 'main',
      isPrivate: r.is_private,
      openIssuesCount: 0,
    }
  }

  async listIssues(owner: string, name: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitIssue[]> {
    const q = state === 'all' ? '' : `?q=state="${state === 'open' ? 'new' : 'resolved'}"`
    const data = await this.request<any>(`/repositories/${owner}/${name}/issues${q}&pagelen=50`)
    return ((data.values ?? []) as any[]).map(mapBitbucketIssue)
  }

  async getIssue(owner: string, name: string, number: number): Promise<GitIssue> {
    const i = await this.request<any>(`/repositories/${owner}/${name}/issues/${number}`)
    return mapBitbucketIssue(i)
  }

  async createIssue(owner: string, name: string, input: CreateIssueInput): Promise<GitIssue> {
    const i = await this.request<any>(`/repositories/${owner}/${name}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        content: { raw: input.body ?? '' },
      }),
    })
    return mapBitbucketIssue(i)
  }

  async updateIssue(owner: string, name: string, number: number, input: UpdateIssueInput): Promise<GitIssue> {
    const body: Record<string, unknown> = {}
    if (input.title !== undefined) body.title = input.title
    if (input.body !== undefined) body.content = { raw: input.body }
    if (input.state !== undefined) body.status = input.state === 'closed' ? 'resolved' : 'new'
    const i = await this.request<any>(`/repositories/${owner}/${name}/issues/${number}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    return mapBitbucketIssue(i)
  }

  async listPullRequests(owner: string, name: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitPullRequest[]> {
    const stateParam = state === 'all'
      ? 'state=OPEN&state=MERGED&state=DECLINED&state=SUPERSEDED'
      : state === 'open' ? 'state=OPEN' : 'state=MERGED&state=DECLINED'
    const data = await this.request<any>(`/repositories/${owner}/${name}/pullrequests?${stateParam}&pagelen=50`)
    return ((data.values ?? []) as any[]).map(mapBitbucketPR)
  }

  verifyWebhook(body: string, signature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(body).digest('hex')
    try {
      return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
    } catch {
      return false
    }
  }

  parseWebhookEvent(headers: Record<string, string>, body: string): WebhookEvent {
    const event = headers['x-event-key'] ?? 'unknown'
    const payload = JSON.parse(body) as Record<string, unknown>
    const repo = (payload.repository as any) ?? {}
    return {
      type: mapBitbucketEventType(event),
      action: event,
      repoOwner: repo.owner?.username ?? repo.workspace?.slug ?? '',
      repoName: repo.slug ?? repo.name ?? '',
      payload,
    }
  }
}

function mapBitbucketEventType(event: string): WebhookEvent['type'] {
  if (event.startsWith('repo:push')) return 'push'
  if (event.startsWith('pullrequest:')) return 'pull_request'
  if (event.startsWith('issue:')) return 'issues'
  if (event.startsWith('issue_comment:') || event.startsWith('pullrequest:comment')) return 'issue_comment'
  return 'unknown'
}

function mapBitbucketIssue(i: any): GitIssue {
  return {
    id: i.id,
    number: i.id,
    title: i.title,
    body: i.content?.raw ?? null,
    state: ['resolved', 'closed', 'wontfix', 'duplicate', 'invalid'].includes(i.status) ? 'closed' : 'open',
    url: i.links?.html?.href ?? '',
    labels: i.kind ? [i.kind] : [],
    assignees: i.assignee ? [i.assignee.display_name] : [],
    createdAt: i.created_on,
    updatedAt: i.updated_on,
    author: i.reporter?.display_name ?? '',
  }
}

function mapBitbucketPR(p: any): GitPullRequest {
  const stateMap: Record<string, 'open' | 'closed' | 'merged'> = {
    OPEN: 'open', MERGED: 'merged', DECLINED: 'closed', SUPERSEDED: 'closed',
  }
  return {
    id: p.id,
    number: p.id,
    title: p.title,
    body: p.description ?? null,
    state: stateMap[p.state] ?? 'open',
    url: p.links?.html?.href ?? '',
    sourceBranch: p.source?.branch?.name ?? '',
    targetBranch: p.destination?.branch?.name ?? '',
    draft: false,
    createdAt: p.created_on,
    updatedAt: p.updated_on,
    author: p.author?.display_name ?? '',
  }
}
