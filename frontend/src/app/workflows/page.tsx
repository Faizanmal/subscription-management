'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { workflowsApi } from '@/lib/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workflow,
  Plus,
  MoreVertical,
  Play,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Mail,
  BellRing,
  ArrowRight,
  Calendar,
  Activity,
  RefreshCw,
  TrendingDown,
  Lightbulb,
  MessageSquare,
  CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type {
  Workflow as WorkflowType,
  WorkflowExecution,
  WorkflowTrigger,
  WorkflowAction,
} from '@/types/swm';

const TRIGGER_ICONS: Record<WorkflowTrigger, React.ReactNode> = {
  renewal_approaching: <Calendar className="h-4 w-4" />,
  low_usage: <TrendingDown className="h-4 w-4" />,
  budget_exceeded: <AlertTriangle className="h-4 w-4" />,
  new_subscription: <Plus className="h-4 w-4" />,
  recommendation_created: <Lightbulb className="h-4 w-4" />,
  scheduled: <Calendar className="h-4 w-4" />,
  schedule: <Calendar className="h-4 w-4" />,
  threshold: <AlertTriangle className="h-4 w-4" />,
};

const TRIGGER_LABELS: Record<WorkflowTrigger, string> = {
  renewal_approaching: 'Renewal Approaching',
  low_usage: 'Low Usage',
  budget_exceeded: 'Budget Exceeded',
  new_subscription: 'New Subscription',
  recommendation_created: 'Recommendation Created',
  scheduled: 'Scheduled',
  schedule: 'Scheduled',
  threshold: 'Threshold',
};

const ACTION_ICONS: Record<WorkflowAction, React.ReactNode> = {
  send_email: <Mail className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  send_slack: <MessageSquare className="h-4 w-4" />,
  create_task: <CheckSquare className="h-4 w-4" />,
  update_subscription: <RefreshCw className="h-4 w-4" />,
  create_approval: <Clock className="h-4 w-4" />,
  webhook: <Zap className="h-4 w-4" />,
  notify: <BellRing className="h-4 w-4" />,
};

const ACTION_LABELS: Record<WorkflowAction, string> = {
  send_email: 'Send Email',
  email: 'Send Email',
  send_slack: 'Send Slack',
  create_task: 'Create Task',
  update_subscription: 'Update Subscription',
  create_approval: 'Create Approval',
  webhook: 'Trigger Webhook',
  notify: 'Send Notification',
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowType[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowType | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger: 'threshold' as WorkflowTrigger,
    action: 'notify' as WorkflowAction,
    conditions: {} as Record<string, unknown>,
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [workflowsData, executionsData] = await Promise.all([
        workflowsApi.list(),
        workflowsApi.listExecutions(),
      ]);
      setWorkflows(Array.isArray(workflowsData) ? workflowsData : workflowsData.results || []);
      setExecutions(Array.isArray(executionsData) ? executionsData : executionsData.results || []);
    } catch (error) {
      console.error('Failed to load workflows', error);
      toast.error('Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const workflow = await workflowsApi.create({
        ...formData,
        conditions: formData.conditions,
      });
      setWorkflows([workflow, ...workflows]);
      setShowCreateDialog(false);
      resetForm();
      toast.success('Workflow created successfully');
    } catch (error) {
      console.error("Failed to create workflow", error);
      toast.error('Failed to create workflow');
    }
  };

  const handleUpdate = async () => {
    if (!editingWorkflow) return;
    try {
      const updated = await workflowsApi.update(editingWorkflow.id, formData);
      setWorkflows(workflows.map((w) => (w.id === updated.id ? updated : w)));
      setEditingWorkflow(null);
      resetForm();
      toast.success('Workflow updated successfully');
    } catch {
      toast.error('Failed to update workflow');
    }
  };

  const handleToggle = async (workflow: WorkflowType) => {
    try {
      const updated = await workflowsApi.update(workflow.id, {
        is_active: !workflow.is_active,
      });
      setWorkflows(workflows.map((w) => (w.id === updated.id ? updated : w)));
      toast.success(`Workflow ${updated.is_active ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Failed to update workflow', error);
      toast.error('Failed to update workflow');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await workflowsApi.delete(id);
      setWorkflows(workflows.filter((w) => w.id !== id));
      toast.success('Workflow deleted');
    } catch (error) {
      console.error('Failed to delete workflow', error);
      toast.error('Failed to delete workflow');
    }
  };

  const handleRun = async (id: string) => {
    try {
      const execution = await workflowsApi.run(id);
      setExecutions([execution, ...executions]);
      toast.success('Workflow triggered');
    } catch (error) {
      console.error('Failed to run workflow', error);
      toast.error('Failed to run workflow');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger: 'threshold',
      action: 'notify',
      conditions: {},
      is_active: true,
    });
  };

  const openEditDialog = (workflow: WorkflowType) => {
    setFormData({
      name: workflow.name,
      description: workflow.description,
      trigger: workflow.trigger,
      action: workflow.action,
      conditions: workflow.conditions || {},
      is_active: workflow.is_active,
    });
    setEditingWorkflow(workflow);
  };

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
            <h1 className="text-2xl font-bold">Automation Workflows</h1>
            <p className="text-gray-500">
              Automate subscription management tasks
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Workflow
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Workflow</DialogTitle>
                <DialogDescription>
                  Set up automated actions for your subscriptions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Low utilization alert"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="What does this workflow do?"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trigger</Label>
                    <Select
                      value={formData.trigger}
                      onValueChange={(v) =>
                        setFormData({ ...formData, trigger: v as WorkflowTrigger })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              {TRIGGER_ICONS[value as WorkflowTrigger]}
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Action</Label>
                    <Select
                      value={formData.action}
                      onValueChange={(v) =>
                        setFormData({ ...formData, action: v as WorkflowAction })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ACTION_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              {ACTION_ICONS[value as WorkflowAction]}
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Condition Builder based on trigger */}
                {formData.trigger === 'threshold' && (
                  <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Label>Threshold Conditions</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Select
                        value={(formData.conditions?.field as string) || 'utilization_rate'}
                        onValueChange={(v) =>
                          setFormData({
                            ...formData,
                            conditions: { ...formData.conditions, field: v },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="utilization_rate">Utilization</SelectItem>
                          <SelectItem value="monthly_cost">Monthly Cost</SelectItem>
                          <SelectItem value="assigned_licenses">Licenses</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={(formData.conditions?.operator as string) || 'lt'}
                        onValueChange={(v) =>
                          setFormData({
                            ...formData,
                            conditions: { ...formData.conditions, operator: v },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lt">Less than</SelectItem>
                          <SelectItem value="gt">Greater than</SelectItem>
                          <SelectItem value="eq">Equals</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Value"
                        value={(formData.conditions?.value as number) || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            conditions: {
                              ...formData.conditions,
                              value: parseFloat(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {(formData.trigger === 'schedule' || formData.trigger === 'scheduled') && (
                  <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <Label>Schedule</Label>
                    <Select
                      value={(formData.conditions?.schedule as string) || 'daily'}
                      onValueChange={(v) =>
                        setFormData({
                          ...formData,
                          conditions: { ...formData.conditions, schedule: v },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Every Hour</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Active</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create Workflow</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Workflows</CardDescription>
              <CardTitle className="text-3xl">{workflows.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {workflows.filter((w) => w.is_active).length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Executions (30d)</CardDescription>
              <CardTitle className="text-3xl">{executions.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Success Rate</CardDescription>
              <CardTitle className="text-3xl">
                {executions.length > 0
                  ? Math.round(
                      (executions.filter((e) => e.status === 'completed').length /
                        executions.length) *
                        100
                    )
                  : 100}
                %
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="workflows">
          <TabsList>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="history">Execution History</TabsTrigger>
          </TabsList>

          <TabsContent value="workflows" className="space-y-4">
            {workflows.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Workflow className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium">No workflows yet</h3>
                  <p className="text-gray-500 mb-4">
                    Create your first automation workflow
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workflow
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflows.map((workflow) => (
                  <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              workflow.is_active
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            <Workflow className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{workflow.name}</CardTitle>
                            <CardDescription>{workflow.description}</CardDescription>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleRun(workflow.id)}>
                              <Play className="h-4 w-4 mr-2" />
                              Run Now
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(workflow)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(workflow.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="flex items-center gap-1">
                          {TRIGGER_ICONS[workflow.trigger]}
                          {TRIGGER_LABELS[workflow.trigger]}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <Badge variant="outline" className="flex items-center gap-1">
                          {ACTION_ICONS[workflow.action]}
                          {ACTION_LABELS[workflow.action]}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={workflow.is_active}
                            onCheckedChange={() => handleToggle(workflow)}
                          />
                          <span className="text-sm text-gray-500">
                            {workflow.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {workflow.last_run && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last run: {format(new Date(workflow.last_run), 'MMM d, h:mm a')}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Execution History</CardTitle>
                <CardDescription>Recent workflow executions</CardDescription>
              </CardHeader>
              <CardContent>
                {executions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Activity className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500">No executions yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Workflow</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Trigger</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executions.map((execution) => (
                        <TableRow key={execution.id}>
                          <TableCell className="font-medium">
                            {execution.workflow?.name || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                execution.status === 'completed'
                                  ? 'default'
                                  : execution.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {execution.status === 'completed' && (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              )}
                              {execution.status === 'failed' && (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              {execution.status === 'running' && (
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              )}
                              {execution.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{execution.trigger_reason}</TableCell>
                          <TableCell>
                            {format(new Date(execution.started_at), 'MMM d, h:mm a')}
                          </TableCell>
                          <TableCell>
                            {execution.completed_at
                              ? `${Math.round(
                                  (new Date(execution.completed_at).getTime() -
                                    new Date(execution.started_at).getTime()) /
                                    1000
                                )}s`
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={!!editingWorkflow} onOpenChange={() => setEditingWorkflow(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Workflow</DialogTitle>
              <DialogDescription>Update workflow configuration</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trigger</Label>
                  <Select
                    value={formData.trigger}
                    onValueChange={(v) =>
                      setFormData({ ...formData, trigger: v as WorkflowTrigger })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select
                    value={formData.action}
                    onValueChange={(v) =>
                      setFormData({ ...formData, action: v as WorkflowAction })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-is_active">Active</Label>
                <Switch
                  id="edit-is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingWorkflow(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
