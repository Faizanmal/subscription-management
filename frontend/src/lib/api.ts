/**
 * API Client for SyncQuote Backend
 */
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import type { User } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  withCredentials: true, // Important for httpOnly cookies
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    // Try to get token from zustand store
    if (typeof window !== 'undefined') {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          const token = parsed?.state?.accessToken;
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Failed to parse auth storage:', error);
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh and rate limiting
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }; // extend for retry flag

    // Handle rate limiting (429)
    if (error.response?.status === 429) {
      const retryAfter = (error.response.data as { retry_after?: number })?.retry_after || 60;
      const message = (error.response.data as { message?: string })?.message || 'Too many requests. Please try again later.';
      
      // You can integrate with your toast/notification system here
      console.warn(`Rate limit exceeded: ${message}`);
      
      return Promise.reject({
        ...error,
        isRateLimit: true,
        retryAfter,
        message
      });
    }

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh tokens endpoint sends new access token
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data;

        // Update access token in storage
        if (typeof window !== 'undefined') {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            try {
              const parsed = JSON.parse(authStorage);
              parsed.state.accessToken = accessToken;
              localStorage.setItem('auth-storage', JSON.stringify(parsed));
            } catch (e) {
              console.error('Failed to update token:', e);
            }
          }
        }

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-storage');
          window.location.href = '/signin';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Lightweight types used by this API client
export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
  duration_minutes?: number | null;
  created_at: string;
  updated_at: string;
  action_items_count?: number;
  is_shared?: boolean;
  is_favorite?: boolean;
  tags?: Tag[];
}

export interface MeetingDetail extends Meeting {
  file_path: string;
  file_size: number;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  error_message: string | null;
  transcript: string | null;
  summary: string | null;
  key_decisions: string[];
  share_token: string | null;
  share_url: string | null;
  speakers: Speaker[];
  action_items: ActionItem[];
  notes: MeetingNote[];
  transcript_segments: TranscriptSegment[];
}

export interface Speaker {
  id: string;
  name: string;
  speaker_id: string;
  created_at: string;
}

export interface TranscriptSegment {
  id: string;
  speaker: Speaker | null;
  text: string;
  start_time: number;
  end_time: number;
  confidence: number | null;
}

export interface ActionItem {
  id: string;
  meeting: string;
  meeting_title: string;
  task: string;
  owner: string | null;
  due_date: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  context: string | null;
  timestamp: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface MeetingNote {
  id: string;
  meeting: string;
  user: User;
  content: string;
  timestamp: number | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingStats {
  total_meetings: number;
  completed: number;
  processing: number;
  failed: number;
  total_action_items: number;
  pending_action_items: number;
  completion_rate: number;
}

export interface AnalyticsData {
  meeting_trends: Array<{
    date: string;
    count: number;
  }>;
  duration_stats: {
    average_minutes: number;
    total_hours: number;
    total_meetings: number;
  };
  status_distribution: Array<{
    status: string;
    count: number;
  }>;
  speaker_stats: Array<{
    name: string;
    segment_count: number;
    meeting_count: number;
  }>;
  action_item_priority: Array<{
    priority: string;
    count: number;
  }>;
  action_item_status: Array<{
    status: string;
    count: number;
  }>;
  completion_trends: Array<{
    week: string;
    completion_rate: number;
    total: number;
    completed: number;
  }>;
  tag_stats: Array<{
    name: string;
    color: string;
    meeting_count: number;
  }>;
}

export interface Activity {
  id: string;
  user: User;
  activity_type: string;
  activity_type_display: string;
  description: string;
  meeting: string | null;
  meeting_title: string | null;
  action_item: string | null;
  action_item_title: string | null;
  tag: string | null;
  tag_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MeetingTemplate {
  id: string;
  user: string | null;
  user_username: string | null;
  name: string;
  template_type: 'one_on_one' | 'standup' | 'retrospective' | 'planning' | 'brainstorm' | 'review' | 'custom';
  template_type_display: string;
  description: string;
  analysis_prompt: string;
  summary_focus: string;
  action_item_prompt: string;
  is_system: boolean;
  is_active: boolean;
  default_tags: string[];
  created_at: string;
  updated_at: string;
}

// ==================== API Functions ====================

// Authentication
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await apiClient.post('/auth/token/', { username, password });
    const { access, refresh } = response.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    return response.data;
  },

  register: async (username: string, email: string, password: string, timezone?: string) => {
    const response = await apiClient.post('/users/register/', { 
      username, 
      email, 
      password,
      password_confirm: password,
      timezone: timezone || 'UTC'
    });
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  verifyToken: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) throw new Error('No token found');
    return await apiClient.post('/auth/token/verify/', { token });
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get('/users/profile/');
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await apiClient.patch('/users/profile/', data);
    return response.data;
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    const response = await apiClient.post('/users/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
      new_password_confirm: newPassword,
    });
    return response.data;
  },
};

// Meetings
export const meetingsAPI = {
  list: async (params?: {
    search?: string;
    status?: string;
    ordering?: string;
    page?: number;
  }): Promise<{ results: Meeting[]; count: number; next: string | null; previous: string | null }> => {
    const response = await apiClient.get('/meetings/', { params });
    return response.data;
  },

  get: async (id: string): Promise<MeetingDetail> => {
    const response = await apiClient.get(`/meetings/${id}/`);
    return response.data;
  },

  create: async (data: FormData) => {
    const response = await apiClient.post('/meetings/', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minutes for uploads
    });
    return response.data;
  },

  update: async (id: string, data: Partial<Meeting>) => {
    const response = await apiClient.patch(`/meetings/${id}/`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await apiClient.delete(`/meetings/${id}/`);
  },

  getTranscript: async (id: string) => {
    const response = await apiClient.get(`/meetings/${id}/transcript/`);
    return response.data;
  },

  share: async (id: string) => {
    const response = await apiClient.post(`/meetings/${id}/share/`);
    return response.data;
  },

  getShared: async (token: string): Promise<MeetingDetail> => {
    const response = await apiClient.get(`/meetings/shared/${token}/`);
    return response.data;
  },

  getStats: async (): Promise<MeetingStats> => {
    const response = await apiClient.get('/meetings/stats/');
    return response.data;
  },

  getAnalytics: async (days: number = 30): Promise<AnalyticsData> => {
    const response = await apiClient.get('/meetings/analytics/', {
      params: { days }
    });
    return response.data;
  },

  exportPDF: async (id: string) => {
    const response = await apiClient.get(`/meetings/${id}/export_pdf/`, {
      responseType: 'blob',
    });
    return response.data;
  },

  toggleFavorite: async (id: string) => {
    const response = await apiClient.post(`/meetings/${id}/toggle_favorite/`);
    return response.data;
  },

  getFavorites: async (): Promise<Meeting[]> => {
    const response = await apiClient.get('/meetings/favorites/');
    return response.data;
  },

  exportMarkdown: async (id: string) => {
    const response = await apiClient.get(`/meetings/${id}/export_markdown/`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// Action Items
export const actionItemsAPI = {
  list: async (params?: {
    search?: string;
    status?: string;
    priority?: string;
    meeting?: string;
    ordering?: string;
    page?: number;
  }): Promise<{ results: ActionItem[]; count: number }> => {
    const response = await apiClient.get('/action-items/', { params });
    return response.data;
  },

  get: async (id: string): Promise<ActionItem> => {
    const response = await apiClient.get(`/action-items/${id}/`);
    return response.data;
  },

  create: async (data: Partial<ActionItem>) => {
    const response = await apiClient.post('/action-items/', data);
    return response.data;
  },

  update: async (id: string, data: Partial<ActionItem>) => {
    const response = await apiClient.patch(`/action-items/${id}/`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await apiClient.delete(`/action-items/${id}/`);
  },

  complete: async (id: string) => {
    const response = await apiClient.post(`/action-items/${id}/complete/`);
    return response.data;
  },
};

// Meeting Notes
export const notesAPI = {
  list: async (meetingId?: string) => {
    const response = await apiClient.get('/notes/', {
      params: meetingId ? { meeting: meetingId } : undefined,
    });
    return response.data;
  },

  create: async (data: { meeting: string; content: string; timestamp?: number }) => {
    const response = await apiClient.post('/notes/', data);
    return response.data;
  },

  update: async (id: string, data: Partial<MeetingNote>) => {
    const response = await apiClient.patch(`/notes/${id}/`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await apiClient.delete(`/notes/${id}/`);
  },
};

// Tags
export const tagsAPI = {
  list: async (): Promise<Tag[]> => {
    const response = await apiClient.get('/tags/');
    return response.data;
  },

  get: async (id: string): Promise<Tag> => {
    const response = await apiClient.get(`/tags/${id}/`);
    return response.data;
  },

  create: async (data: { name: string; color?: string }) => {
    const response = await apiClient.post('/tags/', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Tag>) => {
    const response = await apiClient.patch(`/tags/${id}/`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await apiClient.delete(`/tags/${id}/`);
  },
};

// Activities
export const activitiesAPI = {
  list: async (limit?: number): Promise<Activity[]> => {
    const params = limit ? { limit } : {};
    const response = await apiClient.get('/activities/', { params });
    return response.data;
  },

  get: async (id: string): Promise<Activity> => {
    const response = await apiClient.get(`/activities/${id}/`);
    return response.data;
  },
};

// Templates
export const templatesAPI = {
  list: async (): Promise<MeetingTemplate[]> => {
    const response = await apiClient.get('/templates/');
    return response.data;
  },

  get: async (id: string): Promise<MeetingTemplate> => {
    const response = await apiClient.get(`/templates/${id}/`);
    return response.data;
  },

  create: async (data: Partial<MeetingTemplate>) => {
    const response = await apiClient.post('/templates/', data);
    return response.data;
  },

  update: async (id: string, data: Partial<MeetingTemplate>) => {
    const response = await apiClient.patch(`/templates/${id}/`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await apiClient.delete(`/templates/${id}/`);
  },
};

// Integrations
export interface NotificationIntegration {
  id: string;
  integration_type: 'slack' | 'teams' | 'webhook';
  name: string;
  webhook_url: string;
  is_active: boolean;
  notify_on_meeting_complete: boolean;
  notify_on_action_items: boolean;
  notify_on_mentions: boolean;
  channel_id?: string;
  channel_name?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  integration: string;
  integration_name: string;
  integration_type: string;
  meeting: string | null;
  meeting_title: string | null;
  notification_type: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  retry_count: number;
  error_message: string;
  sent_at: string | null;
  created_at: string;
}

export const integrationsAPI = {
  list: async (): Promise<NotificationIntegration[]> => {
    const response = await apiClient.get('/integrations/');
    return response.data;
  },

  get: async (id: string): Promise<NotificationIntegration> => {
    const response = await apiClient.get(`/integrations/${id}/`);
    return response.data;
  },

  create: async (data: Partial<NotificationIntegration>) => {
    const response = await apiClient.post('/integrations/', data);
    return response.data;
  },

  update: async (id: string, data: Partial<NotificationIntegration>) => {
    const response = await apiClient.patch(`/integrations/${id}/`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await apiClient.delete(`/integrations/${id}/`);
  },

  test: async (id: string, testMessage?: string) => {
    const response = await apiClient.post(`/integrations/${id}/test/`, {
      integration_id: id,
      test_message: testMessage,
    });
    return response.data;
  },
};

export const notificationLogsAPI = {
  list: async (): Promise<NotificationLog[]> => {
    const response = await apiClient.get('/notification-logs/');
    return response.data;
  },

  get: async (id: string): Promise<NotificationLog> => {
    const response = await apiClient.get(`/notification-logs/${id}/`);
    return response.data;
  },
};

// Calendar
export interface CalendarConnection {
  id: string;
  provider: 'google' | 'outlook' | 'apple';
  is_active: boolean;
  account_email: string;
  calendar_id?: string;
  auto_import: boolean;
  auto_transcribe: boolean;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  last_sync_status: 'success' | 'failed' | 'pending';
  last_sync_error: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  connection: string;
  external_event_id: string;
  title: string;
  description: string;
  location: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  duration_minutes: number | null;
  organizer_email: string;
  attendees: string[];
  meeting_url: string;
  meeting_platform: 'zoom' | 'meet' | 'teams' | 'webex' | 'other' | '';
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  meeting: string | null;
  has_meeting: boolean;
  auto_transcribe_scheduled: boolean;
  transcription_reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface CalendarSyncLog {
  id: string;
  connection: string;
  connection_email: string;
  connection_provider: string;
  sync_started_at: string;
  sync_completed_at: string | null;
  duration_seconds: number | null;
  status: 'running' | 'success' | 'failed';
  events_fetched: number;
  events_created: number;
  events_updated: number;
  events_deleted: number;
  error_message: string;
}

export const calendarAPI = {
  // Connections
  listConnections: async (): Promise<CalendarConnection[]> => {
    const response = await apiClient.get('/calendar-connections/');
    return response.data;
  },

  getConnection: async (id: string): Promise<CalendarConnection> => {
    const response = await apiClient.get(`/calendar-connections/${id}/`);
    return response.data;
  },

  createConnection: async (data: Partial<CalendarConnection>) => {
    const response = await apiClient.post('/calendar-connections/', data);
    return response.data;
  },

  updateConnection: async (id: string, data: Partial<CalendarConnection>) => {
    const response = await apiClient.patch(`/calendar-connections/${id}/`, data);
    return response.data;
  },

  deleteConnection: async (id: string) => {
    await apiClient.delete(`/calendar-connections/${id}/`);
  },

  syncConnection: async (id: string) => {
    const response = await apiClient.post(`/calendar-connections/${id}/sync/`);
    return response.data;
  },

  // Events
  listEvents: async (): Promise<CalendarEvent[]> => {
    const response = await apiClient.get('/calendar-events/');
    return response.data;
  },

  getEvent: async (id: string): Promise<CalendarEvent> => {
    const response = await apiClient.get(`/calendar-events/${id}/`);
    return response.data;
  },

  // Sync Logs
  listSyncLogs: async (): Promise<CalendarSyncLog[]> => {
    const response = await apiClient.get('/calendar-sync-logs/');
    return response.data;
  },
};

// Workspaces
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  owner: string;
  owner_username: string;
  plan: 'free' | 'pro' | 'enterprise';
  is_active: boolean;
  max_members: number;
  max_meetings_per_month: number;
  max_storage_gb: number;
  member_count: number;
  is_at_member_limit: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace: string;
  workspace_name: string;
  user: string;
  user_username: string;
  user_email: string;
  role: 'admin' | 'manager' | 'member';
  is_active: boolean;
  invited_by: string | null;
  invited_by_username: string | null;
  invited_at: string;
  joined_at: string;
  custom_permissions: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace: string;
  workspace_name: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
  invited_by: string;
  invited_by_username: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  token: string;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
  is_expired: boolean;
}

export const workspacesAPI = {
  // Workspaces
  list: async (): Promise<Workspace[]> => {
    const response = await apiClient.get('/workspaces/');
    return response.data;
  },

  get: async (id: string): Promise<Workspace> => {
    const response = await apiClient.get(`/workspaces/${id}/`);
    return response.data;
  },

  create: async (data: Partial<Workspace>) => {
    const response = await apiClient.post('/workspaces/', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Workspace>) => {
    const response = await apiClient.patch(`/workspaces/${id}/`, data);
    return response.data;
  },

  delete: async (id: string) => {
    await apiClient.delete(`/workspaces/${id}/`);
  },

  // Members
  listMembers: async (): Promise<WorkspaceMember[]> => {
    const response = await apiClient.get('/workspace-members/');
    return response.data;
  },

  getMember: async (id: string): Promise<WorkspaceMember> => {
    const response = await apiClient.get(`/workspace-members/${id}/`);
    return response.data;
  },

  updateMember: async (id: string, data: Partial<WorkspaceMember>) => {
    const response = await apiClient.patch(`/workspace-members/${id}/`, data);
    return response.data;
  },

  removeMember: async (id: string) => {
    await apiClient.delete(`/workspace-members/${id}/`);
  },

  // Invitations
  listInvitations: async (): Promise<WorkspaceInvitation[]> => {
    const response = await apiClient.get('/workspace-invitations/');
    return response.data;
  },

  createInvitation: async (data: { workspace: string; email: string; role: string; message?: string }) => {
    const response = await apiClient.post('/workspace-invitations/', data);
    return response.data;
  },

  acceptInvitation: async (id: string) => {
    const response = await apiClient.post(`/workspace-invitations/${id}/accept/`);
    return response.data;
  },

  declineInvitation: async (id: string) => {
    const response = await apiClient.post(`/workspace-invitations/${id}/decline/`);
    return response.data;
  },
};

// Update named API modules export
export const api = {
  auth: authAPI,
  meetings: meetingsAPI,
  actionItems: actionItemsAPI,
  notes: notesAPI,
  tags: tagsAPI,
  activities: activitiesAPI,
  templates: templatesAPI,
  integrations: integrationsAPI,
  notificationLogs: notificationLogsAPI,
  calendar: calendarAPI,
  workspaces: workspacesAPI,
};
