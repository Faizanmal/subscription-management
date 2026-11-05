import { LegalShell } from '@/components/legal-shell';

export const metadata = {
  title: 'Privacy Policy | Subscription Waste Manager',
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="November 4, 2026">
      <p>
        Subscription Waste Manager (&quot;SWM&quot;, &quot;we&quot;) helps organizations discover and
        reduce wasted software spend. This policy explains what we collect and how we use it.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — name, email, organization name, role, and authentication
          credentials.
        </li>
        <li>
          <strong>Workspace data</strong> — subscriptions, vendors, usage metrics, recommendations,
          alerts, and team membership you enter or sync.
        </li>
        <li>
          <strong>Integration data</strong> — OAuth tokens and metadata from connectors you enable
          (for example Google Workspace, Microsoft 365, Plaid, Okta). Tokens are encrypted at rest
          when encryption is configured.
        </li>
        <li>
          <strong>Billing data</strong> — plan status and Stripe customer/subscription identifiers.
          Card details are handled by Stripe, not stored on our servers.
        </li>
        <li>
          <strong>Technical logs</strong> — IP address, user agent, and error diagnostics (for
          example via Sentry when enabled) to operate and secure the service.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>Provide discovery, analytics, alerts, and recommendations for your organization.</li>
        <li>Authenticate users, enforce roles, and protect accounts.</li>
        <li>Process subscriptions and invoices through Stripe.</li>
        <li>Improve reliability and investigate abuse or outages.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We do not sell personal data. We share data with subprocessors only as needed to run the
        product (hosting, email delivery, payments, error monitoring) and when required by law.
      </p>

      <h2>Retention</h2>
      <p>
        We retain workspace data while your organization account is active. You can export data
        from Settings → Backups. After account deletion, we remove or anonymize production data
        within a reasonable period unless law requires longer retention.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Disconnect integrations and revoke OAuth access at any time.</li>
        <li>Export or request deletion of organization data (see Your data).</li>
        <li>Contact us at privacy@subscriptionwastemanager.com for privacy requests.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about this policy: privacy@subscriptionwastemanager.com
      </p>
    </LegalShell>
  );
}
