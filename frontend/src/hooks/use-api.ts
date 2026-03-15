'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsAPI, actionItemsAPI, notesAPI, tagsAPI, activitiesAPI, templatesAPI, integrationsAPI, notificationLogsAPI, calendarAPI, workspacesAPI } from '@/lib/api';
import type { Meeting, ActionItem, Tag, MeetingTemplate, NotificationIntegration, CalendarConnection, Workspace, WorkspaceMember } from '@/lib/api';

// Meetings
export function useMeetings(params?: {
  search?: string;
  status?: string;
  ordering?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ['meetings', params],
    queryFn: () => meetingsAPI.list(params),
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: ['meetings', id],
    queryFn: () => meetingsAPI.get(id),
    enabled: !!id,
  });
}

export function useMeetingStats() {
  return useQuery({
    queryKey: ['meetings', 'stats'],
    queryFn: () => meetingsAPI.getStats(),
  });
}

export function useAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ['meetings', 'analytics', days],
    queryFn: () => meetingsAPI.getAnalytics(days),
  });
}

export function useUploadMeeting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (formData: FormData) => meetingsAPI.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'stats'] });
    },
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Meeting> }) =>
      meetingsAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', variables.id] });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => meetingsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'stats'] });
    },
  });
}

export function useShareMeeting() {
  return useMutation({
    mutationFn: (id: string) => meetingsAPI.share(id),
  });
}

// Action Items
export function useActionItems(params?: {
  search?: string;
  status?: string;
  priority?: string;
  meeting?: string;
  ordering?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ['action-items', params],
    queryFn: () => actionItemsAPI.list(params),
  });
}

export function useActionItem(id: string) {
  return useQuery({
    queryKey: ['action-items', id],
    queryFn: () => actionItemsAPI.get(id),
    enabled: !!id,
  });
}

export function useCreateActionItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<ActionItem>) => actionItemsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'stats'] });
    },
  });
}

export function useUpdateActionItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ActionItem> }) =>
      actionItemsAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
      queryClient.invalidateQueries({ queryKey: ['action-items', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'stats'] });
    },
  });
}

export function useCompleteActionItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => actionItemsAPI.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'stats'] });
    },
  });
}

export function useDeleteActionItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => actionItemsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'stats'] });
    },
  });
}

// Meeting Notes
export function useMeetingNotes(meetingId?: string) {
  return useQuery({
    queryKey: ['notes', meetingId],
    queryFn: () => notesAPI.list(meetingId),
    enabled: !!meetingId,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { meeting: string; content: string; timestamp?: number }) =>
      notesAPI.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes', variables.meeting] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => notesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

// Tags
export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsAPI.list(),
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => tagsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tag> }) =>
      tagsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => tagsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
}

// Favorites
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => meetingsAPI.toggleFavorite(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', id] });
    },
  });
}

export function useFavorites() {
  return useQuery({
    queryKey: ['meetings', 'favorites'],
    queryFn: () => meetingsAPI.getFavorites(),
  });
}

// Activities
export function useActivities(limit?: number) {
  return useQuery({
    queryKey: ['activities', limit],
    queryFn: () => activitiesAPI.list(limit),
  });
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: ['activities', id],
    queryFn: () => activitiesAPI.get(id),
    enabled: !!id,
  });
}

// Templates
export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesAPI.list(),
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: () => templatesAPI.get(id),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<MeetingTemplate>) => templatesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MeetingTemplate> }) =>
      templatesAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates', variables.id] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => templatesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

// Integrations
export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsAPI.list(),
  });
}

export function useIntegration(id: string) {
  return useQuery({
    queryKey: ['integrations', id],
    queryFn: () => integrationsAPI.get(id),
    enabled: !!id,
  });
}

export function useCreateIntegration() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<NotificationIntegration>) => integrationsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NotificationIntegration> }) =>
      integrationsAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['integrations', variables.id] });
    },
  });
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => integrationsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: ({ id, testMessage }: { id: string; testMessage?: string }) =>
      integrationsAPI.test(id, testMessage),
  });
}

// Notification Logs
export function useNotificationLogs() {
  return useQuery({
    queryKey: ['notification-logs'],
    queryFn: () => notificationLogsAPI.list(),
  });
}

// Calendar Connections
export function useCalendarConnections() {
  return useQuery({
    queryKey: ['calendar-connections'],
    queryFn: () => calendarAPI.listConnections(),
  });
}

export function useCalendarConnection(id: string) {
  return useQuery({
    queryKey: ['calendar-connections', id],
    queryFn: () => calendarAPI.getConnection(id),
    enabled: !!id,
  });
}

export function useCreateCalendarConnection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<CalendarConnection>) => calendarAPI.createConnection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
    },
  });
}

export function useUpdateCalendarConnection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CalendarConnection> }) =>
      calendarAPI.updateConnection(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-connections', variables.id] });
    },
  });
}

export function useDeleteCalendarConnection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => calendarAPI.deleteConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useSyncCalendar() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => calendarAPI.syncConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-sync-logs'] });
    },
  });
}

// Calendar Events
export function useCalendarEvents() {
  return useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => calendarAPI.listEvents(),
  });
}

// Calendar Sync Logs
export function useCalendarSyncLogs() {
  return useQuery({
    queryKey: ['calendar-sync-logs'],
    queryFn: () => calendarAPI.listSyncLogs(),
  });
}

// Workspaces
export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspacesAPI.list(),
  });
}

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: ['workspaces', id],
    queryFn: () => workspacesAPI.get(id),
    enabled: !!id,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Partial<Workspace>) => workspacesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Workspace> }) =>
      workspacesAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', variables.id] });
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => workspacesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

// Workspace Members
export function useWorkspaceMembers() {
  return useQuery({
    queryKey: ['workspace-members'],
    queryFn: () => workspacesAPI.listMembers(),
  });
}

export function useUpdateWorkspaceMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WorkspaceMember> }) =>
      workspacesAPI.updateMember(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
    },
  });
}

export function useRemoveWorkspaceMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => workspacesAPI.removeMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
    },
  });
}

// Workspace Invitations
export function useWorkspaceInvitations() {
  return useQuery({
    queryKey: ['workspace-invitations'],
    queryFn: () => workspacesAPI.listInvitations(),
  });
}

export function useInviteWorkspaceMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { workspace: string; email: string; role: string; message?: string }) =>
      workspacesAPI.createInvitation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations'] });
    },
  });
}

export function useAcceptWorkspaceInvitation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => workspacesAPI.acceptInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
    },
  });
}

export function useDeclineWorkspaceInvitation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => workspacesAPI.declineInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations'] });
    },
  });
}
