'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useSubscriptionsStore } from '@/lib/stores';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Plus,
  Search,
  MoreHorizontal,
  ExternalLink,
  Edit,
  Trash2,
  Ban,
  Download,
  Grid,
  List,
  Calendar,
  Users,
  DollarSign,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { VendorCategory, SubscriptionStatus } from '@/types/swm';

const CATEGORIES: { value: VendorCategory; label: string }[] = [
  { value: 'productivity', label: 'Productivity' },
  { value: 'communication', label: 'Communication' },
  { value: 'development', label: 'Development' },
  { value: 'design', label: 'Design' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Sales' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'security', label: 'Security' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'storage', label: 'Storage' },
  { value: 'project_management', label: 'Project Management' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS: { value: SubscriptionStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'bg-green-500' },
  { value: 'trial', label: 'Trial', color: 'bg-blue-500' },
  { value: 'expiring', label: 'Expiring', color: 'bg-yellow-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-500' },
  { value: 'suspended', label: 'Suspended', color: 'bg-red-500' },
  { value: 'pending', label: 'Pending', color: 'bg-purple-500' },
];

export default function SubscriptionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    subscriptions,
    totalCount,
    isLoading,
    filters,
    fetchSubscriptions,
    deleteSubscription,
    cancelSubscription,
    setFilters,
    clearFilters,
  } = useSubscriptionsStore();

  useEffect(() => {
    const status = searchParams.get('status') || undefined;
    const category = searchParams.get('category') || undefined;
    const filter = searchParams.get('filter');

    if (filter === 'low-utilization') {
      setFilters({ ...filters, status: 'active' });
    } else {
      setFilters({ status, category });
    }

    fetchSubscriptions();
  }, [searchParams, fetchSubscriptions, filters, setFilters]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, search: searchQuery });
    fetchSubscriptions();
  };

  const handleFilterChange = (key: string, value: string | undefined) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchSubscriptions();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    clearFilters();
    fetchSubscriptions();
    router.push('/subscriptions');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSubscription(deleteId);
      toast.success('Subscription deleted successfully');
      setDeleteId(null);
    } catch {
      toast.error('Failed to delete subscription');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelSubscription(id);
      toast.success('Subscription cancelled');
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
    const option = STATUS_OPTIONS.find((s) => s.value === status);
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
        {option?.label || status}
      </Badge>
    );
  };

  const hasActiveFilters = filters.status || filters.category || filters.search;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Subscriptions
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Manage your organization&apos;s software subscriptions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/subscriptions/import">
                <Download className="h-4 w-4 mr-2" />
                Import
              </Link>
            </Button>
            <Button asChild>
              <Link href="/subscriptions/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Subscription
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <form onSubmit={handleSearch} className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search subscriptions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </form>

              {/* Status Filter */}
              <Select
                value={filters.status || 'all'}
                onValueChange={(v) => handleFilterChange('status', v === 'all' ? undefined : v)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select
                value={filters.category || 'all'}
                onValueChange={(v) => handleFilterChange('category', v === 'all' ? undefined : v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View Toggle */}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="rounded-r-none"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-l-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button variant="ghost" onClick={handleClearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {subscriptions.length} of {totalCount} subscriptions
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Monthly Cost</TableHead>
                  <TableHead className="text-center">Utilization</TableHead>
                  <TableHead>Renewal</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                      No subscriptions found
                    </TableCell>
                  </TableRow>
                ) : (
                  subscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <Link
                          href={`/subscriptions/${sub.id}`}
                          className="font-medium hover:underline"
                        >
                          {sub.name}
                        </Link>
                        {sub.vendor && (
                          <p className="text-xs text-gray-500">{sub.vendor.name}</p>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell className="capitalize">
                        {sub.vendor?.category?.replace('_', ' ') || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sub.monthly_cost)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Progress
                            value={sub.utilization_rate}
                            className="h-2 w-16"
                          />
                          <span className="text-sm text-gray-500 w-10">
                            {Math.round(sub.utilization_rate)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {sub.renewal_date ? formatDate(sub.renewal_date) : '-'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/subscriptions/${sub.id}`}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/subscriptions/${sub.id}/edit`}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            {sub.status === 'active' && (
                              <DropdownMenuItem onClick={() => handleCancel(sub.id)}>
                                <Ban className="h-4 w-4 mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteId(sub.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subscriptions.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-12 text-center text-gray-500">
                  No subscriptions found
                </CardContent>
              </Card>
            ) : (
              subscriptions.map((sub) => (
                <Card key={sub.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/subscriptions/${sub.id}`}
                          className="font-medium hover:underline"
                        >
                          {sub.name}
                        </Link>
                        {sub.vendor && (
                          <p className="text-xs text-gray-500">{sub.vendor.name}</p>
                        )}
                      </div>
                      {getStatusBadge(sub.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">
                          {formatCurrency(sub.monthly_cost)}/mo
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>
                          {sub.assigned_licenses}/{sub.total_licenses} licenses
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Utilization</span>
                        <span className="font-medium">
                          {Math.round(sub.utilization_rate)}%
                        </span>
                      </div>
                      <Progress value={sub.utilization_rate} className="h-2" />
                    </div>
                    {sub.renewal_date && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        Renews {formatDate(sub.renewal_date)}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={`/subscriptions/${sub.id}`}>View</Link>
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={`/subscriptions/${sub.id}/edit`}>Edit</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this subscription? This action cannot be undone.
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
    </DashboardLayout>
  );
}
