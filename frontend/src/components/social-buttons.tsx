'use client';

import { Button } from '@/components/ui/button';
import { socialLoginUrl } from '@/lib/api-base';
import type { PolicyVersions } from '@/types/swm';
import { useState } from 'react';
import { FormMessage } from '@/components/form-message';

export function SocialButtons({ policies, disabled = false }: { policies: PolicyVersions | null; disabled?: boolean }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function start(provider: 'google' | 'microsoft') {
    setBusy(true); setError('');
    try {
      const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
      const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      sessionStorage.setItem('swm-social-verifier', verifier);
      const url = new URL(socialLoginUrl(provider));
      url.searchParams.set('swm_challenge', challenge);
      url.searchParams.set('next', '/social/finish/');
      window.location.assign(url.toString());
    } catch { setError('Unable to start secure sign-in. Enable browser storage or use email.'); setBusy(false); }
  }
  const providers = (['google', 'microsoft'] as const).filter(provider => policies?.social_providers[provider]);
  if (!providers.length) return null;
  return <div className="mb-6"><FormMessage message={error} /><div className="grid gap-3 sm:grid-cols-2">{providers.map(provider => <Button key={provider} type="button" variant="outline" disabled={disabled || busy} onClick={() => void start(provider)}>Continue with {provider === 'google' ? 'Google' : 'Microsoft'}</Button>)}</div><div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />Or use email<span className="h-px flex-1 bg-border" /></div></div>;
}
