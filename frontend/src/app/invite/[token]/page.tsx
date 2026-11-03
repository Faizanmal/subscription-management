'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function InviteTokenRedirectPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();

  useEffect(() => {
    const token = params.token;
    if (token) {
      router.replace(`/invite/accept?token=${encodeURIComponent(token)}`);
    } else {
      router.replace('/login');
    }
  }, [params.token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      Opening invitation...
    </div>
  );
}
