import Link from 'next/link';
import { LegalShell } from '@/components/legal-shell';

export const metadata = {
  title: 'Support | Subscription Waste Manager',
};

export default function SupportPage() {
  return (
    <LegalShell title="Support & feedback" updated="November 4, 2026">
      <p>
        We are in private beta / early launch. Reach us directly — there is no ticket portal yet.
      </p>

      <h2>Contact</h2>
      <ul>
        <li>
          <strong>Product / billing help:</strong>{' '}
          <a href="mailto:support@subscriptionwastemanager.com">
            support@subscriptionwastemanager.com
          </a>
        </li>
        <li>
          <strong>Security reports:</strong>{' '}
          <a href="mailto:security@subscriptionwastemanager.com">
            security@subscriptionwastemanager.com
          </a>
        </li>
        <li>
          <strong>Privacy requests:</strong>{' '}
          <a href="mailto:privacy@subscriptionwastemanager.com">
            privacy@subscriptionwastemanager.com
          </a>
        </li>
      </ul>

      <h2>Self-serve</h2>
      <ul>
        <li>
          <Link href="/onboarding">Onboarding</Link> — connect Workspace/M365 or add a subscription
        </li>
        <li>
          <Link href="/settings/billing">Billing</Link> — plan, trial, Stripe portal
        </li>
        <li>
          <Link href="/settings/integrations">Integrations</Link> — connectors and sync
        </li>
        <li>
          <Link href="/data">Your data</Link> — export and deletion process
        </li>
        <li>
          <Link href="/security">Security overview</Link>
        </li>
      </ul>

      <h2>Status</h2>
      <p>
        If the app is unreachable, email support with
        your organization name and approximate time of the issue.
      </p>
    </LegalShell>
  );
}
