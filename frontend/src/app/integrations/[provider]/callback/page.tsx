'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { integrationsApi } from '@/lib/services';

function OAuthCallbackContent() {
  const router = useRouter();
  const params = useParams<{ provider: string }>();
  const searchParams = useSearchParams();
  const provider = params.provider;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');
  const validProviders = [
    'google', 'microsoft', 'quickbooks', 'xero', 'workday', 
    'bamboohr', 'gusto', 'rippling', 'concur', 'expensify', 
    'brex', 'ramp', 'onelogin', 'jumpcloud'
  ];
  const invalidProvider = !provider || !validProviders.includes(provider as string);
  const [message, setMessage] = useState(() => {
    if (invalidProvider) return 'Unknown integration provider';
    if (oauthError) return 'Authorization was cancelled';
    if (!code || !state) return 'Missing authorization details';
    return 'Completing authorization...';
  });

  useEffect(() => {
    const notifyParent = (payload: Record<string, string>) => {
      if (window.opener) {
        window.opener.postMessage(payload, window.location.origin);
      }
    };

    const finish = (ok: boolean, detail?: string) => {
      notifyParent({
        type: ok ? 'integration-oauth-success' : 'integration-oauth-error',
        provider: provider || '',
        error: detail || '',
      });
      if (window.opener) {
        window.close();
        return;
      }
      const query = ok ? 'connected=1' : `error=${encodeURIComponent(detail || 'oauth_failed')}`;
      router.replace(`/settings/integrations?${query}`);
    };

    if (invalidProvider) {
      finish(false, 'Unknown provider');
      return;
    }

    if (oauthError) {
      finish(false, oauthError);
      return;
    }

    if (!code || !state) {
      finish(false, 'Missing code or state');
      return;
    }

    const complete = (c: string, s: string) => integrationsApi.completeProviderOAuth(provider as string, c, s);

    complete(code, state)
      .then(() => {
        setMessage('Connected. Redirecting...');
        finish(true);
      })
      .catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : 'Failed to complete connection';
        setMessage(detail);
        finish(false, detail);
      });
  }, [code, invalidProvider, oauthError, provider, router, state]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">{message}</p>
        <p className="text-sm text-gray-500 mt-2">This window will close automatically</p>
      </div>
    </div>
  );
}

export default function IntegrationOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
