"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
// DEPRECATED: formforge API client was removed. Forms feature needs migration to /api/v1 endpoints.
// import { formsApi, submissionsApi } from "@/lib/api-client";
import type { Form, Submission, Analytics } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Download, Eye, FileText, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function FormAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;

  const [form, setForm] = useState<Form | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [formData, analyticsData, submissionsData] = await Promise.all([
        formsApi.get(formId),
        formsApi.getAnalytics(formId),
        submissionsApi.list(formId),
      ]);
      setForm(formData);
      setAnalytics(analyticsData);
      setSubmissions(submissionsData);
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Prepare chart data - submissions by day (last 30 days)
  const getSubmissionsByDay = () => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    const submissionCounts = last30Days.map(date => {
      const count = submissions.filter(s => 
        s.created_at.split('T')[0] === date
      ).length;
      
      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        submissions: count
      };
    });

    return submissionCounts;
  };

  // Field completion analysis
  const getFieldCompletion = () => {
    if (!form || submissions.length === 0) return [];

    return form.schema_json.fields.map(field => {
      const completedCount = submissions.filter(s => 
        s.payload_json[field.id] !== undefined && s.payload_json[field.id] !== ''
      ).length;
      
      const completionRate = ((completedCount / submissions.length) * 100).toFixed(1);

      return {
        field: field.label.length > 20 ? field.label.substring(0, 20) + '...' : field.label,
        rate: parseFloat(completionRate)
      };
    }).slice(0, 8); // Show top 8 fields
  };

  const exportToCSV = () => {
    if (!form || submissions.length === 0) return;

    // Get all unique field IDs
    const fieldIds = form.schema_json.fields.map(f => f.id);
    const fieldLabels = form.schema_json.fields.reduce((acc, f) => {
      acc[f.id] = f.label;
      return acc;
    }, {} as Record<string, string>);

    // Create CSV header
    const headers = ['Submission ID', 'Created At', ...fieldIds.map(id => fieldLabels[id])];
    
    // Create CSV rows
    const rows = submissions.map(sub => [
      sub.id,
      new Date(sub.created_at).toLocaleString(),
      ...fieldIds.map(id => {
        const value = sub.payload_json[id];
        if (Array.isArray(value)) return value.join('; ');
        return value || '';
      })
    ]);

    // Combine into CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${form.slug}-submissions.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("CSV exported successfully!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push("/dashboard")}>
          ← Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold mt-2">{form?.title}</h1>
        <p className="text-muted-foreground">Analytics & Submissions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.views || 0}</div>
            <p className="text-xs text-muted-foreground">
              Form page visits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submissions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.submissions || 0}</div>
            <p className="text-xs text-muted-foreground">
              Total responses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.conversion_rate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Submissions / Views
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent (30d)</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.recent_submissions || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {submissions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Submissions Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Submissions Trend</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getSubmissionsByDay()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="submissions" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Field Completion Rates */}
          <Card>
            <CardHeader>
              <CardTitle>Field Completion Rates</CardTitle>
              <CardDescription>Percentage of submissions with each field filled</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={getFieldCompletion()} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="field" type="category" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="rate" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Submissions</CardTitle>
              <CardDescription>
                All form responses ({submissions.length} total)
              </CardDescription>
            </div>
            <Button onClick={exportToCSV} disabled={submissions.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
              <p className="mt-4 text-muted-foreground">No submissions yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Submissions will appear here once people start filling out your form
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitted</TableHead>
                    <TableHead>IP Address</TableHead>
                    {form?.schema_json.fields.slice(0, 3).map(field => (
                      <TableHead key={field.id}>{field.label}</TableHead>
                    ))}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell className="font-medium">
                        {new Date(submission.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {new Date(submission.created_at).toLocaleTimeString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {submission.ip_address || 'N/A'}
                      </TableCell>
                      {form?.schema_json.fields.slice(0, 3).map(field => (
                        <TableCell key={field.id} className="max-w-xs truncate">
                          {Array.isArray(submission.payload_json[field.id])
                            ? (submission.payload_json[field.id] as string[]).join(', ')
                            : (submission.payload_json[field.id] as string) || '-'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Show full submission in modal (to be implemented)
                            toast.info("Full submission view coming soon!");
                          }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
