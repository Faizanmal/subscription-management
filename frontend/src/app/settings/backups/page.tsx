'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { backupsApi } from '@/lib/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Download,
  Upload,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  Trash2,
  FileJson,
  FileText,
  HardDrive,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { BackupSchedule, Backup, DataExport, ImportJob } from '@/types/swm';

export default function BackupsPage() {
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [exports, setExports] = useState<DataExport[]>([]);
  const [imports, setImports] = useState<ImportJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    retention_days: 30,
    is_active: true,
  });
  
  const [exportForm, setExportForm] = useState({
    format: 'json' as 'json' | 'csv',
    include_subscriptions: true,
    include_usage: true,
    include_costs: true,
    include_recommendations: false,
  });

  async function loadData() {
    setIsLoading(true);
    try {
      const [schedulesData, backupsData, exportsData, importsData] = await Promise.all([
        backupsApi.getSchedules(),
        backupsApi.getBackups(),
        backupsApi.getExports(),
        backupsApi.getImports(),
      ]);
      setSchedules(schedulesData);
      setBackups(backupsData);
      setExports(exportsData);
      setImports(importsData);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleCreateSchedule = async () => {
    try {
      const schedule = await backupsApi.createSchedule(scheduleForm);
      setSchedules([...schedules, schedule]);
      setShowScheduleDialog(false);
      setScheduleForm({
        name: '',
        frequency: 'daily',
        retention_days: 30,
        is_active: true,
      });
      toast.success('Backup schedule created');
    } catch (error) {
      toast.error('Failed to create backup schedule');
    }
  };

  const handleToggleSchedule = async (id: string, isActive: boolean) => {
    try {
      const updated = await backupsApi.updateSchedule(id, { is_active: isActive });
      setSchedules(schedules.map((s) => (s.id === id ? updated : s)));
      toast.success(`Schedule ${isActive ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update schedule');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      await backupsApi.deleteSchedule(id);
      setSchedules(schedules.filter((s) => s.id !== id));
      toast.success('Schedule deleted');
    } catch (error) {
      toast.error('Failed to delete schedule');
    }
  };

  const handleRunBackup = async () => {
    try {
      const backup = await backupsApi.createBackup();
      setBackups([backup, ...backups]);
      toast.success('Backup started');
    } catch {
      toast.error('Failed to start backup');
    }
  };

  const handleCreateExport = async () => {
    try {
      const dataExport = await backupsApi.createExport({
        export_type: 'full',
        format: exportForm.format,
        filters: {
          include_subscriptions: exportForm.include_subscriptions,
          include_usage: exportForm.include_usage,
          include_costs: exportForm.include_costs,
          include_recommendations: exportForm.include_recommendations,
        },
      });
      setExports([dataExport, ...exports]);
      setShowExportDialog(false);
      toast.success('Export started');
    } catch (error) {
      toast.error('Failed to create export');
    }
  };

  const handleDownloadExport = async (id: string) => {
    try {
      const response = await backupsApi.downloadExport(id);
      window.open(response.download_url, '_blank');
      toast.success('Download started');
    } catch {
      toast.error('Failed to download export');
    }
  };

  const handleUploadImport = async (file: File) => {
    try {
      const importJob = await backupsApi.createImport(file, 'subscriptions');
      setImports([importJob, ...imports]);
      setShowImportDialog(false);
      toast.success('Import started');
    } catch (error) {
      toast.error('Failed to start import');
    }
  };

  const handleRestoreBackup = async (id: string) => {
    try {
      await backupsApi.restoreBackup(id);
      toast.success('Restore started');
    } catch (error) {
      toast.error('Failed to start restore');
    }
  };

  const totalBackupSize = backups.reduce((acc, b) => acc + (b.size || 0), 0);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-32" />
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Backups & Exports</h1>
            <p className="text-gray-500">Manage data backups and exports</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Backup Schedules</CardDescription>
              <CardTitle className="text-3xl">{schedules.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Backups</CardDescription>
              <CardTitle className="text-3xl">{backups.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Storage Used</CardDescription>
              <CardTitle className="text-3xl">
                {(totalBackupSize / 1024 / 1024).toFixed(1)} MB
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Last Backup</CardDescription>
              <CardTitle className="text-xl">
                {backups[0]
                  ? format(new Date(backups[0].created_at), 'MMM d, h:mm a')
                  : 'Never'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="schedules">
          <TabsList>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
            <TabsTrigger value="backups">Backups</TabsTrigger>
            <TabsTrigger value="exports">Exports</TabsTrigger>
            <TabsTrigger value="imports">Imports</TabsTrigger>
          </TabsList>

          <TabsContent value="schedules" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Backup Schedules</CardTitle>
                    <CardDescription>
                      Automated backup schedules for your data
                    </CardDescription>
                  </div>
                  <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Schedule
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Backup Schedule</DialogTitle>
                        <DialogDescription>
                          Set up automated backups for your data
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="schedule-name">Name</Label>
                          <Input
                            id="schedule-name"
                            placeholder="e.g., Daily Backup"
                            value={scheduleForm.name}
                            onChange={(e) =>
                              setScheduleForm({ ...scheduleForm, name: e.target.value })
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Frequency</Label>
                            <Select
                              value={scheduleForm.frequency}
                              onValueChange={(v) =>
                                setScheduleForm({
                                  ...scheduleForm,
                                  frequency: v as 'daily' | 'weekly' | 'monthly',
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="retention">Retention (days)</Label>
                            <Input
                              id="retention"
                              type="number"
                              min="1"
                              value={scheduleForm.retention_days}
                              onChange={(e) =>
                                setScheduleForm({
                                  ...scheduleForm,
                                  retention_days: parseInt(e.target.value) || 30,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Enable Schedule</Label>
                          <Switch
                            checked={scheduleForm.is_active}
                            onCheckedChange={(checked) =>
                              setScheduleForm({ ...scheduleForm, is_active: checked })
                            }
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowScheduleDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleCreateSchedule}>Create</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {schedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 mb-4">No backup schedules configured</p>
                    <Button onClick={() => setShowScheduleDialog(true)}>
                      Create Your First Schedule
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {schedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              schedule.is_active
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            <Clock className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{schedule.name}</p>
                            <p className="text-sm text-gray-500">
                              {(schedule.frequency || 'daily').charAt(0).toUpperCase() +
                                (schedule.frequency || 'daily').slice(1)}{' '}
                              • {schedule.retention_days} days retention
                            </p>
                            {schedule.last_run && (
                              <p className="text-xs text-gray-400">
                                Last run:{' '}
                                {format(new Date(schedule.last_run), 'MMM d, h:mm a')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={schedule.is_active}
                            onCheckedChange={(checked) =>
                              handleToggleSchedule(schedule.id, checked)
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRunBackup()}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Run Now
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backups" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Backup History</CardTitle>
                <CardDescription>All backups created by schedules</CardDescription>
              </CardHeader>
              <CardContent>
                {backups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <HardDrive className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500">No backups yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backups.map((backup) => (
                        <TableRow key={backup.id}>
                          <TableCell className="font-medium">
                            {backup.schedule?.name || 'Manual'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                backup.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : backup.status === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }
                            >
                              {backup.status === 'completed' && (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              )}
                              {backup.status === 'failed' && (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              {backup.status === 'in_progress' && (
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              )}
                              {backup.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {backup.size
                              ? `${(backup.size / 1024 / 1024).toFixed(2)} MB`
                              : '-'}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {format(new Date(backup.created_at), 'MMM d, h:mm a')}
                          </TableCell>
                          <TableCell>
                            {backup.status === 'completed' && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRestoreBackup(backup.id)}
                                >
                                  Restore
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exports" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Data Exports</CardTitle>
                    <CardDescription>
                      Export your data in various formats
                    </CardDescription>
                  </div>
                  <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Download className="h-4 w-4 mr-2" />
                        New Export
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Data Export</DialogTitle>
                        <DialogDescription>
                          Export your subscription data
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Format</Label>
                          <Select
                            value={exportForm.format}
                            onValueChange={(v) =>
                              setExportForm({
                                ...exportForm,
                                format: v as 'json' | 'csv',
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="json">
                                <div className="flex items-center gap-2">
                                  <FileJson className="h-4 w-4" />
                                  JSON
                                </div>
                              </SelectItem>
                              <SelectItem value="csv">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  CSV
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Include Data</Label>
                          <div className="space-y-2">
                            {[
                              { key: 'include_subscriptions', label: 'Subscriptions' },
                              { key: 'include_usage', label: 'Usage Data' },
                              { key: 'include_costs', label: 'Cost Records' },
                              { key: 'include_recommendations', label: 'Recommendations' },
                            ].map(({ key, label }) => (
                              <label
                                key={key}
                                className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={exportForm[key as keyof typeof exportForm] as boolean}
                                  onChange={(e) =>
                                    setExportForm({
                                      ...exportForm,
                                      [key]: e.target.checked,
                                    })
                                  }
                                  className="rounded"
                                />
                                <span>{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowExportDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleCreateExport}>Create Export</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {exports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Download className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 mb-4">No exports yet</p>
                    <Button onClick={() => setShowExportDialog(true)}>
                      Create Your First Export
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Format</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exports.map((exp) => (
                        <TableRow key={exp.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {exp.format === 'json' ? (
                                <FileJson className="h-4 w-4" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                              {exp.format.toUpperCase()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                exp.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : exp.status === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }
                            >
                              {exp.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {exp.size
                              ? `${(exp.size / 1024).toFixed(1)} KB`
                              : '-'}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {format(new Date(exp.created_at), 'MMM d, h:mm a')}
                          </TableCell>
                          <TableCell>
                            {exp.status === 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadExport(exp.id)}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="imports" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Data Imports</CardTitle>
                    <CardDescription>Import data from files</CardDescription>
                  </div>
                  <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Upload className="h-4 w-4 mr-2" />
                        Import Data
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import Data</DialogTitle>
                        <DialogDescription>
                          Upload a JSON or CSV file to import
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
                          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500 mb-4">
                            Drop your file here or click to browse
                          </p>
                          <input
                            type="file"
                            accept=".json,.csv"
                            className="hidden"
                            id="import-file"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadImport(file);
                            }}
                          />
                          <Button
                            variant="outline"
                            onClick={() =>
                              document.getElementById('import-file')?.click()
                            }
                          >
                            Select File
                          </Button>
                        </div>
                        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                            <div className="text-sm text-yellow-700 dark:text-yellow-300">
                              <p className="font-medium">Important</p>
                              <p>
                                Importing data will merge with existing records.
                                Duplicate entries will be skipped.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {imports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Upload className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 mb-4">No imports yet</p>
                    <Button
                      variant="outline"
                      onClick={() => setShowImportDialog(true)}
                    >
                      Import Your Data
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Records</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {imports.map((imp) => (
                        <TableRow key={imp.id}>
                          <TableCell className="font-medium">
                            {imp.filename}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                imp.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : imp.status === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }
                            >
                              {imp.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {imp.processed_rows || 0} / {imp.total_rows || 0}
                          </TableCell>
                          <TableCell>
                            <Progress
                              value={
                                (imp.total_rows || 0) > 0
                                  ? ((imp.processed_rows || 0) / (imp.total_rows || 1)) * 100
                                  : 0
                              }
                              className="w-24 h-2"
                            />
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {format(new Date(imp.created_at), 'MMM d, h:mm a')}
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
      </div>
    </DashboardLayout>
  );
}
