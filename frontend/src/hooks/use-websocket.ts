/**
 * WebSocket Hook for Real-time Updates
 */
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { api } from '@/lib/api-base';
import { useAuthStore } from '@/lib/stores';
import { useNotificationsStore } from '@/lib/stores';
import type { Notification, DashboardStats, Subscription } from '@/types/swm';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketMessage {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(
  endpoint: string,
  options: UseWebSocketOptions = {}
) {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
  } = options;

  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(false);
  const { accessToken, isAuthenticated } = useAuthStore();

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus('connecting');

    const wsUrl = `${api.wsUrl}/${endpoint}?token=${accessToken}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttemptsRef.current = 0;
      onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        onMessage?.(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      onDisconnect?.();

      // Auto-reconnect indicator
      if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        shouldReconnectRef.current = true;
        reconnectAttemptsRef.current += 1;
      } else {
        shouldReconnectRef.current = false;
      }
    }; 

    ws.onerror = (error) => {
      setStatus('error');
      onError?.(error);
    };

    wsRef.current = ws;
  }, [
    endpoint,
    accessToken,
    isAuthenticated,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect,

    maxReconnectAttempts,
  ]);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const t = setTimeout(() => connect(), 0);

    return () => {
      clearTimeout(t);
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect]);

  // Schedule automatic reconnects when connection is closed
  useEffect(() => {
    if (!shouldReconnectRef.current) return;
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) return;

    const t = setTimeout(() => {
      if (isAuthenticated) {
        connect();
      }
    }, reconnectInterval);

    return () => clearTimeout(t);
  }, [isAuthenticated, connect, reconnectInterval, maxReconnectAttempts]);

  return {
    status,
    send,
    connect,
    disconnect,
  };
}

// ==================== Specialized Hooks ====================

/**
 * Hook for notifications WebSocket
 */
export function useNotificationsSocket() {
  const { addNotification } = useNotificationsStore();
  const [lastNotification, setLastNotification] = useState<Notification | null>(null);

  const { status, send } = useWebSocket('notifications/', {
    onMessage: (message) => {
      if (message.type === 'notification') {
        const notification = message.data as Notification;
        addNotification(notification);
        setLastNotification(notification);
      }
    },
  });

  const markAsRead = useCallback(
    (notificationId: string) => {
      send({ type: 'mark_read', data: { id: notificationId } });
    },
    [send]
  );

  return {
    status,
    lastNotification,
    markAsRead,
  };
}

/**
 * Hook for dashboard real-time updates
 */
export function useDashboardSocket() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const { status, send } = useWebSocket('dashboard/', {
    onMessage: (message) => {
      if (message.type === 'stats_update') {
        setStats(message.data as DashboardStats);
        setLastUpdate(new Date());
      }
    },
  });

  const requestUpdate = useCallback(() => {
    send({ type: 'request_update', data: {} });
  }, [send]);

  return {
    status,
    stats,
    lastUpdate,
    requestUpdate,
  };
}

/**
 * Hook for alerts WebSocket
 */
export function useAlertsSocket() {
  const [alerts, setAlerts] = useState<
    {
      id: string;
      type: 'renewal' | 'budget' | 'security' | 'integration';
      message: string;
      severity: 'info' | 'warning' | 'critical';
      timestamp: Date;
    }[]
  >([]);

  const { status } = useWebSocket('alerts/', {
    onMessage: (message) => {
      if (message.type === 'alert') {
        setAlerts((prev) => [
          {
            ...message.data,
            timestamp: new Date(),
          },
          ...prev.slice(0, 49), // Keep last 50 alerts
        ]);
      }
    },
  });

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    status,
    alerts,
    clearAlerts,
    dismissAlert,
  };
}

/**
 * Hook for integration sync status
 */
export function useIntegrationSocket() {
  const [syncStatus, setSyncStatus] = useState<
    Map<
      string,
      {
        status: 'syncing' | 'completed' | 'failed';
        progress: number;
        message?: string;
      }
    >
  >(new Map());

  const [recentSync, setRecentSync] = useState<{
    integrationId: string;
    subscription?: Subscription;
    action: 'discovered' | 'updated' | 'error';
    timestamp: Date;
  } | null>(null);

  const { status, send } = useWebSocket('integrations/', {
    onMessage: (message) => {
      if (message.type === 'sync_progress') {
        setSyncStatus((prev) => {
          const next = new Map(prev);
          next.set(message.data.integration_id, {
            status: message.data.status,
            progress: message.data.progress,
            message: message.data.message,
          });
          return next;
        });
      } else if (message.type === 'subscription_discovered') {
        setRecentSync({
          integrationId: message.data.integration_id,
          subscription: message.data.subscription,
          action: 'discovered',
          timestamp: new Date(),
        });
      } else if (message.type === 'sync_error') {
        setRecentSync({
          integrationId: message.data.integration_id,
          action: 'error',
          timestamp: new Date(),
        });
      }
    },
  });

  const startSync = useCallback(
    (integrationId: string) => {
      send({ type: 'start_sync', data: { integration_id: integrationId } });
    },
    [send]
  );

  return {
    status,
    syncStatus,
    recentSync,
    startSync,
  };
}

/**
 * Combined hook for all real-time features
 */
export function useRealTimeUpdates() {
  const notifications = useNotificationsSocket();
  const dashboard = useDashboardSocket();
  const alerts = useAlertsSocket();
  const integrations = useIntegrationSocket();

  const isConnected =
    notifications.status === 'connected' &&
    dashboard.status === 'connected' &&
    alerts.status === 'connected' &&
    integrations.status === 'connected';

  return {
    isConnected,
    notifications,
    dashboard,
    alerts,
    integrations,
  };
}
