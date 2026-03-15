'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useOrganizationStore, useAuthStore } from '@/lib/stores';
import { organizationApi } from '@/lib/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Users,
  MoreVertical,
  Mail,
  Shield,
  Trash2,
  UserPlus,
  Crown,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { UserRole } from '@/types/swm';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  finance: 'Finance',
  manager: 'Manager',
  viewer: 'Viewer',
  department_lead: 'Department Lead',
  it_admin: 'IT Admin',
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  finance: 'bg-green-100 text-green-700',
  manager: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-700',
  department_lead: 'bg-orange-100 text-orange-700',
  it_admin: 'bg-red-100 text-red-700',
};

interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  expires_at: string;
}

export default function TeamPage() {
  const { user } = useAuthStore();
  const { members, isLoading, fetchMembers, inviteMember, updateMemberRole, removeMember } =
    useOrganizationStore();

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'viewer' as UserRole });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([
    {
      id: '1',
      email: 'pending@example.com',
      role: 'viewer',
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: new Date('2026-01-16').toISOString(),
    },
  ]);

  useEffect(() => {
    fetchMembers();
    // Pending invitations are now initialized in state
  }, [fetchMembers]);

  const handleInvite = async () => {
    try {
      await inviteMember(inviteForm.email, inviteForm.role);
      toast.success(`Invitation sent to ${inviteForm.email}`);
      setShowInviteDialog(false);
      setInviteForm({ email: '', role: 'viewer' });
    } catch {
      toast.error('Failed to send invitation');
    }
  };

  const handleUpdateRole = async (memberId: string, role: UserRole) => {
    try {
      await updateMemberRole(memberId, role);
      toast.success('Role updated successfully');
    } catch (error) {
      console.error('Failed to update role', error);
      toast.error('Failed to update role');
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      await removeMember(memberId);
      toast.success('Member removed');
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to remove member', error);
      toast.error('Failed to remove member');
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      await organizationApi.resendInvitation(inviteId);
      toast.success('Invitation resent successfully');
    } catch (error) {
      console.error('Failed to resend invitation', error);
      toast.error('Failed to resend invitation');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    setInvitations(invitations.filter((i) => i.id !== inviteId));
    toast.success('Invitation cancelled');
  };

  const isCurrentUserAdmin = user?.role === 'admin';

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/settings">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Team Members</h1>
              <p className="text-gray-500">Manage your team and permissions</p>
            </div>
          </div>
          {isCurrentUserAdmin && (
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your organization
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteForm.email}
                      onChange={(e) =>
                        setInviteForm({ ...inviteForm, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(v) =>
                        setInviteForm({ ...inviteForm, role: v as UserRole })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div>
                            <p className="font-medium">Admin</p>
                            <p className="text-xs text-gray-500">
                              Full access to all settings
                            </p>
                          </div>
                        </SelectItem>
                        <SelectItem value="finance">
                          <div>
                            <p className="font-medium">Finance</p>
                            <p className="text-xs text-gray-500">
                              Manage costs and budgets
                            </p>
                          </div>
                        </SelectItem>
                        <SelectItem value="manager">
                          <div>
                            <p className="font-medium">Manager</p>
                            <p className="text-xs text-gray-500">
                              Manage subscriptions
                            </p>
                          </div>
                        </SelectItem>
                        <SelectItem value="viewer">
                          <div>
                            <p className="font-medium">Viewer</p>
                            <p className="text-xs text-gray-500">
                              Read-only access
                            </p>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowInviteDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleInvite}>Send Invitation</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Members</CardDescription>
              <CardTitle className="text-3xl">{members.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Admins</CardDescription>
              <CardTitle className="text-3xl text-purple-600">
                {members.filter((m) => m.role === 'admin').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Today</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {members.filter((m) => m.is_active).length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Invites</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">
                {invitations.filter((i) => i.status === 'pending').length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              People with access to this organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Active</TableHead>
                  {isCurrentUserAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback>
                            {member.first_name?.[0]}
                            {member.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {member.first_name} {member.last_name}
                            </p>
                            {member.id === user?.id && (
                              <Badge variant="outline" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isCurrentUserAdmin && member.id !== user?.id ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) =>
                            handleUpdateRole(member.id, v as UserRole)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={ROLE_COLORS[member.role as UserRole]}>
                          {member.role === 'admin' && (
                            <Crown className="h-3 w-3 mr-1" />
                          )}
                          {ROLE_LABELS[member.role as UserRole]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={member.is_active ? 'default' : 'secondary'}
                        className={
                          member.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }
                      >
                        {member.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {member.date_joined
                        ? format(new Date(member.date_joined), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {member.last_login
                        ? format(new Date(member.last_login), 'MMM d, h:mm a')
                        : 'Never'}
                    </TableCell>
                    {isCurrentUserAdmin && (
                      <TableCell>
                        {member.id !== user?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirm(member.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                Invitations that haven&apos;t been accepted yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          {invite.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={ROLE_COLORS[invite.role]}>
                          {ROLE_LABELS[invite.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={invite.status === 'pending' ? 'secondary' : 'outline'}
                          className={
                            invite.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : ''
                          }
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {invite.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {format(new Date(invite.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {format(new Date(invite.expires_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResendInvite(invite.id)}
                          >
                            Resend
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => handleCancelInvite(invite.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Role Permissions Info */}
        <Card>
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
            <CardDescription>
              What each role can do in the organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-4 w-4 text-purple-600" />
                  <h4 className="font-medium">Admin</h4>
                </div>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Full organization access
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Manage team members
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Manage billing
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Delete organization
                  </li>
                </ul>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <h4 className="font-medium">Finance</h4>
                </div>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    View all subscriptions
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Manage budgets
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Export reports
                  </li>
                  <li className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    Manage team
                  </li>
                </ul>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <h4 className="font-medium">Manager</h4>
                </div>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Manage subscriptions
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Create workflows
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    View analytics
                  </li>
                  <li className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    Manage billing
                  </li>
                </ul>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-gray-600" />
                  <h4 className="font-medium">Viewer</h4>
                </div>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    View subscriptions
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    View analytics
                  </li>
                  <li className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    Edit subscriptions
                  </li>
                  <li className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    Manage settings
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this member? They will lose access to
                the organization immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConfirm && handleRemove(deleteConfirm)}
                className="bg-red-600 hover:bg-red-700"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
