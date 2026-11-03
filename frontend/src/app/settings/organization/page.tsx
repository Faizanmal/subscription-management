'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useOrganizationStore } from '@/lib/stores';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Building, Save } from 'lucide-react';
import { toast } from 'sonner';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR'];

export default function OrganizationSettingsPage() {
  const { organization, isLoading, fetchOrganization, updateOrganization } = useOrganizationStore();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    domain: '',
    default_currency: 'USD',
  });
  const [loadedOrgId, setLoadedOrgId] = useState<string | null>(null);

  useEffect(() => {
    void fetchOrganization();
  }, [fetchOrganization]);

  if (organization && organization.id !== loadedOrgId) {
    setLoadedOrgId(organization.id);
    setForm({
      name: organization.name || '',
      domain: organization.domain || '',
      default_currency: organization.default_currency || organization.settings?.currency || 'USD',
    });
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Organization name is required');
      return;
    }
    setIsSaving(true);
    try {
      await updateOrganization({
        name: form.name.trim(),
        domain: form.domain.trim(),
        default_currency: form.default_currency,
      });
      toast.success('Organization updated');
    } catch {
      toast.error('Failed to update organization');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Settings
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Organization</h1>
          <p className="text-gray-500">Company details used across billing, invites, and reports</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <Building className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Company profile</CardTitle>
                <CardDescription>
                  {organization?.plan ? `${organization.plan} plan` : 'Loaded from your current organization'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={isLoading || isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain">Email domain</Label>
                <Input
                  id="domain"
                  placeholder="acme.com"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  disabled={isLoading || isSaving}
                />
                <p className="text-xs text-gray-500">Used to match teammates signing in with Google or Microsoft.</p>
              </div>
              <div className="space-y-2">
                <Label>Default currency</Label>
                <Select
                  value={form.default_currency}
                  onValueChange={(value) => setForm({ ...form, default_currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isLoading || isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
