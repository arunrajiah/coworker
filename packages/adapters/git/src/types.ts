export interface GitIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  url: string
  labels: string[]
  assignees: string[]
  createdAt: string
  updatedAt: string
  author: string
}

export interface GitPullRequest {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed' | 'merged'
  url: string
  sourceBranch: string
  targetBranch: string
  draft: boolean
  createdAt: string
  updatedAt: string
  author: string
}

export interface GitRepo {
  owner: string
  name: string
  fullName: string
  description: string | null
  url: string
  defaultBranch: string
  isPrivate: boolean
  openIssuesCount: number
}

export interface CreateIssueInput {
  title: string
  body?: string
  labels?: string[]
  assignees?: string[]
}

export interface UpdateIssueInput {
  title?: string
  body?: string
  state?: 'open' | 'closed'
  labels?: string[]
  assignees?: string[]
}

export interface WebhookEvent {
  type: 'push' | 'pull_request' | 'issues' | 'issue_comment' | 'unknown'
  action?: string
  repoOwner: string
  repoName: string
  payload: Record<string, unknown>
}

export interface GitAdapter {
  provider: 'github' | 'gitlab' | 'bitbucket'
  getRepo(owner: string, name: string): Promise<GitRepo>
  listIssues(owner: string, name: string, state?: 'open' | 'closed' | 'all'): Promise<GitIssue[]>
  getIssue(owner: string, name: string, number: number): Promise<GitIssue>
  createIssue(owner: string, name: string, input: CreateIssueInput): Promise<GitIssue>
  updateIssue(owner: string, name: string, number: number, input: UpdateIssueInput): Promise<GitIssue>
  listPullRequests(owner: string, name: string, state?: 'open' | 'closed' | 'all'): Promise<GitPullRequest[]>
  verifyWebhook(body: string, signature: string, secret: string): boolean
  parseWebhookEvent(headers: Record<string, string>, body: string): WebhookEvent
}
