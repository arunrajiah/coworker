const BASE = 'https://api.vercel.com'

export interface VercelTeam {
  id: string
  slug: string
  name: string
}

export interface VercelProject {
  id: string
  name: string
  framework: string | null
  link?: { type: string; repoId?: string; org?: string; repo?: string }
  latestDeployments?: VercelDeployment[]
}

export interface VercelDeployment {
  uid: string
  name: string
  url: string
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED'
  createdAt: number
  buildingAt?: number
  ready?: number
  target: 'production' | 'staging' | null
  meta?: Record<string, string>
  creator?: { username: string }
}

export class VercelAdapter {
  constructor(private token: string, private teamId?: string) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = new URL(`${BASE}${path}`)
    if (this.teamId) url.searchParams.set('teamId', this.teamId)

    const res = await fetch(url.toString(), {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(`Vercel API ${res.status}: ${err.error?.message ?? res.statusText}`)
    }

    return res.json() as Promise<T>
  }

  async getUser(): Promise<{ id: string; username: string; email: string; name: string }> {
    const data = await this.request<{ user: { id: string; username: string; email: string; name: string } }>('/v2/user')
    return data.user
  }

  async getTeams(): Promise<VercelTeam[]> {
    const data = await this.request<{ teams: VercelTeam[] }>('/v2/teams?limit=100')
    return data.teams ?? []
  }

  async getProjects(): Promise<VercelProject[]> {
    const data = await this.request<{ projects: VercelProject[] }>('/v9/projects?limit=100')
    return data.projects ?? []
  }

  async getProject(projectId: string): Promise<VercelProject> {
    return this.request<VercelProject>(`/v9/projects/${projectId}`)
  }

  async listDeployments(projectId: string, limit = 20): Promise<VercelDeployment[]> {
    const data = await this.request<{ deployments: VercelDeployment[] }>(
      `/v6/deployments?projectId=${projectId}&limit=${limit}`
    )
    return data.deployments ?? []
  }

  async getDeployment(deploymentId: string): Promise<VercelDeployment> {
    return this.request<VercelDeployment>(`/v13/deployments/${deploymentId}`)
  }

  async triggerDeployment(projectId: string, target: 'production' | 'staging' = 'production'): Promise<VercelDeployment> {
    const project = await this.getProject(projectId)
    return this.request<VercelDeployment>('/v13/deployments', {
      method: 'POST',
      body: JSON.stringify({
        name: project.name,
        target,
        ...(this.teamId ? { teamId: this.teamId } : {}),
      }),
    })
  }
}
