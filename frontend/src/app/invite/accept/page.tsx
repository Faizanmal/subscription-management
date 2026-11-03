'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/services';
import { useAuthStore } from '@/lib/stores';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { setTokens, fetchUser } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('This invite link is missing a token');
      return;
    }
    if (!form.first_name || !form.last_name) {
      toast.error('Enter your name');
      return;
    }
    if (form.password.length < 10) {
      toast.error('Password must be at least 10 characters');
      return;
    }
    if (form.password !== form.password_confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authApi.acceptInvitation({
        token,
        first_name: form.first_name,
        last_name: form.last_name,
        password: form.password,
        password_confirm: form.password_confirm,
      });
      setTokens(result.tokens.access, result.tokens.refresh);
      await fetchUser();
      toast.success('Welcome to the team');
      router.push('/dashboard');
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || 'Unable to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-xl border-0">
      <CardHeader>
        <CardTitle>Join your organization</CardTitle>
        <CardDescription>Create your account to accept the invite</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last name</Label>
              <Input
                id="last_name"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password_confirm">Confirm password</Label>
            <Input
              id="password_confirm"
              type="password"
              value={form.password_confirm}
              onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || !token}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              'Accept invitation'
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t pt-6">
        <p className="text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-white">S</span>
          </div>
          <h1 className="text-2xl font-bold">You have been invited</h1>
          <p className="text-gray-500">Finish setup to join Subscription Waste Manager</p>
        </div>
        <Suspense fallback={<p className="text-center text-gray-500">Loading invite...</p>}>
          <AcceptInviteForm />
        </Suspense>
      </div>
    </div>
  );
}
