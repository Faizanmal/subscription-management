"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { formsApi, submissionsApi } from "@/lib/formforge-services";
import type { Form, FormField } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PublicFormPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  const loadForm = useCallback(async () => {
    try {
      // In production, this would be a public endpoint
      // For now, we'll fetch by slug (needs backend adjustment)
      const forms = await formsApi.list();
      const foundForm = forms.find((f: Form) => f.slug === slug);
      
      if (foundForm) {
        setForm(foundForm);
        // Initialize visible fields
        const initialVisible = new Set<string>();
        foundForm.schema_json.fields.forEach((field: FormField) => {
          initialVisible.add(field.id);
        });
        setVisibleFields(initialVisible);
      } else {
        toast.error("Form not found");
      }
    } catch {
      toast.error("Failed to load form");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const updateVisibleFields = useCallback(() => {
    if (!form) return;

    const newVisible = new Set<string>();
    
    // Start with all fields visible
    form.schema_json.fields.forEach(field => {
      newVisible.add(field.id);
    });

    // Apply conditional logic
    if (form.schema_json.logic) {
      form.schema_json.logic.forEach(rule => {
        const fieldValue = formData[rule.if.field];
        let conditionMet = false;

        switch (rule.if.operator) {
          case 'equals':
            conditionMet = fieldValue === rule.if.value;
            break;
          case 'contains':
            conditionMet = Array.isArray(fieldValue) 
              ? fieldValue.includes(rule.if.value)
              : String(fieldValue).includes(String(rule.if.value));
            break;
          case 'gte':
            conditionMet = Number(fieldValue) >= Number(rule.if.value);
            break;
          case 'lte':
            conditionMet = Number(fieldValue) <= Number(rule.if.value);
            break;
        }

        if (conditionMet) {
          rule.show?.forEach(fieldId => newVisible.add(fieldId));
          rule.hide?.forEach(fieldId => newVisible.delete(fieldId));
        } else {
          rule.hide?.forEach(fieldId => newVisible.add(fieldId));
          rule.show?.forEach(fieldId => newVisible.delete(fieldId));
        }
      });
    }

    setVisibleFields(newVisible);
  }, [form, formData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadForm();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadForm]);

  useEffect(() => {
    if (form) {
      const timer = window.setTimeout(() => {
        updateVisibleFields();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [form, updateVisibleFields]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const requiredFields = form?.schema_json.fields.filter(f => f.required && visibleFields.has(f.id));
    const missingFields = requiredFields?.filter(f => !formData[f.id]);
    
    if (missingFields && missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    setSubmitting(true);

    try {
      const response = await submissionsApi.submit(slug, formData);
      setSubmitted(true);
      toast.success(response.message || "Form submitted successfully!");
      
      // Redirect if specified
      const redirect = response.redirect;
      if (typeof redirect === 'string' && redirect !== '/thank-you') {
        setTimeout(() => {
          window.location.href = redirect;
        }, 2000);
      }
    } catch (error: unknown) {
      const err = error as { isRateLimit?: boolean; message?: string; retryAfter?: number };
      // Handle rate limiting
      if (err?.isRateLimit) {
        toast.error(err.message || "Too many submissions. Please try again later.", {
          description: err.retryAfter ? `Please wait ${err.retryAfter} seconds before trying again.` : undefined,
          duration: 5000,
        });
      } else {
        toast.error("Failed to submit form. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    if (!visibleFields.has(field.id)) return null;

    const value = formData[field.id] || '';

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
      case 'number':
      case 'date':
      case 'time':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type={field.type}
              placeholder={field.placeholder}
              value={value as string}
              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
              required={field.required}
            />
            {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.id}
              placeholder={field.placeholder}
              value={value as string}
              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
              required={field.required}
              rows={4}
            />
            {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select
              value={value as string}
              onValueChange={(val) => setFormData({ ...formData, [field.id]: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder || "Select..."} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={value === true}
              onCheckedChange={(checked) => setFormData({ ...formData, [field.id]: checked })}
            />
            <Label htmlFor={field.id} className="text-sm font-normal">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
        );

      case 'radio':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <RadioGroup
              value={value as string}
              onValueChange={(val) => setFormData({ ...formData, [field.id]: val })}
            >
              {field.options?.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                  <Label htmlFor={`${field.id}-${option}`} className="font-normal">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
          </div>
        );

      case 'multiselect':
        return (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="space-y-2">
              {field.options?.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-${option}`}
                    checked={Array.isArray(value) && value.includes(option)}
                    onCheckedChange={(checked) => {
                      const currentValues = Array.isArray(value) ? value : [];
                      const newValues = checked
                        ? [...currentValues, option]
                        : currentValues.filter((v: string) => v !== option);
                      setFormData({ ...formData, [field.id]: newValues });
                    }}
                  />
                  <Label htmlFor={`${field.id}-${option}`} className="text-sm font-normal">
                    {option}
                  </Label>
                </div>
              ))}
            </div>
            {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Form not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
            <p className="text-muted-foreground">
              Your response has been recorded successfully.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{form.schema_json.title || form.title}</CardTitle>
            {form.schema_json.description && (
              <CardDescription>{form.schema_json.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {form.schema_json.fields.map(renderField)}
              
              {form.schema_json.settings?.consent_text && (
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    {form.schema_json.settings.consent_text}
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
