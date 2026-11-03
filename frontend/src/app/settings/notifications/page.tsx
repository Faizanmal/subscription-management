'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useAuthStore } from '@/lib/stores';
import { authApi } from '@/lib/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Bell, Save } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationPrefs {
  email_renewal_alerts: boolean;
  email_budget_alerts: boolean;
  email_recommendations: boolean;
  email_weekly_digest: boolean;
  push_renewal_alerts: boolean;
  push_budget_alerts: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  email_renewal_alerts: true,
  email_budget_alerts: true,
  email_recommendations: true,
  email_weekly_digest: true,
  push_renewal_alerts: true,
  push_budget_alerts: true,
};

export default function NotificationSettingsPage() {
  const { user, fetchUser } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  useEffect(() => {
    void fetchUser().catch(() => undefined);
  }, [fetchUser]);

  if (user && user.id !== loadedUserId) {
    setLoadedUserId(user.id);
    const stored = user.notification_preferences;
    if (stored && typeof stored === 'object') {
      setPrefs({ ...DEFAULT_PREFS, ...stored });
    }
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await authApi.updateNotificationSettings({ ...prefs });
      await fetchUser();
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save notification preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const rows: { key: keyof NotificationPrefs; label: string; description: string }[] = [
    { key: 'email_renewal_alerts', label: 'Renewal emails', description: 'Upcoming renewals and auto-renew warnings' },
    { key: 'email_budget_alerts', label: 'Budget emails', description: 'When spend crosses a department or org budget' },
    { key: 'email_recommendations', label: 'Recommendation emails', description: 'AI savings suggestions worth reviewing' },
    { key: 'email_weekly_digest', label: 'Weekly digest', description: 'Unread notifications summarized once a week' },
    { key: 'push_renewal_alerts', label: 'In-app renewal alerts', description: 'Show renewals in the header bell' },
    { key: 'push_budget_alerts', label: 'In-app budget alerts', description: 'Show budget overruns in the header bell' },
  ];

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
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-gray-500">Choose which alerts reach email and the in-app inbox</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Alert preferences</CardTitle>
                <CardDescription>These are stored on your user profile</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-4 border-b pb-4 last:border-0">
                <div>
                  <Label htmlFor={row.key}>{row.label}</Label>
                  <p className="text-sm text-gray-500">{row.description}</p>
                </div>
                <Switch
                  id={row.key}
                  checked={prefs[row.key]}
                  onCheckedChange={(checked) => setPrefs({ ...prefs, [row.key]: checked })}
                />
              </div>
            ))}
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save preferences'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
