'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/services';
import type { PolicyVersions } from '@/types/swm';

export function usePolicies() {
  const [policies, setPolicies] = useState<PolicyVersions | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    authApi.getPolicies().then(result => { if (active) setPolicies(result); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  return { policies, error, reload: () => { setError(false); setPolicies(null); setAttempt(value => value + 1); } };
}
