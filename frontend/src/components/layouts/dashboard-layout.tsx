'use client';

import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Building2, CalendarClock, ChartNoAxesCombined, ChevronLeft, ChevronRight, CreditCard, Download, LayoutDashboard, LifeBuoy, Lightbulb, Loader2, LogOut, Menu, Plus, Plug, Search, Settings, Shield, User, Users, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, useNotificationsStore, useOrganizationStore } from '@/lib/stores';
import { Brand } from '@/components/brand';
import { ThemeControl } from '@/components/theme-control';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const mainLinks = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
  { label: 'Usage & analytics', href: '/analytics', icon: ChartNoAxesCombined },
  { label: 'Recommendations', href: '/recommendations', icon: Lightbulb },
  { label: 'Workflows', href: '/workflows', icon: Workflow },
  { label: 'Alerts', href: '/alerts', icon: CalendarClock },
];
const settingsLinks = [
  { label: 'Integrations', href: '/settings/integrations', icon: Plug },
  { label: 'Team', href: '/settings/team', icon: Users },
  { label: 'Billing', href: '/settings/billing', icon: CreditCard },
  { label: 'Security', href: '/settings/security', icon: Shield },
  { label: 'Backups & export', href: '/settings/backups', icon: Download },
  { label: 'Settings', href: '/settings', icon: Settings },
];
const subscribe = () => () => {};

function Navigation({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return <nav aria-label="Workspace navigation" className="flex-1 space-y-5 overflow-y-auto p-3">{[{ title: 'Workspace', links: mainLinks }, { title: 'Manage', links: settingsLinks }].map(group => <div key={group.title}>{!collapsed && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{group.title}</p>}<ul className="space-y-1">{group.links.map(item => {
    const active = item.href === '/settings' ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
    return <li key={item.href}><Link href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} title={collapsed ? item.label : undefined} aria-label={collapsed ? item.label : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors', collapsed && 'justify-center px-0', active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}><item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />{!collapsed && item.label}</Link></li>;
  })}</ul></div>)}<div className="border-t pt-3"><Link href="/help" onClick={onNavigate} title={collapsed ? 'Help & support' : undefined} aria-label={collapsed ? 'Help & support' : undefined} className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent', collapsed && 'justify-center px-0')}><LifeBuoy className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />{!collapsed && 'Help & support'}</Link></div></nav>;
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { user, isAuthenticated, logout } = useAuthStore();
  const { organization, fetchOrganization } = useOrganizationStore();
  const { notifications, unreadCount, fetchNotifications, markAllAsRead, markAsRead } = useNotificationsStore();

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (user?.email_verification_required) { router.replace('/verify-email'); return; }
    if (user?.agreements_required) { router.replace('/agreements'); return; }
    if (user && !user.organization_id) { router.replace('/onboarding'); return; }
    if (user) { void fetchOrganization(); void fetchNotifications(); }
  }, [ready, isAuthenticated, user, router, fetchOrganization, fetchNotifications]);

  async function signOut() { await logout(); router.replace('/login'); }
  function search(event: FormEvent) { event.preventDefault(); router.push(query.trim() ? `/subscriptions?search=${encodeURIComponent(query.trim())}` : '/subscriptions'); }
  if (!ready || !isAuthenticated || !user || user.email_verification_required || user.agreements_required || !user.organization_id) return <div className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground" role="status"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Opening your workspace…</div>;

  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  const initials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const title = [...mainLinks, ...settingsLinks].find(item => pathname === item.href || (item.href !== '/settings' && pathname.startsWith(item.href + '/')))?.label || 'Workspace';
  return <div className="flex h-dvh min-h-0 overflow-hidden bg-muted/30">
    <a className="skip-link" href="#main-content">Skip to workspace content</a>
    <aside aria-label="Workspace sidebar" className={cn('hidden shrink-0 flex-col border-r bg-card transition-[width] lg:flex', collapsed ? 'w-20' : 'w-64')}>
      <div className="flex h-20 shrink-0 items-center justify-between gap-2 border-b px-4">{!collapsed && <Brand href="/dashboard" />}<Button type="button" variant="ghost" size="icon" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)} className={collapsed ? 'mx-auto' : 'shrink-0'}>{collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}</Button></div>
      {!collapsed && <div className="flex items-center gap-3 border-b px-5 py-4"><Building2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{organization?.name || user.organization_name || 'Your organization'}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{organization?.is_on_trial ? 'Pro trial' : organization?.plan || 'Starter'} plan</p></div></div>}
      <Navigation collapsed={collapsed} />
      <div className="shrink-0 border-t p-3"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className={cn('h-auto w-full justify-start gap-3 px-2 py-2', collapsed && 'justify-center')} aria-label="Open account menu"><Avatar className="h-9 w-9 shrink-0"><AvatarImage src={typeof user.avatar === 'string' ? user.avatar : undefined} alt="" /><AvatarFallback>{initials}</AvatarFallback></Avatar>{!collapsed && <span className="min-w-0 text-left"><span className="block truncate text-sm font-medium">{name}</span><span className="block text-xs capitalize text-muted-foreground">{user.role.replaceAll('_', ' ')}</span></span>}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56"><DropdownMenuLabel>My account</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/settings/profile"><User className="mr-2 h-4 w-4" />Profile</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href="/settings/billing"><CreditCard className="mr-2 h-4 w-4" />Billing</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href="/contact"><LifeBuoy className="mr-2 h-4 w-4" />Support</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
    </aside>

    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b bg-card px-4 py-3 sm:px-6"><div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open workspace navigation" className="lg:hidden"><Menu aria-hidden="true" /></Button></SheetTrigger><SheetContent side="left" className="flex w-[min(90vw,20rem)] flex-col p-0"><SheetHeader className="border-b px-5 py-6 text-left"><SheetTitle>Workspace navigation</SheetTitle><SheetDescription>{organization?.name || 'Your organization'}</SheetDescription></SheetHeader><Navigation onNavigate={() => setMobileOpen(false)} /><div className="border-t p-4"><p className="mb-3 truncate text-sm font-medium">{name}</p><Button variant="outline" className="w-full" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button></div></SheetContent></Sheet>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold lg:hidden">{title}</p>
        <form onSubmit={search} role="search" className="order-last w-full lg:order-none lg:w-auto lg:min-w-48 lg:max-w-md lg:flex-1"><label htmlFor="workspace-search" className="sr-only">Search subscriptions</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input id="workspace-search" type="search" placeholder="Search subscriptions…" value={query} onChange={event => setQuery(event.target.value)} className="bg-muted/30 pl-9" /></div></form>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2"><ThemeControl /><Button asChild size="sm" className="h-10 px-3"><Link href="/subscriptions/new" aria-label="Add subscription"><Plus className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Add subscription</span></Link></Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}><Bell aria-hidden="true" />{unreadCount > 0 && <span aria-hidden="true" className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{unreadCount > 9 ? '9+' : unreadCount}</span>}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-[min(90vw,22rem)]"><DropdownMenuLabel className="flex items-center justify-between gap-3">Notifications<Button size="sm" variant="ghost" onClick={() => void markAllAsRead()} disabled={!unreadCount}>Mark read</Button></DropdownMenuLabel><DropdownMenuSeparator /><div className="max-h-72 overflow-y-auto">{!notifications.length ? <div className="p-6 text-center"><p className="text-sm font-medium">You’re all caught up.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">New workspace notifications will appear here.</p></div> : notifications.slice(0, 8).map(notification => <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 whitespace-normal py-3" onClick={() => { if (!notification.is_read) void markAsRead(notification.id); const href = notification.action_url || notification.link || '/alerts'; router.push(href.startsWith('/') && !href.startsWith('//') ? href : '/alerts'); }}><span className={notification.is_read ? 'text-sm' : 'text-sm font-semibold'}>{notification.title}</span><span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{notification.message}</span>{!notification.is_read && <Badge variant="secondary" className="mt-1 text-[10px]">Unread</Badge>}</DropdownMenuItem>)}</div><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/settings/notifications">Notification preferences</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </div></header>
      <main id="main-content" tabIndex={-1} className="app-content min-w-0 flex-1 overflow-auto overscroll-contain p-4 sm:p-6 xl:p-8"><div className="mx-auto w-full max-w-[1600px]">{children}</div><footer className="mx-auto mt-12 flex max-w-[1600px] flex-wrap gap-x-5 gap-y-2 border-t pt-5 text-xs text-muted-foreground"><Link href="/help" className="hover:text-primary">Help</Link><Link href="/contact" className="hover:text-primary">Contact support</Link><Link href="/privacy" className="hover:text-primary">Privacy</Link><Link href="/terms" className="hover:text-primary">Terms</Link></footer></main>
    </div>
  </div>;
}
