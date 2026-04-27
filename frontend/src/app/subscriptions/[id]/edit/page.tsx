'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useSubscriptionsStore, useOrganizationStore } from '@/lib/stores';
import { vendorsApi } from '@/lib/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calender';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CalendarIcon, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Subscription, VendorCategory, BillingCycle, PaymentMethod, Vendor, SubscriptionStatus } from '@/types/swm';
import Image from 'next/image';

const STATUSES: { value: SubscriptionStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
];

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

const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'one_time', label: 'One Time' },
  { value: 'usage_based', label: 'Usage Based' },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'other', label: 'Other' },
];

export default function EditSubscriptionPage() {
  const router = useRouter();
  const params = useParams();
  const subscriptionId = params.id as string;
  
  const { currentSubscription, fetchSubscription, updateSubscription, deleteSubscription, isLoading } = useSubscriptionsStore();
  const { members } = useOrganizationStore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorResults, setVendorResults] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  
  const [formData, setFormData] = useState<Partial<Subscription>>({});

  useEffect(() => {
    if (subscriptionId) {
      fetchSubscription(subscriptionId);
    }
  }, [subscriptionId, fetchSubscription]);

  useEffect(() => {
    if (currentSubscription) {
      const timer = window.setTimeout(() => {
        setFormData(currentSubscription);
        setVendorSearch(currentSubscription.vendor?.name || currentSubscription.name);
        if (currentSubscription.vendor) {
          setSelectedVendor(currentSubscription.vendor);
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [currentSubscription]);

  const handleVendorSearch = async (query: string) => {
    setVendorSearch(query);
    if (query.length >= 2) {
      try {
        const results = await vendorsApi.search(query);
        setVendorResults(results);
      } catch {
        setVendorResults([]);
      }
    } else {
      setVendorResults([]);
    }
  };

  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setFormData((prev) => ({
      ...prev,
      name: vendor.name,
      vendor_id: vendor.id,
    }));
    setVendorSearch(vendor.name);
    setVendorResults([]);
  };

  const handleChange = (field: keyof Subscription, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculateAnnualCost = () => {
    const monthly = formData.monthly_cost || 0;
    switch (formData.billing_cycle) {
      case 'monthly':
        return monthly * 12;
      case 'quarterly':
        return monthly * 4;
      case 'annual':
        return monthly;
      default:
        return monthly * 12;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Subscription name is required');
      return;
    }
    
    if (!formData.monthly_cost || formData.monthly_cost <= 0) {
      toast.error('Please enter a valid cost');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await updateSubscription(subscriptionId, {
        ...formData,
        annual_cost: calculateAnnualCost(),
      });
      toast.success('Subscription updated successfully');
      router.push(`/subscriptions/${subscriptionId}`);
    } catch (error) {
      toast.error('Failed to update subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSubscription(subscriptionId);
      toast.success('Subscription deleted');
      router.push('/subscriptions');
    } catch (error) {
      toast.error('Failed to delete subscription');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading || !currentSubscription) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Edit {currentSubscription.name}</h1>
              <p className="text-gray-500">Update subscription details</p>
            </div>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this subscription? This action cannot be undone and will remove all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Update the subscription details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vendor Search */}
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor / Product</Label>
                <div className="relative">
                  <Input
                    id="vendor"
                    placeholder="Search for a vendor or enter name..."
                    value={vendorSearch}
                    onChange={(e) => handleVendorSearch(e.target.value)}
                  />
                  {vendorResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg max-h-60 overflow-auto">
                      {vendorResults.map((vendor) => (
                        <button
                          key={vendor.id}
                          type="button"
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                          onClick={() => handleSelectVendor(vendor)}
                        >
                          {vendor.logo && (
                            <Image src={vendor.logo} alt="" className="w-6 h-6 rounded" />
                          )}
                          <div>
                            <p className="font-medium">{vendor.name}</p>
                            <p className="text-xs text-gray-500 capitalize">
                              {vendor.category?.replace('_', ' ')}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Subscription Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Slack Pro"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => handleChange('status', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of what this subscription is used for..."
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={selectedVendor?.category || 'other'}
                  onValueChange={(v) => {
                    if (selectedVendor) {
                      setSelectedVendor({ ...selectedVendor, category: v as VendorCategory });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Billing Information */}
          <Card>
            <CardHeader>
              <CardTitle>Billing Information</CardTitle>
              <CardDescription>Cost and payment details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Cost */}
                <div className="space-y-2">
                  <Label htmlFor="cost">
                    {formData.billing_cycle === 'annual' ? 'Annual' : 'Monthly'} Cost *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      $
                    </span>
                    <Input
                      id="cost"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      value={formData.monthly_cost || ''}
                      onChange={(e) => handleChange('monthly_cost', parseFloat(e.target.value) || 0)}
                      required
                    />
                  </div>
                </div>

                {/* Currency */}
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(v) => handleChange('currency', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="CAD">CAD ($)</SelectItem>
                      <SelectItem value="AUD">AUD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Billing Cycle */}
                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <Select
                    value={formData.billing_cycle}
                    onValueChange={(v) => handleChange('billing_cycle', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_CYCLES.map((cycle) => (
                        <SelectItem key={cycle.value} value={cycle.value}>
                          {cycle.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(v) => handleChange('payment_method', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Calculated Annual Cost */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Estimated Annual Cost</span>
                  <span className="text-xl font-bold">
                    ${calculateAnnualCost().toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dates & Renewal */}
          <Card>
            <CardHeader>
              <CardTitle>Dates & Renewal</CardTitle>
              <CardDescription>Subscription timeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Start Date */}
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.start_date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.start_date
                          ? format(new Date(formData.start_date), 'PPP')
                          : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.start_date ? new Date(formData.start_date) : undefined}
                        onSelect={(date) =>
                          handleChange('start_date', date?.toISOString())
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Renewal Date */}
                <div className="space-y-2">
                  <Label>Renewal Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.renewal_date && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.renewal_date
                          ? format(new Date(formData.renewal_date), 'PPP')
                          : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={
                          formData.renewal_date ? new Date(formData.renewal_date) : undefined
                        }
                        onSelect={(date) =>
                          handleChange('renewal_date', date?.toISOString())
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Auto Renew */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Renew</Label>
                  <p className="text-sm text-gray-500">
                    Subscription will automatically renew
                  </p>
                </div>
                <Switch
                  checked={formData.auto_renew}
                  onCheckedChange={(checked) => handleChange('auto_renew', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Licenses */}
          <Card>
            <CardHeader>
              <CardTitle>Licenses</CardTitle>
              <CardDescription>License allocation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_licenses">Total Licenses</Label>
                  <Input
                    id="total_licenses"
                    type="number"
                    min="1"
                    value={formData.total_licenses || ''}
                    onChange={(e) =>
                      handleChange('total_licenses', parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assigned_licenses">Currently Assigned</Label>
                  <Input
                    id="assigned_licenses"
                    type="number"
                    min="0"
                    max={formData.total_licenses}
                    value={formData.assigned_licenses || ''}
                    onChange={(e) =>
                      handleChange('assigned_licenses', parseInt(e.target.value) || 0)
                    }
                  />
                </div>
              </div>
              
              {/* Utilization Rate Display */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Current Utilization</span>
                  <span className="text-lg font-semibold">
                    {Math.round((formData.utilization_rate || 0) * 100)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organization */}
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Assignment and tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Owner */}
                <div className="space-y-2">
                  <Label>Owner</Label>
                  <Select
                    value={formData.owner_id || 'unassigned'}
                    onValueChange={(v) =>
                      handleChange('owner_id', v === 'unassigned' ? undefined : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.first_name} {member.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Department */}
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    placeholder="e.g., Engineering"
                    value={formData.department || ''}
                    onChange={(e) => handleChange('department', e.target.value)}
                  />
                </div>

                {/* Cost Center */}
                <div className="space-y-2">
                  <Label htmlFor="cost_center">Cost Center</Label>
                  <Input
                    id="cost_center"
                    placeholder="e.g., CC-1234"
                    value={formData.cost_center || ''}
                    onChange={(e) => handleChange('cost_center', e.target.value)}
                  />
                </div>

                {/* Contract URL */}
                <div className="space-y-2">
                  <Label htmlFor="contract_url">Contract URL</Label>
                  <Input
                    id="contract_url"
                    type="url"
                    placeholder="https://..."
                    value={formData.contract_url || ''}
                    onChange={(e) => handleChange('contract_url', e.target.value)}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes..."
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" type="button" asChild>
              <Link href={`/subscriptions/${subscriptionId}`}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
