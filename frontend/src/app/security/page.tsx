import Link from 'next/link';
import { LegalShell } from '@/components/legal-shell';

export const metadata = {
  title: 'Security | Subscription Waste Manager',
};

export default function SecurityPage() {
  return (
    <LegalShell title="Security overview" updated="November 1, 2026">
      <p>
        We design Subscription Waste Manager for B2B SaaS spend data. This page summarizes
        baseline controls — not a SOC 2 report.
      </p>

      <h2>Application security</h2>
      <ul>
        <li>JWT authentication with refresh rotation and brute-force protections.</li>
        <li>Organization-scoped API queries and role-based permissions.</li>
        <li>Optional MFA (TOTP) for user accounts.</li>
        <li>Integration secrets encrypted at rest when <code>ENCRYPTION_KEY</code> is set.</li>
      </ul>

      <h2>Infrastructure</h2>
      <ul>
        <li>TLS in production (HTTPS redirect and secure cookies when debug is off).</li>
        <li>Managed Postgres and Redis recommended for production deployments.</li>
        <li>Background workers for sync and alerts; health check at <code>/api/v1/health/</code>.</li>
        <li>Optional Sentry error reporting without sending payment card data.</li>
      </ul>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Grant least-privilege OAuth scopes and revoke unused connectors.</li>
        <li>Use strong admin passwords and enable MFA for privileged users.</li>
        <li>Keep Stripe and OAuth client secrets out of source control.</li>
      </ul>

      <h2>Data access</h2>
      <p>
        Export and backup tools live under{' '}
        <Link href="/settings/backups">Settings → Backups</Link> after sign-in. See also{' '}
        <Link href="/data">Your data</Link>.
      </p>

      <h2>Report an issue</h2>
      <p>security@subscriptionwastemanager.com</p>
    </LegalShell>
  );
}
