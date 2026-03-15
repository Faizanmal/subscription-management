"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { formsApi } from "@/lib/formforge-services";
import type { Form, FormField, FormSchema } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Eye, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

export default function FormEditorPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;

  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schema, setSchema] = useState<FormSchema | null>(null);

  const loadForm = useCallback(async () => {
    try {
      const data = await formsApi.get(formId);
      setForm(data);
      setSchema(data.schema_json);
    } catch {
      toast.error("Failed to load form");
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [formId, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadForm();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadForm]);

  const handleSave = async () => {
    if (!schema) return;

    setSaving(true);
    try {
      await formsApi.update(formId, {
        title: schema.title,
        description: schema.description,
        schema_json: schema,
      });
      toast.success("Form saved successfully!");
    } catch {
      toast.error("Failed to save form");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      await formsApi.publish(formId);
      toast.success("Form published successfully!");
      loadForm();
    } catch {
      toast.error("Failed to publish form");
    }
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    if (!schema) return;
    const newFields = [...schema.fields];
    newFields[index] = { ...newFields[index], ...updates };
    setSchema({ ...schema, fields: newFields });
  };

  const removeField = (index: number) => {
    if (!schema) return;
    const newFields = schema.fields.filter((_, i) => i !== index);
    setSchema({ ...schema, fields: newFields });
  };

  const addField = () => {
    if (!schema) return;
    const newField: FormField = {
      id: `f_${schema.fields.length + 1}`,
      type: 'text',
      label: 'New Field',
      placeholder: '',
      required: false,
    };
    setSchema({ ...schema, fields: [...schema.fields, newField] });
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (!schema) return;
    const newFields = [...schema.fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newFields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setSchema({ ...schema, fields: newFields });
  };

  if (loading || !schema) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            ← Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold mt-2">{schema.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/form/${form?.slug}`)}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button variant="outline" onClick={handlePublish}>
            Publish
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Form Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Form Title</Label>
                <Input
                  id="title"
                  value={schema.title}
                  onChange={(e) => setSchema({ ...schema, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={schema.description}
                  onChange={(e) => setSchema({ ...schema, description: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Form Fields</CardTitle>
                <Button onClick={addField} size="sm">
                  Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {schema.fields.map((field, index) => (
                <Card key={field.id} className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveField(index, 'up')}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveField(index, 'down')}
                          disabled={index === schema.fields.length - 1}
                        >
                          ↓
                        </Button>
                      </div>
                      
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Label</Label>
                            <Input
                              value={field.label}
                              onChange={(e) => updateField(index, { label: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                              value={field.type}
                              onValueChange={(value: string) => updateField(index, { type: value as FormField['type'] })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="phone">Phone</SelectItem>
                                <SelectItem value="textarea">Textarea</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                                <SelectItem value="select">Select</SelectItem>
                                <SelectItem value="checkbox">Checkbox</SelectItem>
                                <SelectItem value="radio">Radio</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Placeholder</Label>
                          <Input
                            value={field.placeholder || ''}
                            onChange={(e) => updateField(index, { placeholder: e.target.value })}
                          />
                        </div>

                        {(field.type === 'select' || field.type === 'radio' || field.type === 'multiselect') && (
                          <div className="space-y-2">
                            <Label>Options (comma-separated)</Label>
                            <Input
                              value={field.options?.join(', ') || ''}
                              onChange={(e) => updateField(index, { 
                                options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                              })}
                              placeholder="Option 1, Option 2, Option 3"
                            />
                          </div>
                        )}

                        <div className="flex items-center space-x-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={field.required || false}
                              onChange={(e) => updateField(index, { required: e.target.checked })}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">Required</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeField(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {schema.fields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No fields yet. Click &quot;Add Field&quot; to get started.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Settings Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Redirect URL (after submission)</Label>
                <Input
                  value={schema.settings?.redirect || ''}
                  onChange={(e) => setSchema({
                    ...schema,
                    settings: { ...schema.settings, redirect: e.target.value }
                  })}
                  placeholder="/thank-you"
                />
              </div>
              <div className="space-y-2">
                <Label>Consent Text</Label>
                <Textarea
                  value={schema.settings?.consent_text || ''}
                  onChange={(e) => setSchema({
                    ...schema,
                    settings: { ...schema.settings, consent_text: e.target.value }
                  })}
                  placeholder="By submitting, you agree..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Form Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Views</span>
                <span className="font-semibold">{form?.views_count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Submissions</span>
                <span className="font-semibold">{form?.submissions_count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Conversion</span>
                <span className="font-semibold">{form?.conversion_rate || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className={`text-xs px-2 py-1 rounded ${form?.published_at ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {form?.published_at ? 'Published' : 'Draft'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
