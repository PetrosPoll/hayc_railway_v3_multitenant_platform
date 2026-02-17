import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Mail, Users, Eye, Send, Check, Tag as TagIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const campaignFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  purpose: z.string().optional(),
  tagIds: z.array(z.number()).default([]),
  excludedTagIds: z.array(z.number()).default([]),
  subject: z.string().min(1, 'Subject is required'),
  senderName: z.string().min(1, 'Sender name is required'),
  senderEmail: z.string().email('Valid email is required').min(1, 'Sender email is required'),
  message: z.string().optional(),
  templateId: z.number().optional(),
  scheduledFor: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

interface AdminCampaignWizardProps {
  open: boolean;
  onClose: () => void;
  editingCampaign?: any;
  onSuccess: () => void;
}

export function AdminCampaignWizard({ 
  open, 
  onClose, 
  editingCampaign,
  onSuccess 
}: AdminCampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Scheduling state
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [schedulePreset, setSchedulePreset] = useState<string>('');
  const [customDays, setCustomDays] = useState<number>(0);
  const [customHours, setCustomHours] = useState<number>(0);
  const [customMinutes, setCustomMinutes] = useState<number>(0);

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      title: editingCampaign?.title || '',
      description: editingCampaign?.description || '',
      purpose: editingCampaign?.purpose || '',
      tagIds: editingCampaign?.tagIds || [],
      excludedTagIds: editingCampaign?.excludedTagIds || editingCampaign?.excluded_tag_ids || [],
      subject: editingCampaign?.subject || '',
      senderName: editingCampaign?.senderName || '',
      senderEmail: editingCampaign?.senderEmail || '',
      message: editingCampaign?.message || '',
      templateId: editingCampaign?.templateId || undefined,
      scheduledFor: editingCampaign?.scheduledFor || '',
    },
  });

  // Check if returning from email builder with a new template
  useEffect(() => {
    if (open) {
      const savedTemplateId = sessionStorage.getItem('savedTemplateId');
      if (savedTemplateId) {
        form.setValue('templateId', parseInt(savedTemplateId));
        setCurrentStep(2); // Go to template selection step
        sessionStorage.removeItem('savedTemplateId');
      }
    }
  }, [open, form]);

  // Fetch admin tags
  const { data: tags = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/tags"],
    queryFn: async () => {
      const response = await fetch("/api/admin/tags", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tags");
      }
      return response.json();
    },
    enabled: open,
  });

  // Fetch admin templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery<any[]>({
    queryKey: ["/api/admin/templates"],
    queryFn: async () => {
      console.log('[AdminCampaignWizard] Fetching admin templates');
      const response = await fetch(`/api/admin/templates`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      const data = await response.json();
      console.log('[AdminCampaignWizard] Fetched templates:', data.length, data);
      return data;
    },
    enabled: open,
  });

  // Log templates when they change
  useEffect(() => {
    if (templates) {
      console.log('[AdminCampaignWizard] Templates updated:', templates.length, templates);
    }
  }, [templates]);

  // Reset form when editing campaign changes or dialog opens
  useEffect(() => {
    if (open) {
      // Handle both camelCase and snake_case field names from API
      const campaignTagIds = editingCampaign?.tagIds || editingCampaign?.tag_ids || [];
      const campaignExcludedTagIds = editingCampaign?.excludedTagIds || editingCampaign?.excluded_tag_ids || [];
      const campaignSenderName = editingCampaign?.senderName || editingCampaign?.sender_name || '';
      const campaignSenderEmail = editingCampaign?.senderEmail || editingCampaign?.sender_email || '';
      const campaignTemplateId = editingCampaign?.templateId || editingCampaign?.template_id;
      const campaignScheduledFor = editingCampaign?.scheduledFor || editingCampaign?.scheduled_for || '';
      
      console.log('[AdminCampaignWizard] Editing campaign:', { id: editingCampaign?.id, title: editingCampaign?.title, tagIds: campaignTagIds, excludedTagIds: campaignExcludedTagIds });
      
      form.reset({
        title: editingCampaign?.title || '',
        description: editingCampaign?.description || '',
        purpose: editingCampaign?.purpose || '',
        tagIds: Array.isArray(campaignTagIds) ? campaignTagIds : [],
        excludedTagIds: Array.isArray(campaignExcludedTagIds) ? campaignExcludedTagIds : [],
        subject: editingCampaign?.subject || '',
        senderName: campaignSenderName,
        senderEmail: campaignSenderEmail,
        message: editingCampaign?.message || '',
        templateId: campaignTemplateId ? parseInt(campaignTemplateId.toString()) : undefined,
        scheduledFor: campaignScheduledFor ? (typeof campaignScheduledFor === 'string' ? campaignScheduledFor : new Date(campaignScheduledFor).toISOString()) : '',
      });
      
      console.log('[AdminCampaignWizard] Form reset with tagIds:', form.getValues('tagIds'));
      
      // Initialize scheduling state from existing campaign
      if (campaignScheduledFor) {
        setScheduleType('later');
      } else {
        setScheduleType('now');
      }
      
      // Reset custom duration inputs
      setSchedulePreset('');
      setCustomDays(0);
      setCustomHours(0);
      setCustomMinutes(0);
      
      if (campaignTemplateId && templates.length > 0) {
        setSelectedTemplate(templates.find(t => t.id === parseInt(campaignTemplateId.toString())) || null);
      } else {
        setSelectedTemplate(null);
      }
      
      setCurrentStep(1);
    } else {
      // Reset scheduling state when dialog closes
      setScheduleType('now');
      setSchedulePreset('');
      setCustomDays(0);
      setCustomHours(0);
      setCustomMinutes(0);
    }
  }, [open, editingCampaign, form, templates]);

  // Watch selected tags and excluded tags
  const selectedTagIds = form.watch('tagIds') || [];
  const excludedTagIds = form.watch('excludedTagIds') || [];

  // Fetch admin contacts for the selected tags (or all contacts if no tags selected)
  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: [`/api/admin/contacts`, { tagIds: selectedTagIds }],
    queryFn: async () => {
      const params = new URLSearchParams();
      // Only add tagIds if some are selected
      if (selectedTagIds.length > 0) {
        selectedTagIds.forEach(id => params.append('tagIds', id.toString()));
      }
      const response = await fetch(`/api/admin/contacts?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error('Failed to fetch contacts');
      return response.json();
    },
    enabled: open,
  });

  // Helper function to get tag IDs from contact's tags array
  const getContactTagIds = (contact: any): number[] => {
    if (!contact.tags || !Array.isArray(contact.tags)) return [];
    return contact.tags.map((t: any) => t.id).filter((id: number) => id != null);
  };

  // Filter contacts based on excluded tags
  const activeContacts = contacts.filter(c => {
    // Filter by status first
    if (c.status !== 'active' && c.status !== 'confirmed' && c.status !== 'pending') {
      return false;
    }
    // Filter out contacts that have any excluded tags
    if (excludedTagIds.length > 0) {
      const contactTagIds = getContactTagIds(c);
      const hasExcludedTag = contactTagIds.some((tagId: number) => excludedTagIds.includes(tagId));
      if (hasExcludedTag) return false;
    }
    return true;
  });

  // Get contacts that are being excluded (for preview)
  const excludedContacts = contacts.filter(c => {
    if (c.status !== 'active' && c.status !== 'confirmed' && c.status !== 'pending') {
      return false;
    }
    if (excludedTagIds.length > 0) {
      const contactTagIds = getContactTagIds(c);
      return contactTagIds.some((tagId: number) => excludedTagIds.includes(tagId));
    }
    return false;
  });

  const steps = [
    { number: 1, title: "Campaign Details", icon: Mail },
    { number: 2, title: "Email Design", icon: Eye },
    { number: 3, title: "Recipients", icon: Users },
    { number: 4, title: "Review & Send", icon: Send },
  ];

  const handleNext = async (e?: React.MouseEvent) => {
     e?.preventDefault();
    // Validate current step before moving forward
    let fieldsToValidate: (keyof CampaignFormData)[] = [];

    if (currentStep === 1) {
      fieldsToValidate = ['title', 'subject', 'senderName', 'senderEmail'];
    } else if (currentStep === 2) {
      // Step 2: Must have a template selected
      const templateId = form.getValues('templateId');
      if (!templateId) {
        toast({
          title: 'Template required',
          description: 'Please select an email template before continuing',
          variant: 'destructive',
        });
        return;
      }
    }

    // Trigger validation for the current step's fields
    const isValid = await form.trigger(fieldsToValidate);

    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    form.setValue('templateId', template.id);
  };

  // Helper function to update custom schedule
  const updateCustomSchedule = (days: number, hours: number, minutes: number) => {
    const totalMinutes = (days * 24 * 60) + (hours * 60) + minutes;
    if (totalMinutes > 0) {
      const scheduledTime = new Date(Date.now() + totalMinutes * 60 * 1000);
      form.setValue('scheduledFor', scheduledTime.toISOString());
    } else {
      form.setValue('scheduledFor', '');
    }
  };

  const handleSubmit = async (data: CampaignFormData) => {
    // Extra safeguard: only submit if we're on step 4
    if (currentStep !== 4) {
      return;
    }

    // Ensure template is selected
    if (!data.templateId) {
      toast({
        title: 'Template required',
        description: 'Please select an email template before sending the campaign',
        variant: 'destructive',
      });
      return;
    }

    // Validate scheduling: if "Schedule for later" is selected, must have a time set
    if (scheduleType === 'later' && !data.scheduledFor) {
      toast({
        title: 'Schedule time required',
        description: 'Please select a time to schedule the campaign or choose "Send Now"',
        variant: 'destructive',
      });
      return;
    }

    try {
      const url = editingCampaign 
        ? `/api/admin/newsletter/campaigns/${editingCampaign.id}` 
        : '/api/admin/newsletter/campaigns';

      const method = editingCampaign ? 'PUT' : 'POST';
      
      // Set status to 'scheduled' if scheduledFor is provided, otherwise 'draft'
      const status = data.scheduledFor ? 'scheduled' : 'draft';
      
      const response = await apiRequest(method, url, {
        ...data,
        status,
      });

      if (response.ok) {
        toast({
          title: editingCampaign ? 'Campaign updated' : 'Campaign created',
          description: editingCampaign ? 'Campaign has been updated successfully' : 'Campaign has been created successfully',
        });
        onSuccess();
        onClose();
        form.reset();
        setCurrentStep(1);
        setSelectedTemplate(null);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save campaign',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingCampaign
              ? t("dashboard.campaigns.wizard.editTitle")
              : t("dashboard.campaigns.wizard.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {editingCampaign
              ? t("dashboard.campaigns.wizard.editDescription")
              : t("dashboard.campaigns.wizard.createDescription")}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;

            return (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center mb-2
                      ${isActive ? 'bg-primary text-primary-foreground' : ''}
                      ${isCompleted ? 'bg-green-500 text-white' : ''}
                      ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                    `}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs text-center ${isActive ? 'font-semibold' : ''}`}>
                    {t(`dashboard.campaigns.wizard.steps.${step.number}`)}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(handleSubmit)} 
            onKeyDown={(e) => {
              // Prevent Enter key from submitting the form unless it's the submit button
              if (e.key === 'Enter' && !(e.target as HTMLElement).closest('button[type="submit"]')) {
                e.preventDefault();
              }
            }}
            className="space-y-6"
          >
            {/* Step 1: Campaign Details */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("dashboard.campaigns.wizard.fields.title")}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t("dashboard.campaigns.wizard.placeholders.title")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tagIds"
                  render={() => (
                    <FormItem>
                      <FormLabel>
                        {t("dashboard.campaigns.wizard.fields.tags")}{" "}
                        <span className="text-xs text-muted-foreground font-normal">
                          ({t("dashboard.campaigns.wizard.hints.selectMultiple")})
                        </span>
                      </FormLabel>
                      <div className="border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto">
                        {tags.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {t("dashboard.campaigns.wizard.messages.noTags")}
                          </p>
                        ) : (
                          tags.map((tag: any) => (
                            <FormField
                              key={tag.id}
                              control={form.control}
                              name="tagIds"
                              render={({ field }) => (
                                <FormItem
                                  className="flex flex-row items-center space-x-3 space-y-0 p-2 rounded-md hover:bg-accent"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(tag.id)}
                                      onCheckedChange={(checked) => {
                                        const currentValue = field.value || [];
                                        field.onChange(
                                          checked
                                            ? [...currentValue, tag.id]
                                            : currentValue.filter((id: number) => id !== tag.id)
                                        );
                                      }}
                                      data-testid={`checkbox-tag-${tag.id}`}
                                    />
                                  </FormControl>
                                  <div className="flex-1 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <TagIcon className="h-3 w-3" style={{ color: tag.color || "#888" }} />
                                      <FormLabel className="text-sm font-normal cursor-pointer">
                                        {tag.name} ({tag.contactCount || 0})
                                        {tag.isSystem && (
                                          <Badge variant="outline" className="ml-2 text-xs">
                                            {t("dashboard.campaigns.wizard.system")}
                                          </Badge>
                                        )}
                                      </FormLabel>
                                    </div>
                                    {tag.description && (
                                      <p className="text-xs text-muted-foreground">{tag.description}</p>
                                    )}
                                  </div>
                                </FormItem>
                              )}
                            />
                          ))
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("dashboard.campaigns.wizard.fields.subject")}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t("dashboard.campaigns.wizard.placeholders.subject")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="senderName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("dashboard.campaigns.wizard.fields.senderName")}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t("dashboard.campaigns.wizard.placeholders.senderName")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="senderEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("dashboard.campaigns.wizard.fields.senderEmail")}</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="hello@yourcompany.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("dashboard.campaigns.wizard.fields.description")}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={t("dashboard.campaigns.wizard.placeholders.description")}
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}


            {/* Step 2: Email Design */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {t("dashboard.campaigns.wizard.design.title")}{" "}
                    <span className="text-destructive">*</span>
                  </h3>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {t("dashboard.campaigns.wizard.design.description", { count: templates.length })}
                </p>

                {isLoadingTemplates ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Mail className="h-12 w-12 text-muted-foreground mb-4 animate-pulse" />
                      <p className="text-muted-foreground text-center">
                        {t("dashboard.campaigns.wizard.design.loading")}
                      </p>
                    </CardContent>
                  </Card>
                ) : templates.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground text-center mb-4">
                        {t("dashboard.campaigns.wizard.design.noTemplates")}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {templates.map((template: any) => (
                      <Card
                        key={template.id}
                        className={`cursor-pointer transition-all ${
                          selectedTemplate?.id === template.id
                            ? "ring-2 ring-primary"
                            : "hover:shadow-md"
                        }`}
                        onClick={() => handleSelectTemplate(template)}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base">{template.name}</CardTitle>
                              {template.description && (
                                <CardDescription className="text-sm mt-1">
                                  {template.description}
                                </CardDescription>
                              )}
                            </div>
                            {selectedTemplate?.id === template.id && (
                              <Badge className="ml-2">
                                {t("dashboard.campaigns.wizard.design.selected")}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
                            {template.thumbnail ? (
                              <img
                                src={template.thumbnail}
                                alt={template.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Mail className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Recipients */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("dashboard.campaigns.wizard.recipients.title")}</CardTitle>
                    <CardDescription>
                      {t("dashboard.campaigns.wizard.recipients.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium mb-2">
                            {t("dashboard.campaigns.wizard.recipients.selectedTags")}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {selectedTagIds.length === 0 ? (
                              <span className="text-sm text-muted-foreground">
                                {t("dashboard.campaigns.wizard.recipients.noTagsSelected")}
                              </span>
                            ) : (
                              tags
                                .filter((t: any) => selectedTagIds.includes(t.id))
                                .map((tag: any) => (
                                  <Badge
                                    key={tag.id}
                                    style={{ borderColor: tag.color, color: tag.color }}
                                  >
                                    <TagIcon className="h-3 w-3 mr-1" />
                                    {tag.name}
                                  </Badge>
                                ))
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-lg px-4 py-1">
                          {activeContacts.length} {t("dashboard.campaigns.wizard.recipients.count")}
                        </Badge>
                      </div>

                      {activeContacts.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">
                            {t("dashboard.campaigns.wizard.recipients.listTitle")}
                          </p>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {activeContacts.map((contact: any) => (
                              <div
                                key={contact.id}
                                className="text-sm p-2 bg-muted/50 rounded flex items-center justify-between"
                              >
                                <span>{contact.email}</span>
                                <span className="text-xs text-muted-foreground">
                                  {contact.name || t("dashboard.campaigns.wizard.recipients.noName")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeContacts.length === 0 && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            {t("dashboard.campaigns.wizard.recipients.noContacts")}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Exclude Tags Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TagIcon className="h-5 w-5 text-destructive" />
                      Exclude by Tags
                    </CardTitle>
                    <CardDescription>
                      Select tags to exclude. Contacts with any of these tags will not receive this campaign.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="excludedTagIds"
                      render={() => (
                        <FormItem>
                          <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                            {tags.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No tags available
                              </p>
                            ) : (
                              tags.map((tag: any) => (
                                <FormField
                                  key={tag.id}
                                  control={form.control}
                                  name="excludedTagIds"
                                  render={({ field }) => (
                                    <FormItem
                                      className="flex flex-row items-center space-x-3 space-y-0 p-2 rounded-md hover:bg-accent"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(tag.id)}
                                          onCheckedChange={(checked) => {
                                            const currentValue = field.value || [];
                                            field.onChange(
                                              checked
                                                ? [...currentValue, tag.id]
                                                : currentValue.filter((id: number) => id !== tag.id)
                                            );
                                          }}
                                          data-testid={`checkbox-exclude-tag-${tag.id}`}
                                        />
                                      </FormControl>
                                      <div className="flex-1 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <TagIcon className="h-3 w-3" style={{ color: tag.color || "#888" }} />
                                          <FormLabel className="text-sm font-normal cursor-pointer">
                                            {tag.name} ({tag.contactCount || 0})
                                          </FormLabel>
                                        </div>
                                      </div>
                                    </FormItem>
                                  )}
                                />
                              ))
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Show excluded tags summary */}
                    {excludedTagIds.length > 0 && (
                      <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                          Excluding contacts with these tags:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {tags
                            .filter((t: any) => excludedTagIds.includes(t.id))
                            .map((tag: any) => (
                              <Badge
                                key={tag.id}
                                variant="destructive"
                                className="text-xs"
                              >
                                <TagIcon className="h-3 w-3 mr-1" />
                                {tag.name}
                              </Badge>
                            ))}
                        </div>
                        <p className="text-xs text-red-600 dark:text-red-300 mt-2">
                          {excludedContacts.length} contact(s) will be excluded from this campaign
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 4: Review & Send */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("dashboard.campaigns.wizard.review.title")}</CardTitle>
                    <CardDescription>
                      {t("dashboard.campaigns.wizard.review.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {t("dashboard.campaigns.wizard.review.fields.title")}
                        </p>
                        <p className="font-medium">{form.getValues("title")}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {t("dashboard.campaigns.wizard.review.fields.tags")}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {tags
                            .filter((t: any) => selectedTagIds.includes(t.id))
                            .map((tag: any) => (
                              <Badge key={tag.id} variant="secondary">
                                {tag.name}
                              </Badge>
                            ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {t("dashboard.campaigns.wizard.review.fields.subject")}
                        </p>
                        <p className="font-medium">{form.getValues("subject")}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {t("dashboard.campaigns.wizard.review.fields.recipients")}
                        </p>
                        <p className="font-medium">
                          {activeContacts.length} {t("dashboard.campaigns.wizard.recipients.count")}
                          {excludedContacts.length > 0 && (
                            <span className="text-sm text-muted-foreground ml-1">
                              ({excludedContacts.length} excluded)
                            </span>
                          )}
                        </p>
                      </div>
                      {excludedTagIds.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">
                            Excluded Tags
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {tags
                              .filter((t: any) => excludedTagIds.includes(t.id))
                              .map((tag: any) => (
                                <Badge key={tag.id} variant="destructive" className="text-xs">
                                  {tag.name}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {t("dashboard.campaigns.wizard.review.fields.template")}
                        </p>
                        <p className="font-medium">
                          {selectedTemplate?.name || t("dashboard.campaigns.wizard.review.plainText")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {t("dashboard.campaigns.wizard.review.fields.sender")}
                        </p>
                        <p className="font-medium">
                          {form.getValues("senderName") || t("dashboard.campaigns.wizard.review.default")}
                          {form.getValues("senderEmail") &&
                            ` (${form.getValues("senderEmail")})`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Scheduling Options */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("dashboard.campaigns.wizard.schedule.title")}</CardTitle>
                    <CardDescription>{t("dashboard.campaigns.wizard.schedule.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Send Now or Later */}
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant={scheduleType === 'now' ? 'default' : 'outline'}
                        onClick={() => {
                          setScheduleType('now');
                          form.setValue('scheduledFor', '');
                        }}
                        className="flex-1"
                      >
                        {t("dashboard.campaigns.wizard.schedule.sendNow")}
                      </Button>
                      <Button
                        type="button"
                        variant={scheduleType === 'later' ? 'default' : 'outline'}
                        onClick={() => setScheduleType('later')}
                        className="flex-1"
                      >
                        {t("dashboard.campaigns.wizard.schedule.scheduleLater")}
                      </Button>
                    </div>

                    {/* Schedule Options */}
                    {scheduleType === 'later' && (
                      <div className="space-y-4">
                        {/* Quick Presets */}
                        <div>
                          <p className="text-sm font-medium mb-2">
                            {t("dashboard.campaigns.wizard.schedule.quickSchedule")}
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: t("dashboard.campaigns.wizard.schedule.presets.30min"), minutes: 30 },
                              { label: t("dashboard.campaigns.wizard.schedule.presets.1hour"), minutes: 60 },
                              { label: t("dashboard.campaigns.wizard.schedule.presets.2hours"), minutes: 120 },
                              { label: t("dashboard.campaigns.wizard.schedule.presets.6hours"), minutes: 360 },
                              { label: t("dashboard.campaigns.wizard.schedule.presets.1day"), minutes: 1440 },
                              { label: t("dashboard.campaigns.wizard.schedule.presets.1week"), minutes: 10080 },
                            ].map(preset => (
                              <Button
                                key={preset.label}
                                type="button"
                                variant={schedulePreset === preset.label ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  setSchedulePreset(preset.label);
                                  setCustomDays(0);
                                  setCustomHours(0);
                                  setCustomMinutes(0);

                                  const scheduledTime = new Date(Date.now() + preset.minutes * 60 * 1000);
                                  form.setValue('scheduledFor', scheduledTime.toISOString());
                                }}
                              >
                                {preset.label}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Duration */}
                        <div>
                          <p className="text-sm font-medium mb-2">
                            {t("dashboard.campaigns.wizard.schedule.customDuration")}
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">
                                {t("dashboard.campaigns.wizard.schedule.days")}
                              </label>
                              <Input
                                type="number"
                                min="0"
                                value={customDays}
                                onChange={(e) => {
                                  const days = parseInt(e.target.value) || 0;
                                  setCustomDays(days);
                                  setSchedulePreset('');
                                  updateCustomSchedule(days, customHours, customMinutes);
                                }}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">
                                {t("dashboard.campaigns.wizard.schedule.hours")}
                              </label>
                              <Input
                                type="number"
                                min="0"
                                max="23"
                                value={customHours}
                                onChange={(e) => {
                                  const hours = parseInt(e.target.value) || 0;
                                  setCustomHours(hours);
                                  setSchedulePreset('');
                                  updateCustomSchedule(customDays, hours, customMinutes);
                                }}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">
                                {t("dashboard.campaigns.wizard.schedule.minutes")}
                              </label>
                              <Input
                                type="number"
                                min="0"
                                max="59"
                                value={customMinutes}
                                onChange={(e) => {
                                  const minutes = parseInt(e.target.value) || 0;
                                  setCustomMinutes(minutes);
                                  setSchedulePreset('');
                                  updateCustomSchedule(customDays, customHours, minutes);
                                }}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Preview Scheduled Time */}
                        {form.watch('scheduledFor') && (
                          <div className="p-3 bg-muted rounded-md">
                            <p className="text-sm font-medium mb-1">
                              {t("dashboard.campaigns.wizard.schedule.scheduledToSend")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(form.watch('scheduledFor') || '').toLocaleString('en-US', {
                                dateStyle: 'full',
                                timeStyle: 'short'
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                {t("dashboard.campaigns.wizard.navigation.back")}
              </Button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                >
                  {t("dashboard.campaigns.wizard.navigation.cancel")}
                </Button>

                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                  >
                    {t("dashboard.campaigns.wizard.navigation.next")}
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="submit">
                    <Send className="h-4 w-4 mr-2" />
                    {editingCampaign
                      ? t("dashboard.campaigns.wizard.navigation.update")
                      : t("dashboard.campaigns.wizard.navigation.create")}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

