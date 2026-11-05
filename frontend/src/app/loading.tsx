import { Loader2 } from 'lucide-react';

export default function Loading() {
  return <div role="status" aria-live="polite" className="flex min-h-[60vh] items-center justify-center gap-3 bg-background text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /><span>Loading your page…</span></div>;
}
