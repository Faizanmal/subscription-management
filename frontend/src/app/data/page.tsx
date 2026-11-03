import Link from 'next/link';
import { LegalShell } from '@/components/legal-shell';

export const metadata = {
  title: 'Your data | Subscription Waste Manager',
};

export default function DataPage() {
  return (
    <LegalShell title="Your data — export & deletion" updated="November 1, 2026">
      <p>
        Organization admins can export workspace data and request deletion. This is our baseline
        GDPR-oriented process until a formal DPA program is published.
      </p>

      <h2>Export</h2>
      <ol>
        <li>Sign in as an organization admin.</li>
        <li>
          Open <Link href="/settings/backups">Settings → Backups</Link>.
        </li>
        <li>Create a data export (JSON/CSV as available) for subscriptions, users, and related records.</li>
        <li>Download the file when the job completes.</li>
      </ol>

      <h2>Delete or close an organization</h2>
      <ol>
        <li>Disconnect all integrations and revoke OAuth grants at the provider.</li>
        <li>Export any data you need to keep.</li>
        <li>
          Email support@subscriptionwastemanager.com from an admin address with subject
          &quot;Organization deletion request&quot; and your organization name/slug.
        </li>
        <li>
          We confirm identity, schedule deletion of production data, and cancel Stripe
          subscriptions when applicable.
        </li>
      </ol>

      <h2>What we keep briefly</h2>
      <p>
        Billing identifiers and security logs may be retained for a limited period for fraud
        prevention, accounting, and legal compliance, then removed or anonymized.
      </p>

      <h2>Questions</h2>
      <p>
        privacy@subscriptionwastemanager.com · See also{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalShell>
  );
}
