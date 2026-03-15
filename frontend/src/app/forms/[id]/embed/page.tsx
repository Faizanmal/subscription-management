"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
// DEPRECATED: formforge API client was removed. Forms feature needs migration to /api/v1 endpoints.
// import { formsApi } from "@/lib/api-client";
import type { Form } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Code, Copy, ExternalLink, Globe, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function FormEmbedPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;

  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const loadForm = useCallback(async () => {
    try {
      const data = await formsApi.get(formId);
      setForm(data);
    } catch {
      toast.error("Failed to load form");
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const hostedUrl = form ? `${window.location.origin}/form/${form.slug}` : "";
  
  const iframeCode = form
    ? `<iframe src="${hostedUrl}" width="100%" height="600" frameborder="0" style="border: 1px solid #e5e7eb; border-radius: 8px;"></iframe>`
    : "";

  const embedJsCode = form
    ? `<div id="formforge-${form.slug}"></div>
<script src="${window.location.origin}/embed.js"></script>
<script>
  FormForge.embed({
    formId: '${form.id}',
    slug: '${form.slug}',
    container: '#formforge-${form.slug}',
    theme: 'light', // or 'dark'
    onSubmit: function(data) {
      console.log('Form submitted:', data);
    }
  });
</script>`
    : "";

  const popupCode = form
    ? `<button onclick="openFormForgePopup()">Fill Out Form</button>

<script src="${window.location.origin}/embed.js"></script>
<script>
  function openFormForgePopup() {
    FormForge.popup({
      formId: '${form.id}',
      slug: '${form.slug}',
      width: 600,
      height: 700
    });
  }
</script>`
    : "";

  const reactCode = form
    ? `import { useEffect } from 'react';

export default function MyFormComponent() {
  useEffect(() => {
    // Load FormForge embed script
    const script = document.createElement('script');
    script.src = '${window.location.origin}/embed.js';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      window.FormForge.embed({
        formId: '${form.id}',
        slug: '${form.slug}',
        container: '#formforge-container',
        theme: 'light',
        onSubmit: (data) => {
          console.log('Form submitted:', data);
        }
      });
    };

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return <div id="formforge-container"></div>;
}`
    : "";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading embed options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push("/dashboard")}>
          ← Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold mt-2">{form?.title}</h1>
        <p className="text-muted-foreground">Embed Options & Sharing</p>
      </div>

      {/* Hosted Link */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Globe className="mr-2 h-5 w-5" />
            Hosted Form Link
          </CardTitle>
          <CardDescription>
            Share this direct link to your form
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={hostedUrl} readOnly className="flex-1 font-mono text-sm" />
            <Button
              variant="outline"
              onClick={() => copyToClipboard(hostedUrl, "Link")}
            >
              {copied === "Link" ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(hostedUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Embed Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Code className="mr-2 h-5 w-5" />
            Embed Code
          </CardTitle>
          <CardDescription>
            Choose how to embed this form on your website
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="iframe" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="iframe">iFrame</TabsTrigger>
              <TabsTrigger value="embed">Embed.js</TabsTrigger>
              <TabsTrigger value="popup">Popup</TabsTrigger>
              <TabsTrigger value="react">React</TabsTrigger>
            </TabsList>

            {/* iFrame Tab */}
            <TabsContent value="iframe" className="space-y-4 mt-4">
              <div>
                <Label>iFrame Embed Code</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Simple iframe embed. Works everywhere but may have height limitations.
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                    <code>{iframeCode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(iframeCode, "iFrame code")}
                  >
                    {copied === "iFrame code" ? (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    Copy
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-900">
                  <strong>Pro Tip:</strong> Adjust the <code>height</code> attribute based on your form length.
                  For dynamic height, use the Embed.js option instead.
                </p>
              </div>
            </TabsContent>

            {/* Embed.js Tab */}
            <TabsContent value="embed" className="space-y-4 mt-4">
              <div>
                <Label>JavaScript Embed Code</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Recommended method. Provides automatic height adjustment and custom theming.
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                    <code>{embedJsCode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(embedJsCode, "Embed.js code")}
                  >
                    {copied === "Embed.js code" ? (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    Copy
                  </Button>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-900">
                  <strong>Features:</strong> Auto-height, custom themes, submission callbacks, responsive design
                </p>
              </div>
            </TabsContent>

            {/* Popup Tab */}
            <TabsContent value="popup" className="space-y-4 mt-4">
              <div>
                <Label>Popup Modal Code</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Open your form in a lightbox/modal popup when users click a button.
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                    <code>{popupCode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(popupCode, "Popup code")}
                  >
                    {copied === "Popup code" ? (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    Copy
                  </Button>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
                <p className="text-sm text-purple-900">
                  <strong>Use Case:</strong> Perfect for newsletter signups, contact forms, or lead generation without leaving the page.
                </p>
              </div>
            </TabsContent>

            {/* React Tab */}
            <TabsContent value="react" className="space-y-4 mt-4">
              <div>
                <Label>React Component Code</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Integrate into React/Next.js applications with this component example.
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                    <code>{reactCode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(reactCode, "React code")}
                  >
                    {copied === "React code" ? (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    Copy
                  </Button>
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
                <p className="text-sm text-orange-900">
                  <strong>TypeScript:</strong> Add type definitions for <code>window.FormForge</code> in your <code>global.d.ts</code>
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>See how your form looks when embedded</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <iframe
              src={hostedUrl}
              width="100%"
              height="600"
              frameBorder="0"
              style={{ border: 'none' }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
