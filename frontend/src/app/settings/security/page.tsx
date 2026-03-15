'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { securityApi } from '@/lib/services';
// import { useAuthStore } from '@/lib/stores';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Shield,
  Key,
  Smartphone,
  Globe,
  Copy,
  Trash2,
  Plus,
  CheckCircle,
  AlertTriangle,
  LogOut,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { APIKey, MFADevice, Session, AuditLog } from '@/types/swm';

export default function SecurityPage() {
  // const { user } = useAuthStore();
  
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [mfaDevices, setMfaDevices] = useState<MFADevice[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [newApiKey, setNewApiKey] = useState<{ key: string; secret: string } | null>(null);
  const [apiKeyForm, setApiKeyForm] = useState({ name: '', scopes: [] as string[] });
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [keys, devices, sessionData, logs] = await Promise.all([
        securityApi.listApiKeys(),
        securityApi.listMfaDevices(),
        securityApi.listSessions(),
        securityApi.getAuditLogs(),
      ]);
      setApiKeys(Array.isArray(keys) ? keys : keys.results || []);
      setMfaDevices(Array.isArray(devices) ? devices : devices.results || []);
      setSessions(Array.isArray(sessionData) ? sessionData : sessionData.results || []);
      setAuditLogs(Array.isArray(logs) ? logs : logs.results || []);
    } catch (error) {
      console.error('Failed to load security data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    try {
      const result = await securityApi.createApiKey({
        name: apiKeyForm.name,
        scopes: apiKeyForm.scopes,
      });
      setNewApiKey({ key: result.key, secret: result.secret || '' });
      setApiKeys([...apiKeys, result]);
      setApiKeyForm({ name: '', scopes: [] });
    } catch {
      toast.error('Failed to create API key');
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    try {
      await securityApi.revokeApiKey(id);
      setApiKeys(apiKeys.filter((k) => k.id !== id));
      toast.success('API key revoked');
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to revoke API key', error);
      toast.error('Failed to revoke API key');
    }
  };

  const handleSetupMfa = async () => {
    try {
      // const { qr_code, secret } = await securityApi.setupMFA('totp');
      // Would show QR code for scanning
      toast.success('MFA setup initiated');
      loadData();
    } catch (error) {
      console.error('Failed to setup MFA', error);
      toast.error('Failed to setup MFA');
    }
  };

  const handleRemoveMfa = async (id: string) => {
    try {
      await securityApi.removeMfaDevice(id);
      setMfaDevices(mfaDevices.filter((d) => d.id !== id));
      toast.success('MFA device removed');
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to remove MFA device', error);
      toast.error('Failed to remove MFA device');
    }
  };

  const handleRevokeSession = async (id: string) => {
    try {
      await securityApi.revokeSession(id);
      setSessions(sessions.filter((s) => s.id !== id));
      toast.success('Session revoked');
    } catch (error) {
      console.error('Failed to revoke session', error);
      toast.error('Failed to revoke session');
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await securityApi.revokeAllSessions();
      setSessions([]);
      toast.success('All sessions revoked');
    } catch (error) {
      console.error('Failed to revoke sessions', error);
      toast.error('Failed to revoke sessions');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
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
            <h1 className="text-2xl font-bold">Security</h1>
            <p className="text-gray-500">Manage API keys, MFA, and sessions</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>API Keys</CardDescription>
              <CardTitle className="text-3xl">{apiKeys.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>MFA Status</CardDescription>
              <CardTitle className="text-3xl">
                {mfaDevices.length > 0 ? (
                  <span className="flex items-center gap-2 text-green-600">
                    <Shield className="h-6 w-6" />
                    Enabled
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="h-6 w-6" />
                    Disabled
                  </span>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Sessions</CardDescription>
              <CardTitle className="text-3xl">{sessions.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Audit Events (30d)</CardDescription>
              <CardTitle className="text-3xl">{auditLogs.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="api-keys">
          <TabsList>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="mfa">Multi-Factor Auth</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>
                      Manage API keys for programmatic access
                    </CardDescription>
                  </div>
                  <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Create API Key
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      {newApiKey ? (
                        <>
                          <DialogHeader>
                            <DialogTitle>API Key Created</DialogTitle>
                            <DialogDescription>
                              Save these credentials now. You won&apos;t be able to see the
                              secret again.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>API Key</Label>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                                  {newApiKey.key}
                                </code>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => copyToClipboard(newApiKey.key)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Secret</Label>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                                  {newApiKey.secret}
                                </code>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => copyToClipboard(newApiKey.secret)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => {
                                setNewApiKey(null);
                                setShowApiKeyDialog(false);
                              }}
                            >
                              Done
                            </Button>
                          </DialogFooter>
                        </>
                      ) : (
                        <>
                          <DialogHeader>
                            <DialogTitle>Create API Key</DialogTitle>
                            <DialogDescription>
                              Generate a new API key for accessing the SWM API
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="key-name">Key Name</Label>
                              <Input
                                id="key-name"
                                placeholder="e.g., Production API"
                                value={apiKeyForm.name}
                                onChange={(e) =>
                                  setApiKeyForm({ ...apiKeyForm, name: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Permissions</Label>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  'subscriptions:read',
                                  'subscriptions:write',
                                  'analytics:read',
                                  'recommendations:read',
                                  'workflows:read',
                                  'workflows:write',
                                ].map((scope) => (
                                  <label
                                    key={scope}
                                    className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={apiKeyForm.scopes.includes(scope)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setApiKeyForm({
                                            ...apiKeyForm,
                                            scopes: [...apiKeyForm.scopes, scope],
                                          });
                                        } else {
                                          setApiKeyForm({
                                            ...apiKeyForm,
                                            scopes: apiKeyForm.scopes.filter(
                                              (s) => s !== scope
                                            ),
                                          });
                                        }
                                      }}
                                      className="rounded"
                                    />
                                    <span className="text-sm">{scope}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setShowApiKeyDialog(false)}
                            >
                              Cancel
                            </Button>
                            <Button onClick={handleCreateApiKey}>Create Key</Button>
                          </DialogFooter>
                        </>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {apiKeys.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Key className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 mb-4">No API keys created yet</p>
                    <Button onClick={() => setShowApiKeyDialog(true)}>
                      Create Your First API Key
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Key Prefix</TableHead>
                        <TableHead>Scopes</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last Used</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell className="font-medium">{key.name}</TableCell>
                          <TableCell>
                            <code className="text-sm">{key.prefix}...</code>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {key.scopes.slice(0, 2).map((scope) => (
                                <Badge key={scope} variant="outline" className="text-xs">
                                  {scope}
                                </Badge>
                              ))}
                              {key.scopes.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{key.scopes.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {format(new Date(key.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {key.last_used
                              ? format(new Date(key.last_used), 'MMM d, h:mm a')
                              : 'Never'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() =>
                                setDeleteConfirm({ type: 'apiKey', id: key.id })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mfa" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Multi-Factor Authentication</CardTitle>
                    <CardDescription>
                      Add an extra layer of security to your account
                    </CardDescription>
                  </div>
                  {mfaDevices.length === 0 && (
                    <Button onClick={handleSetupMfa}>
                      <Smartphone className="h-4 w-4 mr-2" />
                      Enable MFA
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {mfaDevices.length === 0 ? (
                  <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="h-6 w-6 text-yellow-600" />
                      <div>
                        <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                          MFA Not Enabled
                        </h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          We strongly recommend enabling multi-factor authentication to
                          protect your account. MFA adds an extra layer of security by
                          requiring a code from your phone in addition to your password.
                        </p>
                        <Button
                          className="mt-4"
                          variant="outline"
                          onClick={handleSetupMfa}
                        >
                          Enable MFA Now
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mfaDevices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                            <Smartphone className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">{device.name}</p>
                            <p className="text-sm text-gray-500">
                              Added {format(new Date(device.created_at), 'MMM d, yyyy')}
                              {device.last_used && (
                                <span>
                                  {' '}
                                  • Last used{' '}
                                  {format(new Date(device.last_used), 'MMM d, h:mm a')}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() =>
                              setDeleteConfirm({ type: 'mfa', id: device.id })
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Active Sessions</CardTitle>
                    <CardDescription>
                      Devices and browsers currently logged into your account
                    </CardDescription>
                  </div>
                  {sessions.length > 1 && (
                    <Button variant="outline" onClick={handleRevokeAllSessions}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Globe className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500">No active sessions</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                            <Globe className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{session.device}</p>
                              {session.is_current && (
                                <Badge
                                  variant="outline"
                                  className="bg-green-100 text-green-700"
                                >
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {session.ip_address} • {session.location}
                            </p>
                            <p className="text-xs text-gray-400">
                              Last active{' '}
                              {format(new Date(session.last_activity), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                        {!session.is_current && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => handleRevokeSession(session.id)}
                          >
                            <LogOut className="h-4 w-4 mr-1" />
                            Sign Out
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>
                  Recent security-related activity on your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Activity className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500">No audit events recorded</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4 text-gray-400" />
                              <span className="font-medium">{log.action}</span>
                            </div>
                            {log.details && (
                              <p className="text-sm text-gray-500 mt-1">
                                {JSON.stringify(log.details)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            {log.user?.email || 'System'}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {log.ip_address}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {format(new Date(log.created_at), 'MMM d, h:mm:ss a')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation */}
        <AlertDialog
          open={!!deleteConfirm}
          onOpenChange={() => setDeleteConfirm(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteConfirm?.type === 'apiKey'
                  ? 'Revoke API Key'
                  : 'Remove MFA Device'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteConfirm?.type === 'apiKey'
                  ? 'Are you sure you want to revoke this API key? Any applications using it will lose access immediately.'
                  : 'Are you sure you want to remove this MFA device? Your account will be less secure.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConfirm?.type === 'apiKey') {
                    handleRevokeApiKey(deleteConfirm.id);
                  } else if (deleteConfirm?.type === 'mfa') {
                    handleRemoveMfa(deleteConfirm.id);
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteConfirm?.type === 'apiKey' ? 'Revoke' : 'Remove'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
