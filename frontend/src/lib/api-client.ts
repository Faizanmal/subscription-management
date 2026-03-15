/**
 * API Client for FormForge
 */
import { apiClient } from '@/lib/api';
import type {
  User,
  Form,
  FormSchema,
  Submission,
  FormTemplate,
  Integration,
  LoginCredentials,
  RegisterData,
  FormGenerateRequest,
  Analytics,
  AuthTokens
} from '@/types';

// Auth API
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthTokens> => {
    const response = await apiClient.post('/auth/login/', credentials);
    return response.data;
  },

  register: async (data: RegisterData): Promise<{ user: User; tokens: AuthTokens }> => {
    const response = await apiClient.post('/users/register/', data);
    return response.data;
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get('/users/me/');
    return response.data;
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const response = await apiClient.post('/auth/refresh/', { refresh });
    return response.data;
  },
};

// Forms API
export const formsApi = {
  list: async (): Promise<Form[]> => {
    const response = await apiClient.get('/forms/');
    return response.data.results || response.data;
  },

  get: async (id: string): Promise<Form> => {
    const response = await apiClient.get(`/forms/${id}/`);
    return response.data;
  },

  create: async (data: {
    title?: string;
    description?: string;
    schema_json?: FormSchema;
    prompt?: string;
    context?: string;
  }): Promise<Form> => {
    const response = await apiClient.post('/forms/', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Form>): Promise<Form> => {
    const response = await apiClient.patch(`/forms/${id}/`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/forms/${id}/`);
  },

  publish: async (id: string): Promise<{ status: string; published_at: string }> => {
    const response = await apiClient.post(`/forms/${id}/publish/`);
    return response.data;
  },

  getEmbedCode: async (id: string): Promise<{ embed_code: string; hosted_link: string; slug: string }> => {
    const response = await apiClient.get(`/forms/${id}/embed/`);
    return response.data;
  },

  getAnalytics: async (id: string): Promise<Analytics> => {
    const response = await apiClient.get(`/forms/${id}/analytics/`);
    return response.data;
  },

  generate: async (request: FormGenerateRequest): Promise<FormSchema> => {
    const response = await apiClient.post('/generate/', request);
    return response.data;
  },
};

// Submissions API
export const submissionsApi = {
  list: async (formId: string): Promise<Submission[]> => {
    const response = await apiClient.get(`/forms/${formId}/submissions/`);
    return response.data.results || response.data;
  },

  get: async (formId: string, submissionId: string): Promise<Submission> => {
    const response = await apiClient.get(`/forms/${formId}/submissions/${submissionId}/`);
    return response.data;
  },

  // Public submission (no auth)
  submit: async (slug: string, payload: Record<string, unknown>): Promise<{ id: string; message: string; redirect: string }> => {
    const response = await apiClient.post(`/public/submit/${slug}/`, { payload });
    return response.data;
  },
};

// Templates API
export const templatesApi = {
  list: async (category?: string): Promise<FormTemplate[]> => {
    const params = category ? { category } : {};
    const response = await apiClient.get('/templates/', { params });
    return response.data.results || response.data;
  },

  get: async (id: string): Promise<FormTemplate> => {
    const response = await apiClient.get(`/templates/${id}/`);
    return response.data;
  },

  use: async (id: string): Promise<Form> => {
    const response = await apiClient.post(`/templates/${id}/use/`);
    return response.data;
  },
};

// Integrations API
export const integrationsApi = {
  list: async (formId?: string): Promise<Integration[]> => {
    const url = formId ? `/forms/${formId}/integrations/` : '/integrations/';
    const response = await apiClient.get(url);
    return response.data.results || response.data;
  },

  create: async (data: {
    form: string;
    integration_type: string;
    config: Record<string, unknown>;
    is_active?: boolean;
  }): Promise<Integration> => {
    const response = await apiClient.post('/integrations/', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Integration>): Promise<Integration> => {
    const response = await apiClient.patch(`/integrations/${id}/`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/integrations/${id}/`);
  },

  test: async (id: string): Promise<{ status: string; message: string }> => {
    const response = await apiClient.post(`/integrations/${id}/test/`);
    return response.data;
  },

  initiateGoogleOAuth: async (formId: string): Promise<{ authorization_url: string; state: string }> => {
    const response = await apiClient.get('/integrations/google_sheets_auth/', {
      params: { form_id: formId }
    });
    return response.data;
  },

  completeGoogleOAuth: async (data: { code: string; state: string; form_id: string }): Promise<Integration> => {
    const response = await apiClient.post('/integrations/google_sheets_connect/', data);
    return response.data;
  },

  getWebhookLogs: async (integrationId?: string): Promise<unknown[]> => {
    const url = integrationId 
      ? `/integrations/webhook-logs/?integration=${integrationId}`
      : '/integrations/webhook-logs/';
    const response = await apiClient.get(url);
    return response.data.results || response.data;
  },

  retryWebhook: async (logId: string): Promise<{ status: string }> => {
    const response = await apiClient.post(`/integrations/webhook-logs/${logId}/retry/`);
    return response.data;
  },
};
