'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { alertsApi } from '@/lib/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, DollarSign, AlertTriangle, CheckCircle, Clock, XCircle, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { RenewalAlert, BudgetAlert, AlertPriority } from '@/types/swm';

const PRIORITY_COLORS: Record<AlertPriority, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

export default function AlertsPage() {
  const [renewalAlerts, setRenewalAlerts] = useState<RenewalAlert[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateBudgetDialog, setShowCreateBudgetDialog] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<AlertPriority | 'all'>('all');

  const [budgetForm, setBudgetForm] = useState({
    name: '',
    amount: 0,
    period: 'monthly' as 'monthly' | 'quarterly' | 'annual',
    category: '',
  });

  async function loadData() {
    setIsLoading(true);
    try {
      const [renewals, budgets] = await Promise.all([
        alertsApi.listRenewalAlerts(),
        alertsApi.listBudgetAlerts(),
      ]);
      setRenewalAlerts(renewals.results);
      setBudgetAlerts(budgets.results);
    } catch {
      toast.error('Failed to load alerts');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleAcknowledge = async (id: string) => {
    try {
      const updated = await alertsApi.acknowledgeRenewalAlert(id);
      setRenewalAlerts(renewalAlerts.map((a) => (a.id === id ? updated : a)));
      toast.success('Alert acknowledged');
    } catch {
      toast.error('Failed to acknowledge alert');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const updated = await alertsApi.dismissRenewalAlert(id);
      setRenewalAlerts(renewalAlerts.map((a) => (a.id === id ? updated : a)));
      toast.success('Alert dismissed');
    } catch {
      toast.error('Failed to dismiss alert');
    }
  };

  const handleCreateBudget = async () => {
    try {
      const budget = await alertsApi.createBudgetAlert(budgetForm);
      setBudgetAlerts([budget, ...budgetAlerts]);
      setShowCreateBudgetDialog(false);
      setBudgetForm({ name: '', amount: 0, period: 'monthly', category: '' });
      toast.success('Budget alert created');
    } catch {
      toast.error('Failed to create budget alert');
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await alertsApi.deleteBudgetAlert(id);
      setBudgetAlerts(budgetAlerts.filter((b) => b.id !== id));
      toast.success('Budget alert deleted');
    } catch {
      toast.error('Failed to delete budget alert');
    }
  };

  const filterAlerts = (alerts: RenewalAlert[]) => {
    return alerts.filter((a) => {
      if (priorityFilter !== 'all' && a.priority !== priorityFilter) return false;
      return true;
    });
  };

  const upcomingRenewals = filterAlerts(
    renewalAlerts.filter((a) => a.status === 'pending')
  );
  const acknowledgedRenewals = filterAlerts(
    renewalAlerts.filter((a) => a.status === 'acknowledged')
  );
  const dismissedRenewals = filterAlerts(
    renewalAlerts.filter((a) => a.status === 'dismissed')
  );

  const getDaysUntil = (date: string) => {
    return differenceInDays(new Date(date), new Date());
  };

  const getDaysUntilColor = (days: number) => {
    if (days <= 7) return 'text-red-600';
    if (days <= 14) return 'text-orange-600';
    if (days <= 30) return 'text-yellow-600';
    return 'text-green-600';
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Alerts & Renewals</h1>
            <p className="text-gray-500">
              Track upcoming renewals and budget alerts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={showCreateBudgetDialog} onOpenChange={setShowCreateBudgetDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Set Budget Alert
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Budget Alert</DialogTitle>
                  <DialogDescription>
                    Get notified when spending exceeds your budget
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget-name">Name</Label>
                    <Input
                      id="budget-name"
                      value={budgetForm.name}
                      onChange={(e) =>
                        setBudgetForm({ ...budgetForm, name: e.target.value })
                      }
                      placeholder="e.g., Monthly SaaS Budget"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget-amount">Budget Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        $
                      </span>
                      <Input
                        id="budget-amount"
                        type="number"
                        min="0"
                        step="100"
                        className="pl-7"
                        value={budgetForm.amount || ''}
                        onChange={(e) =>
                          setBudgetForm({
                            ...budgetForm,
                            amount: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="10000"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Period</Label>
                      <Select
                        value={budgetForm.period}
                        onValueChange={(v) =>
                          setBudgetForm({
                            ...budgetForm,
                            period: v as 'monthly' | 'quarterly' | 'annual',
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget-category">Category (optional)</Label>
                      <Input
                        id="budget-category"
                        value={budgetForm.category}
                        onChange={(e) =>
                          setBudgetForm({ ...budgetForm, category: e.target.value })
                        }
                        placeholder="e.g., Engineering"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateBudgetDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateBudget}>Create Alert</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Upcoming Renewals</CardDescription>
              <CardTitle className="text-3xl">{upcomingRenewals.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">in the next 90 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Critical (7 days)</CardDescription>
              <CardTitle className="text-3xl text-red-600">
                {renewalAlerts.filter((a) => getDaysUntil(a.renewal_date) <= 7).length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">needs immediate attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Renewal Value</CardDescription>
              <CardTitle className="text-3xl">
                $
                {upcomingRenewals
                  .reduce((acc, a) => acc + (a.subscription?.monthly_cost || 0), 0)
                  .toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">monthly cost at risk</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Budget Alerts</CardDescription>
              <CardTitle className="text-3xl">
                {budgetAlerts.filter((b) => b.is_triggered).length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                of {budgetAlerts.length} budgets exceeded
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="renewals">
          <TabsList>
            <TabsTrigger value="renewals">
              Renewals ({upcomingRenewals.length})
            </TabsTrigger>
            <TabsTrigger value="budgets">
              Budgets ({budgetAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="renewals" className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-500">Priority:</span>
              </div>
              <Select
                value={priorityFilter}
                onValueChange={(v) => setPriorityFilter(v as AlertPriority | 'all')}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {upcomingRenewals.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-medium">No upcoming renewals</h3>
                  <p className="text-gray-500">
                    You&apos;re all caught up! Check back later.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subscription</TableHead>
                        <TableHead>Renewal Date</TableHead>
                        <TableHead>Days Until</TableHead>
                        <TableHead>Monthly Cost</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingRenewals.map((alert) => {
                        const daysUntil = getDaysUntil(alert.renewal_date);
                        return (
                          <TableRow key={alert.id}>
                            <TableCell>
                              <Link
                                href={`/subscriptions/${alert.subscription?.id}`}
                                className="font-medium hover:underline"
                              >
                                {alert.subscription?.name}
                              </Link>
                            </TableCell>
                            <TableCell>
                              {format(new Date(alert.renewal_date), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn('font-medium', getDaysUntilColor(daysUntil))}
                              >
                                {daysUntil} days
                              </span>
                            </TableCell>
                            <TableCell>
                              ${alert.subscription?.monthly_cost.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={PRIORITY_COLORS[alert.priority]}>
                                {alert.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAcknowledge(alert.id)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Acknowledge
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDismiss(alert.id)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="budgets" className="space-y-4">
            {budgetAlerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <DollarSign className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium">No budget alerts</h3>
                  <p className="text-gray-500 mb-4">
                    Set up budget alerts to track your spending
                  </p>
                  <Button onClick={() => setShowCreateBudgetDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Budget Alert
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {budgetAlerts.map((budget) => {
                  const percentUsed = Math.round(
                    (budget.current_spend / budget.amount) * 100
                  );
                  const isOver = percentUsed > 100;
                  const isWarning = percentUsed > 80;

                  return (
                    <Card
                      key={budget.id}
                      className={cn(
                        'hover:shadow-md transition-shadow',
                        isOver && 'border-red-200 bg-red-50/50 dark:bg-red-900/10',
                        isWarning &&
                          !isOver &&
                          'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/10'
                      )}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{budget.name}</CardTitle>
                            <CardDescription>
                              {budget.category || 'All Categories'} • {budget.period}
                            </CardDescription>
                          </div>
                          {isOver && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Over Budget
                            </Badge>
                          )}
                          {isWarning && !isOver && (
                            <Badge className="bg-yellow-100 text-yellow-700">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Warning
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">
                              ${budget.current_spend.toLocaleString()} /{' '}
                              ${budget.amount.toLocaleString()}
                            </span>
                            <span
                              className={cn(
                                'font-medium',
                                isOver && 'text-red-600',
                                isWarning && !isOver && 'text-yellow-600',
                                !isWarning && 'text-green-600'
                              )}
                            >
                              {percentUsed}%
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full transition-all',
                                isOver && 'bg-red-500',
                                isWarning && !isOver && 'bg-yellow-500',
                                !isWarning && 'bg-green-500'
                              )}
                              style={{ width: `${Math.min(percentUsed, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">
                            ${Math.max(0, budget.amount - budget.current_spend).toLocaleString()}{' '}
                            remaining
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteBudget(budget.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Alert History</CardTitle>
                <CardDescription>
                  Previously acknowledged and dismissed alerts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {acknowledgedRenewals.length === 0 && dismissedRenewals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500">No alert history yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subscription</TableHead>
                        <TableHead>Renewal Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...acknowledgedRenewals, ...dismissedRenewals].map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell className="font-medium">
                            {alert.subscription?.name}
                          </TableCell>
                          <TableCell>
                            {format(new Date(alert.renewal_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                alert.status === 'acknowledged' ? 'default' : 'secondary'
                              }
                            >
                              {alert.status === 'acknowledged' && (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              )}
                              {alert.status === 'dismissed' && (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              {alert.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(alert.updated_at), 'MMM d, yyyy')}
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
      </div>
    </DashboardLayout>
  );
}
