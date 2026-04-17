import type { IBillingProvider, WorkspaceUsage } from '@coworker/core'

// OSS billing: all features always enabled, no payment required
export class NoopBillingProvider implements IBillingProvider {
  async isFeatureEnabled(_workspaceId: string, _feature: string): Promise<boolean> {
    return true
  }

  async getUsage(_workspaceId: string): Promise<WorkspaceUsage> {
    return { agentRunsThisMonth: 0, storageUsedBytes: 0, membersCount: 0 }
  }

  async createCheckoutSession(_workspaceId: string, _priceId: string): Promise<string> {
    throw new Error('Billing is not available in the open source version')
  }

  async handleWebhookEvent(_payload: unknown, _signature: string): Promise<void> {
    // no-op
  }
}
