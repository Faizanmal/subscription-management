'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useIntegrationsStore } from '@/lib/stores';
import { integrationsApi, organizationApi } from '@/lib/services';
import { PlanUpgradeCard } from '@/components/plan-upgrade-card';
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
import { openPlaidLink } from '@/lib/plaid-link';
import { hardNavigate } from '@/lib/navigation';
import type { BankAccount, BillingStatus, EmailScanConfig, SSOConnection, Webhook } from '@/types/swm';

const INTEGRATION_ICONS: Record<string, React.ReactNode> = {
  plaid: <CreditCard className="h-6 w-6" />,
  slack: <MessageSquare className="h-6 w-6" />,
  teams: <MessageSquare className="h-6 w-6" />,
  google_workspace: <Mail className="h-6 w-6" />,
  microsoft_365: <Mail className="h-6 w-6" />,
  okta: <Key className="h-6 w-6" />,
  azure_ad: <Key className="h-6 w-6" />,
  quickbooks: <CreditCard className="h-6 w-6" />,
  xero: <CreditCard className="h-6 w-6" />,
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  connected: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
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
  const [emailScans, setEmailScans] = useState<EmailScanConfig[]>([]);
  const [activeTab, setActiveTab] = useState('connected');
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [connectingType, setConnectingType] = useState<string | null>(null);
  const [connectDialog, setConnectDialog] = useState<'slack' | 'teams' | 'okta' | 'azure_ad' | null>(null);
  const [connectForm, setConnectForm] = useState({
    webhook_url: '',
    channel_name: 'alerts',
    domain: '',
    api_token: '',
    tenant_id: '',
    client_id: '',
    client_secret: '',
  });

  const apiError = (error: unknown, fallback: string) => {
    const err = error as {
      response?: { status?: number; data?: { error?: string; detail?: string; code?: string; upgrade_url?: string } };
      message?: string;
    };
    if (err.response?.data?.code === 'plan_upgrade_required' || err.response?.status === 402) {
      return err.response?.data?.error || 'This feature requires Pro. Open Billing to upgrade.';
    }
    return err.response?.data?.error || err.response?.data?.detail || err.message || fallback;
  };

  const handlePlanGate = (error: unknown) => {
    const err = error as { response?: { status?: number; data?: { code?: string; upgrade_url?: string; error?: string } } };
    if (err.response?.data?.code === 'plan_upgrade_required' || err.response?.status === 402) {
      toast.error(err.response?.data?.error || 'Upgrade required', {
        action: {
          label: 'Billing',
          onClick: () => hardNavigate(err.response?.data?.upgrade_url || '/settings/billing'),
        },
      });
      return true;
    }
    return false;
  };

  const isConnectedStatus = (status?: string) =>
    status === 'active' || status === 'connected';

  const loadData = async () => {
    await fetchIntegrations();
    try {
      const [banks, sso, hooks, scans, billingStatus] = await Promise.all([
        integrationsApi.listBankAccounts(),
        integrationsApi.listSSOConnections(),
        integrationsApi.listWebhooks(),
        integrationsApi.listEmailScans(),
        organizationApi.getBilling().catch(() => null),
      ]);
      setBankAccounts(Array.isArray(banks) ? banks : banks.results || []);
      setSSOConnections(Array.isArray(sso) ? sso : sso.results || []);
      setWebhooks(Array.isArray(hooks) ? hooks : hooks.results || []);
      setEmailScans(scans);
      if (billingStatus) setBilling(billingStatus);
    } catch {
      // Optional tabs should not block the main integrations list.
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'integration-oauth-success') {
        toast.success('Integration connected');
        void loadData();
      } else if (event.data?.type === 'integration-oauth-error') {
        toast.error(event.data.error || 'OAuth connection failed');
      }
    };
    window.addEventListener('message', onMessage);

    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      toast.success('Integration connected');
      window.history.replaceState({}, '', '/settings/integrations');
    } else if (params.get('error')) {
      toast.error(params.get('error') || 'OAuth connection failed');
      window.history.replaceState({}, '', '/settings/integrations');
    }

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('message', onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchIntegrations]);

  const openOAuthPopup = (authUrl: string) => {
    const popup = window.open(authUrl, 'swm-oauth', 'width=520,height=720,scrollbars=yes');
    if (!popup) {
      hardNavigate(authUrl);
    }
  };

  const handleConnect = async (type: string) => {
    setConnectingType(type);
    try {
      if (type === 'plaid') {
        const { link_token } = await integrationsApi.createPlaidLink();
        const publicToken = await openPlaidLink(link_token);
        await integrationsApi.exchangePlaidToken(publicToken);
        toast.success('Bank account connected');
        await loadData();
        return;
      }
      if (type === 'slack' || type === 'teams' || type === 'okta' || type === 'azure_ad') {
        setConnectForm({
          webhook_url: '',
          channel_name: 'alerts',
          domain: '',
          api_token: '',
          tenant_id: '',
          client_id: '',
          client_secret: '',
        });
        setConnectDialog(type as 'slack' | 'teams' | 'okta' | 'azure_ad');
        return;
      }
      const { auth_url } = await integrationsApi.getProviderAuthUrl(type);
      openOAuthPopup(auth_url);
      return;
    } catch (error) {
      if (!handlePlanGate(error)) {
        toast.error(apiError(error, 'Failed to connect integration'));
      }
    } finally {
      setConnectingType(null);
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

  const submitConnectDialog = async () => {
    if (!connectDialog) return;
    setConnectingType(connectDialog);
    try {
      if (connectDialog === 'slack') {
        await integrationsApi.connectSlack({
          webhook_url: connectForm.webhook_url,
          channel_name: connectForm.channel_name,
        });
        toast.success('Slack connected');
      } else if (connectDialog === 'teams') {
        // Need to cast to any since we haven't updated services.ts yet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (integrationsApi as any).connectTeams({
          webhook_url: connectForm.webhook_url,
          channel_name: connectForm.channel_name,
        });
        toast.success('Teams connected');
      } else if (connectDialog === 'okta') {
        await integrationsApi.connectOkta({
          domain: connectForm.domain,
          api_token: connectForm.api_token,
        });
        toast.success('Okta connected');
      } else {
        await integrationsApi.connectAzureAd({
          tenant_id: connectForm.tenant_id,
          client_id: connectForm.client_id,
          client_secret: connectForm.client_secret,
        });
        toast.success('Azure AD connected');
      }
      setConnectDialog(null);
      await loadData();
    } catch (error) {
      toast.error(apiError(error, 'Failed to connect integration'));
    } finally {
      setConnectingType(null);
    }
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
    } catch {
      toast.error('Failed to create webhook');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await integrationsApi.deleteWebhook(id);
      setWebhooks(webhooks.filter((w) => w.id !== id));
      toast.success('Webhook deleted');
    } catch {
      toast.error('Failed to delete webhook');
    }
  };

  const availableIntegrations: Array<{ type: string; name: string; description: string; category: string; comingSoon?: boolean }> = [
    {
      type: 'google_workspace',
      name: 'Google Workspace',
      description: 'Discover Gmail receipts and Workspace app usage',
      category: 'discovery',
    },
    {
      type: 'microsoft_365',
      name: 'Microsoft 365',
      description: 'Discover Outlook receipts and Microsoft 365 usage',
      category: 'discovery',
    },
    {
      type: 'plaid',
      name: 'Plaid',
      description: 'Connect bank accounts to discover subscription payments',
      category: 'banking',
    },
    {
      type: 'slack',
      name: 'Slack',
      description: 'Post alerts to a Slack channel via incoming webhook',
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
      description: 'Sync assigned apps from Okta',
      category: 'sso',
    },
    {
      type: 'azure_ad',
      name: 'Azure AD',
      description: 'Discover enterprise apps from Azure Active Directory',
      category: 'sso',
    },
    {
      type: 'onelogin',
      name: 'OneLogin',
      description: 'Sync assigned apps from OneLogin',
      category: 'sso',
      comingSoon: true,
    },
    {
      type: 'jumpcloud',
      name: 'JumpCloud',
      description: 'Sync assigned apps from JumpCloud',
      category: 'sso',
      comingSoon: true,
    },
    {
      type: 'quickbooks',
      name: 'QuickBooks',
      description: 'Sync subscription expenses with accounting',
      category: 'accounting',
      comingSoon: true,
    },
    {
      type: 'xero',
      name: 'Xero',
      description: 'Sync subscription expenses with Xero',
      category: 'accounting',
      comingSoon: true,
    },
    {
      type: 'workday',
      name: 'Workday',
      description: 'Sync employee departments and managers',
      category: 'hr',
      comingSoon: true,
    },
    {
      type: 'bamboohr',
      name: 'BambooHR',
      description: 'Sync employee profiles',
      category: 'hr',
      comingSoon: true,
    },
    {
      type: 'gusto',
      name: 'Gusto',
      description: 'Sync payroll and employee data',
      category: 'hr',
      comingSoon: true,
    },
    {
      type: 'rippling',
      name: 'Rippling',
      description: 'Sync employee data',
      category: 'hr',
      comingSoon: true,
    },
    {
      type: 'concur',
      name: 'SAP Concur',
      description: 'Sync expense reports',
      category: 'finance',
      comingSoon: true,
    },
    {
      type: 'expensify',
      name: 'Expensify',
      description: 'Sync expenses',
      category: 'finance',
      comingSoon: true,
    },
    {
      type: 'brex',
      name: 'Brex',
      description: 'Sync corporate cards and transactions',
      category: 'finance',
      comingSoon: true,
    },
    {
      type: 'ramp',
      name: 'Ramp',
      description: 'Sync virtual cards',
      category: 'finance',
      comingSoon: true,
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

        {billing && !billing.has_pro_access && !billing.is_on_trial && (
          <PlanUpgradeCard
            title="Discovery connectors need Pro"
            description="Google Workspace, Microsoft 365, Okta, Azure AD, and Plaid require Pro or an active trial. Slack, Teams, and webhooks stay available on Starter."
          />
        )}

        <Dialog open={connectDialog !== null} onOpenChange={(open) => !open && setConnectDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {connectDialog === 'slack' && 'Connect Slack'}
                {connectDialog === 'teams' && 'Connect Teams'}
                {connectDialog === 'okta' && 'Connect Okta'}
                {connectDialog === 'azure_ad' && 'Connect Azure AD'}
              </DialogTitle>
              <DialogDescription>
                {connectDialog === 'slack' &&
                  'Paste an incoming webhook URL from Slack (Apps → Incoming Webhooks).'}
                {connectDialog === 'teams' &&
                  'Paste an incoming webhook URL from Microsoft Teams.'}
                {connectDialog === 'okta' &&
                  'Use your Okta domain and an API token with app read access.'}
                {connectDialog === 'azure_ad' &&
                  'Use an app registration with Application.Read.All (application permission).'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {(connectDialog === 'slack' || connectDialog === 'teams') && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      type="url"
                      placeholder="https://..."
                      value={connectForm.webhook_url}
                      onChange={(e) => setConnectForm({ ...connectForm, webhook_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="channel">Channel name</Label>
                    <Input
                      id="channel"
                      placeholder="alerts"
                      value={connectForm.channel_name}
                      onChange={(e) => setConnectForm({ ...connectForm, channel_name: e.target.value })}
                    />
                  </div>
                </>
              )}
              {connectDialog === 'okta' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="okta-domain">Okta domain</Label>
                    <Input
                      id="okta-domain"
                      placeholder="company.okta.com"
                      value={connectForm.domain}
                      onChange={(e) => setConnectForm({ ...connectForm, domain: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="okta-token">API token</Label>
                    <Input
                      id="okta-token"
                      type="password"
                      value={connectForm.api_token}
                      onChange={(e) => setConnectForm({ ...connectForm, api_token: e.target.value })}
                    />
                  </div>
                </>
              )}
              {connectDialog === 'azure_ad' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="azure-tenant">Tenant ID</Label>
                    <Input
                      id="azure-tenant"
                      value={connectForm.tenant_id}
                      onChange={(e) => setConnectForm({ ...connectForm, tenant_id: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="azure-client">Client ID</Label>
                    <Input
                      id="azure-client"
                      value={connectForm.client_id}
                      onChange={(e) => setConnectForm({ ...connectForm, client_id: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="azure-secret">Client secret</Label>
                    <Input
                      id="azure-secret"
                      type="password"
                      value={connectForm.client_secret}
                      onChange={(e) => setConnectForm({ ...connectForm, client_secret: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConnectDialog(null)}>
                Cancel
              </Button>
              <Button onClick={submitConnectDialog} disabled={Boolean(connectingType)}>
                {connectingType ? 'Connecting...' : 'Connect'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Connected Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Connected</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {integrations.filter((i) => isConnectedStatus(i.status)).length}
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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="connected">Connected</TabsTrigger>
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="email">Email scan</TabsTrigger>
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
                  <Button onClick={() => setActiveTab('available')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Browse connectors
                  </Button>
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
                          {isConnectedStatus(integration.status) && (
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
                  (i) => i.type === integration.type && isConnectedStatus(i.status)
                );
                const comingSoon = Boolean(integration.comingSoon);
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
                            {comingSoon ? 'coming soon' : integration.category}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-500">{integration.description}</p>
                      <Button
                        className="w-full"
                        variant={isConnected || comingSoon ? 'secondary' : 'default'}
                        disabled={isConnected || comingSoon || connectingType === integration.type}
                        onClick={() => handleConnect(integration.type)}
                      >
                        {comingSoon ? (
                          'Coming soon'
                        ) : isConnected ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Connected
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            {connectingType === integration.type ? 'Connecting...' : 'Connect'}
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email scan</CardTitle>
                <CardDescription>
                  Scan connected Google or Microsoft mailboxes for invoices and receipts.
                  Connect Workspace first if you do not see a configuration here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {emailScans.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Mail className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 mb-4">No email scan configured yet</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleConnect('google_workspace')}
                        disabled={connectingType === 'google_workspace'}
                      >
                        Connect Google
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleConnect('microsoft_365')}
                        disabled={connectingType === 'microsoft_365'}
                      >
                        Connect Microsoft
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {emailScans.map((config) => (
                      <div
                        key={config.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {(config.mailboxes || []).join(', ') || 'All connected mailboxes'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Last scan:{' '}
                            {config.last_scan || config.last_scan_at
                              ? format(new Date(config.last_scan || config.last_scan_at || ''), 'MMM d, h:mm a')
                              : 'Never'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={config.enabled ?? config.is_active ?? false}
                            onCheckedChange={async (checked) => {
                              try {
                                const updated = await integrationsApi.updateEmailScan(config.id, {
                                  enabled: checked,
                                });
                                setEmailScans(
                                  emailScans.map((item) => (item.id === updated.id ? updated : item))
                                );
                              } catch (error) {
                                toast.error(apiError(error, 'Failed to update scan'));
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await integrationsApi.scanEmailsNow(config.id);
                                toast.success('Email scan started');
                              } catch (error) {
                                toast.error(apiError(error, 'Failed to start email scan'));
                              }
                            }}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Scan now
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
                  <Button onClick={() => handleConnect('plaid')} disabled={connectingType === 'plaid'}>
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
                    <Button onClick={() => handleConnect('plaid')} disabled={connectingType === 'plaid'}>
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
                              } catch {
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
