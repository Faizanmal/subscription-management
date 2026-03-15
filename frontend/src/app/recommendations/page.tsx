'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { useRecommendationsStore } from '@/lib/stores';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Lightbulb,
  ArrowRight,
  Filter,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import type { Recommendation, RecommendationType, RecommendationPriority } from '@/types/swm';

const TYPE_ICONS: Record<RecommendationType, React.ReactNode> = {
  cancel: <XCircle className="h-5 w-5 text-red-500" />,
  downgrade: <TrendingDown className="h-5 w-5 text-orange-500" />,
  consolidate: <Sparkles className="h-5 w-5 text-purple-500" />,
  renegotiate: <DollarSign className="h-5 w-5 text-green-500" />,
  remove_licenses: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  upgrade: <Zap className="h-5 w-5 text-blue-500" />,
  optimize: <RefreshCw className="h-5 w-5 text-cyan-500" />,
  rightsizing: <TrendingDown className="h-5 w-5 text-indigo-500" />,
};

const TYPE_LABELS: Record<RecommendationType, string> = {
  cancel: 'Cancel',
  downgrade: 'Downgrade',
  consolidate: 'Consolidate',
  renegotiate: 'Renegotiate',
  remove_licenses: 'Remove Licenses',
  upgrade: 'Upgrade',
  optimize: 'Optimize',
  rightsizing: 'Rightsize',
};

const PRIORITY_COLORS: Record<RecommendationPriority, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

function RecommendationCard({
  recommendation,
  onApprove,
  onDismiss,
  onImplement,
}: {
  recommendation: Recommendation;
  onApprove: () => void;
  onDismiss: () => void;
  onImplement: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showDismissDialog, setShowDismissDialog] = useState(false);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {TYPE_ICONS[recommendation.type]}
            <div>
              <CardTitle className="text-lg">{recommendation.title}</CardTitle>
              <CardDescription className="mt-1">
                {recommendation.subscription?.name}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={PRIORITY_COLORS[recommendation.priority]}>
              {recommendation.priority}
            </Badge>
            <Badge variant="outline">{TYPE_LABELS[recommendation.type]}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-600 dark:text-gray-300">{recommendation.description}</p>

        {/* Savings */}
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div>
            <p className="text-sm text-gray-500">Potential Savings</p>
            <p className="text-2xl font-bold text-green-600">
              ${recommendation.potential_savings.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">per year</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Confidence</p>
            <div className="flex items-center gap-2">
              <Progress
                value={recommendation.confidence_score * 100}
                className="w-20 h-2"
              />
              <span className="text-sm font-medium">
                {Math.round(recommendation.confidence_score * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Expandable Details */}
        {recommendation.implementation_steps && recommendation.implementation_steps.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide Implementation Steps
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show Implementation Steps
                </>
              )}
            </button>

            {expanded && (
              <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">Implementation Steps</h4>
                <ol className="list-decimal list-inside space-y-2">
                  {recommendation.implementation_steps.map((step, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-300">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* AI Reasoning */}
        {recommendation.ai_reasoning && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">AI Analysis</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {recommendation.ai_reasoning}
            </p>
          </div>
        )}

        {/* Actions */}
        {recommendation.status === 'pending' && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => setShowApproveDialog(true)}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDismissDialog(true)}
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Dismiss
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/subscriptions/${recommendation.subscription?.id}`}>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}

        {recommendation.status === 'approved' && (
          <div className="flex items-center gap-2 pt-2">
            <Button size="sm" onClick={onImplement} className="flex-1">
              <Zap className="h-4 w-4 mr-2" />
              Mark as Implemented
            </Button>
          </div>
        )}

        {recommendation.status === 'implemented' && (
          <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-700 dark:text-green-400 font-medium">
              Implemented
            </span>
          </div>
        )}

        {recommendation.status === 'dismissed' && (
          <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <XCircle className="h-5 w-5 text-gray-500" />
            <span className="text-gray-500">Dismissed</span>
          </div>
        )}
      </CardContent>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Recommendation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this recommendation? This will mark it for implementation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onApprove}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dismiss Dialog */}
      <AlertDialog open={showDismissDialog} onOpenChange={setShowDismissDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Recommendation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to dismiss this recommendation? You can always view it later in the dismissed tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDismiss}>Dismiss</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function RecommendationsPage() {
  const {
    recommendations,
    quickWins,
    totalSavings,
    isLoading,
    fetchRecommendations,
    fetchQuickWins,
    approveRecommendation,
    dismissRecommendation,
    implementRecommendation,
  } = useRecommendationsStore();

  const [typeFilter, setTypeFilter] = useState<RecommendationType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<RecommendationPriority | 'all'>('all');

  useEffect(() => {
    fetchRecommendations();
    fetchQuickWins();
  }, [fetchRecommendations, fetchQuickWins]);

  const filterRecommendations = (recs: Recommendation[], status?: string) => {
    return recs.filter((r) => {
      if (status && r.status !== status) return false;
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false;
      return true;
    });
  };

  const pendingRecs = filterRecommendations(recommendations, 'pending');
  const approvedRecs = filterRecommendations(recommendations, 'approved');
  const implementedRecs = filterRecommendations(recommendations, 'implemented');
  const dismissedRecs = filterRecommendations(recommendations, 'dismissed');

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Recommendations</h1>
            <p className="text-gray-500">
              AI-powered insights to optimize your subscriptions
            </p>
          </div>
          <Button onClick={() => fetchRecommendations()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Potential Savings</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                ${totalSavings.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">per year</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Recommendations</CardDescription>
              <CardTitle className="text-3xl">{pendingRecs.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Implemented</CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {implementedRecs.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                savings realized:{' '}
                <span className="font-medium">
                  $
                  {implementedRecs
                    .reduce((acc, r) => acc + r.potential_savings, 0)
                    .toLocaleString()}
                </span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Wins */}
        {quickWins.length > 0 && (
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-600" />
                <CardTitle>Quick Wins</CardTitle>
              </div>
              <CardDescription>
                Easy savings opportunities you can act on today
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {quickWins.slice(0, 3).map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 bg-white dark:bg-gray-800 rounded-lg border"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {TYPE_ICONS[rec.type]}
                      <span className="font-medium">{rec.subscription?.name}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{rec.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-green-600">
                        ${rec.potential_savings.toLocaleString()}
                      </span>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/subscriptions/${rec.subscription?.id}`}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-500">Filter by:</span>
          </div>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as RecommendationType | 'all')}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as RecommendationPriority | 'all')}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({pendingRecs.length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({approvedRecs.length})
            </TabsTrigger>
            <TabsTrigger value="implemented">
              Implemented ({implementedRecs.length})
            </TabsTrigger>
            <TabsTrigger value="dismissed">
              Dismissed ({dismissedRecs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingRecs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-medium">All caught up!</h3>
                  <p className="text-gray-500">No pending recommendations to review.</p>
                </CardContent>
              </Card>
            ) : (
              pendingRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onApprove={() => approveRecommendation(rec.id)}
                  onDismiss={() => dismissRecommendation(rec.id)}
                  onImplement={() => implementRecommendation(rec.id)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {approvedRecs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium">No approved recommendations</h3>
                  <p className="text-gray-500">Approve pending recommendations to see them here.</p>
                </CardContent>
              </Card>
            ) : (
              approvedRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onApprove={() => approveRecommendation(rec.id)}
                  onDismiss={() => dismissRecommendation(rec.id)}
                  onImplement={() => implementRecommendation(rec.id)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="implemented" className="space-y-4">
            {implementedRecs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Sparkles className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium">No implemented recommendations yet</h3>
                  <p className="text-gray-500">Your savings will be tracked here.</p>
                </CardContent>
              </Card>
            ) : (
              implementedRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onApprove={() => approveRecommendation(rec.id)}
                  onDismiss={() => dismissRecommendation(rec.id)}
                  onImplement={() => implementRecommendation(rec.id)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="dismissed" className="space-y-4">
            {dismissedRecs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <XCircle className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium">No dismissed recommendations</h3>
                  <p className="text-gray-500">Dismissed recommendations will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              dismissedRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onApprove={() => approveRecommendation(rec.id)}
                  onDismiss={() => dismissRecommendation(rec.id)}
                  onImplement={() => implementRecommendation(rec.id)}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
