'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useAuthStore } from '@/lib/stores';
import { authApi } from '@/lib/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  User,
  Lock,
  Bell,
  Palette,
  Upload,
  Save,
  Eye,
  EyeOff,
  Check,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner';
import type { User as UserType } from '@/types/swm';

interface ProfileForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  job_title: string;
  timezone: string;
  avatar?: File | null;
}

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

interface NotificationSettings {
  email_renewal_alerts: boolean;
  email_budget_alerts: boolean;
  email_recommendations: boolean;
  email_weekly_digest: boolean;
  push_renewal_alerts: boolean;
  push_budget_alerts: boolean;
  push_recommendations: boolean;
}

interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  compact_mode: boolean;
  show_cost_in_header: boolean;
}

export default function ProfilePage() {
  const { user, loadProfile } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
    timezone: 'UTC',
  });
  
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_renewal_alerts: true,
    email_budget_alerts: true,
    email_recommendations: true,
    email_weekly_digest: true,
    push_renewal_alerts: true,
    push_budget_alerts: true,
    push_recommendations: false,
  });
  
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>({
    theme: 'system',
    compact_mode: false,
    show_cost_in_header: true,
  });

  useEffect(() => {
    if (user) {
      const timer = window.setTimeout(() => {
        setProfileForm({
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email || '',
          phone: user.phone || '',
          job_title: user.job_title || '',
          timezone: user.timezone || 'UTC',
        });
        setIsLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const updateData: Partial<UserType> = {
        ...profileForm,
        avatar: profileForm.avatar === null ? undefined : profileForm.avatar,
      };
      await authApi.updateProfile(updateData);
      await loadProfile();
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (passwordForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    setIsSaving(true);
    try {
      await authApi.changePassword({
        old_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        new_password2: passwordForm.confirm_password,
      });
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      toast.success('Password changed successfully');
    } catch {
      toast.error('Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      const notificationData: Record<string, unknown> = notificationSettings as unknown as Record<string, unknown>;
      await authApi.updateNotificationSettings(notificationData);
      toast.success('Notification settings saved');
    } catch {
      toast.error('Failed to save notification settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAppearance = () => {
    // Save to local storage
    localStorage.setItem('appearance_settings', JSON.stringify(appearanceSettings));
    
    // Apply theme
    if (appearanceSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (appearanceSettings.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
    
    toast.success('Appearance settings saved');
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileForm({ ...profileForm, avatar: file });
    }
  };

  const getInitials = () => {
    const first = profileForm.first_name?.charAt(0) || '';
    const last = profileForm.last_name?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Australia/Sydney',
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Profile Settings</h1>
            <p className="text-gray-500">Manage your personal settings</p>
          </div>
        </div>

        {/* Profile Header Card */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="h-24 w-24 text-2xl">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
                <input
                  type="file"
                  accept="image/*"
                  id="avatar-upload"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute -bottom-2 -right-2 rounded-full h-8 w-8 p-0"
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  <Upload className="h-3 w-3" />
                </Button>
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {profileForm.first_name} {profileForm.last_name}
                </h2>
                <p className="text-gray-500">{profileForm.email}</p>
                <p className="text-sm text-gray-400">{user?.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="password">
              <Lock className="h-4 w-4 mr-2" />
              Password
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="h-4 w-4 mr-2" />
              Appearance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your personal details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={profileForm.first_name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, first_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={profileForm.last_name}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, last_name: e.target.value })
                      }
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.email}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-gray-500">
                    Contact support to change your email address
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, phone: e.target.value })
                      }
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job_title">Job Title</Label>
                    <Input
                      id="job_title"
                      value={profileForm.job_title}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, job_title: e.target.value })
                      }
                      placeholder="e.g., IT Manager"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={profileForm.timezone}
                    onValueChange={(v) =>
                      setProfileForm({ ...profileForm, timezone: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Separator />
                
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current_password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current_password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.current_password}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          current_password: e.target.value,
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new_password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.new_password}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          new_password: e.target.value,
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm New Password</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirm_password: e.target.value,
                      })
                    }
                  />
                </div>
                
                {/* Password Requirements */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm font-medium mb-2">Password Requirements</p>
                  <ul className="text-sm text-gray-500 space-y-1">
                    {[
                      { text: 'At least 8 characters', met: passwordForm.new_password.length >= 8 },
                      { text: 'One uppercase letter', met: /[A-Z]/.test(passwordForm.new_password) },
                      { text: 'One lowercase letter', met: /[a-z]/.test(passwordForm.new_password) },
                      { text: 'One number', met: /\d/.test(passwordForm.new_password) },
                      { text: 'Passwords match', met: passwordForm.new_password === passwordForm.confirm_password && passwordForm.new_password.length > 0 },
                    ].map(({ text, met }) => (
                      <li key={text} className="flex items-center gap-2">
                        <Check
                          className={`h-4 w-4 ${
                            met ? 'text-green-500' : 'text-gray-300'
                          }`}
                        />
                        <span className={met ? 'text-green-600' : ''}>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <Separator />
                
                <Button onClick={handleChangePassword} disabled={isSaving}>
                  <Lock className="h-4 w-4 mr-2" />
                  {isSaving ? 'Changing...' : 'Change Password'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose how you want to be notified
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium mb-4">Email Notifications</h3>
                  <div className="space-y-4">
                    {[
                      {
                        key: 'email_renewal_alerts',
                        label: 'Renewal Alerts',
                        description: 'Get notified when subscriptions are up for renewal',
                      },
                      {
                        key: 'email_budget_alerts',
                        label: 'Budget Alerts',
                        description: 'Receive alerts when spending approaches budget limits',
                      },
                      {
                        key: 'email_recommendations',
                        label: 'Recommendations',
                        description: 'Get AI-powered cost optimization recommendations',
                      },
                      {
                        key: 'email_weekly_digest',
                        label: 'Weekly Digest',
                        description: 'Receive a weekly summary of your subscription spending',
                      },
                    ].map(({ key, label, description }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="text-sm text-gray-500">{description}</p>
                        </div>
                        <Switch
                          checked={notificationSettings[key as keyof NotificationSettings] as boolean}
                          onCheckedChange={(checked) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              [key]: checked,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="font-medium mb-4">Push Notifications</h3>
                  <div className="space-y-4">
                    {[
                      {
                        key: 'push_renewal_alerts',
                        label: 'Renewal Alerts',
                        description: 'Immediate push notifications for renewals',
                      },
                      {
                        key: 'push_budget_alerts',
                        label: 'Budget Alerts',
                        description: 'Real-time budget threshold notifications',
                      },
                      {
                        key: 'push_recommendations',
                        label: 'Recommendations',
                        description: 'Get notified of new cost-saving opportunities',
                      },
                    ].map(({ key, label, description }) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="text-sm text-gray-500">{description}</p>
                        </div>
                        <Switch
                          checked={notificationSettings[key as keyof NotificationSettings] as boolean}
                          onCheckedChange={(checked) =>
                            setNotificationSettings({
                              ...notificationSettings,
                              [key]: checked,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                <Button onClick={handleSaveNotifications} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Preferences'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize how the application looks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Theme</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { value: 'light', label: 'Light', icon: Sun },
                      { value: 'dark', label: 'Dark', icon: Moon },
                      { value: 'system', label: 'System', icon: Monitor },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        className={`flex flex-col items-center gap-2 p-4 border rounded-lg transition ${
                          appearanceSettings.theme === value
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-gray-400'
                        }`}
                        onClick={() =>
                          setAppearanceSettings({
                            ...appearanceSettings,
                            theme: value as 'light' | 'dark' | 'system',
                          })
                        }
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Compact Mode</p>
                      <p className="text-sm text-gray-500">
                        Use smaller spacing and font sizes
                      </p>
                    </div>
                    <Switch
                      checked={appearanceSettings.compact_mode}
                      onCheckedChange={(checked) =>
                        setAppearanceSettings({
                          ...appearanceSettings,
                          compact_mode: checked,
                        })
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Show Cost in Header</p>
                      <p className="text-sm text-gray-500">
                        Display total monthly cost in the navigation bar
                      </p>
                    </div>
                    <Switch
                      checked={appearanceSettings.show_cost_in_header}
                      onCheckedChange={(checked) =>
                        setAppearanceSettings({
                          ...appearanceSettings,
                          show_cost_in_header: checked,
                        })
                      }
                    />
                  </div>
                </div>
                
                <Separator />
                
                <Button onClick={handleSaveAppearance}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Appearance
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete Account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    account and remove all your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
