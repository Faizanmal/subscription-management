export const productName = 'Subscription Waste Manager';
export const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@subscriptionwastemanager.com';
export const businessName = process.env.NEXT_PUBLIC_LEGAL_BUSINESS_NAME || '';
export const businessCountry = process.env.NEXT_PUBLIC_BUSINESS_COUNTRY || '';
export const policyVersion = '2026-11-04';

export const plans = [
  { name: 'Starter', price: '$0', period: 'forever', description: 'Keep your subscription inventory organized.', features: ['25 subscriptions', '2 team seats', 'Manual tracking', 'Basic analytics and renewal alerts'], href: '/register', cta: 'Start free', featured: false },
  { name: 'Pro', price: '$49', period: 'month', description: 'Discovery and optimization for growing teams.', features: ['200 subscriptions', '25 team seats', 'Supported discovery and bank connectors', 'Recommendations and automation workflows'], href: '/register?plan=pro', cta: 'Start 14-day trial', featured: true },
  { name: 'Enterprise', price: 'Custom', period: '', description: 'Discuss your organization’s requirements.', features: ['Unlimited subscriptions and seats', 'Supported enterprise identity connections', 'Custom workflow requirements', 'Sales-assisted support'], href: '/contact', cta: 'Talk to us', featured: false },
];

export const faqs = [
  { question: 'Do I need a card to start?', answer: 'No. New organizations receive a 14-day trial of Pro features without entering a card. You choose whether to upgrade from Billing. Signup does not start a paid subscription.' },
  { question: 'What happens after the trial?', answer: 'Your organization uses Starter unless you explicitly purchase a paid plan. Starter supports manual tracking with 25 subscriptions and 2 seats. Discovery, AI, bank feeds, and automation require Pro access.' },
  { question: 'Can I start without connecting my bank or workspace?', answer: 'Yes. Add subscriptions manually and review your inventory first. Connections are optional and may require provider or workspace administrator permissions.' },
  { question: 'Does SWM cancel my vendor subscriptions?', answer: 'Changes to tracked subscriptions do not automatically cancel contracts with vendors. You remain responsible for contacting the vendor and confirming the cancellation or plan change.' },
  { question: 'How do I manage a paid subscription?', answer: 'Organization admins open Settings → Billing → Manage billing to access the payment provider’s portal, available invoices, payment methods, and cancellation options. Cancellation timing is shown in the portal.' },
  { question: 'Can I export or delete my data?', answer: 'Admins can create exports under Settings → Backups & Export. For organization closure or deletion, follow Your data or contact support from an administrator address.' },
];

export const connectors = [
  { name: 'Google Workspace', category: 'Workspace discovery', description: 'Connect a workspace with the necessary administrator permissions to discover supported subscription and usage information.' },
  { name: 'Microsoft 365', category: 'Workspace discovery', description: 'Connect your Microsoft tenant with appropriate consent and permissions for supported discovery.' },
  { name: 'Plaid', category: 'Bank feeds', description: 'Connect supported institutions through Plaid. Availability depends on the institution, region, and enabled environment.' },
  { name: 'Okta / Azure AD', category: 'Identity sources', description: 'Configure supported identity connections with your organization’s administrator.' },
  { name: 'Slack webhooks', category: 'Notifications', description: 'Send configured alerts to a Slack incoming webhook. Available independently of discovery connectors.' },
  { name: 'Email scanning', category: 'Discovery', description: 'Configure supported mailbox scanning to identify subscription-related messages. Review access before connecting.' },
];
