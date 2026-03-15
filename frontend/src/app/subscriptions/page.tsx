import { Suspense } from 'react';
import SubscriptionsContent from './subscriptions-content';

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <SubscriptionsContent />
    </Suspense>
  );
}
