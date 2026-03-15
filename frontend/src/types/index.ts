/**
 * Type definitions for FormForge
 */

export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  plan: 'free' | 'starter' | 'pro' | 'business';
  created_at: string;
  updated_at: string;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
}

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'number' | 'date' | 'time' | 
        'select' | 'multiselect' | 'checkbox' | 'radio' | 'file' | 'url' | 'payment';
  label: string;
  placeholder?: string;
  required?: boolean;
  validation?: FieldValidation;
  options?: string[];
  help?: string;
  
  // Payment field specific
  amount?: number;  // Amount in cents
  currency?: string;  // USD, EUR, etc.
}

export interface ConditionalLogic {
  if: {
    field: string;
    operator: 'equals' | 'in' | 'contains' | 'gte' | 'lte';
    value: unknown;
  };
  show?: string[];
  hide?: string[];
}

export interface FormSettings {
  consent_text?: string;
  redirect?: string;
  integrations?: {
    google_sheets?: boolean;
    webhook?: boolean;
    email?: boolean;
    stripe?: boolean;
  };
}

export interface FormSchema {
  title: string;
  description: string;
  fields: FormField[];
  logic?: ConditionalLogic[];
  settings?: FormSettings;
}

export interface Form {
  id: string;
  title: string;
  slug: string;
  description: string;
  schema_json: FormSchema;
  settings_json: FormSettings;
  published_at: string | null;
  is_active: boolean;
  views_count: number;
  submissions_count: number;
  conversion_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  form: string;
  payload_json: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  processed_at: string | null;
  payment_status?: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_id?: string;
  payment_amount?: number;
  created_at: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: 'photography' | 'health' | 'fitness' | 'real_estate' | 'consulting' | 'events' | 'general';
  schema_json: FormSchema;
  thumbnail_url?: string;
  usage_count: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface Integration {
  id: string;
  type: 'google_sheets' | 'notion' | 'webhook' | 'stripe' | 'email' | 'zapier' | 'slack';
  name: string;
  config_json: Record<string, unknown>;
  status: 'active' | 'inactive' | 'error';
  last_triggered_at: string | null;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  password2: string;
  first_name?: string;
  last_name?: string;
}

export interface FormGenerateRequest {
  prompt: string;
  context?: string;
}

export interface Analytics {
  views: number;
  submissions: number;
  conversion_rate: number;
  recent_submissions: number;
  last_submission: string | null;
}
