"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function GoogleCallbackContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      // Send error to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'google-oauth-error',
          error: error
        }, window.location.origin);
      }
      window.close();
      return;
    }

    if (code && state) {
      // Send success to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'google-oauth-success',
          code: code,
          state: state
        }, window.location.origin);
      }
      
      // Close popup after a short delay
      setTimeout(() => {
        window.close();
      }, 500);
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Completing authorization...</p>
        <p className="text-sm text-muted-foreground mt-2">This window will close automatically</p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <GoogleCallbackContent />
    </Suspense>
  );
}
