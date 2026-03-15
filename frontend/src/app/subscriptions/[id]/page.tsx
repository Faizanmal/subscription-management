'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useSubscriptionsStore } from '@/lib/stores';
import { subscriptionsApi } from '@/lib/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Ban,
  ExternalLink,
  DollarSign,
  Users,
  Calendar,
  BarChart3,
  FileText,
  Lightbulb,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { toast } from 'sonner';
import type { UsageMetrics, CostRecord, Recommendation, LicenseAssignment, SubscriptionStatus } from '@/types/swm';

export default function SubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { currentSubscription, fetchSubscription, deleteSubscription, cancelSubscription, isLoading } =
    useSubscriptionsStore();

  const [usage, setUsage] = useState<UsageMetrics[]>([]);
  const [costs, setCosts] = useState<CostRecord[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [licenses, setLicenses] = useState<LicenseAssignment[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const [currentTime] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await fetchSubscription(id);
      if (cancelled) return;

      try {
        const [usageData, costsData, recsData, licensesData] = await Promise.all([
          subscriptionsApi.getUsage(id, { period_type: 'monthly', limit: 12 }),
          subscriptionsApi.getCosts(id, { limit: 12 }),
          subscriptionsApi.getRecommendations(id),
          subscriptionsApi.getLicenses(id),
        ]);

        if (cancelled) return;

        setUsage(usageData);
        setCosts(costsData);
        setRecommendations(recsData);
        setLicenses(licensesData);
      } catch (error) {
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, fetchSubscription]);

  const handleDelete = async () => {
    try {
      await deleteSubscription(id);
      toast.success('Subscription deleted');
      router.push('/subscriptions');
    } catch {
      toast.error('Failed to delete subscription');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSubscription(id);
      toast.success('Subscription cancelled');
      setShowCancelDialog(false);
    } catch {
      toast.error('Failed to cancel subscription');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: SubscriptionStatus) => {
    const variants: Record<SubscriptionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      trial: 'secondary',
      expiring: 'outline',
      expired: 'destructive',
      cancelled: 'secondary',
      suspended: 'destructive',
      pending: 'outline',
    };
    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
    );
  };

  const sub = currentSubscription;

  if (isLoading || !sub) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{sub.name}</h1>
                {getStatusBadge(sub.status)}
              </div>
              <p className="text-gray-500">
                {sub.vendor?.name || 'Unknown Vendor'} • {sub.vendor?.category?.replace('_', ' ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sub.status === 'active' && (
              <Button variant="outline" onClick={() => setShowCancelDialog(true)}>
                <Ban className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={`/subscriptions/${id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Monthly Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(sub.monthly_cost)}</div>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(sub.annual_cost)} / year
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Licenses</CardTitle>
              <Users className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sub.assigned_licenses} / {sub.total_licenses}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {sub.total_licenses - sub.assigned_licenses} available
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Utilization</CardTitle>
              <BarChart3 className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(sub.utilization_rate)}%</div>
              <Progress value={sub.utilization_rate} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Next Renewal</CardTitle>
              <Calendar className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sub.renewal_date ? formatDate(sub.renewal_date) : 'N/A'}
              </div>
              {sub.renewal_date && (
                <p className="text-xs text-gray-500 mt-1">
                  {Math.ceil(
                    (new Date(sub.renewal_date).getTime() - currentTime) / (1000 * 60 * 60 * 24)
                  )}{' '}
                  days away
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="licenses">Licenses</TabsTrigger>
            <TabsTrigger value="recommendations">
              Recommendations
              {recommendations.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {recommendations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Subscription Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Billing Cycle</p>
                      <p className="font-medium capitalize">{sub.billing_cycle}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Payment Method</p>
                      <p className="font-medium capitalize">{sub.payment_method.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Start Date</p>
                      <p className="font-medium">{formatDate(sub.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Auto Renew</p>
                      <p className="font-medium">{sub.auto_renew ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Owner</p>
                      <p className="font-medium">
                        {sub.owner
                          ? `${sub.owner.first_name} ${sub.owner.last_name}`
                          : 'Unassigned'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Department</p>
                      <p className="font-medium">{sub.department || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Cost Center</p>
                      <p className="font-medium">{sub.cost_center || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Discovered Via</p>
                      <p className="font-medium capitalize">
                        {sub.discovered_via?.replace('_', ' ') || 'Manual'}
                      </p>
                    </div>
                  </div>
                  {sub.notes && (
                    <div>
                      <p className="text-sm text-gray-500">Notes</p>
                      <p className="text-sm mt-1">{sub.notes}</p>
                    </div>
                  )}
                  {sub.contract_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={sub.contract_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4 mr-2" />
                        View Contract
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Usage Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Usage Trend</CardTitle>
                  <CardDescription>Active users over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {usage.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={usage.slice().reverse()}>
                        <defs>
                          <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="period_start"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString('en-US', { month: 'short' })
                          }
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value: unknown) =>
                            value !== undefined ? [Number(value), 'Active Users'] : ['N/A', 'Active Users']
                          }
                          labelFormatter={(label) => formatDate(label)}
                        />
                        <Area
                          type="monotone"
                          dataKey="active_users"
                          stroke="#3b82f6"
                          fill="url(#colorUsers)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-gray-500 py-12">No usage data available</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recommendations Preview */}
            {recommendations.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-600" />
                    <CardTitle className="text-yellow-800 dark:text-yellow-200">
                      Recommendations Available
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recommendations.slice(0, 2).map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{rec.title}</p>
                          <p className="text-sm text-gray-500">{rec.description}</p>
                        </div>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Save {formatCurrency(rec.estimated_savings)}/mo
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage">
            <Card>
              <CardHeader>
                <CardTitle>Usage Metrics</CardTitle>
                <CardDescription>Monthly usage statistics</CardDescription>
              </CardHeader>
              <CardContent>
                {usage.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Active Users</TableHead>
                        <TableHead className="text-right">Total Logins</TableHead>
                        <TableHead className="text-right">Avg Session</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usage.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>{formatDate(u.period_start)}</TableCell>
                          <TableCell className="text-right">{u.active_users}</TableCell>
                          <TableCell className="text-right">{u.total_logins}</TableCell>
                          <TableCell className="text-right">
                            {Math.round(u.avg_session_duration)} min
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-gray-500 py-12">No usage data available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Costs Tab */}
          <TabsContent value="costs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Cost History</CardTitle>
                    <CardDescription>Payment records</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/subscriptions/${id}/costs/new`}>Add Cost Record</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {costs.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={costs.slice().reverse()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="period_start"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString('en-US', { month: 'short' })
                          }
                        />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip
                          formatter={(value: unknown) =>
                            value !== undefined ? formatCurrency(Number(value)) : 'N/A'
                          }
                        />
                        <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <Table className="mt-4">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {costs.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{formatDate(c.period_start)}</TableCell>
                            <TableCell>
                              {c.invoice_url ? (
                                <a
                                  href={c.invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {c.invoice_number || 'View'}
                                </a>
                              ) : (
                                c.invoice_number || '-'
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(c.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={c.payment_status === 'paid' ? 'default' : 'outline'}
                                className="capitalize"
                              >
                                {c.payment_status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                ) : (
                  <p className="text-center text-gray-500 py-12">No cost records available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Licenses Tab */}
          <TabsContent value="licenses">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>License Assignments</CardTitle>
                    <CardDescription>
                      {sub.assigned_licenses} of {sub.total_licenses} licenses assigned
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/subscriptions/${id}/licenses/assign`}>Assign License</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {licenses.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>License Type</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead>Last Used</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {licenses.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>
                            {l.user
                              ? `${l.user.first_name} ${l.user.last_name}`
                              : 'Unknown User'}
                          </TableCell>
                          <TableCell>{l.license_type || 'Standard'}</TableCell>
                          <TableCell>{formatDate(l.assigned_at)}</TableCell>
                          <TableCell>
                            {l.last_used_at ? formatDate(l.last_used_at) : 'Never'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={l.status === 'active' ? 'default' : 'secondary'}
                              className="capitalize"
                            >
                              {l.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-gray-500 py-12">No licenses assigned</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations">
            <Card>
              <CardHeader>
                <CardTitle>AI Recommendations</CardTitle>
                <CardDescription>Suggestions to optimize this subscription</CardDescription>
              </CardHeader>
              <CardContent>
                {recommendations.length > 0 ? (
                  <div className="space-y-4">
                    {recommendations.map((rec) => (
                      <div key={rec.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize">
                                {rec.type}
                              </Badge>
                              <Badge
                                variant={rec.priority === 'high' ? 'destructive' : 'secondary'}
                              >
                                {rec.priority} priority
                              </Badge>
                            </div>
                            <h3 className="font-medium mt-2">{rec.title}</h3>
                            <p className="text-sm text-gray-500 mt-1">{rec.description}</p>
                          </div>
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            Save {formatCurrency(rec.estimated_savings)}/mo
                          </Badge>
                        </div>
                        {rec.implementation_steps && rec.implementation_steps.length > 0 && (
                          <div>
                            <p className="text-sm font-medium">Implementation Steps:</p>
                            <ol className="list-decimal list-inside text-sm text-gray-600 mt-1">
                              {rec.implementation_steps.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-2">
                          <Button size="sm">Implement</Button>
                          <Button size="sm" variant="outline">
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-12">
                    No recommendations for this subscription
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{sub.name}&quot;? This will remove all
              associated data including usage history, cost records, and recommendations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel &quot;{sub.name}&quot;? The subscription will be
              marked as cancelled but the data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Active</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel}>Confirm Cancellation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
