"use client";
import { useCallback, useEffect, useState } from 'react';
import { api } from './api-base';
export function useOwnerOptions() {
  const [members, setMembers] = useState<{ id: string; first_name: string; last_name: string; full_name: string }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { setMembers(await api.get('/auth/organizations/member-options/')); }
    catch { setError('Owner options could not load. Retry before assigning an owner.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void reload(), 0); return () => window.clearTimeout(timer); }, [reload]);
  return { members, error, loading, reload };
}
