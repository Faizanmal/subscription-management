'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useDashboardStore, useRecommendationsStore, useAuthStore, useOrganizationStore } from '@/lib/stores';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CreditCard,
  TrendingDown,
  DollarSign,
  Lightbulb,
  Clock,
  BarChart3,
  ArrowUpRight,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function DashboardPage() {
  const { user, isAuthenticated, fetchUser } = useAuthStore();
  const { fetchOrganization } = useOrganizationStore();
  const {
    stats,
    trends,
    categoryBreakdown,
    topSpend,
    lowUtilization,
    upcomingRenewals,
    isLoading,
    fetchDashboard,
    refreshDashboard,
  } = useDashboardStore();
  const { quickWins, fetchQuickWins } = useRecommendationsStore();

  const [currentTime] = useState(() => Date.now());

  useEffect(() => {
    if (isAuthenticated) {
      fetchUser();
      fetchOrganization();
      fetchDashboard();
      fetchQuickWins();
    }
  }, [isAuthenticated, fetchUser, fetchOrganization, fetchDashboard, fetchQuickWins]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${Math.round(value)}%`;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Welcome back, {user?.first_name}! Here&apos;s your subscription overview.
            </p>
          </div>
          <Button onClick={refreshDashboard} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Spend */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Monthly Spend
              </CardTitle>
              <DollarSign className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(stats?.total_monthly_cost || 0)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatCurrency((stats?.total_annual_cost || 0))} / year
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Active Subscriptions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Active Subscriptions
              </CardTitle>
              <CreditCard className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats?.active_subscriptions || 0}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    of {stats?.total_subscriptions || 0} total
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Average Utilization */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Avg Utilization
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatPercent(stats?.avg_utilization || 0)}
                  </div>
                  <Progress
                    value={stats?.avg_utilization || 0}
                    className="h-2 mt-2"
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Potential Savings */}
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                Potential Savings
              </CardTitle>
              <Zap className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(stats?.potential_savings || 0)}
                    <span className="text-sm font-normal">/mo</span>
                  </div>
                  <Link
                    href="/recommendations"
                    className="text-xs text-green-600 hover:underline mt-1 inline-flex items-center"
                  >
                    {stats?.pending_recommendations || 0} recommendations
                    <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Spending Trend */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Spending Trend</CardTitle>
              <CardDescription>Monthly subscription costs over time</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trends}>
                    <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      tickFormatter={(value) => `$${value / 1000}k`}
                    />
                    <Tooltip
                      formatter={(value: any) =>
                        value !== undefined
                          ? [formatCurrency(Number(value)), 'Cost']
                          : ['N/A', 'Cost']
                      }
                      labelStyle={{ color: '#374151' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cost"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#colorCost)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">By Category</CardTitle>
              <CardDescription>Subscription distribution</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <RechartsPieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="cost"
                      nameKey="category"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) =>
                        value !== undefined ? formatCurrency(Number(value)) : 'N/A'
                      }
                    />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      formatter={(value) => (
                        <span className="text-xs capitalize">{value}</span>
                      )}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lists Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Wins */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Quick Wins</CardTitle>
                <Lightbulb className="h-5 w-5 text-yellow-500" />
              </div>
              <CardDescription>High-impact recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : quickWins.length > 0 ? (
                <div className="space-y-3">
                  {quickWins.map((rec) => (
                    <Link
                      key={rec.id}
                      href={`/recommendations/${rec.id}`}
                      className="block p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium line-clamp-1">
                            {rec.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {rec.subscription?.name}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="ml-2 text-green-600 border-green-200 bg-green-50"
                        >
                          {formatCurrency(rec.estimated_savings)}/mo
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  No recommendations available
                </p>
              )}
              <Button variant="ghost" className="w-full mt-4" asChild>
                <Link href="/recommendations">View all recommendations</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Low Utilization */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Low Utilization</CardTitle>
                <TrendingDown className="h-5 w-5 text-orange-500" />
              </div>
              <CardDescription>Subscriptions under 30% usage</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : lowUtilization.length > 0 ? (
                <div className="space-y-3">
                  {lowUtilization.slice(0, 5).map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/subscriptions/${sub.id}`}
                      className="block p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{sub.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatCurrency(sub.monthly_cost)}/mo
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-orange-600">
                            {formatPercent(sub.utilization_rate)}
                          </p>
                          <Progress
                            value={sub.utilization_rate}
                            className="h-1 w-16 mt-1"
                          />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  All subscriptions have good utilization
                </p>
              )}
              <Button variant="ghost" className="w-full mt-4" asChild>
                <Link href="/subscriptions?filter=low-utilization">View all</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Upcoming Renewals */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Upcoming Renewals</CardTitle>
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <CardDescription>Next 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : upcomingRenewals.length > 0 ? (
                <div className="space-y-3">
                  {upcomingRenewals.slice(0, 5).map((sub) => {
                    const daysUntil = sub.renewal_date
                      ? Math.ceil(
                          (new Date(sub.renewal_date).getTime() - currentTime) /
                            (1000 * 60 * 60 * 24)
                        )
                      : 0;
                    return (
                      <Link
                        key={sub.id}
                        href={`/subscriptions/${sub.id}`}
                        className="block p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{sub.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(sub.monthly_cost)}/mo
                            </p>
                          </div>
                          <Badge
                            variant={daysUntil <= 7 ? 'destructive' : 'outline'}
                          >
                            {daysUntil} days
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  No upcoming renewals
                </p>
              )}
              <Button variant="ghost" className="w-full mt-4" asChild>
                <Link href="/alerts">View all alerts</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Top Spend */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Top Spending Subscriptions</CardTitle>
                <CardDescription>Your highest cost subscriptions</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/subscriptions">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={topSpend.slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: any) =>
                      value !== undefined ? formatCurrency(Number(value)) : 'N/A'
                    }
                  />
                  <Bar dataKey="monthly_cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
