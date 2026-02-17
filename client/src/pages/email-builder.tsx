import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmailEditor, { EditorRef, EmailEditorProps } from "react-email-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Download, Loader2, Eye, X, Mail } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EmailTemplate } from "@shared/schema";
import { sampleTemplates, loadSampleTemplate as loadSampleTemplateUtil, type SampleTemplate } from "@/templates/email-samples/sample-templates";

export default function EmailBuilderPage() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const emailEditorRef = useRef<EditorRef>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [showSampleTemplatesDialog, setShowSampleTemplatesDialog] = useState(false);
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  // Ref to track the current template ID reliably (avoids stale closure issues in mutation callbacks)
  const selectedTemplateRef = useRef<number | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testFromEmail, setTestFromEmail] = useState("");
  const [testSubject, setTestSubject] = useState("Test Email");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirmDialog, setShowExitConfirmDialog] = useState(false);
  const [shouldNavigateAfterSave, setShouldNavigateAfterSave] = useState(false);
  const [campaignContext, setCampaignContext] = useState<any>(null);
  const [editorReady, setEditorReady] = useState(false);

  // Keep the ref in sync with the state (for use in mutation callbacks)
  useEffect(() => {
    selectedTemplateRef.current = selectedTemplate;
  }, [selectedTemplate]);

  // Load campaign context from sessionStorage on mount
  useEffect(() => {
    const contextStr = sessionStorage.getItem('campaignContext');
    if (contextStr) {
      try {
        const context = JSON.parse(contextStr);
        setCampaignContext(context);
        // Set template name from campaign title if available
        if (context.campaignData?.title) {
          setTemplateName(context.campaignData.title);
        }
      } catch (error) {
        console.error('Failed to parse campaign context:', error);
      }
    }
  }, []);

  // Fetch templates for this website
  const { data: templates = [], isLoading: templatesLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates", websiteId],
    queryFn: async () => {
      const response = await fetch(`/api/email-templates/${websiteId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      return response.json();
    },
  });

  // Load template when both editor is ready and templates are fetched
  useEffect(() => {
    const templateIdToLoad = sessionStorage.getItem('loadTemplateId');
    if (templateIdToLoad && templates.length > 0 && editorReady && emailEditorRef.current?.editor) {
      const unlayer = emailEditorRef.current.editor;
      const template = templates.find(t => t.id === parseInt(templateIdToLoad));

      if (template) {
        try {
          // Check if design has actual content (rows array with items)
          let shouldUseHtmlFallback = false;

          if (template.design) {
            try {
              const design = JSON.parse(template.design);
              console.log("Loading template from sessionStorage:", {
                templateId: template.id,
                templateName: template.name,
                hasDesign: !!design,
                hasBody: !!design?.body,
                bodyKeys: design?.body ? Object.keys(design.body) : [],
                rowsLength: design?.body?.rows?.length
              });

              // Check if design has actual content rows
              const hasContent = design?.body?.rows?.length > 0;

              if (!hasContent) {
                console.log("Design has no rows, using HTML fallback");
                shouldUseHtmlFallback = true;
              } else {
                // Try loading design
                try {
                  unlayer.loadDesign(design);
                  setSelectedTemplate(template.id);
                  setTemplateName(template.name);
                  setTemplateCategory(template.category || "");
                  setHasUnsavedChanges(false);
                  sessionStorage.removeItem('loadTemplateId');
                  toast({
                    title: "Success",
                    description: `Template "${template.name}" loaded`,
                  });
                  return;
                } catch (loadError) {
                  console.warn("Failed to load design, trying HTML fallback:", loadError);
                  shouldUseHtmlFallback = true;
                }
              }
            } catch (designError) {
              console.warn("Design parse failed, trying HTML fallback:", designError);
              shouldUseHtmlFallback = true;
            }
          } else {
            shouldUseHtmlFallback = true;
          }

          // Use HTML fallback if design is invalid/empty or missing
          if (shouldUseHtmlFallback && template.html) {
            console.log("Loading template using HTML fallback from sessionStorage");
            unlayer.loadDesign({
              html: template.html,
              classic: true
            } as any);
            setSelectedTemplate(template.id);
            setTemplateName(template.name);
            setTemplateCategory(template.category || "");
            setHasUnsavedChanges(false);
            sessionStorage.removeItem('loadTemplateId');
            toast({
              title: "Success",
              description: `Template "${template.name}" loaded (using HTML)`,
            });
          } else if (!template.html) {
            throw new Error("Template has no design or HTML");
          }
        } catch (error) {
          console.error("Failed to load template:", error);
          sessionStorage.removeItem('loadTemplateId');
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to load template",
            variant: "destructive",
          });
        }
      } else {
        console.warn(`Template ${templateIdToLoad} not found`);
        sessionStorage.removeItem('loadTemplateId');
        toast({
          title: "Error",
          description: "Template not found",
          variant: "destructive",
        });
      }
    }
  }, [templates, editorReady, toast]);

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; html: string; design: string; thumbnail?: string; category?: string }) => {
      let response;
      // Use ref to get current template ID (avoids stale closure issues)
      const currentTemplateId = selectedTemplateRef.current;
      if (currentTemplateId) {
        // Update existing template
        response = await apiRequest("PATCH", `/api/email-templates/${currentTemplateId}`, data);
      } else {
        // Create new template
        response = await apiRequest("POST", "/api/email-templates", {
          ...data,
          websiteProgressId: Number(websiteId),
        });
      }
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save template');
      }
      // Return both the response and whether this was an update
      const result = await response.json();
      return { ...result, wasUpdate: !!currentTemplateId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates", websiteId] });

      // If coming from campaign wizard, save template ID and navigate back
      if (campaignContext) {
        sessionStorage.setItem('savedTemplateId', data.id.toString());
        sessionStorage.removeItem('campaignContext');
        toast({
          title: "Success",
          description: "Template saved! Returning to campaign...",
        });
        setShowSaveDialog(false);
        setHasUnsavedChanges(false);
        if (campaignContext.returnPath) {
          navigate(campaignContext.returnPath);
        } else {
          navigate(`/websites/${websiteId}?tab=newsletter`);
        }
      } else {
        // Normal template save flow - use wasUpdate from the mutation result
        toast({
          title: "Success",
          description: data.wasUpdate ? "Template updated successfully" : "Template saved successfully",
        });
        setShowSaveDialog(false);
        // After creating a new template, set it as the selected template so future saves are updates
        if (!data.wasUpdate && data?.id) {
          setSelectedTemplate(data.id);
        }
        // Don't clear template name/category - keep them so user can save again with same name
        // Name only gets cleared when user explicitly loads a different template or clicks "New Template"
        setHasUnsavedChanges(false);

        // Navigate if this was a "Save & Exit" action
        if (shouldNavigateAfterSave) {
          setShouldNavigateAfterSave(false);
          navigate(`/dashboard/website/${websiteId}`);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save template",
        variant: "destructive",
      });
    },
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: async (data: { toEmail: string; fromEmail: string; subject: string; html: string }) => {
      return apiRequest("POST", "/api/email-templates/send-test", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Test email sent successfully! Check your inbox.",
      });
      setShowTestEmailDialog(false);
      setTestEmail("");
      setTestFromEmail("");
      setTestSubject("Test Email");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      });
    },
  });

  const saveCampaignMutation = useMutation({
    mutationFn: async (data: {
      templateId: number;
      status: string;
      campaignData: any;
      websiteProgressId: number;
    }) => {
      const { templateId, status, campaignData, websiteProgressId } = data;

      if (campaignContext?.mode === 'edit' && campaignContext?.campaignId) {
        // Update existing campaign
        return apiRequest("PUT", `/api/newsletter/campaigns/${campaignContext.campaignId}`, {
          ...campaignData,
          templateId,
          status,
          websiteProgressId,
        });
      } else {
        // Create new campaign
        return apiRequest("POST", "/api/newsletter/campaigns", {
          websiteProgressId,
          title: campaignData.title || templateName,
          groupName: campaignData.groupName,
          senderName: campaignData.senderName,
          senderEmail: campaignData.senderEmail,
          subject: campaignData.subject,
          message: '',
          excludedSubscriberIds: campaignData.excludedSubscriberIds || [],
          templateId,
          status,
          scheduledFor: campaignData.scheduledFor || null,
        });
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate campaigns cache to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/campaigns"] });

      toast({
        title: "Success",
        description: variables.status === 'draft' ? "Campaign saved as draft" : "Campaign saved successfully",
      });
      sessionStorage.removeItem('campaignContext');
      sessionStorage.removeItem('loadTemplateId');
      if (campaignContext?.returnPath) {
        navigate(campaignContext.returnPath);
      } else {
        navigate(`/websites/${websiteId}?tab=newsletter`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save campaign",
        variant: "destructive",
      });
    },
  });

  const saveCampaignHtmlMutation = useMutation({
    mutationFn: async (data: {
      campaignId: number;
      emailHtml: string;
      emailDesign?: string;
      websiteProgressId: number;
    }) => {
      const payload: any = {
        emailHtml: data.emailHtml,
        websiteProgressId: data.websiteProgressId,
      };
      if (data.emailDesign) {
        payload.emailDesign = data.emailDesign;
      }
      const response = await apiRequest("POST", `/api/newsletter/campaigns/${data.campaignId}/save-html`, payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save campaign');
      }
      return response.json();
    },
    onSuccess: (updatedCampaign) => {
      // Invalidate both campaigns and templates to ensure UI updates
      // Use partial match to invalidate all campaign queries regardless of params
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "/api/newsletter/campaigns"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates", websiteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates-multi"] });

      setHasUnsavedChanges(false);

      toast({
        title: "✅ Saved to Campaign",
        description: `Email has been saved to ${campaignContext?.campaignName || 'campaign'}. A template has been created and attached.`,
      });

      // Clear session storage
      sessionStorage.removeItem('campaignContext');
      sessionStorage.removeItem('loadTemplateId');
      sessionStorage.removeItem('loadCampaignDesign');
      sessionStorage.removeItem('loadCampaignHtml');

      // Navigate back after a brief delay to show the success message
      setTimeout(() => {
        if (campaignContext?.returnPath) {
          navigate(campaignContext.returnPath);
        } else {
          navigate(`/websites/${websiteId}?tab=newsletter`);
        }
      }, 800);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save campaign email",
        variant: "destructive",
      });
    },
  });

  const onReady = (unlayer: any) => {
    // Editor is ready
    console.log("Unlayer editor is ready");
    setEditorReady(true);

    // Track design changes
    unlayer.addEventListener('design:updated', () => {
      setHasUnsavedChanges(true);
    });

    // Check if there's campaign design to load (preferred)
    const campaignDesign = sessionStorage.getItem('loadCampaignDesign');
    if (campaignDesign) {
      try {
        const design = JSON.parse(campaignDesign);
        unlayer.loadDesign(design);
        setHasUnsavedChanges(false);
        sessionStorage.removeItem('loadCampaignDesign');
        sessionStorage.removeItem('loadCampaignHtml'); // Also clear legacy HTML key if present
        toast({
          title: "Success",
          description: "Campaign email loaded",
        });
        return;
      } catch (error) {
        console.error("Failed to load campaign design:", error);
        sessionStorage.removeItem('loadCampaignDesign');
      }
    }

    // Fallback to legacy HTML for backward compatibility
    const campaignHtml = sessionStorage.getItem('loadCampaignHtml');
    if (campaignHtml) {
      try {
        // For legacy campaigns with only HTML, parse it as best we can
        unlayer.loadDesign({
          html: campaignHtml,
          classic: true
        });
        setHasUnsavedChanges(false);
        sessionStorage.removeItem('loadCampaignHtml');
        toast({
          title: "Success",
          description: "Campaign email loaded (legacy format - save to upgrade)",
        });
        return;
      } catch (error) {
        console.error("Failed to load campaign HTML:", error);
        sessionStorage.removeItem('loadCampaignHtml');
      }
    }

    // Template loading is now handled in useEffect to avoid race conditions
  };

  const saveDesign = () => {
    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) return;

    unlayer.exportHtml((data: { design: any; html: string }) => {
      const { design, html } = data;

      // Store design and HTML for saving
      (window as any).currentDesign = design;
      (window as any).currentHtml = html;

      // Export thumbnail image
      unlayer.exportImage((data: { design: any; url: string | null }) => {
        const { url } = data;
        (window as any).currentThumbnail = url;

        setShouldNavigateAfterSave(false);
        setShowSaveDialog(true);
      }, {
        width: 600,
        height: 400,
      });
    });
  };

  const handleSaveForCampaign = async () => {
    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) {
      toast({
        title: "Error",
        description: "Editor not ready",
        variant: "destructive",
      });
      return;
    }

    if (!campaignContext?.campaignId || !campaignContext?.websiteProgressId) {
      toast({
        title: "Error",
        description: "Campaign context is missing",
        variant: "destructive",
      });
      return;
    }

    // Export the current email design and HTML
    unlayer.exportHtml((data: { design: any; html: string }) => {
      const { design, html } = data;

      // Build the mutation data
      const mutationData: any = {
        campaignId: campaignContext.campaignId,
        emailHtml: html,
        websiteProgressId: campaignContext.websiteProgressId,
      };

      if (design) {
        mutationData.emailDesign = JSON.stringify(design);
      }

      // Save to campaign (this will auto-create/update a template and attach it)
      saveCampaignHtmlMutation.mutate(mutationData);
    });
  };

  const handleSaveTemplate = async (saveAsDraft = false) => {
    if (!templateName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a template name",
        variant: "destructive",
      });
      return;
    }

    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) {
      toast({
        title: "Error",
        description: "Editor not ready",
        variant: "destructive",
      });
      return;
    }

    // Always export fresh design and HTML right before saving
    // This ensures we have the latest state from the editor
    const { design, html, thumbnail } = await new Promise<{ design: any; html: string; thumbnail: string | null }>((resolve, reject) => {
      unlayer.exportHtml((data: { design: any; html: string }) => {
        const exportedDesign = data.design;
        const exportedHtml = data.html;

        // Export thumbnail
        unlayer.exportImage((imageData: { design: any; url: string | null }) => {
          resolve({
            design: exportedDesign,
            html: exportedHtml,
            thumbnail: imageData.url || null
          });
        }, {
          width: 600,
          height: 400,
        });
      });
    });

    // Ensure we have a valid design object (required by API)
    // If design is invalid, create a minimal one but still save the HTML
    let validDesign = design;
    if (!validDesign || typeof validDesign !== 'object' || !validDesign.body) {
      console.warn("Design is invalid, creating minimal design structure");
      validDesign = {
        counters: {},
        body: {
          id: undefined,
          rows: [],
          headers: [],
          footers: [],
          values: {}
        }
      };
    }

    // If we have campaign context, save template then save campaign
    if (campaignContext && campaignContext.campaignData) {
      try {
        const templateData = await saveTemplateMutation.mutateAsync({
          name: templateName,
          html: html,
          design: JSON.stringify(validDesign),
          thumbnail: thumbnail || undefined,
          category: templateCategory || undefined,
        });

        // Get the template ID from the response (or use existing one if updating)
        const templateId = selectedTemplate || templateData.id;

        // Close dialog and reset state
        setShowSaveDialog(false);
        // Don't clear template name/category - keep them for potential future saves
        // After creating new template, set it as selected so future saves are updates
        if (!selectedTemplateRef.current && templateData?.id) {
          setSelectedTemplate(templateData.id);
        }
        setHasUnsavedChanges(false);

        // Save the campaign with the template ID
        saveCampaignMutation.mutate({
          templateId,
          status: saveAsDraft ? 'draft' : (campaignContext.campaignData.scheduledFor ? 'scheduled' : 'draft'),
          campaignData: campaignContext.campaignData,
          websiteProgressId: Number(websiteId),
        });
      } catch (error) {
        console.error('Failed to save template and campaign:', error);
      }
    } else {
      // Just save the template normally
      saveTemplateMutation.mutate({
        name: templateName,
        html: html,
        design: JSON.stringify(validDesign),
        thumbnail: thumbnail || undefined,
        category: templateCategory || undefined,
      });
    }
  };

  const loadTemplate = (template: EmailTemplate) => {
    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) {
      toast({
        title: "Error",
        description: "Editor not ready",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check if design has actual content (rows array with items)
      let shouldUseHtmlFallback = false;

      if (template.design) {
        try {
          const design = JSON.parse(template.design);
          console.log("Loading template design:", {
            hasDesign: !!design,
            hasBody: !!design?.body,
            bodyKeys: design?.body ? Object.keys(design.body) : [],
            rowsLength: design?.body?.rows?.length
          });

          // Check if design has actual content rows
          const hasContent = design?.body?.rows?.length > 0;

          if (!hasContent) {
            console.log("Design has no rows, using HTML fallback");
            shouldUseHtmlFallback = true;
          } else {
            // Try loading design
            try {
              unlayer.loadDesign(design);
              setSelectedTemplate(template.id);
              setTemplateName(template.name);
              setTemplateCategory(template.category || "");
              setShowTemplatesDialog(false);
              setHasUnsavedChanges(false);
              toast({
                title: "Success",
                description: `Template "${template.name}" loaded successfully`,
              });
              return;
            } catch (loadError) {
              console.warn("Failed to load design, trying HTML fallback:", loadError);
              shouldUseHtmlFallback = true;
            }
          }
        } catch (designError) {
          console.warn("Design parse failed, trying HTML fallback:", designError);
          shouldUseHtmlFallback = true;
        }
      } else {
        shouldUseHtmlFallback = true;
      }

      // Use HTML fallback if design is invalid/empty or missing
      if (shouldUseHtmlFallback && template.html) {
        console.log("Loading template using HTML fallback");
        unlayer.loadDesign({
          html: template.html,
          classic: true
        } as any);
        setSelectedTemplate(template.id);
        setTemplateName(template.name);
        setTemplateCategory(template.category || "");
        setShowTemplatesDialog(false);
        setHasUnsavedChanges(false);
        toast({
          title: "Success",
          description: `Template "${template.name}" loaded (using HTML)`,
        });
      } else if (!template.html) {
        throw new Error("Template has no design or HTML");
      }
    } catch (error) {
      console.error("Failed to load template:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load template",
        variant: "destructive",
      });
    }
  };

  const loadSampleTemplate = async (template: SampleTemplate) => {
    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) {
      toast({
        title: "Error",
        description: "Editor not ready",
        variant: "destructive",
      });
      return;
    }

    try {
      const processedHtml = await loadSampleTemplateUtil(template);
      unlayer.loadDesign({
        html: processedHtml,
        classic: true
      } as any);

      // Wait for Unlayer to process the design, then export it for saving
      // Use multiple attempts to ensure Unlayer has fully converted HTML to design format
      const attemptExport = (attempt = 1, maxAttempts = 3) => {
        setTimeout(() => {
          unlayer.exportHtml((data: { design: any; html: string }) => {
            const { design, html } = data;
            console.log(`Export attempt ${attempt}:`, {
              hasDesign: !!design,
              hasBody: !!design?.body,
              rowsLength: design?.body?.rows?.length
            });

            // Check if we have a valid design with actual content rows
            const hasValidDesign = design &&
              typeof design === 'object' &&
              design.body &&
              design.body.rows?.length > 0;

            if (!hasValidDesign && attempt < maxAttempts) {
              // If design is still invalid, wait more and try again
              console.log(`Design still invalid, retrying (attempt ${attempt + 1}/${maxAttempts})`);
              attemptExport(attempt + 1, maxAttempts);
              return;
            }

            // Store design and HTML for saving via API
            // Even if design is empty, store it - we'll use HTML fallback when loading
            (window as any).currentDesign = design;
            (window as any).currentHtml = html;

            // Pre-fill template name and category from sample template
            setTemplateName(template.name);
            setTemplateCategory(template.category);
            setSelectedTemplate(null);
            setShowSampleTemplatesDialog(false);
            setHasUnsavedChanges(true); // Mark as having changes so user knows to save

            // Thumbnail will be generated when user saves the template (in saveDesign function)
            // No need to call exportImage here - it causes unnecessary API calls to Unlayer

            if (hasValidDesign) {
              toast({
                title: "Success",
                description: `Sample template "${template.name}" loaded. Click "Save Template" to save it via API.`,
              });
            } else {
              toast({
                title: "Success",
                description: `Sample template "${template.name}" loaded (will use HTML when saving). Click "Save Template" to save it via API.`,
              });
            }
          });
        }, attempt * 800); // Increasing delay: 800ms, 1600ms, 2400ms
      };

      attemptExport();
    } catch (error) {
      console.error("Failed to load sample template:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load sample template",
        variant: "destructive",
      });
    }
  };

  const exportHtml = () => {
    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) return;

    unlayer.exportHtml((data: { design: any; html: string }) => {
      const { html } = data;

      // Download HTML file
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateName || "email-template"}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "HTML exported successfully",
      });
    });
  };

  const previewEmail = () => {
    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) return;

    unlayer.exportHtml((data: { design: any; html: string }) => {
      const { html } = data;

      // Open preview in new window
      const previewWindow = window.open("", "_blank");
      if (previewWindow) {
        previewWindow.document.write(html);
        previewWindow.document.close();
      }
    });
  };

  const createNewTemplate = () => {
    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) return;

    // Load a minimal blank design
    unlayer.loadDesign({
      counters: {},
      body: {
        id: undefined,
        rows: [],
        headers: [],
        footers: [],
        values: {}
      }
    } as any);
    setSelectedTemplate(null);
    setTemplateName("");
    setTemplateCategory("");
    setHasUnsavedChanges(false);
    toast({
      title: "New Template",
      description: "Starting with a blank template",
    });
  };

  const sendTestEmail = () => {
    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) return;

    unlayer.exportHtml((data: { design: any; html: string }) => {
      const { html } = data;

      // Store HTML for sending
      sessionStorage.setItem('testEmailHtml', html);
      setShowTestEmailDialog(true);
    });
  };

  const handleSendTestEmail = () => {
    const html = sessionStorage.getItem('testEmailHtml');
    if (!html) {
      toast({
        title: "Error",
        description: "No email content found",
        variant: "destructive",
      });
      return;
    }

    if (!testEmail || !testFromEmail || !testSubject) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    sendTestEmailMutation.mutate({
      toEmail: testEmail,
      fromEmail: testFromEmail,
      subject: testSubject,
      html,
    });

    // Clear sessionStorage
    sessionStorage.removeItem('testEmailHtml');
  };

  const saveAndExit = () => {
    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) {
      navigate(`/dashboard/website/${websiteId}?tab=newsletter`);
      return;
    }

    unlayer.exportHtml((data: { design: any; html: string }) => {
      const { design, html } = data;

      // If we have a selected template and name, update it directly
      if (selectedTemplate && templateName) {
        saveTemplateMutation.mutate({
          name: templateName,
          html: html,
          design: JSON.stringify(design),
          category: templateCategory || undefined,
        }, {
          onSuccess: () => {
            navigate(`/dashboard/website/${websiteId}?tab=newsletter`);
          }
        });
      } else {
        // Otherwise, show save dialog and navigate after save
        (window as any).currentDesign = design;
        (window as any).currentHtml = html;
        setShouldNavigateAfterSave(true);
        setShowSaveDialog(true);
      }
    });
  };

  const handleExit = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirmDialog(true);
    } else {
      navigate(`/dashboard/website/${websiteId}?tab=newsletter`);
    }
  };

  const confirmExit = () => {
    setShowExitConfirmDialog(false);
    navigate(`/dashboard/website/${websiteId}?tab=newsletter`);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Campaign Context Banner - Only show when editing existing campaign */}
      {campaignContext && campaignContext.mode === 'edit' && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Editing email for campaign: <strong>{campaignContext.campaignName}</strong>
              </span>
              {selectedTemplate && templateName && (
                <span className="text-xs text-muted-foreground">
                  • Using template: {templateName}
                </span>
              )}
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${hasUnsavedChanges
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}>
              {hasUnsavedChanges ? 'Unsaved Changes' : 'All Changes Saved'}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExit}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="h-6 w-px bg-border" />
          <h1 className="text-lg font-semibold">Email Builder</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSampleTemplatesDialog(true)}
            data-testid="button-load-sample-template"
          >
            Load Base Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplatesDialog(true)}
            data-testid="button-load-template"
          >
            Load Saved Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={previewEmail}
            data-testid="button-preview"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={sendTestEmail}
            disabled={sendTestEmailMutation.isPending}
            data-testid="button-send-test"
          >
            {sendTestEmailMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Send Test
          </Button>

          {campaignContext ? (
            <Button
              size="sm"
              onClick={handleSaveForCampaign}
              disabled={saveCampaignHtmlMutation.isPending}
              data-testid="button-save-to-campaign"
            >
              {saveCampaignHtmlMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save to Campaign
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={saveDesign}
              disabled={saveTemplateMutation.isPending}
              data-testid="button-save"
            >
              {saveTemplateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Template
            </Button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <EmailEditor
          ref={emailEditorRef}
          onReady={onReady}
          minHeight="100%"
          data-testid="email-editor"
          options={{
            features: {
              textEditor: {
                spellChecker: true,
              },
            },
            tools: {
              social: {
                properties: {
                  icons: {
                    value: [
                      {
                        name: 'Facebook',
                        url: 'https://facebook.com',
                        icon: 'https://cdn.tools.unlayer.com/social/icons/circle-black/facebook.png'
                      },
                      {
                        name: 'Instagram',
                        url: 'https://instagram.com',
                        icon: 'https://cdn.tools.unlayer.com/social/icons/circle-black/instagram.png'
                      },
                      {
                        name: 'Twitter',
                        url: 'https://twitter.com',
                        icon: 'https://cdn.tools.unlayer.com/social/icons/circle-black/twitter.png'
                      },
                      {
                        name: 'LinkedIn',
                        url: 'https://linkedin.com',
                        icon: 'https://cdn.tools.unlayer.com/social/icons/circle-black/linkedin.png'
                      },
                      {
                        name: 'YouTube',
                        url: 'https://youtube.com',
                        icon: 'https://cdn.tools.unlayer.com/social/icons/circle-black/youtube.png'
                      },
                      {
                        name: 'Pinterest',
                        url: 'https://pinterest.com',
                        icon: 'https://cdn.tools.unlayer.com/social/icons/circle-black/pinterest.png'
                      }
                    ]
                  }
                }
              }
            }
          }}
        />
      </div>

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent data-testid="dialog-save-template">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? "Update Template" : "Save Template"}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate
                ? "Update the name and category for this template"
                : "Enter a name and optional category for your email template"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., Welcome Email, Newsletter Template"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-category">Category (Optional)</Label>
              <Input
                id="template-category"
                placeholder="e.g., Welcome, Promotional, Newsletter"
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                data-testid="input-template-category"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              data-testid="button-cancel-save"
            >
              Cancel
            </Button>
            {campaignContext && campaignContext.mode === 'edit' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleSaveTemplate(false)}
                  disabled={saveTemplateMutation.isPending || saveCampaignHtmlMutation.isPending}
                  data-testid="button-save-as-template"
                >
                  {saveTemplateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save as Template
                </Button>
                <Button
                  onClick={handleSaveForCampaign}
                  disabled={saveTemplateMutation.isPending || saveCampaignHtmlMutation.isPending}
                  data-testid="button-save-for-campaign"
                >
                  {saveCampaignHtmlMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save for {campaignContext.campaignName}
                </Button>
              </>
            ) : campaignContext && campaignContext.campaignData ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleSaveTemplate(true)}
                  disabled={saveTemplateMutation.isPending || saveCampaignMutation.isPending}
                  data-testid="button-save-draft"
                >
                  {(saveTemplateMutation.isPending || saveCampaignMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save as Draft
                </Button>
                <Button
                  onClick={() => handleSaveTemplate(false)}
                  disabled={saveTemplateMutation.isPending || saveCampaignMutation.isPending}
                  data-testid="button-save-campaign"
                >
                  {(saveTemplateMutation.isPending || saveCampaignMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save Campaign
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleSaveTemplate(false)}
                disabled={saveTemplateMutation.isPending}
                data-testid="button-confirm-save"
              >
                {saveTemplateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {selectedTemplate ? "Update" : "Save"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Templates Dialog */}
      <Dialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-load-template">
          <DialogHeader>
            <DialogTitle>Load Template</DialogTitle>
            <DialogDescription>
              Select a template to load into the editor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {templatesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No templates saved yet. Create your first template!
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 border rounded-lg hover:border-primary cursor-pointer transition-colors"
                  onClick={() => loadTemplate(template)}
                  data-testid={`template-${template.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{template.name}</h3>
                      {template.category && (
                        <p className="text-sm text-muted-foreground">
                          {template.category}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Last updated: {new Date(template.updatedAt!).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Sample Templates Dialog */}
      <Dialog open={showSampleTemplatesDialog} onOpenChange={setShowSampleTemplatesDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-load-sample-template">
          <DialogHeader>
            <DialogTitle>Load Sample Template</DialogTitle>
            <DialogDescription>
              Select a sample template to load into the editor as a starting point
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sampleTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sample templates available.
              </div>
            ) : (
              sampleTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 border rounded-lg hover:border-primary cursor-pointer transition-colors"
                  onClick={() => loadSampleTemplate(template)}
                  data-testid={`sample-template-${template.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{template.name}</h3>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Sample
                        </span>
                      </div>
                      {template.category && (
                        <p className="text-sm text-muted-foreground">
                          {template.category}
                        </p>
                      )}
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const previewWindow = window.open("", "_blank");
                        if (previewWindow) {
                          fetch(template.htmlPath)
                            .then(res => res.text())
                            .then(html => {
                              // Images are now on Cloudinary, so no path replacement needed
                              // Only replace local image paths if they exist (for backward compatibility)
                              const templatePath = template.htmlPath.replace("/template.html", "");
                              const processedHtml = html
                                // Only replace relative image paths, not full URLs (Cloudinary)
                                .replace(/src=(["'])(images\/[^"']+)\1/g, (match, quote, imagePath) => {
                                  // Skip if already a full URL (Cloudinary)
                                  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                                    return match;
                                  }
                                  return `src=${quote}${templatePath}/${imagePath}${quote}`;
                                })
                                .replace(/url\((['"]?)(images\/[^"')]+)\1\)/g, (match, quote, imagePath) => {
                                  // Skip if already a full URL (Cloudinary)
                                  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                                    return match;
                                  }
                                  return `url(${quote}${templatePath}/${imagePath}${quote})`;
                                })
                                .replace(/background-image:\s*url\((['"]?)(images\/[^"')]+)\1\)/g, (match, quote, imagePath) => {
                                  // Skip if already a full URL (Cloudinary)
                                  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                                    return match;
                                  }
                                  return `background-image: url(${quote}${templatePath}/${imagePath}${quote})`;
                                });
                              previewWindow.document.write(processedHtml);
                              previewWindow.document.close();
                            })
                            .catch(err => {
                              console.error("Failed to preview template:", err);
                            });
                        }
                      }}
                      data-testid={`preview-sample-${template.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Test Email Dialog */}
      <Dialog open={showTestEmailDialog} onOpenChange={setShowTestEmailDialog}>
        <DialogContent data-testid="dialog-send-test-email">
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test version of this email to verify how it looks
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Recipient Email</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="your@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                data-testid="input-test-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from-email">From Email (must be verified in AWS SES)</Label>
              <Input
                id="from-email"
                type="email"
                placeholder="noreply@yourdomain.com"
                value={testFromEmail}
                onChange={(e) => setTestFromEmail(e.target.value)}
                data-testid="input-from-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-subject">Subject</Label>
              <Input
                id="test-subject"
                type="text"
                placeholder="Test Email"
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
                data-testid="input-test-subject"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTestEmailDialog(false)}
              data-testid="button-cancel-test"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendTestEmail}
              disabled={sendTestEmailMutation.isPending}
              data-testid="button-confirm-send-test"
            >
              {sendTestEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Test Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitConfirmDialog} onOpenChange={setShowExitConfirmDialog}>
        <DialogContent data-testid="dialog-exit-confirm">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to exit without saving?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExitConfirmDialog(false)}
              data-testid="button-cancel-exit"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmExit}
              data-testid="button-confirm-exit"
            >
              Exit Without Saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
