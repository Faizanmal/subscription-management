'use client';

import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import {
  Plug,
  Users,
  Shield,
  Database,
  User,
  Building,
  CreditCard,
  Bell,
  ChevronRight,
} from 'lucide-react';

const settingsLinks = [
  {
    title: 'Integrations',
    description: 'Connect your tools and services',
    icon: Plug,
    href: '/settings/integrations',
    badge: 'Connect',
  },
  {
    title: 'Team',
    description: 'Manage team members and roles',
    icon: Users,
    href: '/settings/team',
  },
  {
    title: 'Security',
    description: 'API keys, MFA, and audit logs',
    icon: Shield,
    href: '/settings/security',
  },
  {
    title: 'Backups',
    description: 'Data export and backup settings',
    icon: Database,
    href: '/settings/backups',
  },
  {
    title: 'Profile',
    description: 'Your personal settings',
    icon: User,
    href: '/settings/profile',
  },
  {
    title: 'Organization',
    description: 'Company details and billing',
    icon: Building,
    href: '/settings/organization',
  },
  {
    title: 'Billing',
    description: 'Subscription and payment methods',
    icon: CreditCard,
    href: '/settings/billing',
  },
  {
    title: 'Notifications',
    description: 'Email and alert preferences',
    icon: Bell,
    href: '/settings/notifications',
  },
];

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-gray-500">Manage your account and organization settings</p>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {settingsLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{link.title}</CardTitle>
                          <CardDescription>{link.description}</CardDescription>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
