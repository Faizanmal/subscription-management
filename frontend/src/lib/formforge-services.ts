import { api } from '@/lib/api-base';
import type { Analytics, Form, FormGenerateRequest, FormTemplate, Submission } from '@/types';

interface SubmissionResponse {
  message?: string;
  redirect?: string;
}

export const formsApi = {
  list: () => api.get<Form[]>('/forms/'),

  get: (id: string) => api.get<Form>(`/forms/${id}/`),

  create: (data: FormGenerateRequest) => api.post<Form>('/forms/', data),

  update: (id: string, data: Partial<Form>) => api.patch<Form>(`/forms/${id}/`, data),

  publish: (id: string) => api.post<Form>(`/forms/${id}/publish/`),

  getAnalytics: (id: string) => api.get<Analytics>(`/forms/${id}/analytics/`),
};

export const submissionsApi = {
  list: (formId: string) => api.get<Submission[]>(`/forms/${formId}/submissions/`),

  submit: (slug: string, payload: Record<string, unknown>) =>
    api.post<SubmissionResponse>(`/forms/${slug}/submit/`, payload),
};

export const templatesApi = {
  list: () => api.get<FormTemplate[]>('/form-templates/'),

  use: (id: string) => api.post<Form>(`/form-templates/${id}/use/`),
};
