'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  CreditCard,
  GitMerge,
  Search,
  Shield,
  Sparkles,
  TrendingDown,
  Zap,
  CheckCircle2,
} from 'lucide-react';

export default function LandingPage() {
  const features = [
    {
      icon: Search,
      title: 'Automated Discovery',
      description:
        'Automatically discover all SaaS subscriptions from email, SSO, bank feeds, and expense reports.',
    },
    {
      icon: BarChart3,
      title: 'Usage Analytics',
      description:
        'Track actual usage across all subscriptions to identify underutilized or abandoned software.',
    },
    {
      icon: GitMerge,
      title: 'Redundancy Detection',
      description:
        'Find overlapping tools and duplicate subscriptions costing you money.',
    },
    {
      icon: CreditCard,
      title: 'Cost Dashboard',
      description:
        'Unified view of all SaaS spending by department, category, and vendor.',
    },
    {
      icon: Bell,
      title: 'Renewals & Alerts',
      description:
        'Never miss a renewal. Get alerted before auto-renewals and budget overruns.',
    },
    {
      icon: Bot,
      title: 'AI Recommendations',
      description:
        'GPT-powered suggestions to optimize licenses, downgrade plans, or cancel unused tools.',
    },
    {
      icon: Zap,
      title: 'Automated Workflows',
      description:
        'Auto-cancel unused subscriptions, notify stakeholders, and enforce policies.',
    },
    {
      icon: Shield,
      title: 'Enterprise Integrations',
      description:
        'Connect with Slack, Teams, Okta, Google Workspace, and accounting systems.',
    },
  ];

  const stats = [
    { value: '32%', label: 'Average SaaS Waste' },
    { value: '$2.4M', label: 'Avg. Annual Savings' },
    { value: '89%', label: 'License Utilization' },
    { value: '< 5 min', label: 'Setup Time' },
  ];

  const testimonials = [
    {
      quote:
        'We discovered $180K in unused subscriptions within the first week. The ROI was immediate.',
      author: 'Sarah Chen',
      role: 'CFO, TechCorp',
      avatar: 'SC',
    },
    {
      quote:
        'The AI recommendations alone saved us 15 hours per month on license optimization.',
      author: 'Mike Johnson',
      role: 'IT Director, ScaleUp Inc',
      avatar: 'MJ',
    },
    {
      quote:
        'Finally, complete visibility into our SaaS stack. No more shadow IT surprises.',
      author: 'Emily Rodriguez',
      role: 'CTO, DataFlow',
      avatar: 'ER',
    },
  ];

  const pricingPlans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'For individuals and small teams',
      features: [
        'Up to 25 subscriptions',
        'Manual entry only',
        'Basic analytics',
        'Email alerts',
      ],
      cta: 'Get Started',
      highlighted: false,
    },
    {
      name: 'Pro',
      price: '$49',
      period: 'per month',
      description: 'For growing companies',
      features: [
        'Up to 200 subscriptions',
        'Auto-discovery',
        'AI recommendations',
        'Bank feed integration',
        'Team collaboration',
        'Priority support',
      ],
      cta: 'Start Free Trial',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'contact us',
      description: 'For large organizations',
      features: [
        'Unlimited subscriptions',
        'SSO integration',
        'Custom workflows',
        'API access',
        'Dedicated CSM',
        'SLA guarantee',
      ],
      cta: 'Contact Sales',
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-lg dark:bg-gray-950/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600">
                <span className="text-lg font-bold text-white">S</span>
              </div>
              <span className="text-xl font-bold">SWM</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm hover:text-blue-600">
                Features
              </a>
              <a href="#pricing" className="text-sm hover:text-blue-600">
                Pricing
              </a>
              <a href="#testimonials" className="text-sm hover:text-blue-600">
                Testimonials
              </a>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Link href="/register">Start Free</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-32">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-950" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-4 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100">
              <Sparkles className="h-3 w-3 mr-1" />
              Now with GPT-4 AI Recommendations
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              Stop Wasting Money on
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Unused SaaS
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-gray-600 dark:text-gray-400 mb-8">
              Companies waste 32% of their SaaS budget on unused, duplicate, or
              over-provisioned subscriptions. Subscription Waste Manager finds and
              eliminates that waste automatically.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="text-lg px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Link href="/register">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-lg px-8">
                <Link href="/demo">Watch Demo</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              No credit card required • 14-day free trial • Setup in 5 minutes
            </p>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Dashboard Preview */}
          <div className="mt-20 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent dark:from-gray-950 z-10" />
            <div className="rounded-xl border bg-gray-900 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
              <div className="p-4 bg-gradient-to-br from-gray-900 to-gray-800">
                <div className="grid grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Active Subscriptions', value: '127' },
                    { label: 'Monthly Spend', value: '$48,320' },
                    { label: 'Potential Savings', value: '$12,580' },
                    { label: 'Unused Licenses', value: '43' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-gray-800 p-4">
                      <p className="text-xs text-gray-400">{item.label}</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="h-48 rounded-lg bg-gray-800/50 flex items-center justify-center">
                  <TrendingDown className="h-24 w-24 text-green-500/20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Everything You Need to Eliminate SaaS Waste
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Powerful features to discover, analyze, and optimize your entire SaaS
              portfolio.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="pt-6">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Get started in minutes, not months
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Connect Your Sources',
                description:
                  'Connect email, SSO, bank accounts, and expense tools. We automatically discover all your subscriptions.',
              },
              {
                step: '2',
                title: 'Analyze Usage',
                description:
                  'Our AI analyzes usage patterns to identify waste, redundancies, and optimization opportunities.',
              },
              {
                step: '3',
                title: 'Take Action',
                description:
                  'Get actionable recommendations. Cancel unused tools, downgrade plans, and negotiate better deals.',
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mb-6">
                  <span className="text-2xl font-bold text-white">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Trusted by Finance & IT Leaders</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              See why companies choose SWM
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <Card key={idx} className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold">{testimonial.author}</p>
                      <p className="text-sm text-gray-500">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Start free, scale as you grow
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative border-2 ${
                  plan.highlighted
                    ? 'border-blue-600 shadow-xl scale-105'
                    : 'border-gray-200'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-blue-600 to-purple-600">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardContent className="pt-8">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-500 ml-1">/{plan.period}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    {plan.description}
                  </p>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full ${
                      plan.highlighted
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                        : ''
                    }`}
                    variant={plan.highlighted ? 'default' : 'outline'}
                    asChild
                  >
                    <Link href="/register">{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Stop Wasting Money on SaaS?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of companies saving millions on their SaaS subscriptions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="secondary" asChild className="text-lg px-8">
              <Link href="/register">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8 border-white text-white hover:bg-white/10">
              <Link href="/demo">Schedule Demo</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">S</span>
                </div>
                <span className="font-bold">Subscription Waste Manager</span>
              </div>
              <p className="text-sm text-gray-500">
                Helping companies eliminate SaaS waste and optimize their software
                investments.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#features" className="hover:text-blue-600">Features</a></li>
                <li><a href="#pricing" className="hover:text-blue-600">Pricing</a></li>
                <li><a href="/integrations" className="hover:text-blue-600">Integrations</a></li>
                <li><a href="/changelog" className="hover:text-blue-600">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="/about" className="hover:text-blue-600">About</a></li>
                <li><a href="/blog" className="hover:text-blue-600">Blog</a></li>
                <li><a href="/careers" className="hover:text-blue-600">Careers</a></li>
                <li><a href="/contact" className="hover:text-blue-600">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="/privacy" className="hover:text-blue-600">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-blue-600">Terms of Service</a></li>
                <li><a href="/security" className="hover:text-blue-600">Security</a></li>
                <li><a href="/gdpr" className="hover:text-blue-600">GDPR</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t text-center text-sm text-gray-500">
            © {new Date().getFullYear()} Subscription Waste Manager. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
