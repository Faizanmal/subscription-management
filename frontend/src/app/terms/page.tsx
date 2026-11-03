import { LegalShell } from '@/components/legal-shell';

export const metadata = {
  title: 'Terms of Service | Subscription Waste Manager',
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="November 1, 2026">
      <p>
        These Terms govern use of Subscription Waste Manager (&quot;SWM&quot;, &quot;Service&quot;).
        By creating an account you agree to them on behalf of your organization.
      </p>

      <h2>The service</h2>
      <p>
        SWM provides tools to track software subscriptions, discover waste via optional
        integrations, and surface savings recommendations. Features depend on your plan and trial
        status. We may change free-tier limits with notice.
      </p>

      <h2>Accounts and organizations</h2>
      <ul>
        <li>You must provide accurate registration information.</li>
        <li>Organization admins are responsible for user invites and access control.</li>
        <li>You must keep credentials secure and notify us of unauthorized use.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You may not:</p>
      <ul>
        <li>Probe, abuse, or disrupt the Service or other customers.</li>
        <li>Upload unlawful content or scrape the Service beyond documented APIs.</li>
        <li>Use integrations in violation of third-party provider terms.</li>
      </ul>

      <h2>Customer data</h2>
      <p>
        You retain ownership of data you submit. You grant us a limited license to process that
        data solely to provide the Service. See our Privacy Policy for details.
      </p>

      <h2>Billing</h2>
      <p>
        Paid plans are billed via Stripe. Fees are non-refundable except where required by law.
        Failure to pay may result in downgrade to the free plan and loss of paid features.
      </p>

      <h2>Disclaimer and liability</h2>
      <p>
        The Service is provided &quot;as is.&quot; Recommendations are informational; you remain
        responsible for cancellation and purchasing decisions. To the maximum extent permitted by
        law, our aggregate liability is limited to fees paid in the three months before the claim.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend accounts that violate these
        Terms or pose security risk. Upon termination, export your data promptly; we may delete
        remaining data per our retention policy.
      </p>

      <h2>Contact</h2>
      <p>legal@subscriptionwastemanager.com</p>
    </LegalShell>
  );
}
