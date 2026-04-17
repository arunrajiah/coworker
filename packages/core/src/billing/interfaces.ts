export interface WorkspaceUsage {
  agentRunsThisMonth: number
  storageUsedBytes: number
  membersCount: number
}

export interface IBillingProvider {
  isFeatureEnabled(workspaceId: string, feature: string): Promise<boolean>
  getUsage(workspaceId: string): Promise<WorkspaceUsage>
  // SaaS implementations provide real Stripe URLs; OSS throws NotImplemented
  createCheckoutSession(workspaceId: string, priceId: string): Promise<string>
  handleWebhookEvent(payload: unknown, signature: string): Promise<void>
}
