/**
 * API Services for Subscription Waste Manager
 */
import { api } from './api-base';
import type {
  User,
  Organization,
  Invitation,
  Subscription,
  Vendor,
  LicenseAssignment,
  UsageMetrics,
  CostRecord,
  RedundancyGroup,
  Recommendation,
  Workflow,
  WorkflowExecution,
  RenewalAlert,
  BudgetAlert,
  Integration,
  BankAccount,
  BankTransaction,
  Webhook,
  SSOConnection,
  SlackNotification,
  APIKey,
  MFADevice,
  Session,
  AuditLog,
  SecuritySettings,
  BackupSchedule,
  Backup,
  DataExport,
  ImportJob,
  Notification,
  DashboardStats,
  DashboardTrend,
  CategoryBreakdown,
  PaginatedResponse,
  AuthTokens,
  LoginCredentials,
  RegisterData,
} from '@/types/swm';

// ==================== Auth API ====================

export const authApi = {
  login: (credentials: LoginCredentials) =>
    api.post<AuthTokens>('/auth/token/', credentials),

  register: (data: RegisterData) =>
    api.post<{ user: User; tokens: AuthTokens }>('/auth/register/', data),

  logout: () =>
    api.post('/auth/logout/'),

  refreshToken: (refresh: string) =>
    api.post<{ access: string }>('/auth/token/refresh/', { refresh }),

  me: () =>
    api.get<User>('/auth/me/'),

  updateProfile: (data: Partial<User>) =>
    api.patch<User>('/auth/me/', data),

  changePassword: (data: { old_password: string; new_password: string; new_password2: string }) =>
    api.post('/auth/me/password/', data),

  updateNotificationSettings: (settings: Record<string, unknown>) =>
    api.patch('/users/me/notification-settings/', settings),

  requestPasswordReset: (email: string) =>
    api.post('/security/password-reset/', { email }),

  confirmPasswordReset: (token: string, password: string, password2: string) =>
    api.post('/security/password-reset/confirm/', { token, new_password: password, new_password2: password2 }),

  googleLogin: () =>
    api.get<{ auth_url: string }>('/integrations/oauth/google/'),

  microsoftLogin: () =>
    api.get<{ auth_url: string }>('/integrations/oauth/microsoft/'),
};

// ==================== Organization API ====================

export const organizationApi = {
  get: () =>
    api.get<Organization>('/auth/organizations/current/'),

  update: (data: Partial<Organization>) =>
    api.patch<Organization>('/auth/organizations/', data),

  updateSettings: (settings: Partial<Organization['settings']>) =>
    api.patch<Organization>('/auth/organizations/', { settings }),

  getMembers: () =>
    api.get<User[]>('/auth/users/'),

  getMember: (id: string) =>
    api.get<User>(`/auth/users/${id}/`),

  updateMember: (id: string, data: Partial<User>) =>
    api.patch<User>(`/auth/users/${id}/`, data),

  removeMember: (id: string) =>
    api.delete(`/auth/users/${id}/`),

  getInvitations: () =>
    api.get<Invitation[]>('/auth/invitations/'),

  sendInvitation: (data: { email: string; role: string }) =>
    api.post<Invitation>('/auth/invitations/', data),

  resendInvitation: (id: string) =>
    api.post<Invitation>(`/auth/invitations/${id}/resend/`),

  revokeInvitation: (id: string) =>
    api.post(`/auth/invitations/${id}/cancel/`),
};

// ==================== Subscriptions API ====================

export const subscriptionsApi = {
  list: (params?: {
    status?: string;
    category?: string;
    department?: string;
    owner?: string;
    search?: string;
    ordering?: string;
    page?: number;
  }) =>
    api.get<PaginatedResponse<Subscription>>('/subscriptions/', { params }),

  get: (id: string) =>
    api.get<Subscription>(`/subscriptions/${id}/`),

  create: (data: Partial<Subscription>) =>
    api.post<Subscription>('/subscriptions/', data),

  update: (id: string, data: Partial<Subscription>) =>
    api.patch<Subscription>(`/subscriptions/${id}/`, data),

  delete: (id: string) =>
    api.delete(`/subscriptions/${id}/`),

  cancel: (id: string, reason?: string) =>
    api.post(`/subscriptions/${id}/cancel/`, { reason }),

  renew: (id: string) =>
    api.post<Subscription>(`/subscriptions/${id}/renew/`),

  // Licenses
  getLicenses: (id: string) =>
    api.get<LicenseAssignment[]>(`/subscriptions/${id}/licenses/`),

  assignLicense: (id: string, data: { user_id: string; license_type?: string }) =>
    api.post<LicenseAssignment>(`/subscriptions/${id}/licenses/`, data),

  revokeLicense: (id: string, licenseId: string) =>
    api.delete(`/subscriptions/${id}/licenses/${licenseId}/`),

  // Usage
  getUsage: (id: string, params?: { period_type?: string; limit?: number }) =>
    api.get<UsageMetrics[]>(`/subscriptions/${id}/usage/`, { params }),

  // Costs
  getCosts: (id: string, params?: { limit?: number }) =>
    api.get<CostRecord[]>(`/subscriptions/${id}/costs/`, { params }),

  addCost: (id: string, data: Partial<CostRecord>) =>
    api.post<CostRecord>(`/subscriptions/${id}/costs/`, data),

  // Recommendations
  getRecommendations: (id: string) =>
    api.get<Recommendation[]>(`/subscriptions/${id}/recommendations/`),
};

// ==================== Vendors API ====================

export const vendorsApi = {
  list: (params?: { category?: string; search?: string }) =>
    api.get<PaginatedResponse<Vendor>>('/vendors/', { params }),

  get: (id: string) =>
    api.get<Vendor>(`/vendors/${id}/`),

  search: (query: string) =>
    api.get<Vendor[]>('/vendors/search/', { params: { q: query } }),
};

// ==================== Usage Metrics API ====================

export const usageApi = {
  list: (params?: {
    subscription?: string;
    period_type?: string;
    start_date?: string;
    end_date?: string;
  }) =>
    api.get<PaginatedResponse<UsageMetrics>>('/usage-metrics/', { params }),

  getAggregated: (params?: {
    period?: 'day' | 'week' | 'month';
    start_date?: string;
    end_date?: string;
  }) =>
    api.get<{
      total_active_users: number;
      total_logins: number;
      avg_session_duration: number;
      by_subscription: { subscription_id: string; name: string; active_users: number }[];
    }>('/usage-metrics/', { params }),

  track: (subscriptionId: string) =>
    api.post(`/usage-events/`, { subscription_id: subscriptionId, event_type: 'manual_track' }),
};

// ==================== Costs API ====================

export const costsApi = {
  list: (params?: {
    subscription?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  }) =>
    api.get<PaginatedResponse<CostRecord>>('/cost-records/', { params }),

  getSummary: (params?: {
    period?: 'month' | 'quarter' | 'year';
    group_by?: 'category' | 'department' | 'subscription';
  }) =>
    api.get<{
      total: number;
      by_category: CategoryBreakdown[];
      by_department: { department: string; spend: number; subscription_count?: number }[];
      trend: DashboardTrend[];
    }>('/analytics/spend/', { params }),
};

// ==================== Redundancy API ====================

export const redundancyApi = {
  list: () =>
    api.get<PaginatedResponse<RedundancyGroup>>('/redundancies/'),

  get: (id: string) =>
    api.get<RedundancyGroup>(`/redundancies/${id}/`),

  dismiss: (id: string, reason?: string) =>
    api.post(`/redundancies/${id}/dismiss/`, { reason }),

  resolve: (id: string) =>
    api.post(`/redundancies/${id}/start_consolidation/`),

  scan: () =>
    api.post<{ task_id: string }>('/redundancies/scan/'),
};

// ==================== Recommendations API ====================

export const recommendationsApi = {
  list: (params?: {
    status?: string;
    type?: string;
    priority?: string;
    subscription?: string;
  }) =>
    api.get<PaginatedResponse<Recommendation>>('/recommendations/', { params }),

  get: (id: string) =>
    api.get<Recommendation>(`/recommendations/${id}/`),

  approve: (id: string) =>
    api.post<Recommendation>(`/recommendations/${id}/approve/`),

  dismiss: (id: string, reason: string) =>
    api.post(`/recommendations/${id}/dismiss/`, { reason }),

  implement: (id: string) =>
    api.post<Recommendation>(`/recommendations/${id}/implement/`),

  generate: () =>
    api.post<{ task_id: string }>('/recommendations/generate/'),

  getQuickWins: (limit?: number) =>
    api.get<Recommendation[]>('/recommendations/quick-wins/', { params: { limit } }),

  getSavingsSummary: () =>
    api.get<{
      total_potential: number;
      implemented: number;
      by_type: { type: string; count: number; savings: number }[];
    }>('/recommendations/savings-summary/'),
};

// ==================== Workflows API ====================

export const workflowsApi = {
  list: () =>
    api.get<PaginatedResponse<Workflow>>('/workflows/'),

  get: (id: string) =>
    api.get<Workflow>(`/workflows/${id}/`),

  create: (data: Partial<Workflow>) =>
    api.post<Workflow>('/workflows/', data),

  update: (id: string, data: Partial<Workflow>) =>
    api.patch<Workflow>(`/workflows/${id}/`, data),

  delete: (id: string) =>
    api.delete(`/workflows/${id}/`),

  toggle: (id: string) =>
    api.post<Workflow>(`/workflows/${id}/toggle/`),

  run: (id: string) =>
    api.post<WorkflowExecution>(`/workflows/${id}/run/`),

  getExecutions: (id: string) =>
    api.get<WorkflowExecution[]>(`/workflows/${id}/executions/`),

  listExecutions: () =>
    api.get<PaginatedResponse<WorkflowExecution>>('/workflow-executions/'),
};

// ==================== Alerts API ====================

export const alertsApi = {
  getRenewals: (params?: { days?: number }) =>
    api.get<PaginatedResponse<RenewalAlert>>('/alerts/', { params: { ...params, alert_type: 'renewal' } }).then((data) => data.results || []),

  listRenewalAlerts: (params?: { days?: number }) =>
    api.get<PaginatedResponse<RenewalAlert>>('/alerts/', { params: { ...params, alert_type: 'renewal' } }),

  dismissRenewal: (id: string) =>
    api.post(`/alerts/${id}/take_action/`, { action: 'resolve' }),

  dismissRenewalAlert: (id: string) =>
    api.post<RenewalAlert>(`/alerts/${id}/take_action/`, { action: 'resolve' }),

  acknowledgeRenewalAlert: (id: string) =>
    api.post<RenewalAlert>(`/alerts/${id}/take_action/`, { action: 'acknowledge' }),

  getBudgets: () =>
    api.get<BudgetAlert[]>('/budgets/'),

  listBudgetAlerts: () =>
    api.get<PaginatedResponse<BudgetAlert>>('/budgets/'),

  createBudgetAlert: (data: Partial<BudgetAlert>) =>
    api.post<BudgetAlert>('/budgets/', data),

  dismissBudget: (id: string) =>
    api.delete(`/budgets/${id}/`),

  deleteBudgetAlert: (id: string) =>
    api.delete(`/budgets/${id}/`),
};

// ==================== Integrations API ====================

export const integrationsApi = {
  list: () =>
    api.get<Integration[]>('/integrations/'),

  get: (id: string) =>
    api.get<Integration>(`/integrations/${id}/`),

  create: (data: Partial<Integration>) =>
    api.post<Integration>('/integrations/', data),

  update: (id: string, data: Partial<Integration>) =>
    api.patch<Integration>(`/integrations/${id}/`, data),

  delete: (id: string) =>
    api.delete(`/integrations/${id}/`),

  sync: (id: string) =>
    api.post<{ task_id: string }>(`/integrations/${id}/sync/`),

  test: (id: string) =>
    api.post<{ success: boolean; message: string }>(`/integrations/${id}/test/`),

  // Bank Accounts (Plaid)
  getBankAccounts: () =>
    api.get<BankAccount[]>('/integrations/bank-accounts/'),

  listBankAccounts: () =>
    api.get<PaginatedResponse<BankAccount>>('/integrations/bank-accounts/'),

  createPlaidLink: () =>
    api.post<{ link_token: string }>('/integrations/bank-accounts/create_link_token/'),

  exchangePlaidToken: (publicToken: string) =>
    api.post<BankAccount[]>('/integrations/bank-accounts/exchange_token/', { public_token: publicToken }),

  syncBankAccount: (id: string) =>
    api.post(`/integrations/bank-accounts/${id}/sync/`),

  deleteBankAccount: (id: string) =>
    api.delete(`/integrations/bank-accounts/${id}/`),

  // Transactions
  getTransactions: (params?: {
    bank_account?: string;
    is_recurring?: boolean;
    unmatched?: boolean;
    start_date?: string;
    end_date?: string;
  }) =>
    api.get<PaginatedResponse<BankTransaction>>('/integrations/transactions/', { params }),

  matchTransaction: (id: string, subscriptionId: string) =>
    api.post(`/integrations/transactions/${id}/match/`, { subscription_id: subscriptionId }),

  // Webhooks
  getWebhooks: () =>
    api.get<Webhook[]>('/integrations/webhooks/'),

  listWebhooks: () =>
    api.get<PaginatedResponse<Webhook>>('/integrations/webhooks/'),

  createWebhook: (data: Partial<Webhook>) =>
    api.post<Webhook>('/integrations/webhooks/', data),

  updateWebhook: (id: string, data: Partial<Webhook>) =>
    api.patch<Webhook>(`/integrations/webhooks/${id}/`, data),

  deleteWebhook: (id: string) =>
    api.delete(`/integrations/webhooks/${id}/`),

  testWebhook: (id: string) =>
    api.post<{ success: boolean }>(`/integrations/webhooks/${id}/test/`),

  // SSO
  getSSOConnections: () =>
    api.get<SSOConnection[]>('/integrations/sso/'),

  listSSOConnections: () =>
    api.get<PaginatedResponse<SSOConnection>>('/integrations/sso/'),

  createSSOConnection: (data: Partial<SSOConnection>) =>
    api.post<SSOConnection>('/integrations/sso/', data),

  deleteSSOConnection: (id: string) =>
    api.delete(`/integrations/sso/${id}/`),

  // Slack
  getSlackNotifications: () =>
    api.get<SlackNotification[]>('/integrations/slack/'),

  createSlackNotification: (data: Partial<SlackNotification>) =>
    api.post<SlackNotification>('/integrations/slack/', data),

  updateSlackNotification: (id: string, data: Partial<SlackNotification>) =>
    api.patch<SlackNotification>(`/integrations/slack/${id}/`, data),

  deleteSlackNotification: (id: string) =>
    api.delete(`/integrations/slack/${id}/`),

  testSlackNotification: (id: string) =>
    api.post<{ success: boolean }>(`/integrations/slack/${id}/test/`),

  connectSlack: (workspaceId: string) =>
    api.post('/integrations/slack/connect/', { workspace_id: workspaceId }),
};

// ==================== Security API ====================

export const securityApi = {
  // API Keys
  getAPIKeys: () =>
    api.get<APIKey[]>('/security/api-keys/'),

  listApiKeys: () =>
    api.get<PaginatedResponse<APIKey>>('/security/api-keys/'),

  createAPIKey: (data: { name: string; scopes: string[]; expires_at?: string }) =>
    api.post<APIKey & { key: string }>('/security/api-keys/', data),

  createApiKey: (data: { name: string; scopes: string[]; expires_at?: string }) =>
    api.post<APIKey & { key: string; secret: string }>('/security/api-keys/', data),

  revokeAPIKey: (id: string) =>
    api.post(`/security/api-keys/${id}/revoke/`),

  revokeApiKey: (id: string) =>
    api.post(`/security/api-keys/${id}/revoke/`),

  regenerateAPIKey: (id: string) =>
    api.post<{ key: string }>(`/security/api-keys/${id}/regenerate/`),

  // MFA
  getMFADevices: () =>
    api.get<MFADevice[]>('/security/mfa/'),

  listMfaDevices: () =>
    api.get<PaginatedResponse<MFADevice>>('/security/mfa/'),

  setupTOTP: () =>
    api.post<{ secret: string; qr_code: string; backup_codes: string[] }>('/security/mfa/setup_totp/'),

  setupMFA: (type: string) =>
    api.post<{ secret: string; qr_code: string; backup_codes: string[] }>(`/security/mfa/setup_${type}/`),

  verifyTOTP: (code: string) =>
    api.post<{ success: boolean }>('/security/mfa/verify/', { type: 'totp', code }),

  setupSMS: (phone: string) =>
    api.post<{ success: boolean }>('/security/mfa/setup_sms/', { phone }),

  verifySMS: (code: string) =>
    api.post<{ success: boolean }>('/security/mfa/verify/', { type: 'sms', code }),

  setupEmail: () =>
    api.post<{ success: boolean }>('/security/mfa/setup_email/'),

  verifyEmail: (code: string) =>
    api.post<{ success: boolean }>('/security/mfa/verify/', { type: 'email', code }),

  removeMFADevice: (id: string) =>
    api.delete(`/security/mfa/${id}/`),

  removeMfaDevice: (id: string) =>
    api.delete(`/security/mfa/${id}/`),

  // Sessions
  getSessions: () =>
    api.get<Session[]>('/security/sessions/'),

  listSessions: () =>
    api.get<PaginatedResponse<Session>>('/security/sessions/'),

  terminateSession: (id: string) =>
    api.post(`/security/sessions/${id}/terminate/`),

  revokeSession: (id: string) =>
    api.post(`/security/sessions/${id}/terminate/`),

  terminateAllSessions: () =>
    api.post('/security/sessions/terminate_all/'),

  revokeAllSessions: () =>
    api.post('/security/sessions/terminate_all/'),

  // Security Settings
  getSettings: () =>
    api.get<SecuritySettings>('/security/settings/'),

  updateSettings: (data: Partial<SecuritySettings>) =>
    api.patch<SecuritySettings>('/security/settings/', data),

  // Audit Logs
  getAuditLogs: (params?: {
    user?: string;
    action?: string;
    resource_type?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
  }) =>
    api.get<PaginatedResponse<AuditLog>>('/security/access-logs/', { params }),

  // Dashboard
  getSecurityDashboard: () =>
    api.get<{
      mfa_adoption: number;
      active_sessions: number;
      recent_login_attempts: number;
      api_key_count: number;
      suspicious_activities: number;
    }>('/security/dashboard/'),
};

// ==================== Backups API ====================

export const backupsApi = {
  // Schedules
  getSchedules: () =>
    api.get<BackupSchedule[]>('/backups/schedules/'),

  createSchedule: (data: Partial<BackupSchedule>) =>
    api.post<BackupSchedule>('/backups/schedules/', data),

  updateSchedule: (id: string, data: Partial<BackupSchedule>) =>
    api.patch<BackupSchedule>(`/backups/schedules/${id}/`, data),

  deleteSchedule: (id: string) =>
    api.delete(`/backups/schedules/${id}/`),

  // Backups
  getBackups: () =>
    api.get<Backup[]>('/backups/'),

  createBackup: () =>
    api.post<Backup>('/backups/', { type: 'manual' }),

  downloadBackup: (id: string) =>
    api.get<{ download_url: string }>(`/backups/${id}/download/`),

  restoreBackup: (id: string) =>
    api.post<{ task_id: string }>(`/backups/${id}/restore/`),

  deleteBackup: (id: string) =>
    api.delete(`/backups/${id}/`),

  // Exports
  getExports: () =>
    api.get<DataExport[]>('/backups/exports/'),

  createExport: (data: {
    export_type: string;
    format: string;
    filters?: Record<string, unknown>;
  }) =>
    api.post<DataExport>('/backups/exports/', data),

  downloadExport: (id: string) =>
    api.get<{ download_url: string }>(`/backups/exports/${id}/download/`),

  // Imports
  getImports: () =>
    api.get<ImportJob[]>('/backups/imports/'),

  createImport: (file: File, importType: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('import_type', importType);
    return api.post<ImportJob>('/backups/imports/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  previewImport: (id: string) =>
    api.get<{
      headers: string[];
      sample_rows: string[][];
      total_rows: number;
    }>(`/backups/imports/${id}/preview/`),

  setImportMapping: (id: string, mapping: Record<string, string>) =>
    api.post(`/backups/imports/${id}/set_mapping/`, { field_mapping: mapping }),

  startImport: (id: string) =>
    api.post<ImportJob>(`/backups/imports/${id}/start/`),

  cancelImport: (id: string) =>
    api.post(`/backups/imports/${id}/cancel/`),

  // Data Retention
  getRetentionPolicy: () =>
    api.get<{
      audit_logs_days: number;
      usage_data_days: number;
      backup_retention_days: number;
    }>('/backups/retention/'),

  updateRetentionPolicy: (data: {
    audit_logs_days?: number;
    usage_data_days?: number;
    backup_retention_days?: number;
  }) =>
    api.patch('/backups/retention/', data),
};

// ==================== Notifications API ====================

export const notificationsApi = {
  list: (params?: { unread_only?: boolean }) =>
    api.get<Notification[]>('/auth/notifications/', { params }),

  markAsRead: (id: string) =>
    api.post(`/auth/notifications/${id}/read/`),

  markAllAsRead: () =>
    api.post('/auth/notifications/mark_all_read/'),

  delete: (id: string) =>
    api.delete(`/auth/notifications/${id}/`),

  getUnreadCount: () =>
    api.get<{ count: number }>('/auth/notifications/unread_count/'),
};

// ==================== Dashboard API ====================

export const dashboardApi = {
  getStats: () =>
    api.get<DashboardStats>('/dashboard/'),

  getTrends: (params?: { period?: 'week' | 'month' | 'quarter' | 'year' }) =>
    api.get<DashboardTrend[]>('/analytics/trend/', { params }).then((data) =>
      Array.isArray(data) ? data.map((item: any) => ({
        period: item.period,
        date: item.date,
        cost: Number(item.spend ?? item.cost ?? 0),
        amount: Number(item.spend ?? item.amount ?? 0),
        subscription_count: Number(item.subscription_count ?? 0),
      })) : []
    ),

  getCategoryBreakdown: () =>
    api.get<{ by_category: CategoryBreakdown[] }>('/analytics/spend/').then((data) =>
      (data?.by_category || []).map((item: any) => ({
        category: item.category,
        count: Number(item.subscription_count ?? item.count ?? 0),
        cost: Number(item.spend ?? item.cost ?? 0),
        avg_utilization: Number(item.avg_utilization ?? 0),
      }))
    ),

  getTopSpend: (limit?: number) =>
    api.get<{ top_subscriptions: Subscription[] }>('/analytics/spend/', { params: { limit } }).then((data) =>
      data?.top_subscriptions || []
    ),

  getLowUtilization: (threshold?: number, limit?: number) =>
    api.get<PaginatedResponse<Subscription>>('/subscriptions/', {
      params: {
        status: 'active',
        ordering: 'utilization_rate',
        page_size: limit,
      },
    }).then((data) =>
      (data?.results || []).filter((s) => Number(s.utilization_rate || 0) <= (threshold || 30))
    ),

  getUpcomingRenewals: (days?: number) =>
    api.get<PaginatedResponse<RenewalAlert>>('/alerts/', { params: { alert_type: 'renewal', days } }).then((data) =>
      (data?.results || []).map((alert) => alert.subscription).filter(Boolean) as Subscription[]
    ),

  getOptimizationReport: () =>
    api.get<{
      generated_at: string;
      summary: {
        total_subscriptions: number;
        total_monthly_spend: number;
        avg_utilization: number;
        pending_recommendations: number;
        potential_monthly_savings: number;
      };
      by_category: Record<string, {
        count: number;
        total_cost: number;
        subscriptions: { name: string; cost: number; utilization: number }[];
      }>;
      top_recommendations: {
        subscription: string;
        type: string;
        title: string;
        savings: number;
        priority: string;
      }[];
      low_utilization: { name: string; utilization: number; cost: number }[];
      upcoming_renewals: { name: string; renewal_date: string; cost: number }[];
    }>('/dashboard/'),
};

// ==================== Discovery API ====================

export const discoveryApi = {
  scan: (source: 'email' | 'bank' | 'sso' | 'all') =>
    api.post<{ task_id: string }>('/discovery/scan/', { source }),

  getScanStatus: (taskId: string) =>
    api.get<{
      status: 'pending' | 'running' | 'completed' | 'failed';
      progress: number;
      found_count: number;
      message?: string;
    }>(`/discovery/status/${taskId}/`),

  getPendingDiscoveries: () =>
    api.get<{
      id: string;
      name: string;
      vendor_match?: Vendor;
      source: string;
      confidence: number;
      raw_data: Record<string, unknown>;
      created_at: string;
    }[]>('/discovery/pending/'),

  confirmDiscovery: (id: string, data?: Partial<Subscription>) =>
    api.post<Subscription>(`/discovery/${id}/confirm/`, data),

  dismissDiscovery: (id: string) =>
    api.post(`/discovery/${id}/dismiss/`),
};
