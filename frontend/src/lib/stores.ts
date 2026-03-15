/**
 * Zustand Stores for Subscription Waste Manager
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  User,
  UserRole,
  Organization,
  Subscription,
  Recommendation,
  Notification,
  Integration,
  DashboardStats,
  DashboardTrend,
  CategoryBreakdown,
} from '@/types/swm';
import {
  authApi,
  organizationApi,
  subscriptionsApi,
  recommendationsApi,
  notificationsApi,
  integrationsApi,
  dashboardApi,
} from './services';

// ==================== Auth Store ====================

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    password2: string;
    first_name: string;
    last_name: string;
    organization_name: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  loadProfile: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  setTokens: (access: string, refresh: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const tokens = await authApi.login({ email, password });
          set((state) => {
            state.accessToken = tokens.access;
            state.refreshToken = tokens.refresh;
            state.isAuthenticated = true;
          });
          await get().fetchUser();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set((state) => {
            state.error = message;
            state.isAuthenticated = false;
          });
          throw error;
        } finally {
          set((state) => {
            state.isLoading = false;
          });
        }
      },

      register: async (data) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const result = await authApi.register(data);
          set((state) => {
            state.user = result.user;
            state.accessToken = result.tokens.access;
            state.refreshToken = result.tokens.refresh;
            state.isAuthenticated = true;
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Registration failed';
          set((state) => {
            state.error = message;
          });
          throw error;
        } finally {
          set((state) => {
            state.isLoading = false;
          });
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Ignore logout errors
        } finally {
          get().clearAuth();
        }
      },

      fetchUser: async () => {
        try {
          const user = await authApi.me();
          set((state) => {
            state.user = user;
          });
        } catch (error) {
          get().clearAuth();
          throw error;
        }
      },

      loadProfile: async () => {
        try {
          const user = await authApi.me();
          set((state) => {
            state.user = user;
          });
        } catch (error) {
          get().clearAuth();
          throw error;
        }
      },

      updateUser: async (data) => {
        const user = await authApi.updateProfile(data);
        set((state) => {
          state.user = user;
        });
      },

      setTokens: (access, refresh) => {
        set((state) => {
          state.accessToken = access;
          state.refreshToken = refresh;
          state.isAuthenticated = true;
        });
      },

      clearAuth: () => {
        set((state) => {
          state.user = null;
          state.accessToken = null;
          state.refreshToken = null;
          state.isAuthenticated = false;
          state.error = null;
        });
      },
    })),
    {
      name: 'swm-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ==================== Organization Store ====================

interface OrganizationState {
  organization: Organization | null;
  members: User[];
  isLoading: boolean;
  error: string | null;

  fetchOrganization: () => Promise<void>;
  updateOrganization: (data: Partial<Organization>) => Promise<void>;
  fetchMembers: () => Promise<void>;
  updateMember: (id: string, data: Partial<User>) => Promise<void>;
  updateMemberRole: (id: string, role: UserRole) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  inviteMember: (email: string, role: UserRole) => Promise<void>;
}

export const useOrganizationStore = create<OrganizationState>()(
  immer((set) => ({
    organization: null,
    members: [],
    isLoading: false,
    error: null,

    fetchOrganization: async () => {
      set((state) => {
        state.isLoading = true;
      });

      try {
        const org = await organizationApi.get();
        set((state) => {
          state.organization = org;
          state.error = null;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch organization';
        set((state) => {
          state.error = message;
        });
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },

    updateOrganization: async (data) => {
      const org = await organizationApi.update(data);
      set((state) => {
        state.organization = org;
      });
    },

    fetchMembers: async () => {
      try {
        const members = await organizationApi.getMembers();
        set((state) => {
          state.members = members;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch members';
        set((state) => {
          state.error = message;
        });
      }
    },

    updateMember: async (id, data) => {
      const member = await organizationApi.updateMember(id, data);
      set((state) => {
        const index = state.members.findIndex((m) => m.id === id);
        if (index !== -1) {
          state.members[index] = member;
        }
      });
    },

    updateMemberRole: async (id: string, role: UserRole) => {
      const member = await organizationApi.updateMember(id, { role });
      set((state) => {
        const index = state.members.findIndex((m) => m.id === id);
        if (index !== -1) {
          state.members[index] = member;
        }
      });
    },

    removeMember: async (id) => {
      await organizationApi.removeMember(id);
      set((state) => {
        state.members = state.members.filter((m) => m.id !== id);
      });
    },

    inviteMember: async (email, role) => {
      await organizationApi.sendInvitation({ email, role });
    },
  }))
);

// ==================== Subscriptions Store ====================

interface SubscriptionsState {
  subscriptions: Subscription[];
  currentSubscription: Subscription | null;
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  filters: {
    status?: string;
    category?: string;
    department?: string;
    search?: string;
  };

  fetchSubscriptions: (page?: number) => Promise<void>;
  fetchSubscription: (id: string) => Promise<void>;
  createSubscription: (data: Partial<Subscription>) => Promise<Subscription>;
  updateSubscription: (id: string, data: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  cancelSubscription: (id: string, reason?: string) => Promise<void>;
  setFilters: (filters: SubscriptionsState['filters']) => void;
  clearFilters: () => void;
}

export const useSubscriptionsStore = create<SubscriptionsState>()(
  immer((set, get) => ({
    subscriptions: [],
    currentSubscription: null,
    totalCount: 0,
    isLoading: false,
    error: null,
    filters: {},

    fetchSubscriptions: async (page = 1) => {
      set((state) => {
        state.isLoading = true;
      });

      try {
        const { filters } = get();
        const response = await subscriptionsApi.list({ ...filters, page });
        set((state) => {
          state.subscriptions = response.results;
          state.totalCount = response.count;
          state.error = null;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch subscriptions';
        set((state) => {
          state.error = message;
        });
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },

    fetchSubscription: async (id) => {
      set((state) => {
        state.isLoading = true;
      });

      try {
        const subscription = await subscriptionsApi.get(id);
        set((state) => {
          state.currentSubscription = subscription;
          state.error = null;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch subscription';
        set((state) => {
          state.error = message;
        });
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },

    createSubscription: async (data) => {
      const subscription = await subscriptionsApi.create(data);
      set((state) => {
        state.subscriptions.unshift(subscription);
        state.totalCount += 1;
      });
      return subscription;
    },

    updateSubscription: async (id, data) => {
      const subscription = await subscriptionsApi.update(id, data);
      set((state) => {
        const index = state.subscriptions.findIndex((s) => s.id === id);
        if (index !== -1) {
          state.subscriptions[index] = subscription;
        }
        if (state.currentSubscription?.id === id) {
          state.currentSubscription = subscription;
        }
      });
    },

    deleteSubscription: async (id) => {
      await subscriptionsApi.delete(id);
      set((state) => {
        state.subscriptions = state.subscriptions.filter((s) => s.id !== id);
        state.totalCount -= 1;
        if (state.currentSubscription?.id === id) {
          state.currentSubscription = null;
        }
      });
    },

    cancelSubscription: async (id, reason) => {
      await subscriptionsApi.cancel(id, reason);
      set((state) => {
        const index = state.subscriptions.findIndex((s) => s.id === id);
        if (index !== -1) {
          state.subscriptions[index].status = 'cancelled';
        }
        if (state.currentSubscription?.id === id) {
          state.currentSubscription.status = 'cancelled';
        }
      });
    },

    setFilters: (filters) => {
      set((state) => {
        state.filters = filters;
      });
    },

    clearFilters: () => {
      set((state) => {
        state.filters = {};
      });
    },
  }))
);

// ==================== Recommendations Store ====================

interface RecommendationsState {
  recommendations: Recommendation[];
  quickWins: Recommendation[];
  totalPotentialSavings: number;
  totalSavings: number;
  isLoading: boolean;
  error: string | null;

  fetchRecommendations: (params?: { status?: string; type?: string; priority?: string }) => Promise<void>;
  fetchQuickWins: () => Promise<void>;
  approveRecommendation: (id: string) => Promise<void>;
  dismissRecommendation: (id: string, reason?: string) => Promise<void>;
  implementRecommendation: (id: string) => Promise<void>;
  generateRecommendations: () => Promise<void>;
}

export const useRecommendationsStore = create<RecommendationsState>()(
  immer((set) => ({
    recommendations: [],
    quickWins: [],
    totalPotentialSavings: 0,
    totalSavings: 0,
    isLoading: false,
    error: null,

    fetchRecommendations: async (params) => {
      set((state) => {
        state.isLoading = true;
      });

      try {
        const response = await recommendationsApi.list(params);
        const summary = await recommendationsApi.getSavingsSummary();
        set((state) => {
          state.recommendations = response.results;
          state.totalPotentialSavings = summary.total_potential;
          state.totalSavings = summary.total_potential;
          state.error = null;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch recommendations';
        set((state) => {
          state.error = message;
        });
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },

    fetchQuickWins: async () => {
      try {
        const quickWins = await recommendationsApi.getQuickWins(5);
        set((state) => {
          state.quickWins = quickWins;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch quick wins';
        set((state) => {
          state.error = message;
        });
      }
    },

    approveRecommendation: async (id) => {
      const recommendation = await recommendationsApi.approve(id);
      set((state) => {
        const index = state.recommendations.findIndex((r) => r.id === id);
        if (index !== -1) {
          state.recommendations[index] = recommendation;
        }
      });
    },

    dismissRecommendation: async (id, reason?: string) => {
      await recommendationsApi.dismiss(id, reason || '');
      set((state) => {
        const index = state.recommendations.findIndex((r) => r.id === id);
        if (index !== -1) {
          state.recommendations[index].status = 'dismissed';
          if (reason) {
            state.recommendations[index].dismissed_reason = reason;
          }
        }
      });
    },

    implementRecommendation: async (id) => {
      const recommendation = await recommendationsApi.implement(id);
      set((state) => {
        const index = state.recommendations.findIndex((r) => r.id === id);
        if (index !== -1) {
          state.recommendations[index] = recommendation;
        }
      });
    },

    generateRecommendations: async () => {
      set((state) => {
        state.isLoading = true;
      });

      try {
        await recommendationsApi.generate();
        // Refresh recommendations after generation
        const response = await recommendationsApi.list();
        set((state) => {
          state.recommendations = response.results;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to generate recommendations';
        set((state) => {
          state.error = message;
        });
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },
  }))
);

// ==================== Notifications Store ====================

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  addNotification: (notification: Notification) => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  immer((set) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,

    fetchNotifications: async () => {
      set((state) => {
        state.isLoading = true;
      });

      try {
        const notifications = await notificationsApi.list();
        const { count } = await notificationsApi.getUnreadCount();
        set((state) => {
          state.notifications = notifications;
          state.unreadCount = count;
        });
      } catch {
        // Ignore errors
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },

    markAsRead: async (id) => {
      await notificationsApi.markAsRead(id);
      set((state) => {
        const notification = state.notifications.find((n) => n.id === id);
        if (notification && !notification.is_read) {
          notification.is_read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      });
    },

    markAllAsRead: async () => {
      await notificationsApi.markAllAsRead();
      set((state) => {
        state.notifications.forEach((n) => {
          n.is_read = true;
        });
        state.unreadCount = 0;
      });
    },

    deleteNotification: async (id) => {
      await notificationsApi.delete(id);
      set((state) => {
        const notification = state.notifications.find((n) => n.id === id);
        if (notification && !notification.is_read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.notifications = state.notifications.filter((n) => n.id !== id);
      });
    },

    addNotification: (notification) => {
      set((state) => {
        state.notifications.unshift(notification);
        if (!notification.is_read) {
          state.unreadCount += 1;
        }
      });
    },
  }))
);

// ==================== Integrations Store ====================

interface IntegrationsState {
  integrations: Integration[];
  isLoading: boolean;
  error: string | null;
  syncingIds: Set<string>;

  fetchIntegrations: () => Promise<void>;
  createIntegration: (data: Partial<Integration>) => Promise<Integration>;
  updateIntegration: (id: string, data: Partial<Integration>) => Promise<void>;
  deleteIntegration: (id: string) => Promise<void>;
  syncIntegration: (id: string) => Promise<void>;
  testIntegration: (id: string) => Promise<{ success: boolean; message: string }>;
}

export const useIntegrationsStore = create<IntegrationsState>()(
  immer((set, get) => ({
    integrations: [],
    isLoading: false,
    error: null,
    syncingIds: new Set(),

    fetchIntegrations: async () => {
      set((state) => {
        state.isLoading = true;
      });

      try {
        const integrations = await integrationsApi.list();
        set((state) => {
          state.integrations = integrations;
          state.error = null;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch integrations';
        set((state) => {
          state.error = message;
        });
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },

    createIntegration: async (data) => {
      const integration = await integrationsApi.create(data);
      set((state) => {
        state.integrations.push(integration);
      });
      return integration;
    },

    updateIntegration: async (id, data) => {
      const integration = await integrationsApi.update(id, data);
      set((state) => {
        const index = state.integrations.findIndex((i) => i.id === id);
        if (index !== -1) {
          state.integrations[index] = integration;
        }
      });
    },

    deleteIntegration: async (id) => {
      await integrationsApi.delete(id);
      set((state) => {
        state.integrations = state.integrations.filter((i) => i.id !== id);
      });
    },

    syncIntegration: async (id) => {
      set((state) => {
        state.syncingIds.add(id);
      });

      try {
        await integrationsApi.sync(id);
        // Refresh the integration to get updated status
        await get().fetchIntegrations();
      } finally {
        set((state) => {
          state.syncingIds.delete(id);
        });
      }
    },

    testIntegration: async (id) => {
      return await integrationsApi.test(id);
    },
  }))
);

// ==================== Dashboard Store ====================

interface DashboardState {
  stats: DashboardStats | null;
  trends: DashboardTrend[];
  categoryBreakdown: CategoryBreakdown[];
  topSpend: Subscription[];
  lowUtilization: Subscription[];
  upcomingRenewals: Subscription[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  spendingTrend?: DashboardTrend[];

  fetchDashboard: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchDashboardStats: () => Promise<void>;
  fetchTrends: (period?: 'week' | 'month' | 'quarter' | 'year') => Promise<void>;
  refreshDashboard: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>()(
  immer((set) => ({
    stats: null,
    trends: [],
    categoryBreakdown: [],
    topSpend: [],
    lowUtilization: [],
    upcomingRenewals: [],
    spendingTrend: [],
    isLoading: false,
    error: null,
    lastUpdated: null,

    fetchDashboard: async () => {
      set((state) => {
        state.isLoading = true;
      });

      try {
        const [stats, trends, categories, topSpend, lowUtil, renewals] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getTrends({ period: 'month' }),
          dashboardApi.getCategoryBreakdown(),
          dashboardApi.getTopSpend(5),
          dashboardApi.getLowUtilization(30, 5),
          dashboardApi.getUpcomingRenewals(30),
        ]);

        set((state) => {
          state.stats = stats;
          state.trends = trends;
          state.spendingTrend = trends;
          state.categoryBreakdown = categories;
          state.topSpend = topSpend;
          state.lowUtilization = lowUtil;
          state.upcomingRenewals = renewals;
          state.error = null;
          state.lastUpdated = new Date();
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch dashboard';
        set((state) => {
          state.error = message;
        });
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },

    fetchStats: async () => {
      try {
        const stats = await dashboardApi.getStats();
        set((state) => {
          state.stats = stats;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch stats';
        set((state) => {
          state.error = message;
        });
      }
    },

    fetchDashboardStats: async () => {
      try {
        const stats = await dashboardApi.getStats();
        set((state) => {
          state.stats = stats;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch stats';
        set((state) => {
          state.error = message;
        });
      }
    },

    fetchTrends: async (period = 'month') => {
      try {
        const trends = await dashboardApi.getTrends({ period });
        set((state) => {
          state.trends = trends;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch trends';
        set((state) => {
          state.error = message;
        });
      }
    },

    refreshDashboard: async () => {
      set((state) => {
        state.isLoading = true;
      });

      try {
        const stats = await dashboardApi.getStats();
        set((state) => {
          state.stats = stats;
          state.lastUpdated = new Date();
          state.error = null;
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to refresh dashboard';
        set((state) => {
          state.error = message;
        });
      } finally {
        set((state) => {
          state.isLoading = false;
        });
      }
    },
  }))
);
