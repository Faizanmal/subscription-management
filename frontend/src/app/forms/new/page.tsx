"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
// DEPRECATED: formforge API client was removed. Forms feature needs migration to /api/v1 endpoints.
// import { formsApi, templatesApi } from "@/lib/api-client";
import type { FormTemplate } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NewFormPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [templates, setTemplates] = useState<FormTemplate[]>([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await templatesApi.list() as FormTemplate[];
        setTemplates(data);
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      }
    };
    fetchTemplates();
  }, []);

  const handleGenerateForm = async () => {
    if (!prompt.trim()) {
      toast.error("Please describe what form you need");
      return;
    }

    setLoading(true);
    try {
      const form = await formsApi.create({
        prompt: prompt.trim(),
        context: context.trim() || undefined,
      });

      toast.success("Form generated successfully!");
      router.push(`/forms/${form.id}/edit`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to generate form");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = async (templateId: string) => {
    setLoading(true);
    try {
      const form = await templatesApi.use(templateId);
      toast.success("Form created from template!");
      router.push(`/forms/${form.id}/edit`);
    } catch (error) {
      toast.error("Failed to create form from template");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const examplePrompts = [
    "Client intake for wedding photographer — ask about event date, location, estimated guest count, package interest, and deposit payment option",
    "Nutritionist client intake form with health goals, dietary restrictions, and consultation preferences",
    "Gym membership sign-up form with personal details, fitness goals, medical history, and payment options",
    "Real estate property inquiry form with budget, preferred locations, and property requirements",
    "Therapist new client intake with mental health history, current concerns, and insurance information",
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="mb-4"
        >
          ← Back to Dashboard
        </Button>
        <h1 className="text-4xl font-bold">Create New Form</h1>
        <p className="text-muted-foreground mt-2">
          Describe your form in plain English or start from a template
        </p>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generate">
            <Sparkles className="mr-2 h-4 w-4" />
            AI Generate
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="mr-2 h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Describe Your Form</CardTitle>
              <CardDescription>
                Tell us what information you need to collect and we&apos;ll generate a complete form for you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="prompt">What do you need?</Label>
                <Textarea
                  id="prompt"
                  placeholder="E.g., Create a client intake form for wedding photography..."
                  className="min-h-[120px] mt-2"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="context">Additional Context (Optional)</Label>
                <Input
                  id="context"
                  placeholder="E.g., photography, healthcare, fitness..."
                  className="mt-2"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  disabled={loading}
                />
              </div>

              <Button
                onClick={handleGenerateForm}
                disabled={loading || !prompt.trim()}
                size="lg"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Form with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example Prompts</CardTitle>
              <CardDescription>
                Click on any example to use it as a starting point
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {examplePrompts.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => setPrompt(example)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-accent hover:text-accent-foreground transition-colors"
                    disabled={loading}
                  >
                    <div className="text-sm">{example}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Form Templates</CardTitle>
              <CardDescription>
                Start with a pre-built template and customize it
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No templates available yet</p>
                  <p className="text-sm mt-2">Check back soon!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          onClick={() => handleUseTemplate(template.id)}
                          disabled={loading}
                          className="w-full"
                        >
                          Use Template
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
