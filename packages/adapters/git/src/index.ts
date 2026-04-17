export * from './types.js'
export * from './github.js'
export * from './gitlab.js'
export * from './bitbucket.js'

export type { GitAdapter } from './types.js'

import { GitHubAdapter } from './github.js'
import { GitLabAdapter } from './gitlab.js'
import { BitbucketAdapter } from './bitbucket.js'
import type { GitAdapter } from './types.js'

export function createGitAdapter(provider: 'github' | 'gitlab' | 'bitbucket', token: string): GitAdapter {
  switch (provider) {
    case 'github': return new GitHubAdapter(token)
    case 'gitlab': return new GitLabAdapter(token)
    case 'bitbucket': return new BitbucketAdapter(token)
  }
}
