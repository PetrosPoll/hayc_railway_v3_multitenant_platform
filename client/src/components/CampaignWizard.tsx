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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Mail, Users, Eye, Send, Plus, Check, Tag as TagIcon, X, Loader2, CalendarIcon, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

const CONTACT_STATUSES = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'active', label: 'Subscribed' },
  { value: 'pending', label: 'Pending' },
] as const;

const campaignFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  purpose: z.string().optional(),
  tagIds: z.array(z.number()).default([]),
  excludedTagIds: z.array(z.number()).default([]),
  statusFilters: z.array(z.string()).default(['confirmed', 'active', 'pending']),
  subject: z.string().min(1, 'Subject is required'),
  senderName: z.string().min(1, 'Sender name is required'),
  senderEmail: z.string().email('Valid email is required').min(1, 'Sender email is required'),
  message: z.string().optional(),
  templateId: z.number().optional(),
  scheduledFor: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

interface CampaignWizardProps {
  open: boolean;
  onClose: () => void;
  websiteProgressId: number;
  editingCampaign?: any;
  onSuccess: () => void;
}

export function CampaignWizard({ 
  open, 
  onClose, 
  websiteProgressId, 
  editingCampaign,
  onSuccess 
}: CampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Scheduling state
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedHour, setSelectedHour] = useState<string>('12');
  const [selectedMinute, setSelectedMinute] = useState<string>('00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      title: editingCampaign?.title || '',
      description: editingCampaign?.description || '',
      purpose: editingCampaign?.purpose || '',
      tagIds: editingCampaign?.tagIds || [],
      excludedTagIds: editingCampaign?.excludedTagIds || [],
      statusFilters: editingCampaign?.statusFilters || ['confirmed', 'active', 'pending'],
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

  // Fetch tags
  const { data: tags = [] } = useQuery<any[]>({
    queryKey: [`/api/tags?websiteProgressId=${websiteProgressId}`],
    enabled: open && !!websiteProgressId,
  });

  // Fetch templates
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery<any[]>({
    queryKey: [`/api/email-templates/${websiteProgressId}`],
    queryFn: async () => {
      console.log('[CampaignWizard] Fetching templates for website:', websiteProgressId);
      const response = await fetch(`/api/email-templates/${websiteProgressId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      const data = await response.json();
      console.log('[CampaignWizard] Fetched templates:', data.length, data);
      return data;
    },
    enabled: open && !!websiteProgressId,
  });

  // Log templates when they change
  useEffect(() => {
    if (templates) {
      console.log('[CampaignWizard] Templates updated:', templates.length, templates);
    }
  }, [templates]);

  // Reset form when editing campaign changes or dialog opens
  useEffect(() => {
    if (open) {
      console.log('[CampaignWizard] Editing campaign:', { id: editingCampaign?.id, title: editingCampaign?.title, tagIds: editingCampaign?.tagIds });
      
      form.reset({
        title: editingCampaign?.title || '',
        description: editingCampaign?.description || '',
        purpose: editingCampaign?.purpose || '',
        tagIds: editingCampaign?.tagIds || [],
        excludedTagIds: editingCampaign?.excludedTagIds || [],
        statusFilters: editingCampaign?.statusFilters || ['confirmed', 'active', 'pending'],
        subject: editingCampaign?.subject || '',
        senderName: editingCampaign?.senderName || '',
        senderEmail: editingCampaign?.senderEmail || '',
        message: editingCampaign?.message || '',
        templateId: editingCampaign?.templateId || undefined,
        scheduledFor: editingCampaign?.scheduledFor || '',
      });
      
      console.log('[CampaignWizard] Form reset with tagIds:', form.getValues('tagIds'));
      
      // Initialize scheduling state from existing campaign
      if (editingCampaign?.scheduledFor) {
        setScheduleType('later');
        // Parse existing scheduled time
        const scheduledDate = new Date(editingCampaign.scheduledFor);
        setSelectedDate(scheduledDate);
        setSelectedHour(scheduledDate.getHours().toString().padStart(2, '0'));
        setSelectedMinute(scheduledDate.getMinutes().toString().padStart(2, '0'));
      } else {
        setScheduleType('now');
        setSelectedDate(undefined);
        setSelectedHour('12');
        setSelectedMinute('00');
      }
      
      if (editingCampaign?.templateId && templates.length > 0) {
        setSelectedTemplate(templates.find(t => t.id === editingCampaign.templateId) || null);
      } else {
        setSelectedTemplate(null);
      }
      
      setCurrentStep(1);
    } else {
      // Reset scheduling state when dialog closes
      setScheduleType('now');
      setSelectedDate(undefined);
      setSelectedHour('12');
      setSelectedMinute('00');
    }
  }, [open, editingCampaign, form, templates]);

  // Watch selected tags, excluded tags, and status filters
  const selectedTagIds = form.watch('tagIds') || [];
  const excludedTagIds = form.watch('excludedTagIds') || [];
  const selectedStatusFilters = form.watch('statusFilters') || ['confirmed', 'active', 'pending'];

  // Fetch contacts for the selected tags (or all contacts if no tags selected)
  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: [`/api/contacts`, { websiteProgressId, tagIds: selectedTagIds }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('websiteProgressId', websiteProgressId.toString());
      // Only add tagIds if some are selected
      if (selectedTagIds.length > 0) {
        selectedTagIds.forEach(id => params.append('tagIds', id.toString()));
      }
      const response = await fetch(`/api/contacts?${params}`);
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

  // Filter contacts by selected statuses and exclude contacts with excluded tags
  const filteredContacts = contacts.filter(c => {
    // Filter by status first
    if (!selectedStatusFilters.includes(c.status)) return false;
    
    // Filter out contacts with excluded tags
    if (excludedTagIds.length > 0) {
      const contactTagIds = getContactTagIds(c);
      if (contactTagIds.some(tagId => excludedTagIds.includes(tagId))) {
        return false;
      }
    }
    return true;
  });

  // Get contacts that are being excluded (for preview)
  const excludedContacts = contacts.filter(c => {
    if (!selectedStatusFilters.includes(c.status)) return false;
    if (excludedTagIds.length > 0) {
      const contactTagIds = getContactTagIds(c);
      return contactTagIds.some(tagId => excludedTagIds.includes(tagId));
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

  // const handleCreateNewTemplate = () => {
  //   // Save current form data to session storage for the builder
  //   sessionStorage.setItem('campaignContext', JSON.stringify({
  //     campaignData: form.getValues(),
  //     websiteProgressId,
  //     returnPath: window.location.pathname + window.location.search,
  //   }));
  //   setLocation(`/websites/${websiteProgressId}/email-builder`);
  // };

  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    form.setValue('templateId', template.id);
  };

  // Update form value when date or time changes
  useEffect(() => {
    if (scheduleType === 'later' && selectedDate) {
      const scheduledTime = new Date(selectedDate);
      scheduledTime.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0);
      const isoTime = scheduledTime.toISOString();
      console.log('[CampaignWizard] Setting scheduledFor:', { isoTime, selectedDate, selectedHour, selectedMinute });
      form.setValue('scheduledFor', isoTime);
    } else if (scheduleType === 'now') {
      form.setValue('scheduledFor', '');
    }
  }, [selectedDate, selectedHour, selectedMinute, scheduleType, form]);

  const handleSubmit = async (data: CampaignFormData) => {
    // Extra safeguard: only submit if we're on step 4
    if (currentStep !== 4) {
      return;
    }

    // Prevent double submission
    if (isSubmitting) {
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

    setIsSubmitting(true);
    try {
      const url = editingCampaign 
        ? `/api/newsletter/campaigns/${editingCampaign.id}` 
        : '/api/newsletter/campaigns';

      const method = editingCampaign ? 'PUT' : 'POST';
      
      // Set status to 'scheduled' if scheduledFor is provided, otherwise 'draft'
      const status = data.scheduledFor ? 'scheduled' : 'draft';
      
      console.log('[CampaignWizard] Submitting campaign:', { 
        scheduledFor: data.scheduledFor, 
        status, 
        scheduleType,
        selectedDate: selectedDate?.toISOString(),
        selectedHour,
        selectedMinute 
      });
      
      const response = await apiRequest(method, url, {
        ...data,
        status,
        websiteProgressId,
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
    } finally {
      setIsSubmitting(false);
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

                {/* Status Filter */}
                <FormField
                  control={form.control}
                  name="statusFilters"
                  render={() => (
                    <FormItem>
                      <FormLabel>
                        {t("dashboard.campaigns.wizard.fields.statusFilters")}{" "}
                        <span className="text-xs text-muted-foreground font-normal">
                          ({t("dashboard.campaigns.wizard.hints.filterByStatus")})
                        </span>
                      </FormLabel>
                      <div className="border rounded-md p-4">
                        <div className="flex flex-wrap gap-4">
                          {CONTACT_STATUSES.map((status) => (
                            <FormField
                              key={status.value}
                              control={form.control}
                              name="statusFilters"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(status.value)}
                                      onCheckedChange={(checked) => {
                                        const currentValue = field.value || [];
                                        field.onChange(
                                          checked
                                            ? [...currentValue, status.value]
                                            : currentValue.filter((v: string) => v !== status.value)
                                        );
                                      }}
                                      data-testid={`checkbox-status-${status.value}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal cursor-pointer">
                                    {t(`newsletter.${status.value}`)}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-muted-foreground">
                            {t("dashboard.campaigns.wizard.hints.matchingContacts")}: <span className="font-semibold text-foreground">{filteredContacts.length}</span>
                          </p>
                        </div>
                      </div>
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
                  {/* <Button
                    type="button"
                    onClick={handleCreateNewTemplate}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("dashboard.campaigns.wizard.design.createTemplate")}
                  </Button> */}
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
                      {/* <Button onClick={handleCreateNewTemplate}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t("dashboard.campaigns.wizard.design.createTemplate")}
                      </Button> */}
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

                {/* <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("dashboard.campaigns.wizard.design.plainTextLabel")}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={t("dashboard.campaigns.wizard.design.plainTextPlaceholder")}
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                /> */}
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
                      {/* Filter Summary */}
                      <div className="p-4 bg-muted rounded-lg space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-3">
                            {/* Tags Section */}
                            <div>
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
                            
                            {/* Status Filters Section */}
                            <div>
                              <p className="font-medium mb-2">
                                {t("dashboard.campaigns.wizard.recipients.selectedStatuses")}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {selectedStatusFilters.length === 0 ? (
                                  <span className="text-sm text-muted-foreground">
                                    {t("dashboard.campaigns.wizard.recipients.noStatusSelected")}
                                  </span>
                                ) : (
                                  selectedStatusFilters.map((status: string) => (
                                    <Badge key={status} variant="outline">
                                      {t(`newsletter.${status}`)}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-lg px-4 py-1 ml-4">
                            {filteredContacts.length} {t("dashboard.campaigns.wizard.recipients.count")}
                          </Badge>
                        </div>
                      </div>

                      {/* Exclude by Tags Section */}
                      {tags.length > 0 && (
                        <Card className="border-orange-200 dark:border-orange-800">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <X className="h-4 w-4 text-orange-500" />
                              {t("dashboard.campaigns.wizard.recipients.excludeByTags", "Exclude by Tags")}
                            </CardTitle>
                            <CardDescription>
                              {t("dashboard.campaigns.wizard.recipients.excludeByTagsDescription", "Contacts with any of the selected tags will be excluded from this campaign.")}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                {tags.map((tag: any) => (
                                  <div key={`exclude-${tag.id}`} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`exclude-tag-${tag.id}`}
                                      checked={excludedTagIds.includes(tag.id)}
                                      onCheckedChange={(checked) => {
                                        const currentExcluded = form.getValues('excludedTagIds') || [];
                                        if (checked) {
                                          form.setValue('excludedTagIds', [...currentExcluded, tag.id]);
                                        } else {
                                          form.setValue('excludedTagIds', currentExcluded.filter(id => id !== tag.id));
                                        }
                                      }}
                                    />
                                    <label
                                      htmlFor={`exclude-tag-${tag.id}`}
                                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
                                    >
                                      <span
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: tag.color || '#888' }}
                                      />
                                      {tag.name}
                                    </label>
                                  </div>
                                ))}
                              </div>

                              {/* Preview of excluded contacts */}
                              {excludedContacts.length > 0 && (
                                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md">
                                  <p className="text-sm text-orange-800 dark:text-orange-200 font-medium mb-2">
                                    {t("dashboard.campaigns.wizard.recipients.excludedContactsPreview", `${excludedContacts.length} contact(s) will be excluded:`)}
                                  </p>
                                  <div className="max-h-24 overflow-y-auto space-y-1">
                                    {excludedContacts.slice(0, 5).map((contact: any) => (
                                      <div key={contact.id} className="text-xs text-orange-700 dark:text-orange-300">
                                        {contact.email}
                                      </div>
                                    ))}
                                    {excludedContacts.length > 5 && (
                                      <div className="text-xs text-orange-600 dark:text-orange-400">
                                        {t("dashboard.campaigns.wizard.recipients.andMore", `...and ${excludedContacts.length - 5} more`)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {filteredContacts.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">
                            {t("dashboard.campaigns.wizard.recipients.listTitle")}
                          </p>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {filteredContacts.map((contact: any) => (
                              <div
                                key={contact.id}
                                className="text-sm p-2 bg-muted/50 rounded flex items-center justify-between"
                              >
                                <span>{contact.email}</span>
                                <span className="text-xs text-muted-foreground">
                                  {contact.firstName || contact.lastName 
                                    ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() 
                                    : t("dashboard.campaigns.wizard.recipients.noName")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {filteredContacts.length === 0 && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            {t("dashboard.campaigns.wizard.recipients.noContacts")}
                          </p>
                        </div>
                      )}
                    </div>
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
                          {t("dashboard.campaigns.wizard.review.fields.statusFilters")}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedStatusFilters.map((status: string) => (
                            <Badge key={status} variant="outline">
                              {t(`newsletter.${status}`)}
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
                          {filteredContacts.length} {t("dashboard.campaigns.wizard.recipients.count")}
                        </p>
                      </div>
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
                        {/* Date Picker */}
                        <div>
                          <p className="text-sm font-medium mb-2">
                            {t("dashboard.campaigns.wizard.schedule.selectDate") || "Select Date"}
                          </p>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "PPP") : (t("dashboard.campaigns.wizard.schedule.pickDate") || "Pick a date")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Time Picker */}
                        {selectedDate && (
                          <div>
                            <p className="text-sm font-medium mb-2">
                              {t("dashboard.campaigns.wizard.schedule.selectTime") || "Select Time"}
                            </p>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <Select value={selectedHour} onValueChange={setSelectedHour}>
                                <SelectTrigger className="w-[80px]">
                                  <SelectValue placeholder="HH" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(hour => (
                                    <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-lg font-medium">:</span>
                              <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                                <SelectTrigger className="w-[80px]">
                                  <SelectValue placeholder="MM" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')).map(minute => (
                                    <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        {/* Preview Scheduled Time */}
                        {form.watch('scheduledFor') && (
                          <div className="p-3 bg-muted rounded-md">
                            <p className="text-sm font-medium mb-1">
                              {t("dashboard.campaigns.wizard.schedule.scheduledToSend") || "Scheduled to send:"}
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
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {isSubmitting
                      ? (editingCampaign 
                          ? t("dashboard.campaigns.wizard.navigation.updating")
                          : t("dashboard.campaigns.wizard.navigation.creating"))
                      : editingCampaign
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