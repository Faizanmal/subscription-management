'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  Lightbulb,
  Bell,
  Settings,
  Users,
  Plug,
  Shield,
  Download,
  Workflow,
  ChevronLeft,
  ChevronRight,
  Search,
  LogOut,
  User,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState, FormEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useNotificationsStore, useOrganizationStore } from '@/lib/stores';

interface NavItem {
  title: string;
  href: string;
  icon: ReactNode;
  badge?: string | number;
  children?: { title: string; href: string }[];
}

const mainNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    title: 'Subscriptions',
    href: '/subscriptions',
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    title: 'Usage & Analytics',
    href: '/analytics',
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    title: 'Recommendations',
    href: '/recommendations',
    icon: <Lightbulb className="h-5 w-5" />,
  },
  {
    title: 'Workflows',
    href: '/workflows',
    icon: <Workflow className="h-5 w-5" />,
  },
  {
    title: 'Alerts',
    href: '/alerts',
    icon: <Bell className="h-5 w-5" />,
  },
];

const settingsNavItems: NavItem[] = [
  {
    title: 'Integrations',
    href: '/settings/integrations',
    icon: <Plug className="h-5 w-5" />,
  },
  {
    title: 'Team',
    href: '/settings/team',
    icon: <Users className="h-5 w-5" />,
  },
  {
    title: 'Security',
    href: '/settings/security',
    icon: <Shield className="h-5 w-5" />,
  },
  {
    title: 'Backups & Export',
    href: '/settings/backups',
    icon: <Download className="h-5 w-5" />,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
  },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuthStore();
  const { organization, fetchOrganization } = useOrganizationStore();
  const { notifications, unreadCount, fetchNotifications, markAllAsRead, markAsRead } =
    useNotificationsStore();

  useEffect(() => {
    void fetchOrganization();
    void fetchNotifications();
  }, [fetchOrganization, fetchNotifications]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      router.push(`/subscriptions?search=${encodeURIComponent(query)}`);
    } else {
      router.push('/subscriptions');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r bg-white dark:bg-gray-800 transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
                S
              </div>
              <span className="font-semibold text-lg">SWM</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-auto"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Organization Selector */}
        {!isCollapsed && organization && (
          <div className="border-b p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                <Building2 className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{organization.name}</p>
                <p className="text-xs text-gray-500 capitalize">{organization.plan} Plan</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {mainNavItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  )}
                  title={isCollapsed ? item.title : undefined}
                >
                  {item.icon}
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">{item.title}</span>
                      {item.title === 'Alerts' && unreadCount > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 justify-center">
                          {unreadCount}
                        </Badge>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </div>

          {!isCollapsed && (
            <div className="mt-6 pt-6 border-t">
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Settings
              </p>
            </div>
          )}

          <div className="mt-2 space-y-1">
            {settingsNavItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  )}
                  title={isCollapsed ? item.title : undefined}
                >
                  {item.icon}
                  {!isCollapsed && <span>{item.title}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Menu */}
        <div className="border-t p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-3 px-2',
                  isCollapsed && 'justify-center'
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback>
                    {user ? getInitials(`${user.first_name} ${user.last_name}`) : '??'}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/profile">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b bg-white dark:bg-gray-800 flex items-center justify-between px-6">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search subscriptions, vendors..."
                className="pl-10 bg-gray-50 dark:bg-gray-700 border-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>

          {/* Quick Actions */}
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link href="/subscriptions/new">+ Add Subscription</Link>
            </Button>
            
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  Notifications
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      void markAllAsRead();
                    }}
                  >
                    Mark all read
                  </Button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">
                      No new notifications
                    </p>
                  ) : (
                    notifications.slice(0, 8).map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className="flex flex-col items-start gap-1 whitespace-normal"
                        onClick={() => {
                          if (!notification.is_read) {
                            void markAsRead(notification.id);
                          }
                          const href = notification.action_url || notification.link;
                          if (href) {
                            window.location.href = href;
                          }
                        }}
                      >
                        <span className={notification.is_read ? 'text-sm' : 'text-sm font-medium'}>
                          {notification.title}
                        </span>
                        <span className="text-xs text-gray-500 line-clamp-2">
                          {notification.message}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="justify-center">
                  <Link href="/settings/notifications">Notification settings</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
