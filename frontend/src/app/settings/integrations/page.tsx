'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useIntegrationsStore } from '@/lib/stores';
import { integrationsApi } from '@/lib/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Plus,
  Plug,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  MessageSquare,
  Mail,
  Link as LinkIcon,
  Key,
  Clock,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { BankAccount, SSOConnection, Webhook } from '@/types/swm';

const INTEGRATION_ICONS: Record<string, React.ReactNode> = {
  plaid: <CreditCard className="h-6 w-6" />,
  slack: <MessageSquare className="h-6 w-6" />,
  teams: <MessageSquare className="h-6 w-6" />,
  google: <Mail className="h-6 w-6" />,
  microsoft: <Mail className="h-6 w-6" />,
  okta: <Key className="h-6 w-6" />,
  quickbooks: <CreditCard className="h-6 w-6" />,
  xero: <CreditCard className="h-6 w-6" />,
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  connected: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  disabled: 'bg-gray-100 text-gray-700',
};

export default function IntegrationsPage() {
  const { integrations, isLoading, fetchIntegrations, syncIntegration } =
    useIntegrationsStore();

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [ssoConnections, setSSOConnections] = useState<SSOConnection[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ url: '', events: [] as string[] });

  const loadData = async () => {
    await fetchIntegrations();
    try {
      const [banks, sso, hooks] = await Promise.all([
        integrationsApi.listBankAccounts(),
        integrationsApi.listSSOConnections(),
        integrationsApi.listWebhooks(),
      ]);
      setBankAccounts(Array.isArray(banks) ? banks : banks.results || []);
      setSSOConnections(Array.isArray(sso) ? sso : sso.results || []);
      setWebhooks(Array.isArray(hooks) ? hooks : hooks.results || []);
    } catch (error) {
      console.error('Failed to load integration data', error);
    }
  };

  useEffect(() => {
    const load = async () => {
      await fetchIntegrations();
      try {
        const [banks, sso, hooks] = await Promise.all([
          integrationsApi.listBankAccounts(),
          integrationsApi.listSSOConnections(),
          integrationsApi.listWebhooks(),
        ]);
        setBankAccounts(Array.isArray(banks) ? banks : banks.results || []);
        setSSOConnections(Array.isArray(sso) ? sso : sso.results || []);
        setWebhooks(Array.isArray(hooks) ? hooks : hooks.results || []);
      } catch (error) {
        console.error('Failed to load integration data', error);
      }
    };
    load();
  }, [fetchIntegrations]);

  const handleConnect = async (type: string) => {
    try {
      // In production, this would redirect to OAuth flow
      toast.info(`Connecting to ${type}...`);
      if (type === 'plaid') {
        // const { link_token } = await integrationsApi.createPlaidLink();
        // Would open Plaid Link here
        toast.success('Bank connection initiated');
      } else if (type === 'slack') {
        await integrationsApi.connectSlack('workspace-id');
        toast.success('Slack connected');
        loadData();
      }
    } catch {
      toast.error('Failed to connect integration');
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await integrationsApi.delete(id);
      toast.success('Integration disconnected');
      loadData();
    } catch {
      toast.error('Failed to disconnect integration');
    }
  };

  const handleSync = async (id: string) => {
    await syncIntegration(id);
    toast.success('Sync started');
  };

  const handleCreateWebhook = async () => {
    try {
      const webhook = await integrationsApi.createWebhook({
        url: webhookForm.url,
        events: webhookForm.events,
        is_active: true,
      });
      setWebhooks([...webhooks, webhook]);
      setShowWebhookDialog(false);
      setWebhookForm({ url: '', events: [] });
      toast.success('Webhook created');
    } catch (error) {
      console.error('Failed to create webhook', error);
      toast.error('Failed to create webhook');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await integrationsApi.deleteWebhook(id);
      setWebhooks(webhooks.filter((w) => w.id !== id));
      toast.success('Webhook deleted');
    } catch (error) {
      console.error('Failed to delete webhook', error);
      toast.error('Failed to delete webhook');
    }
  };

  const availableIntegrations = [
    {
      type: 'plaid',
      name: 'Plaid',
      description: 'Connect bank accounts to discover subscription payments',
      category: 'banking',
    },
    {
      type: 'slack',
      name: 'Slack',
      description: 'Get notifications and alerts in Slack channels',
      category: 'communication',
    },
    {
      type: 'teams',
      name: 'Microsoft Teams',
      description: 'Get notifications in Teams channels',
      category: 'communication',
    },
    {
      type: 'okta',
      name: 'Okta SSO',
      description: 'Sync users and discover SSO-connected apps',
      category: 'sso',
    },
    {
      type: 'google',
      name: 'Google Workspace',
      description: 'Discover Google Workspace app usage',
      category: 'sso',
    },
    {
      type: 'quickbooks',
      name: 'QuickBooks',
      description: 'Sync subscription expenses with accounting',
      category: 'accounting',
    },
    {
      type: 'xero',
      name: 'Xero',
      description: 'Sync subscription expenses with Xero',
      category: 'accounting',
    },
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Integrations</h1>
            <p className="text-gray-500">Connect your tools and services</p>
          </div>
        </div>

        {/* Connected Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Connected</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {integrations.filter((i) => i.status === 'active').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Bank Accounts</CardDescription>
              <CardTitle className="text-3xl">{bankAccounts.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>SSO Connections</CardDescription>
              <CardTitle className="text-3xl">{ssoConnections.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Webhooks</CardDescription>
              <CardTitle className="text-3xl">{webhooks.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="connected">
          <TabsList>
            <TabsTrigger value="connected">Connected</TabsTrigger>
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="banking">Bank Accounts</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="connected" className="space-y-4">
            {integrations.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Plug className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium">No integrations connected</h3>
                  <p className="text-gray-500 mb-4">
                    Connect your first integration to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrations.map((integration) => (
                  <Card key={integration.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            {INTEGRATION_ICONS[integration.type] || (
                              <Plug className="h-6 w-6" />
                            )}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{integration.name}</CardTitle>
                            <CardDescription>
                              {integration.type.charAt(0).toUpperCase() +
                                integration.type.slice(1)}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className={STATUS_COLORS[integration.status]}>
                          {integration.status === 'active' && (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          )}
                          {integration.status === 'error' && (
                            <AlertTriangle className="h-3 w-3 mr-1" />
                          )}
                          {integration.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Last synced</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {integration.last_sync
                            ? format(new Date(integration.last_sync), 'MMM d, h:mm a')
                            : 'Never'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSync(integration.id)}
                          disabled={integration.sync_status === 'syncing'}
                        >
                          <RefreshCw
                            className={`h-4 w-4 mr-1 ${
                              integration.sync_status === 'syncing' ? 'animate-spin' : ''
                            }`}
                          />
                          Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => handleDisconnect(integration.id)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="available" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {availableIntegrations.map((integration) => {
                const isConnected = integrations.some(
                  (i) => i.type === integration.type && i.status === 'active'
                );
                return (
                  <Card key={integration.type} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                          {INTEGRATION_ICONS[integration.type] || (
                            <Plug className="h-6 w-6" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{integration.name}</CardTitle>
                          <Badge variant="outline" className="mt-1">
                            {integration.category}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-500">{integration.description}</p>
                      <Button
                        className="w-full"
                        variant={isConnected ? 'secondary' : 'default'}
                        disabled={isConnected}
                        onClick={() => handleConnect(integration.type)}
                      >
                        {isConnected ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Connected
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="banking" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Bank Accounts</CardTitle>
                    <CardDescription>
                      Connected accounts for subscription discovery
                    </CardDescription>
                  </div>
                  <Button onClick={() => handleConnect('plaid')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Account
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {bankAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <CreditCard className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 mb-4">No bank accounts connected</p>
                    <Button onClick={() => handleConnect('plaid')}>
                      Connect Bank Account
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bankAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <CreditCard className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{account.name}</p>
                            <p className="text-sm text-gray-500">
                              {account.institution} •••• {account.mask}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={STATUS_COLORS[account.status || 'pending']}>
                            {account.status || 'pending'}
                          </Badge>
                          <Button size="sm" variant="ghost">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Webhooks</CardTitle>
                    <CardDescription>
                      Send event notifications to external services
                    </CardDescription>
                  </div>
                  <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Webhook
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Webhook</DialogTitle>
                        <DialogDescription>
                          Configure a webhook to receive event notifications
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="webhook-url">Webhook URL</Label>
                          <Input
                            id="webhook-url"
                            type="url"
                            placeholder="https://..."
                            value={webhookForm.url}
                            onChange={(e) =>
                              setWebhookForm({ ...webhookForm, url: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Events</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              'subscription.created',
                              'subscription.updated',
                              'subscription.deleted',
                              'recommendation.created',
                              'alert.triggered',
                              'workflow.executed',
                            ].map((event) => (
                              <label
                                key={event}
                                className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                <input
                                  type="checkbox"
                                  checked={webhookForm.events.includes(event)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setWebhookForm({
                                        ...webhookForm,
                                        events: [...webhookForm.events, event],
                                      });
                                    } else {
                                      setWebhookForm({
                                        ...webhookForm,
                                        events: webhookForm.events.filter((e) => e !== event),
                                      });
                                    }
                                  }}
                                  className="rounded"
                                />
                                <span className="text-sm">{event}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowWebhookDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleCreateWebhook}>Create Webhook</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {webhooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <LinkIcon className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 mb-4">No webhooks configured</p>
                    <Button onClick={() => setShowWebhookDialog(true)}>
                      Add Webhook
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {webhooks.map((webhook) => (
                      <div
                        key={webhook.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-gray-500" />
                            <code className="text-sm">{webhook.url}</code>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {webhook.events.slice(0, 3).map((event) => (
                              <Badge key={event} variant="outline" className="text-xs">
                                {event}
                              </Badge>
                            ))}
                            {webhook.events.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{webhook.events.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={webhook.is_active}
                            onCheckedChange={async (checked) => {
                              try {
                                const updated = await integrationsApi.updateWebhook(
                                  webhook.id,
                                  { is_active: checked }
                                );
                                setWebhooks(
                                  webhooks.map((w) =>
                                    w.id === updated.id ? updated : w
                                  )
                                );
                              } catch (error) {
                                console.error('Failed to update webhook', error);
                                toast.error('Failed to update webhook');
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => handleDeleteWebhook(webhook.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
