'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/lib/services';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.requestPasswordReset(email);
      setSent(true);
      toast.success('If an account exists, a reset link has been sent');
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || 'Unable to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-white">S</span>
          </div>
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="text-gray-500">We will email you a reset link</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader>
            <CardTitle>Forgot password</CardTitle>
            <CardDescription>
              Enter the email you use to sign in
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <p className="text-sm text-gray-600">
                Check {email} for a link to choose a new password. The link expires in one hour.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-6">
            <Link href="/login" className="text-sm text-blue-600 hover:underline inline-flex items-center">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
