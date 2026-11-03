'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function PlanUpgradeCard({
  title = 'Pro feature',
  description = 'This capability is included with Pro or an active trial.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href="/settings/billing">View plans</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/support">Ask support</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
