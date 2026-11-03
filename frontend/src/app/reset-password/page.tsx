'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/services';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('This reset link is missing a token');
      return;
    }
    if (password.length < 10) {
      toast.error('Password must be at least 10 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.confirmPasswordReset(token, password, confirmPassword);
      toast.success('Password updated. Please sign in.');
      router.push('/login');
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || 'Unable to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-xl border-0">
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>Use at least 10 characters</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || !token}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update password'
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t pt-6">
        <Link href="/login" className="text-sm text-blue-600 hover:underline inline-flex items-center">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-white">S</span>
          </div>
          <h1 className="text-2xl font-bold">Set a new password</h1>
        </div>
        <Suspense fallback={<p className="text-center text-gray-500">Loading...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
