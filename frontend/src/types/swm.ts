/**
 * Type definitions for Subscription Waste Manager
 */

// ==================== User & Organization Types ====================

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar?: string | File;
  role: UserRole;
  department?: string;
  job_title?: string;
  timezone?: string;
  is_active: boolean;
  mfa_enabled: boolean;
  email_verified: boolean;
  organization_id: string;
  organization_name?: string;
  last_login?: string;
  date_joined?: string;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'admin' | 'finance' | 'department_lead' | 'it_admin' | 'viewer' | 'manager';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logo?: string;
  plan: PlanType;
  plan_expires_at?: string;
  settings: OrganizationSettings;
  subscription_count: number;
  total_monthly_cost: number;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export type PlanType = 'free' | 'starter' | 'professional' | 'enterprise';

export interface OrganizationSettings {
  currency: string;
  timezone: string;
  fiscal_year_start: number;
  notification_preferences: NotificationPreferences;
  discovery_settings: DiscoverySettings;
  budget_alerts: BudgetAlertSettings;
}

export interface NotificationPreferences {
  email_enabled: boolean;
  slack_enabled: boolean;
  renewal_reminder_days: number[];
  budget_threshold_percent: number;
}

export interface DiscoverySettings {
  scan_emails: boolean;
  scan_bank: boolean;
  scan_sso: boolean;
  auto_categorize: boolean;
}

export interface BudgetAlertSettings {
  enabled: boolean;
  threshold_percent: number;
  monthly_budget?: number;
  department_budgets?: Record<string, number>;
}

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  created_at: string;
}

// ==================== Subscription Types ====================

export interface Vendor {
  id: string;
  name: string;
  website?: string;
  logo?: string;
  category: VendorCategory;
  description?: string;
  avg_rating?: number;
  review_count?: number;
  pricing_model?: string;
  created_at: string;
}

export type VendorCategory = 
  | 'productivity'
  | 'communication'
  | 'development'
  | 'design'
  | 'marketing'
  | 'sales'
  | 'finance'
  | 'hr'
  | 'security'
  | 'analytics'
  | 'cloud'
  | 'storage'
  | 'project_management'
  | 'other';

export interface Subscription {
  id: string;
  organization_id: string;
  vendor_id?: string;
  vendor?: Vendor;
  name: string;
  description?: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  monthly_cost: number;
  annual_cost: number;
  currency: string;
  start_date: string;
  renewal_date?: string;
  cancellation_date?: string;
  contract_end_date?: string;
  auto_renew: boolean;
  total_licenses: number;
  assigned_licenses: number;
  utilization_rate: number;
  owner_id?: string;
  owner?: User;
  department?: string;
  cost_center?: string;
  payment_method: PaymentMethod;
  contract_url?: string;
  notes?: string;
  tags: string[];
  discovered_via?: DiscoverySource;
  last_usage_at?: string;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus = 'active' | 'trial' | 'expiring' | 'expired' | 'cancelled' | 'suspended' | 'pending';
export type BillingCycle = 'monthly' | 'quarterly' | 'annual' | 'one_time' | 'usage_based';
export type PaymentMethod = 'credit_card' | 'invoice' | 'bank_transfer' | 'paypal' | 'other';
export type DiscoverySource = 'manual' | 'email_scan' | 'bank_feed' | 'sso' | 'expense_report' | 'api';

export interface SubscriptionOwner {
  id: string;
  subscription_id: string;
  user_id: string;
  user?: User;
  is_primary: boolean;
  assigned_at: string;
}

export interface LicenseAssignment {
  id: string;
  subscription_id: string;
  user_id: string;
  user?: User;
  license_type?: string;
  assigned_at: string;
  last_used_at?: string;
  status: 'active' | 'inactive' | 'pending';
}

// ==================== Usage & Analytics Types ====================

export interface UsageMetrics {
  id: string;
  subscription_id: string;
  period_type: 'daily' | 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  active_users: number;
  total_logins: number;
  total_sessions: number;
  avg_session_duration: number;
  feature_usage: Record<string, number>;
  api_calls?: number;
  data_storage_gb?: number;
  recorded_at: string;
  utilization_rate: number;
  total_users: number;
  created_at: string;
}

export interface DashboardTrend {
  period?: string;
  date?: string;
  amount: number;
  cost?: number;
  subscription_count?: number;
  new_subscriptions?: number;
  cancelled_subscriptions?: number;
  recorded_at?: string;
}

export interface CostRecord {
  id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  period_start: string;
  period_end: string;
  invoice_number?: string;
  invoice_url?: string;
  payment_status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  payment_date?: string;
  notes?: string;
  created_at: string;
}

export interface RedundancyGroup {
  id: string;
  name: string;
  category: string;
  description?: string;
  subscriptions: Subscription[];
  overlap_score: number;
  potential_savings: number;
  total_monthly_cost: number;
  recommendation?: string;
  status: 'detected' | 'reviewing' | 'resolved' | 'dismissed';
  created_at: string;
}

// ==================== Recommendation Types ====================

export interface Recommendation {
  id: string;
  subscription_id: string;
  subscription?: Subscription;
  type: RecommendationType;
  title: string;
  description: string;
  impact_summary?: string;
  estimated_savings: number;
  potential_savings: number;
  implementation_steps: string[];
  priority: RecommendationPriority;
  status: RecommendationStatus;
  ai_confidence: number;
  confidence_score: number;
  ai_reasoning?: string;
  implemented_at?: string;
  dismissed_at?: string;
  dismissed_reason?: string;
  created_at: string;
  updated_at: string;
}

export type RecommendationType = 
  | 'downgrade'
  | 'cancel'
  | 'renegotiate'
  | 'consolidate'
  | 'optimize'
  | 'rightsizing'
  | 'remove_licenses'
  | 'upgrade';

export type RecommendationPriority = 'low' | 'medium' | 'high' | 'critical';
export type RecommendationStatus = 'pending' | 'in_review' | 'approved' | 'implemented' | 'dismissed';

// ==================== Workflow Types ====================

export interface Workflow {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  trigger_type: WorkflowTrigger;
  trigger: WorkflowTrigger;
  trigger_config: Record<string, unknown>;
  steps: WorkflowStep[];
  action: WorkflowAction;
  conditions?: Record<string, unknown>;
  is_active: boolean;
  last_run_at?: string;
  last_run?: string;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export type WorkflowTrigger = 
  | 'renewal_approaching'
  | 'low_usage'
  | 'budget_exceeded'
  | 'new_subscription'
  | 'recommendation_created'
  | 'scheduled'
  | 'threshold'
  | 'schedule';

export interface WorkflowStep {
  order: number;
  action: WorkflowAction;
  config: Record<string, unknown>;
  delay_minutes?: number;
}

export type WorkflowAction = 
  | 'send_email'
  | 'send_slack'
  | 'create_task'
  | 'update_subscription'
  | 'create_approval'
  | 'webhook'
  | 'notify'
  | 'email';

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow?: Workflow;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  error_message?: string;
  steps_completed: number;
  trigger_reason?: string;
  created_at: string;
}

// ==================== Alert Types ====================

export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

export interface RenewalAlert {
  id: string;
  subscription_id: string;
  subscription?: Subscription;
  alert_type: 'renewal' | 'expiration' | 'trial_ending';
  days_until: number;
  sent_at?: string;
  dismissed_at?: string;
  acknowledged_at?: string;
  renewal_date: string;
  priority: AlertPriority;
  status: 'pending' | 'acknowledged' | 'dismissed';
  updated_at: string;
  created_at: string;
}

export interface BudgetAlert {
  id: string;
  organization_id: string;
  name: string;
  department?: string;
  category?: string;
  budget_amount: number;
  amount: number;
  current_spend: number;
  percent_used: number;
  alert_type: 'warning' | 'exceeded';
  period: 'monthly' | 'quarterly' | 'annual';
  period_start: string;
  period_end: string;
  is_triggered: boolean;
  updated_at: string;
  created_at: string;
}

// ==================== Integration Types ====================

export interface Integration {
  id: string;
  organization_id: string;
  type: IntegrationType;
  name: string;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  credentials_encrypted?: string;
  last_sync_at?: string;
  last_sync?: string;
  last_sync_status?: 'success' | 'partial' | 'failed';
  sync_status?: 'syncing' | 'success' | 'partial' | 'failed';
  error_message?: string;
  sync_frequency_hours: number;
  items_synced: number;
  created_at: string;
  updated_at: string;
}

export type IntegrationType = 
  | 'google_workspace'
  | 'microsoft_365'
  | 'okta'
  | 'azure_ad'
  | 'quickbooks'
  | 'xero'
  | 'plaid'
  | 'slack'
  | 'jira'
  | 'salesforce'
  | 'hubspot'
  | 'custom_api';

export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending_auth';

export interface BankAccount {
  id: string;
  organization_id: string;
  institution_name: string;
  institution?: string;
  institution_logo?: string;
  account_name: string;
  name?: string;
  account_type: string;
  account_mask: string;
  mask?: string;
  plaid_account_id?: string;
  is_active: boolean;
  status?: string;
  last_sync_at?: string;
  created_at: string;
}

export interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  category?: string;
  merchant_name?: string;
  merchant_logo?: string;
  is_recurring: boolean;
  subscription_id?: string;
  subscription?: Subscription;
  created_at: string;
}

export interface Webhook {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  is_active: boolean;
  last_triggered_at?: string;
  failure_count: number;
  created_at: string;
}

export interface SSOConnection {
  id: string;
  organization_id: string;
  provider: 'google' | 'microsoft' | 'okta' | 'azure_ad' | 'saml';
  domain: string;
  is_active: boolean;
  auto_provision: boolean;
  default_role: UserRole;
  user_count: number;
  created_at: string;
}

export interface SlackNotification {
  id: string;
  organization_id: string;
  channel_id: string;
  channel_name: string;
  event_types: string[];
  is_active: boolean;
  created_at: string;
}

// ==================== Security Types ====================

export interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  prefix?: string;
  scopes: string[];
  is_active: boolean;
  last_used_at?: string;
  last_used?: string;
  expires_at?: string;
  created_at: string;
}

export interface MFADevice {
  id: string;
  user_id: string;
  type: 'totp' | 'sms' | 'email';
  name?: string;
  is_primary: boolean;
  is_verified: boolean;
  last_used_at?: string;
  last_used?: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  ip_address: string;
  user_agent: string;
  device_type: string;
  device?: string;
  location?: string;
  is_current: boolean;
  last_activity: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user?: User;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address: string;
  user_agent?: string;
  created_at: string;
}

export interface SecuritySettings {
  id: string;
  organization_id: string;
  require_mfa: boolean;
  allowed_domains: string[];
  session_timeout_minutes: number;
  password_min_length: number;
  password_require_special: boolean;
  max_login_attempts: number;
  ip_whitelist: string[];
  created_at: string;
  updated_at: string;
}

// ==================== Backup Types ====================

export interface BackupSchedule {
  id: string;
  organization_id: string;
  name: string;
  schedule_type: 'daily' | 'weekly' | 'monthly';
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  day_of_week?: number;
  day_of_month?: number;
  retention_days: number;
  include_attachments: boolean;
  is_active: boolean;
  last_run_at?: string;
  last_run?: string;
  next_run_at?: string;
  created_at: string;
}

export interface Backup {
  id: string;
  organization_id: string;
  schedule_id?: string;
  schedule?: Partial<BackupSchedule>;
  type: 'scheduled' | 'manual';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'in_progress';
  file_name?: string;
  file_size?: number;
  size?: number;
  download_url?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface DataExport {
  id: string;
  organization_id: string;
  export_type: 'subscriptions' | 'costs' | 'usage' | 'recommendations' | 'audit_logs' | 'full';
  format: 'csv' | 'json' | 'xlsx';
  filters?: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_url?: string;
  size?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface ImportJob {
  id: string;
  organization_id: string;
  import_type: 'subscriptions' | 'users' | 'costs';
  source_file: string;
  filename?: string;
  status: 'pending' | 'mapping' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  processed_rows: number;
  total_items?: number;
  processed_items?: number;
  failed_rows?: number;
  error_log?: string[];
  error_count?: number;
  errors?: string[];
  field_mapping?: Record<string, string>;
  created_by?: string;
  created_at: string;
  completed_at?: string;
}

// ==================== Notification Types ====================

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export type NotificationType = 
  | 'renewal_reminder'
  | 'budget_alert'
  | 'recommendation'
  | 'integration_error'
  | 'team_invite'
  | 'subscription_added'
  | 'workflow_completed'
  | 'security_alert';

// ==================== Dashboard Types ====================

export interface DashboardStats {
  total_subscriptions: number;
  active_subscriptions: number;
  total_monthly_cost: number;
  monthly_spend?: number;
  total_annual_cost: number;
  avg_utilization: number;
  potential_savings: number;
  pending_recommendations: number;
  upcoming_renewals: number;
  low_utilization?: Subscription[];
  spendingTrend?: DashboardTrend[];
}

export interface CategoryBreakdown {
  category: VendorCategory;
  count: number;
  cost: number;
  avg_utilization: number;
}

export interface TopSpendItem {
  subscription: Subscription;
  monthly_cost: number;
  utilization: number;
  trend: 'up' | 'down' | 'stable';
}

// ==================== API Response Types ====================

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  expires_in: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  password2: string;
  first_name: string;
  last_name: string;
  organization_name: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
  new_password2: string;
}
