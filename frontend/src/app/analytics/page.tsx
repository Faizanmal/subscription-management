'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useDashboardStore } from '@/lib/stores';
import { costsApi, usageApi, redundancyApi } from '@/lib/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import {
  TrendingDown,
  DollarSign,
  Activity,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import type { RedundancyGroup, CostRecord, UsageMetrics } from '@/types/swm';

const COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

export default function AnalyticsPage() {
  const {
    stats,
    spendingTrend,
    categoryBreakdown,
    topSpend,
    isLoading: dashboardLoading,
    fetchDashboardStats,
  } = useDashboardStore();

  const [redundancies, setRedundancies] = useState<RedundancyGroup[]>([]);
  const [costHistory, setCostHistory] = useState<CostRecord[]>([]);
  const [usageData, setUsageData] = useState<UsageMetrics[]>([]);
  const [dateRange, setDateRange] = useState('30d');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchDashboardStats();
      const [redundancyData, costsData, usageStats] = await Promise.all([
        redundancyApi.list(),
        costsApi.list(),
        usageApi.list(),
      ]);
      setRedundancies(Array.isArray(redundancyData) ? redundancyData : redundancyData.results || []);
      setCostHistory(Array.isArray(costsData) ? costsData : costsData.results || []);
      setUsageData(Array.isArray(usageStats) ? usageStats : usageStats.results || []);
    } catch (err) {
      console.error('Failed to load analytics data', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchDashboardStats, setCostHistory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate metrics
  const totalRedundantSpend = redundancies.reduce(
    (acc, r) => acc + r.total_monthly_cost,
    0
  );
  const avgUtilization =
    usageData.length > 0
      ? usageData.reduce((acc, u) => acc + u.utilization_rate, 0) / usageData.length
      : 0;
  const monthOverMonthChange = (() => {
    const trend = spendingTrend;
    if (trend && trend.length >= 2) {
      return ((trend[trend.length - 1]?.amount || 0) -
        (trend[trend.length - 2]?.amount || 0)) /
        (trend[trend.length - 2]?.amount || 1) * 100;
    }
    return 0;
  })();

  // Total costs (use costHistory so it's not flagged as unused)
  const totalCosts = costHistory.reduce((acc, c) => acc + (c.amount || 0), 0);

  // Prepare usage trend data
  const usageTrendData = usageData.slice(-30).map((u) => ({
    date: new Date(u.recorded_at || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    utilization: Math.round(u.utilization_rate * 100),
    activeUsers: u.active_users,
    totalUsers: u.total_users,
  }));

  // Department breakdown mock data
  const departmentData = [
    { name: 'Engineering', spend: 45000, subscriptions: 25 },
    { name: 'Marketing', spend: 18000, subscriptions: 12 },
    { name: 'Sales', spend: 22000, subscriptions: 15 },
    { name: 'HR', spend: 8000, subscriptions: 8 },
    { name: 'Finance', spend: 12000, subscriptions: 10 },
    { name: 'Other', spend: 5000, subscriptions: 5 },
  ];

  const handleExport = () => {
    // Export analytics data
    const data = {
      stats,
      spendingTrend,
      categoryBreakdown,
      redundancies,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  if (isLoading || dashboardLoading) {
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
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-gray-500">
              Deep insights into your subscription spending
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Monthly Spend
              </CardDescription>
              <CardTitle className="text-3xl">
                ${(stats?.monthly_spend ?? stats?.total_monthly_cost ?? 0).toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`flex items-center gap-1 text-sm ${
                  monthOverMonthChange >= 0 ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {monthOverMonthChange >= 0 ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                {Math.abs(monthOverMonthChange).toFixed(1)}% vs last month
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Avg Utilization
              </CardDescription>
              <CardTitle className="text-3xl">
                {Math.round(avgUtilization * 100)}%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={avgUtilization * 100} className="h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Redundant Spend
              </CardDescription>
              <CardTitle className="text-3xl text-orange-600">
                ${totalRedundantSpend.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                {redundancies.length} overlapping groups
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Total Recorded Costs
              </CardDescription>
              <CardTitle className="text-3xl text-gray-800">
                ${totalCosts.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Based on recent cost history</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Potential Savings
              </CardDescription>
              <CardTitle className="text-3xl text-green-600">
                ${stats?.potential_savings.toLocaleString() || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">from all recommendations</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="spending">
          <TabsList>
            <TabsTrigger value="spending">Spending</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="redundancy">Redundancy</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
          </TabsList>

          <TabsContent value="spending" className="space-y-6">
            {/* Spending Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Spending Trend</CardTitle>
                <CardDescription>Monthly spend over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={spendingTrend}>
                    <defs>
                      <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: any) =>
                        value !== undefined
                          ? [`$${Number(value).toLocaleString()}`, 'Spend']
                          : ['N/A', 'Spend']
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#3B82F6"
                      fillOpacity={1}
                      fill="url(#colorSpend)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category and Top Spend */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Spend by Category</CardTitle>
                  <CardDescription>Distribution across categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="category"
                        label={({ name, percent }) =>
                          `${name} ${percent !== undefined ? (percent * 100).toFixed(0) : 0}%`
                        }
                      >
                        {categoryBreakdown.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) =>
                          value !== undefined
                            ? [`$${Number(value).toLocaleString()}`, 'Spend']
                            : ['N/A', 'Spend']
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Spending Subscriptions</CardTitle>
                  <CardDescription>Highest monthly costs</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topSpend} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `$${v.toLocaleString()}`}
                      />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip
                        formatter={(value: any) =>
                          value !== undefined
                            ? [`$${Number(value).toLocaleString()}`, 'Cost']
                            : ['N/A', 'Cost']
                        }
                      />
                      <Bar dataKey="cost" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            {/* Usage Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Usage Trend</CardTitle>
                <CardDescription>
                  Utilization and active users over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={usageTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" tickFormatter={(v) => `${v}%`} />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="utilization"
                      name="Utilization %"
                      stroke="#10B981"
                      fill="#10B98120"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="activeUsers"
                      name="Active Users"
                      stroke="#3B82F6"
                      strokeWidth={2}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Low Utilization */}
            <Card>
              <CardHeader>
                <CardTitle>Low Utilization Subscriptions</CardTitle>
                <CardDescription>
                  Subscriptions with less than 50% utilization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Active Users</TableHead>
                      <TableHead>Total Licenses</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Monthly Cost</TableHead>
                      <TableHead>Waste</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.low_utilization?.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>
                          <Link
                            href={`/subscriptions/${sub.id}`}
                            className="font-medium hover:underline"
                          >
                            {sub.name}
                          </Link>
                        </TableCell>
                        <TableCell>{sub.assigned_licenses}</TableCell>
                        <TableCell>{sub.total_licenses}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={sub.utilization_rate * 100}
                              className="w-20 h-2"
                            />
                            <span className="text-sm">
                              {Math.round(sub.utilization_rate * 100)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>${sub.monthly_cost.toLocaleString()}</TableCell>
                        <TableCell className="text-orange-600">
                          $
                          {Math.round(
                            sub.monthly_cost * (1 - sub.utilization_rate)
                          ).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    )) || (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          No low utilization subscriptions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="redundancy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Redundancy Detection</CardTitle>
                <CardDescription>
                  Subscriptions with overlapping functionality
                </CardDescription>
              </CardHeader>
              <CardContent>
                {redundancies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Layers className="h-12 w-12 text-green-500 mb-4" />
                    <h3 className="text-lg font-medium">No Redundancies Detected</h3>
                    <p className="text-gray-500">
                      Your subscription portfolio looks optimized!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {redundancies.map((group) => (
                      <div
                        key={group.id}
                        className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-lg">{group.name}</h3>
                            <p className="text-gray-500">{group.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-orange-600">
                              ${group.total_monthly_cost.toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-500">combined monthly</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="outline">{group.category}</Badge>
                          <Badge className="bg-orange-100 text-orange-700">
                            {group.subscriptions?.length || 0} overlapping
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {group.subscriptions?.map((sub) => (
                            <Link
                              key={sub.id}
                              href={`/subscriptions/${sub.id}`}
                              className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <p className="font-medium">{sub.name}</p>
                              <p className="text-sm text-gray-500">
                                ${sub.monthly_cost.toLocaleString()}/mo •{' '}
                                {Math.round(sub.utilization_rate * 100)}% used
                              </p>
                            </Link>
                          ))}
                        </div>

                        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-sm">
                            <span className="font-medium text-green-600">
                              Potential savings:
                            </span>{' '}
                            ${group.potential_savings.toLocaleString()}/month by
                            consolidating
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Spend by Department</CardTitle>
                  <CardDescription>
                    Cost distribution across departments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={departmentData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: any) =>
                          value !== undefined
                            ? [`$${Number(value).toLocaleString()}`, 'Spend']
                            : ['N/A', 'Spend']
                        }
                      />
                      <Bar dataKey="spend" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Subscriptions by Department</CardTitle>
                  <CardDescription>Number of active subscriptions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={departmentData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="subscriptions"
                        nameKey="name"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {departmentData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Department Breakdown</CardTitle>
                <CardDescription>Detailed spend analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>Subscriptions</TableHead>
                      <TableHead>Monthly Spend</TableHead>
                      <TableHead>% of Total</TableHead>
                      <TableHead>Avg per Sub</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departmentData.map((dept) => {
                      const totalSpend = departmentData.reduce(
                        (acc, d) => acc + d.spend,
                        0
                      );
                      return (
                        <TableRow key={dept.name}>
                          <TableCell className="font-medium">{dept.name}</TableCell>
                          <TableCell>{dept.subscriptions}</TableCell>
                          <TableCell>${dept.spend.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={(dept.spend / totalSpend) * 100}
                                className="w-20 h-2"
                              />
                              <span className="text-sm">
                                {Math.round((dept.spend / totalSpend) * 100)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            ${Math.round(dept.spend / dept.subscriptions).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
