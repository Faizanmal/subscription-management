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
    api.post<AuthTokens>('/auth/login/', credentials),

  register: (data: RegisterData) =>
    api.post<{ user: User; tokens: AuthTokens }>('/users/register/', data),

  logout: () =>
    api.post('/auth/logout/'),

  refreshToken: (refresh: string) =>
    api.post<{ access: string }>('/auth/refresh/', { refresh }),

  me: () =>
    api.get<User>('/users/me/'),

  updateProfile: (data: Partial<User>) =>
    api.patch<User>('/users/me/', data),

  changePassword: (data: { old_password: string; new_password: string; new_password2: string }) =>
    api.post('/users/me/change_password/', data),

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
    api.get<Organization>('/users/organization/'),

  update: (data: Partial<Organization>) =>
    api.patch<Organization>('/users/organization/', data),

  updateSettings: (settings: Partial<Organization['settings']>) =>
    api.patch<Organization>('/users/organization/', { settings }),

  getMembers: () =>
    api.get<User[]>('/users/members/'),

  getMember: (id: string) =>
    api.get<User>(`/users/members/${id}/`),

  updateMember: (id: string, data: Partial<User>) =>
    api.patch<User>(`/users/members/${id}/`, data),

  removeMember: (id: string) =>
    api.delete(`/users/members/${id}/`),

  getInvitations: () =>
    api.get<Invitation[]>('/users/invitations/'),

  sendInvitation: (data: { email: string; role: string }) =>
    api.post<Invitation>('/users/invitations/', data),

  resendInvitation: (id: string) =>
    api.post<Invitation>(`/users/invitations/${id}/resend/`),

  revokeInvitation: (id: string) =>
    api.post(`/users/invitations/${id}/revoke/`),
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
    api.get<PaginatedResponse<Subscription>>('/services/subscriptions/', { params }),

  get: (id: string) =>
    api.get<Subscription>(`/services/subscriptions/${id}/`),

  create: (data: Partial<Subscription>) =>
    api.post<Subscription>('/services/subscriptions/', data),

  update: (id: string, data: Partial<Subscription>) =>
    api.patch<Subscription>(`/services/subscriptions/${id}/`, data),

  delete: (id: string) =>
    api.delete(`/services/subscriptions/${id}/`),

  cancel: (id: string, reason?: string) =>
    api.post(`/services/subscriptions/${id}/cancel/`, { reason }),

  renew: (id: string) =>
    api.post<Subscription>(`/services/subscriptions/${id}/renew/`),

  // Licenses
  getLicenses: (id: string) =>
    api.get<LicenseAssignment[]>(`/services/subscriptions/${id}/licenses/`),

  assignLicense: (id: string, data: { user_id: string; license_type?: string }) =>
    api.post<LicenseAssignment>(`/services/subscriptions/${id}/licenses/`, data),

  revokeLicense: (id: string, licenseId: string) =>
    api.delete(`/services/subscriptions/${id}/licenses/${licenseId}/`),

  // Usage
  getUsage: (id: string, params?: { period_type?: string; limit?: number }) =>
    api.get<UsageMetrics[]>(`/services/subscriptions/${id}/usage/`, { params }),

  // Costs
  getCosts: (id: string, params?: { limit?: number }) =>
    api.get<CostRecord[]>(`/services/subscriptions/${id}/costs/`, { params }),

  addCost: (id: string, data: Partial<CostRecord>) =>
    api.post<CostRecord>(`/services/subscriptions/${id}/costs/`, data),

  // Recommendations
  getRecommendations: (id: string) =>
    api.get<Recommendation[]>(`/services/subscriptions/${id}/recommendations/`),
};

// ==================== Vendors API ====================

export const vendorsApi = {
  list: (params?: { category?: string; search?: string }) =>
    api.get<PaginatedResponse<Vendor>>('/services/vendors/', { params }),

  get: (id: string) =>
    api.get<Vendor>(`/services/vendors/${id}/`),

  search: (query: string) =>
    api.get<Vendor[]>('/services/vendors/search/', { params: { q: query } }),
};

// ==================== Usage Metrics API ====================

export const usageApi = {
  list: (params?: {
    subscription?: string;
    period_type?: string;
    start_date?: string;
    end_date?: string;
  }) =>
    api.get<PaginatedResponse<UsageMetrics>>('/services/usage/', { params }),

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
    }>('/services/usage/aggregated/', { params }),

  track: (subscriptionId: string) =>
    api.post(`/services/usage/track/`, { subscription_id: subscriptionId }),
};

// ==================== Costs API ====================

export const costsApi = {
  list: (params?: {
    subscription?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  }) =>
    api.get<PaginatedResponse<CostRecord>>('/services/costs/', { params }),

  getSummary: (params?: {
    period?: 'month' | 'quarter' | 'year';
    group_by?: 'category' | 'department' | 'subscription';
  }) =>
    api.get<{
      total: number;
      by_category: CategoryBreakdown[];
      by_department: { department: string; cost: number }[];
      trend: DashboardTrend[];
    }>('/services/costs/summary/', { params }),
};

// ==================== Redundancy API ====================

export const redundancyApi = {
  list: () =>
    api.get<PaginatedResponse<RedundancyGroup>>('/services/redundancy-groups/'),

  get: (id: string) =>
    api.get<RedundancyGroup>(`/services/redundancy-groups/${id}/`),

  dismiss: (id: string, reason?: string) =>
    api.post(`/services/redundancy-groups/${id}/dismiss/`, { reason }),

  resolve: (id: string) =>
    api.post(`/services/redundancy-groups/${id}/resolve/`),

  scan: () =>
    api.post<{ task_id: string }>('/services/redundancy-groups/scan/'),
};

// ==================== Recommendations API ====================

export const recommendationsApi = {
  list: (params?: {
    status?: string;
    type?: string;
    priority?: string;
    subscription?: string;
  }) =>
    api.get<PaginatedResponse<Recommendation>>('/services/recommendations/', { params }),

  get: (id: string) =>
    api.get<Recommendation>(`/services/recommendations/${id}/`),

  approve: (id: string) =>
    api.post<Recommendation>(`/services/recommendations/${id}/approve/`),

  dismiss: (id: string, reason: string) =>
    api.post(`/services/recommendations/${id}/dismiss/`, { reason }),

  implement: (id: string) =>
    api.post<Recommendation>(`/services/recommendations/${id}/implement/`),

  generate: () =>
    api.post<{ task_id: string }>('/services/recommendations/generate/'),

  getQuickWins: (limit?: number) =>
    api.get<Recommendation[]>('/services/recommendations/quick-wins/', { params: { limit } }),

  getSavingsSummary: () =>
    api.get<{
      total_potential: number;
      implemented: number;
      by_type: { type: string; count: number; savings: number }[];
    }>('/services/recommendations/savings-summary/'),
};

// ==================== Workflows API ====================

export const workflowsApi = {
  list: () =>
    api.get<PaginatedResponse<Workflow>>('/services/workflows/'),

  get: (id: string) =>
    api.get<Workflow>(`/services/workflows/${id}/`),

  create: (data: Partial<Workflow>) =>
    api.post<Workflow>('/services/workflows/', data),

  update: (id: string, data: Partial<Workflow>) =>
    api.patch<Workflow>(`/services/workflows/${id}/`, data),

  delete: (id: string) =>
    api.delete(`/services/workflows/${id}/`),

  toggle: (id: string) =>
    api.post<Workflow>(`/services/workflows/${id}/toggle/`),

  run: (id: string) =>
    api.post<WorkflowExecution>(`/services/workflows/${id}/run/`),

  getExecutions: (id: string) =>
    api.get<WorkflowExecution[]>(`/services/workflows/${id}/executions/`),

  listExecutions: () =>
    api.get<PaginatedResponse<WorkflowExecution>>('/services/workflow-executions/'),
};

// ==================== Alerts API ====================

export const alertsApi = {
  getRenewals: (params?: { days?: number }) =>
    api.get<RenewalAlert[]>('/services/renewal-alerts/', { params }),

  listRenewalAlerts: (params?: { days?: number }) =>
    api.get<PaginatedResponse<RenewalAlert>>('/services/renewal-alerts/', { params }),

  dismissRenewal: (id: string) =>
    api.post(`/services/renewal-alerts/${id}/dismiss/`),

  dismissRenewalAlert: (id: string) =>
    api.post<RenewalAlert>(`/services/renewal-alerts/${id}/dismiss/`),

  acknowledgeRenewalAlert: (id: string) =>
    api.post<RenewalAlert>(`/services/renewal-alerts/${id}/acknowledge/`),

  getBudgets: () =>
    api.get<BudgetAlert[]>('/services/budget-alerts/'),

  listBudgetAlerts: () =>
    api.get<PaginatedResponse<BudgetAlert>>('/services/budget-alerts/'),

  createBudgetAlert: (data: Partial<BudgetAlert>) =>
    api.post<BudgetAlert>('/services/budget-alerts/', data),

  dismissBudget: (id: string) =>
    api.post(`/services/budget-alerts/${id}/dismiss/`),

  deleteBudgetAlert: (id: string) =>
    api.delete(`/services/budget-alerts/${id}/`),
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
    api.get<PaginatedResponse<AuditLog>>('/security/audit-logs/', { params }),

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
    api.get<Notification[]>('/users/notifications/', { params }),

  markAsRead: (id: string) =>
    api.post(`/users/notifications/${id}/read/`),

  markAllAsRead: () =>
    api.post('/users/notifications/mark_all_read/'),

  delete: (id: string) =>
    api.delete(`/users/notifications/${id}/`),

  getUnreadCount: () =>
    api.get<{ count: number }>('/users/notifications/unread_count/'),
};

// ==================== Dashboard API ====================

export const dashboardApi = {
  getStats: () =>
    api.get<DashboardStats>('/services/dashboard/stats/'),

  getTrends: (params?: { period?: 'week' | 'month' | 'quarter' | 'year' }) =>
    api.get<DashboardTrend[]>('/services/dashboard/trends/', { params }),

  getCategoryBreakdown: () =>
    api.get<CategoryBreakdown[]>('/services/dashboard/categories/'),

  getTopSpend: (limit?: number) =>
    api.get<Subscription[]>('/services/dashboard/top-spend/', { params: { limit } }),

  getLowUtilization: (threshold?: number, limit?: number) =>
    api.get<Subscription[]>('/services/dashboard/low-utilization/', { params: { threshold, limit } }),

  getUpcomingRenewals: (days?: number) =>
    api.get<Subscription[]>('/services/dashboard/upcoming-renewals/', { params: { days } }),

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
    }>('/services/dashboard/optimization-report/'),
};

// ==================== Discovery API ====================

export const discoveryApi = {
  scan: (source: 'email' | 'bank' | 'sso' | 'all') =>
    api.post<{ task_id: string }>('/services/discovery/scan/', { source }),

  getScanStatus: (taskId: string) =>
    api.get<{
      status: 'pending' | 'running' | 'completed' | 'failed';
      progress: number;
      found_count: number;
      message?: string;
    }>(`/services/discovery/status/${taskId}/`),

  getPendingDiscoveries: () =>
    api.get<{
      id: string;
      name: string;
      vendor_match?: Vendor;
      source: string;
      confidence: number;
      raw_data: Record<string, unknown>;
      created_at: string;
    }[]>('/services/discovery/pending/'),

  confirmDiscovery: (id: string, data?: Partial<Subscription>) =>
    api.post<Subscription>(`/services/discovery/${id}/confirm/`, data),

  dismissDiscovery: (id: string) =>
    api.post(`/services/discovery/${id}/dismiss/`),
};
