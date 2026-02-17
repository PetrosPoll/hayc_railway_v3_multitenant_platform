import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Upload,
  Loader2,
  AlertCircle,
  Square,
  Circle,
} from "lucide-react";
import { useAuth } from "@/components/ui/authContext";
import { TemplateBrowserModal } from "@/components/TemplateBrowserModal";
import type { Template } from "@shared/schema";
import { ENVATO_TEMPLATES } from "@/data/envato-templates";

// Configuration: Add new purchasable field names here when you add them to the form
const PURCHASABLE_FIELDS = [
  "logoDesignService",
  // Add more purchasable fields here as needed, e.g.:
  // "websiteHosting",
  // "extraPages",
  // "premiumSupport",
] as const;

export default function Onboarding() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const subscriptionId = searchParams.get("subscriptionId");
  const urlWebsiteProgressId = searchParams.get("websiteProgressId");

  // Prevent search engine indexing of onboarding form
  useEffect(() => {
    const metaRobots = document.createElement("meta");
    metaRobots.name = "robots";
    metaRobots.content = "noindex, nofollow";
    document.head.appendChild(metaRobots);

    const metaTitle = document.querySelector("title");
    const originalTitle = metaTitle?.textContent;
    if (metaTitle) {
      metaTitle.textContent = t("onboarding.pageTitle");
    }

    return () => {
      // Cleanup on unmount
      document.head.removeChild(metaRobots);
      if (metaTitle && originalTitle) {
        metaTitle.textContent = originalTitle;
      }
    };
  }, [t]);

  const formSchema = z
    .object({
      // Step 1: Business Information
      businessName: z.string().min(2, t("onboarding.requiredField")),
      contactName: z.string().min(2, t("onboarding.requiredField")),
      contactPhone: z.string().min(5, t("onboarding.requiredField")),
      accountEmail: z.string().email().optional(), // Pre-filled from user account
      websiteLanguage: z.enum(["en", "gr"], {
        required_error: t("onboarding.requiredField"),
      }),
      contactEmail: z.string()
        .email(t("onboarding.validEmail"))
        .refine((email) => {
          // Check for common email provider typos
          const domain = email.split('@')[1]?.toLowerCase();
          const commonTypos = [
            // Gmail
            'gmial.com', 'gmai.com', 'gmaiil.com', 'gmailc.om', 'gmaiell.com', 'gmail.con', 'gmail.cm',
            'gmail.comm', 'gmail.coom', 'gmail.ccom', 'gmal.com', 'gmil.com', 'gemail.com', 'gmail.co',
            'gmail.om', 'gmail.vom', 'gmail.xom', 'gmail.ocm', 'gmailm.com', 'gmaill.com',

            // Yahoo
            'yahooo.com', 'yaho.com', 'yhoo.com', 'yahho.com', 'yaoo.com', 'yaho.co', 'yahoo.con',
            'yahoom.com', 'yaho.cm', 'yahoo.comm', 'yahooc.om', 'yahoo.cmo',

            // Outlook
            'outlok.com', 'outllok.com', 'outllok.co', 'outlook.co', 'outlook.con', 'outlok.cm',
            'outluk.com', 'outllok.cmo', 'otulook.com', 'outloo.com', 'outlook.coom',

            // Hotmail
            'hotmial.com', 'hotmai.com', 'hotmal.com', 'hotmaill.com', 'hotmail.co', 'hotmail.cm',
            'hotmaiil.com', 'hotmial.cm', 'hotmail.con', 'hotmaol.com', 'hotmaio.com',

            // iCloud
            'iclod.com', 'iclould.com', 'iclou.com', 'icluod.com', 'iclou.co', 'icloud.con',
            'icloud.cm', 'icloud.coom', 'icoud.com', 'iclod.cm',

            // Live
            'liv.com', 'live.cm', 'live.co', 'live.con', 'lve.com', 'livr.com', 'livve.com',
            'livemail.com', 'live.coom', 'livc.com',

            // Misc top-level domain errors
            'gmail.net', 'yahoo.net', 'hotmail.net', 'outlook.net', 'icloud.net',
            'gmail.org', 'hotmail.org', 'outlook.org', 'icloud.org', 'yahoo.org'
          ];
          
          if (commonTypos.includes(domain)) {
            return false;
          }
          
          // Check for obvious invalid patterns (e.g., missing common TLDs)
          if (domain && !domain.includes('.')) {
            return false;
          }
          
          return true;
        }, {
          message: t("onboarding.validation.emailTypo")
        }),
      businessDescription: z.string().min(10, t("onboarding.requiredField")),

      // Step 2: Domain
      hasDomain: z.enum(["yes", "no"], {
        required_error: t("onboarding.requiredField"),
      }),
      existingDomain: z.string().optional(),
      domainConnectionPreference: z
      .string()
      .optional()
      .superRefine((val, ctx) => {
        const parent = ctx.parent as any;
        if (!parent) return;

        if (parent.domainPurchasePreference === "i_will_buy" && !val) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("onboarding.requiredField"),
          });
        }
      }),
      domainPurchasePreference: z.enum(["i_will_buy", "you_buy"]).optional(),
      preferredDomains: z.string().optional(),

      // Step 3: Professional Emails
      hasEmails: z.enum(["yes", "no"], {
        required_error: t("onboarding.requiredField"),
      }),
      emailProvider: z.string().optional(),
      emailAccess: z.string().optional(),
      existingEmails: z.string().optional(),
      emailCount: z.string().optional(),
      emailNames: z.string().optional(),
      emailRedirect: z
        .enum(["main-inbox", "separate"], {
          required_error: t("onboarding.requiredField"),
        })
        .optional(),
      redirectInboxAddress: z.string().email(t("onboarding.validation.emailInvalid")).optional().or(z.literal("")),

      // Step 4: Website Foundation
      hasWebsite: z.enum(["yes", "no"], {
        required_error: t("onboarding.requiredField"),
      }),
      websiteLink: z.string().optional(),
      websiteChanges: z.string().optional(),
      wantedPages: z.array(z.string()).optional(),
      notSurePages: z.boolean().optional(),
      hasTextContent: z.enum(["yes", "no"], {
        required_error: t("onboarding.requiredField"),
      }),
      textContentFiles: z.any().optional(),
      hasMediaContent: z.enum(["yes", "no"], {
        required_error: t("onboarding.requiredField"),
      }),
      mediaContentFiles: z.any().optional(),

      // Step 5: Design Preferences
      businessLogo: z.any().optional(),
      createTextLogo: z.boolean().optional(),
      colorPalette: z.string().optional(),
      brandGuide: z.any().optional(),
      inspirationWebsites: z.array(z.string()).optional(),
      preferredFonts: z.string().optional(),
      siteStyle: z.string().optional(),

      // Step 6: Template Selection
      selectedTemplateId: z.number().optional(),
      customTemplateRequest: z.string().optional(),

      // Step 7: Social Media
      hasSocialMedia: z.enum(["yes", "no"], {
        required_error: t("onboarding.requiredField"),
      }),
      facebookLink: z.string().optional(),
      instagramLink: z.string().optional(),
      linkedinLink: z.string().optional(),
      tiktokLink: z.string().optional(),
      youtubeLink: z.string().optional(),
      otherSocialLinks: z.string().optional(),
      logoDesignService: z
        .enum(["none", "basic", "premium"], {
          required_error: t("onboarding.requiredField"),
        })
        .optional(),

      // Step 8: Practical Information
      projectDeadline: z
        .string()
        .refine(
          (val) => {
            if (!val) return true;
            const selectedDate = new Date(val);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const minDate = new Date(today);
            minDate.setDate(today.getDate() + 15);
            return selectedDate >= minDate;
          },
          { message: t("onboarding.validation.projectDeadlineMin") },
        )
        .optional(),
      additionalNotes: z.string().optional(),
    })
    .refine(
      (data) => {
        // Only validate redirectInboxAddress if emailRedirect is explicitly set to "main-inbox"
        if (data.emailRedirect === "main-inbox") {
          return !!data.redirectInboxAddress;
        }
        // If emailRedirect is "separate" or undefined, validation passes
        return true;
      },
      {
        message: t("onboarding.validation.redirectInboxRequired"),
        path: ["redirectInboxAddress"],
      },
    )
    .refine(
      (data) => {
        if (data.hasDomain === "yes" && !data.existingDomain) {
          return false;
        }
        return true;
      },
      {
        message: t("onboarding.validation.domainRequired"),
        path: ["existingDomain"],
      },
    )
    .refine(
      (data) => {
        if (data.hasDomain === "yes" && !data.domainConnectionPreference) {
          return false;
        }
        return true;
      },
      {
        message: t("onboarding.validation.domainConnectionRequired"),
        path: ["domainConnectionPreference"],
      },
    )
    .refine(
      (data) => {
        if (data.hasDomain === "no" && !data.domainPurchasePreference) {
          return false;
        }
        return true;
      },
      {
        message: t("onboarding.validation.domainPurchaseRequired"),
        path: ["domainPurchasePreference"],
      },
    )
    .refine(
      (data) => {
        if (data.hasDomain === "no" && !data.preferredDomains) {
          return false;
        }
        return true;
      },
      {
        message: t("onboarding.validation.domainNamesRequired"),
        path: ["preferredDomains"],
      },
    )
    .refine(
      (data) => {
        if (
          data.hasDomain === "no" &&
          data.domainPurchasePreference === "i_will_buy" &&
          !data.domainConnectionPreference
        ) {
          return false;
        }
        return true;
      },
      {
        message: t("onboarding.validation.domainConnectionRequired"),
        path: ["domainConnectionPreference"],
      },
    );

  type FormData = z.infer<typeof formSchema>;

  const [showSuccessMessage, setShowSuccessMessage] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [forceRender, setForceRender] = useState(0);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    title: string;
    message: string;
  } | null>(null);
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [savedPaymentMethod, setSavedPaymentMethod] = useState<{
    last4: string;
    brand: string;
  } | null>(null);
  const [pendingLogoData, setPendingLogoData] = useState<{
    data: FormData;
    logoType: string;
  } | null>(null);
  const [onboardingDomain, setOnboardingDomain] = useState<string | null>(null);
  const [websiteProgressId, setWebsiteProgressId] = useState<number | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Initialize onboarding - create website progress entry with unique domain or load existing
  useEffect(() => {
    const initializeOnboarding = async () => {
      if (!user) {
        // Wait for user to be available
        return;
      }

      try {
        // If websiteProgressId is provided in URL, use it and load draft
        if (urlWebsiteProgressId) {
          const progressId = parseInt(urlWebsiteProgressId);
          if (!isNaN(progressId)) {
            setWebsiteProgressId(progressId);
            
            // Load draft data
            try {
              const draftResponse = await fetch(`/api/onboarding-form/draft/${progressId}`, {
                credentials: "include",
              });

              if (draftResponse.ok) {
                const draftData = await draftResponse.json();
                
                // Get website progress to get domain
                const websiteResponse = await fetch(`/api/admin/websites/${progressId}`, {
                  credentials: "include",
                });
                
                if (websiteResponse.ok) {
                  const websiteData = await websiteResponse.json();
                  setOnboardingDomain(websiteData.domain?.replace('.pending-onboarding', '') || null);
                }

                // Store draft data to populate form after initialization
                if (draftData) {
                  // Set selected file if logo exists
                  if (draftData.businessLogoUrl) {
                    setSelectedFile({
                      url: draftData.businessLogoUrl,
                      name: draftData.businessLogoName || "",
                      publicId: draftData.businessLogoPublicId || "",
                    } as any);
                  }

                  // Populate form with draft data after form is initialized
                  setTimeout(() => {
                    form.reset({
                      businessName: draftData.businessName || "",
                      contactName: draftData.contactName || "",
                      contactPhone: draftData.contactPhone || "",
                      contactEmail: draftData.contactEmail || "",
                      businessDescription: draftData.businessDescription || "",
                      websiteLanguage: (draftData.websiteLanguage as "en" | "gr") || "en",
                      hasDomain: (draftData.hasDomain as "yes" | "no") || undefined,
                      existingDomain: draftData.existingDomain || "",
                      domainConnectionPreference: draftData.domainConnectionPreference as "i_will_connect" | "you_connect" | undefined,
                      domainPurchasePreference: draftData.domainPurchasePreference as "i_will_buy" | "you_buy" | undefined,
                      preferredDomains: draftData.preferredDomains || "",
                      hasEmails: (draftData.hasEmails as "yes" | "no") || undefined,
                      emailProvider: draftData.emailProvider || "",
                      emailAccess: draftData.emailAccess || "",
                      existingEmails: draftData.existingEmails || "",
                      emailCount: draftData.emailCount || "",
                      emailNames: draftData.emailNames || "",
                      emailRedirect: draftData.emailRedirect as "main-inbox" | "separate" | undefined,
                      redirectInboxAddress: draftData.redirectInboxAddress || "",
                      hasWebsite: (draftData.hasWebsite as "yes" | "no") || undefined,
                      websiteLink: draftData.websiteLink || "",
                      websiteChanges: draftData.websiteChanges || "",
                      wantedPages: draftData.wantedPages || [],
                      notSurePages: draftData.notSurePages || false,
                      hasTextContent: (draftData.hasTextContent as "yes" | "no") || undefined,
                      hasMediaContent: (draftData.hasMediaContent as "yes" | "no") || undefined,
                      businessLogo: draftData.businessLogoUrl ? {
                        url: draftData.businessLogoUrl,
                        name: draftData.businessLogoName || "",
                        publicId: draftData.businessLogoPublicId || "",
                      } : null,
                      createTextLogo: draftData.createTextLogo || false,
                      colorPalette: draftData.colorPalette || "",
                      inspirationWebsites: draftData.inspirationWebsites || ["", "", ""],
                      preferredFonts: draftData.preferredFonts || "",
                      siteStyle: draftData.siteStyle || "",
                      selectedTemplateId: draftData.selectedTemplateId || undefined,
                      customTemplateRequest: draftData.customTemplateRequest || "",
                      hasSocialMedia: (draftData.hasSocialMedia as "yes" | "no") || undefined,
                      facebookLink: draftData.facebookLink || "",
                      instagramLink: draftData.instagramLink || "",
                      linkedinLink: draftData.linkedinLink || "",
                      tiktokLink: draftData.tiktokLink || "",
                      youtubeLink: draftData.youtubeLink || "",
                      otherSocialLinks: draftData.otherSocialLinks || "",
                      logoDesignService: (draftData.logoDesignService as "none" | "basic" | "premium") || undefined,
                      projectDeadline: draftData.projectDeadline || "",
                      additionalNotes: draftData.additionalNotes || "",
                    });

                    toast({
                      title: t("onboarding.draftLoaded") || "Draft Loaded",
                      description: t("onboarding.draftLoadedDesc") || "Your previous progress has been restored.",
                    });
                  }, 100);
                }
              }
            } catch (draftError) {
              console.error("Error loading draft:", draftError);
            }
            
            return;
          }
        }

        // Otherwise, initialize new onboarding or check for existing draft
        // If subscriptionId is present, this is post-purchase - create new
        // Otherwise, check for existing draft first
        const response = await fetch("/api/onboarding/initialize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            subscriptionId: subscriptionId || null,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to initialize onboarding");
        }

        const data = await response.json();
        setOnboardingDomain(data.domain);
        setWebsiteProgressId(data.websiteProgressId);
        
        // If existing draft was found, load it
        // BUT: Skip loading drafts for post-purchase flows (subscriptionId present) - start fresh
        if (data.hasExistingDraft && !subscriptionId) {
          try {
            const draftResponse = await fetch(`/api/onboarding-form/draft/${data.websiteProgressId}`, {
              credentials: "include",
            });

            if (draftResponse.ok) {
              const draftData = await draftResponse.json();
              
              // Set selected file if logo exists
              if (draftData.businessLogoUrl) {
                setSelectedFile({
                  url: draftData.businessLogoUrl,
                  name: draftData.businessLogoName || "",
                  publicId: draftData.businessLogoPublicId || "",
                } as any);
              }

              // Populate form with draft data after form is initialized
              setTimeout(() => {
                form.reset({
                  businessName: draftData.businessName || "",
                  contactName: draftData.contactName || "",
                  contactPhone: draftData.contactPhone || "",
                  contactEmail: draftData.contactEmail || "",
                  businessDescription: draftData.businessDescription || "",
                  websiteLanguage: (draftData.websiteLanguage as "en" | "gr") || "en",
                  hasDomain: (draftData.hasDomain as "yes" | "no") || undefined,
                  existingDomain: draftData.existingDomain || "",
                  domainConnectionPreference: draftData.domainConnectionPreference as "i_will_connect" | "you_connect" | undefined,
                  domainPurchasePreference: draftData.domainPurchasePreference as "i_will_buy" | "you_buy" | undefined,
                  preferredDomains: draftData.preferredDomains || "",
                  hasEmails: (draftData.hasEmails as "yes" | "no") || undefined,
                  emailProvider: draftData.emailProvider || "",
                  emailAccess: draftData.emailAccess || "",
                  existingEmails: draftData.existingEmails || "",
                  emailCount: draftData.emailCount || "",
                  emailNames: draftData.emailNames || "",
                  emailRedirect: draftData.emailRedirect as "main-inbox" | "separate" | undefined,
                  redirectInboxAddress: draftData.redirectInboxAddress || "",
                  hasWebsite: (draftData.hasWebsite as "yes" | "no") || undefined,
                  websiteLink: draftData.websiteLink || "",
                  websiteChanges: draftData.websiteChanges || "",
                  wantedPages: draftData.wantedPages || [],
                  notSurePages: draftData.notSurePages || false,
                  hasTextContent: (draftData.hasTextContent as "yes" | "no") || undefined,
                  hasMediaContent: (draftData.hasMediaContent as "yes" | "no") || undefined,
                  businessLogo: draftData.businessLogoUrl ? {
                    url: draftData.businessLogoUrl,
                    name: draftData.businessLogoName || "",
                    publicId: draftData.businessLogoPublicId || "",
                  } : null,
                  createTextLogo: draftData.createTextLogo || false,
                  colorPalette: draftData.colorPalette || "",
                  inspirationWebsites: draftData.inspirationWebsites || ["", "", ""],
                  preferredFonts: draftData.preferredFonts || "",
                  siteStyle: draftData.siteStyle || "",
                  selectedTemplateId: draftData.selectedTemplateId || undefined,
                  customTemplateRequest: draftData.customTemplateRequest || "",
                  hasSocialMedia: (draftData.hasSocialMedia as "yes" | "no") || undefined,
                  facebookLink: draftData.facebookLink || "",
                  instagramLink: draftData.instagramLink || "",
                  linkedinLink: draftData.linkedinLink || "",
                  tiktokLink: draftData.tiktokLink || "",
                  youtubeLink: draftData.youtubeLink || "",
                  otherSocialLinks: draftData.otherSocialLinks || "",
                  logoDesignService: (draftData.logoDesignService as "none" | "basic" | "premium") || undefined,
                  projectDeadline: draftData.projectDeadline || "",
                  additionalNotes: draftData.additionalNotes || "",
                });

                toast({
                  title: t("onboarding.draftLoaded") || "Draft Loaded",
                  description: t("onboarding.draftLoadedDesc") || "Your previous progress has been restored.",
                });
              }, 100);
            }
          } catch (draftError) {
            console.error("Error loading draft:", draftError);
          }
        }
        
        console.log("✅ Onboarding initialized:", { domain: data.domain, websiteProgressId: data.websiteProgressId, hasExistingDraft: data.hasExistingDraft });
      } catch (error) {
        console.error("Error initializing onboarding:", error);
        toast({
          title: "Error",
          description: "Failed to initialize onboarding. Please refresh the page.",
          variant: "destructive",
        });
      }
    };

    initializeOnboarding();
  }, [user, toast, urlWebsiteProgressId]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // Step 1: Business Information
      businessName: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      businessDescription: "",
      websiteLanguage: "en",

      // Step 2: Domain
      hasDomain: undefined,
      existingDomain: "",
      domainConnectionPreference: undefined,
      domainPurchasePreference: undefined,
      preferredDomains: "",

      // Step 3: Professional Emails
      hasEmails: undefined,
      emailProvider: "",
      emailAccess: "",
      existingEmails: "",
      emailCount: "",
      emailNames: "",
      emailRedirect: undefined,

      // Step 4: Website Foundation
      hasWebsite: undefined,
      websiteLink: "",
      websiteChanges: "",
      wantedPages: [],
      notSurePages: false,
      hasTextContent: undefined,
      textContentFiles: null,
      hasMediaContent: undefined,
      mediaContentFiles: null,

      // Step 5: Design Preferences
      businessLogo: null,
      createTextLogo: false,
      colorPalette: "",
      brandGuide: null,
      inspirationWebsites: ["", "", ""],
      preferredFonts: "",
      siteStyle: "",

      // Step 6: Template Selection
      selectedTemplateId: undefined,
      customTemplateRequest: "",

      // Step 7: Social Media
      hasSocialMedia: undefined,
      facebookLink: "",
      instagramLink: "",
      linkedinLink: "",
      tiktokLink: "",
      youtubeLink: "",
      otherSocialLinks: "",

      // Step 8: Practical Information
      projectDeadline: "",
      additionalNotes: "",
    },
    mode: "onSubmit",
  });

  // Get selected template details from ENVATO_TEMPLATES
  const selectedTemplateId = form.watch("selectedTemplateId");
  const selectedTemplate = selectedTemplateId
    ? ENVATO_TEMPLATES.find(t => t.id === selectedTemplateId)
    : undefined;

  // Watch all purchasable fields to determine if payment step should be shown
  const watchedPurchasableFields = form.watch(PURCHASABLE_FIELDS as any);
  
  // Check if ANY purchasable field has a value (and not "none" or empty)
  const hasPurchasableItems = useMemo(() => {
    return PURCHASABLE_FIELDS.some((fieldName, index) => {
      const value = watchedPurchasableFields[index];
      // Field has a value and it's not "none" or empty string
      return value && value !== "none" && value !== "";
    });
  }, [watchedPurchasableFields]);

  // Dynamic steps array - only include payment step if any purchasable item is selected
  const steps = useMemo(() => {
    const baseSteps = [
      {
        title: t("onboarding.stepTitles.businessInformation"),
        fields: [
          "businessName",
          "contactName",
          "contactPhone",
          "accountEmail",
          "contactEmail",
          "businessDescription",
        ] as const,
      },
      {
        title: t("onboarding.stepTitles.domain"),
        fields: [
          "hasDomain",
          "existingDomain",
          "domainConnectionPreference",
          "domainPurchasePreference",
          "preferredDomains",
        ] as const,
      },
      {
        title: t("onboarding.stepTitles.professionalEmails"),
        fields: [
          "hasEmails",
          "emailProvider",
          "emailAccess",
          "existingEmails",
          "emailCount",
          "emailNames",
          "emailRedirect",
          "redirectInboxAddress",
        ] as const,
      },
      {
        title: t("onboarding.stepTitles.websiteFoundation"),
        fields: [
          "hasWebsite",
          "websiteLink",
          "websiteChanges",
          "wantedPages",
          "notSurePages",
          "hasTextContent",
          "textContentFiles",
          "hasMediaContent",
          "mediaContentFiles",
        ] as const,
      },
      {
        title: t("onboarding.stepTitles.designPreferences"),
        fields: [
          "businessLogo",
          "logoDesignService",
          "colorPalette",
          "brandGuide",
          "inspirationWebsites",
          "preferredFonts",
          "siteStyle",
        ] as const,
      },
      {
        title: t("onboarding.stepTitles.designPreferences"),
        fields: ["selectedTemplateId", "customTemplateRequest"] as const,
      },
      {
        title: t("onboarding.stepTitles.socialMedia"),
        fields: [
          "hasSocialMedia",
          "facebookLink",
          "instagramLink",
          "linkedinLink",
          "tiktokLink",
          "youtubeLink",
          "otherSocialLinks",
        ] as const,
      },
      {
        title: t("onboarding.stepTitles.practicalInformation"),
        fields: ["projectDeadline", "additionalNotes"] as const,
      },
    ];

    // Only add payment step if any purchasable item is selected
    if (hasPurchasableItems) {
      baseSteps.push({
        title: t("onboarding.stepTitles.reviewPayment"),
        fields: [] as any,
      });
    }

    // Always add final review and confirmation steps
    baseSteps.push({
      title: t("onboarding.stepTitles.reviewSubmit"),
      fields: [] as any,
    });
    baseSteps.push({
      title: t("onboarding.stepTitles.confirmation"),
      fields: [] as any,
    });

    return baseSteps;
  }, [hasPurchasableItems, t]);

  // Force re-render when step changes to prevent field bleeding
  useEffect(() => {
    setForceRender((prev) => prev + 1);
  }, [currentStep]);

  // Auto-save draft functionality
  const saveDraft = React.useCallback(async (formData: FormData) => {
    // Strict check - must have both websiteProgressId and user
    if (!websiteProgressId || websiteProgressId === null || !user) {
      console.warn('Cannot save draft: missing websiteProgressId or user');
      return;
    }

    try {
      setIsSavingDraft(true);
      
      // Convert form data to FormData format for API
      const draftFormData = new FormData();
      // Ensure websiteProgressId is a valid number before converting to string
      const progressId = typeof websiteProgressId === 'number' ? websiteProgressId : parseInt(String(websiteProgressId));
      if (isNaN(progressId) || progressId <= 0) {
        console.error('Invalid websiteProgressId:', websiteProgressId);
        setIsSavingDraft(false);
        return;
      }
      draftFormData.append("websiteProgressId", progressId.toString());
      
      // Add all form fields (only non-empty values)
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            draftFormData.append(key, JSON.stringify(value));
          } else if (typeof value === 'boolean') {
            draftFormData.append(key, value ? 'true' : 'false');
          } else if (typeof value === 'object' && value !== null) {
            // Handle file objects (Cloudinary uploads)
            if ('url' in value) {
              draftFormData.append(`${key}Url`, (value as any).url || '');
              draftFormData.append(`${key}Name`, (value as any).name || '');
              draftFormData.append(`${key}PublicId`, (value as any).publicId || '');
            } else {
              draftFormData.append(key, JSON.stringify(value));
            }
          } else {
            draftFormData.append(key, String(value));
          }
        }
      });

      const response = await fetch("/api/onboarding-form/draft", {
        method: "POST",
        body: draftFormData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to save draft");
      }

      setLastSavedAt(new Date());
    } catch (error) {
      console.error("Error saving draft:", error);
      // Don't show error toast to avoid interrupting user
    } finally {
      setIsSavingDraft(false);
    }
  }, [websiteProgressId, user]);

  // Track form values to detect changes
  const formValues = form.watch();
  const prevFormValuesRef = React.useRef<FormData | null>(null);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Debounced auto-save on form value changes (only when values actually change)
  useEffect(() => {
    // Early return if websiteProgressId or user is not available
    if (!websiteProgressId || !user) {
      // Clear any pending saves if websiteProgressId becomes unavailable
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      return;
    }

    // Skip if form is empty (initial state)
    const hasData = Object.values(formValues).some(
      (val) => val !== null && val !== undefined && val !== '' && 
      (!Array.isArray(val) || val.length > 0)
    );

    if (!hasData) {
      prevFormValuesRef.current = formValues;
      return;
    }

    // Check if values actually changed
    const prevValues = prevFormValuesRef.current;
    if (prevValues) {
      const valuesChanged = JSON.stringify(formValues) !== JSON.stringify(prevValues);
      if (!valuesChanged) {
        return; // No changes, don't save
      }
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Capture websiteProgressId in closure to ensure it's available when timeout fires
    const currentWebsiteProgressId = websiteProgressId;
    const currentUser = user;

    // Set new timeout to save after 2 seconds of no changes
    saveTimeoutRef.current = setTimeout(() => {
      // Double-check websiteProgressId is still available before saving
      if (!currentWebsiteProgressId || !currentUser) {
        console.warn('Skipping draft save: websiteProgressId or user not available');
        return;
      }
      saveDraft(formValues);
      prevFormValuesRef.current = formValues;
    }, 2000); // 2 second debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [formValues, websiteProgressId, user, saveDraft]);


  // Save draft on unmount (only if websiteProgressId is available and there's data)
  useEffect(() => {
    return () => {
      if (websiteProgressId && user) {
        const formValues = form.getValues();
        // Only save if there's actual data
        const hasData = Object.values(formValues).some(
          (val) => val !== null && val !== undefined && val !== '' && 
          (!Array.isArray(val) || val.length > 0)
        );

        if (hasData) {
          // Use sendBeacon for reliable save on page unload
          const formData = new FormData();
          formData.append("websiteProgressId", websiteProgressId.toString());
          Object.entries(formValues).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
              if (Array.isArray(value)) {
                formData.append(key, JSON.stringify(value));
              } else if (typeof value === 'boolean') {
                formData.append(key, value ? 'true' : 'false');
              } else if (typeof value === 'object' && value !== null && 'url' in value) {
                formData.append(`${key}Url`, (value as any).url || '');
                formData.append(`${key}Name`, (value as any).name || '');
                formData.append(`${key}PublicId`, (value as any).publicId || '');
              } else {
                formData.append(key, String(value));
              }
            }
          });
          
          // Use fetch with keepalive for reliable save
          fetch("/api/onboarding-form/draft", {
            method: "POST",
            body: formData,
            credentials: "include",
            keepalive: true,
          }).catch(() => {
            // Silently fail on unmount
          });
        }
      }
    };
  }, [websiteProgressId, user]);

  const validateStep = async (stepIndex: number) => {
    console.log('validation log- --------');
    const currentStepFields = steps[stepIndex].fields as any;
    
    // If no fields to validate (like review/confirmation steps), it's valid
    if (!currentStepFields || currentStepFields.length === 0) {
      return true;
    }
    
    const formValues = form.getValues();
    
    // Determine which fields are actually visible based on form state
    let fieldsToValidate: string[] = [...currentStepFields];
    
    // Step 1: Domain - Only validate visible fields based on hasDomain value
    if (stepIndex === 1) {
      // Clear errors for conditional fields first
      form.clearErrors(["existingDomain", "domainConnectionPreference", "domainPurchasePreference", "preferredDomains"]);
      
      if (formValues.hasDomain === "yes") {
        // When user has domain: validate hasDomain, existingDomain, domainConnectionPreference
        fieldsToValidate = ["hasDomain", "existingDomain", "domainConnectionPreference"];
      } else if (formValues.hasDomain === "no") {
        // When user doesn't have domain: validate hasDomain, domainPurchasePreference, preferredDomains
        // Only add domainConnectionPreference if they chose "i_will_buy"
        fieldsToValidate = ["hasDomain", "domainPurchasePreference", "preferredDomains"];
        if (formValues.domainPurchasePreference === "i_will_buy") {
          fieldsToValidate.push("domainConnectionPreference");
        }
      } else {
        // hasDomain not yet selected - only validate hasDomain
        fieldsToValidate = ["hasDomain"];
      }
    }
    
    // Step 2: Professional Emails - Only validate visible fields
    if (stepIndex === 2) {
      form.clearErrors(["redirectInboxAddress"]);
      
      // Always validate hasEmails
      fieldsToValidate = ["hasEmails"];
      
      // Add fields based on hasEmails value
      if (formValues.hasEmails === "yes") {
        fieldsToValidate.push("emailProvider", "emailAccess", "existingEmails");
      } else if (formValues.hasEmails === "no") {
        fieldsToValidate.push("emailCount", "emailNames");
      }
      
      // emailRedirect is shown for both yes and no (when hasEmails is answered)
      if (formValues.hasEmails === "yes" || formValues.hasEmails === "no") {
        fieldsToValidate.push("emailRedirect");
        // redirectInboxAddress only if main-inbox is selected
        if (formValues.emailRedirect === "main-inbox") {
          fieldsToValidate.push("redirectInboxAddress");
        }
      }
    }
    
    // First, validate the basic field-level validation for visible fields only
    const basicValidation = await form.trigger(fieldsToValidate);
    
    if (!basicValidation) {
      console.log("❌ Basic validation FAILED for step", stepIndex);
      console.log("Form errors:", form.formState.errors);
      console.log("Form values:", form.getValues());
      return false;
    }
    
    // Then, perform step-specific conditional validation (refine checks)
    
    // Step 1: Domain - Check domain-related conditional logic
    if (stepIndex === 1) {
      // If user has a domain, they must provide domain name and connection preference
      if (formValues.hasDomain === "yes") {
        if (!formValues.existingDomain) {
          form.setError("existingDomain", {
            type: "manual",
            message: t("onboarding.validation.domainRequired"),
          });
          return false;
        }
        if (!formValues.domainConnectionPreference) {
          form.setError("domainConnectionPreference", {
            type: "manual",
            message: t("onboarding.validation.domainConnectionRequired"),
          });
          return false;
        }
      }
      
      // If user doesn't have a domain
      if (formValues.hasDomain === "no") {
        if (!formValues.domainPurchasePreference) {
          form.setError("domainPurchasePreference", {
            type: "manual",
            message: t("onboarding.validation.domainPurchaseRequired"),
          });
          return false;
        }
        if (!formValues.preferredDomains) {
          form.setError("preferredDomains", {
            type: "manual",
            message: t("onboarding.validation.domainNamesRequired"),
          });
          return false;
        }
        // If user will buy the domain themselves, they must specify who will connect it
        if (formValues.domainPurchasePreference === "i_will_buy" && !formValues.domainConnectionPreference) {
          form.setError("domainConnectionPreference", {
            type: "manual",
            message: t("onboarding.validation.domainConnectionRequired"),
          });
          return false;
        }
      }
    }
    
    // Step 2: Professional Emails - Check email redirect conditional logic
    if (stepIndex === 2) {
      // If email redirect is set to main-inbox, require the inbox address
      if (formValues.emailRedirect === "main-inbox") {
        if (!formValues.redirectInboxAddress) {
          form.setError("redirectInboxAddress", {
            type: "manual",
            message: t("onboarding.validation.redirectInboxRequired"),
          });
          return false;
        }
      }
    }
    
    console.log("✅ Validation PASSED for step", stepIndex);
    return true;
  };

  const nextStep = async () => {
    setShowValidationErrors(true);
    const isValid = await validateStep(currentStep);
    if (!isValid) {
      // Get current step's error fields for better error messaging
      const errors = form.formState.errors;
      const errorFields = Object.keys(errors);
      
      // Create a more specific error message
      let errorMessage = t("onboarding.validation.requiredFieldsError");
      if (errorFields.length > 0) {
        const fieldLabels: Record<string, string> = {
          hasDomain: t("onboarding.fields.hasDomain"),
          existingDomain: t("onboarding.fields.existingDomain"),
          domainConnectionPreference: t("onboarding.labels.domainConnection"),
          domainPurchasePreference: t("onboarding.labels.domainPurchase"),
          preferredDomains: t("onboarding.fields.preferredDomains")
        };
        
        const missingFields = errorFields
          .filter(field => fieldLabels[field])
          .map(field => fieldLabels[field]);
        
        if (missingFields.length > 0) {
          errorMessage = t("onboarding.validation.requiredFieldsDescription", { fields: missingFields.join(", ") });
        }
      }
      
      // Show toast with error message
      toast({
        title: t("onboarding.validation.requiredFieldsTitle"),
        description: errorMessage,
        variant: "destructive",
      });
      
      // Scroll to first error if validation fails
      const firstError = document.querySelector('[data-invalid="true"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setShowValidationErrors(false);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setShowValidationErrors(false);
    }
  };

  const handleCloudinaryUpload = async () => {
    if (typeof window !== "undefined" && (window as any).cloudinary) {
      // Use the domain from initialization for proper folder structure
      const accountEmail = user?.email || "unknown-user";
      const folderName = onboardingDomain 
        ? `Website Media/${accountEmail}/${onboardingDomain}`
        : `Client Files/${accountEmail}/Onboarding`;

      // Get Cloudinary configuration from server
      let cloudinaryConfig = { apiKey: "", cloudName: "" };
      try {
        const configResponse = await fetch("/api/cloudinary/signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paramsToSign: { folder: folderName } }),
          credentials: "include",
        });
        
        if (!configResponse.ok) {
          throw new Error("Failed to get configuration");
        }
        
        const configData = await configResponse.json();
        cloudinaryConfig.apiKey = configData.apiKey;
        cloudinaryConfig.cloudName = configData.cloudName;
      } catch (error) {
        console.error("Failed to get configuration:", error);
        toast({
          title: "Error",
          description: "Failed to initialize upload. Please try again.",
          variant: "destructive",
        });
        return;
      }

      (window as any).cloudinary.openUploadWidget(
        {
          cloudName: cloudinaryConfig.cloudName,
          apiKey: cloudinaryConfig.apiKey,
          uploadSignature: async (callback: any, paramsToSign: any) => {
            try {
              const signatureResponse = await fetch("/api/cloudinary/signature", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paramsToSign }),
                credentials: "include",
              });

              if (!signatureResponse.ok) {
                throw new Error("Failed to get upload signature");
              }

              const { signature, timestamp } = await signatureResponse.json();
              callback({ signature, timestamp });
            } catch (error) {
              console.error("Signature error:", error);
              toast({
                title: "Error",
                description: "Failed to prepare upload. Please try again.",
                variant: "destructive",
              });
            }
          },
          sources: ["local", "url"],
          multiple: false,
          maxFiles: 1,
          resourceType: "image",
          clientAllowedFormats: ["png", "jpg", "jpeg", "gif", "webp"],
          maxFileSize: 10000000, // 10MB
          folder: folderName,
        },
        (error: any, result: any) => {
          if (!error && result.event === "success") {
            const uploadedFile = {
              name: result.info.original_filename,
              url: result.info.secure_url,
              publicId: result.info.public_id,
            };
            setSelectedFile(uploadedFile as any);
            form.setValue("businessLogo", uploadedFile);
            toast({
              title: t("onboarding.uploadSuccessful"),
              description: t("onboarding.uploadSuccessfulDesc", {
                filename: result.info.original_filename,
              }),
            });
          } else if (error) {
            toast({
              title: t("onboarding.uploadError"),
              description: t("onboarding.uploadErrorDesc"),
              variant: "destructive",
            });
            console.error("Cloudinary upload error:", error);
          }
        },
      );
    } else {
      toast({
        title: t("onboarding.uploadServiceUnavailable"),
        description: t("onboarding.uploadServiceUnavailableDesc"),
        variant: "destructive",
      });
    }
  };

  const handleContentUpload = async (contentType: "text" | "media") => {
    if (typeof window !== "undefined" && (window as any).cloudinary) {
      // Use the domain from initialization for proper folder structure
      const accountEmail = user?.email || "unknown-user";
      const folderName = onboardingDomain 
        ? `Website Media/${accountEmail}/${onboardingDomain}`
        : `Client Files/${accountEmail}/Onboarding`;

      const config =
        contentType === "text"
          ? {
              resourceType: "auto",
              clientAllowedFormats: ["pdf", "doc", "docx", "txt"],
              maxFileSize: 10000000, // 10MB
              maxFiles: 5,
            }
          : {
              resourceType: "auto",
              clientAllowedFormats: [
                "jpg",
                "jpeg",
                "png",
                "gif",
                "webp",
                "mp4",
                "mov",
                "avi",
                "pdf",
                "doc",
                "docx",
              ],
              maxFileSize: 50000000, // 50MB
              maxFiles: 10,
            };

      // Get Cloudinary configuration from server
      let cloudinaryConfig = { apiKey: "", cloudName: "" };
      try {
        const configResponse = await fetch("/api/cloudinary/signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paramsToSign: { folder: folderName } }),
          credentials: "include",
        });
        
        if (!configResponse.ok) {
          throw new Error("Failed to get configuration");
        }
        
        const configData = await configResponse.json();
        cloudinaryConfig.apiKey = configData.apiKey;
        cloudinaryConfig.cloudName = configData.cloudName;
      } catch (error) {
        console.error("Failed to get configuration:", error);
        toast({
          title: "Error",
          description: "Failed to initialize upload. Please try again.",
          variant: "destructive",
        });
        return;
      }

      (window as any).cloudinary.openUploadWidget(
        {
          cloudName: cloudinaryConfig.cloudName,
          apiKey: cloudinaryConfig.apiKey,
          uploadSignature: async (callback: any, paramsToSign: any) => {
            try {
              const signatureResponse = await fetch("/api/cloudinary/signature", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paramsToSign }),
                credentials: "include",
              });

              if (!signatureResponse.ok) {
                throw new Error("Failed to get upload signature");
              }

              const { signature, timestamp } = await signatureResponse.json();
              callback({ signature, timestamp });
            } catch (error) {
              console.error("Signature error:", error);
              toast({
                title: "Error",
                description: "Failed to prepare upload. Please try again.",
                variant: "destructive",
              });
            }
          },
          sources: ["local", "url"],
          multiple: true,
          folder: folderName,
          ...config,
        },
        (error: any, result: any) => {
          if (!error && result.event === "success") {
            const fieldName =
              contentType === "text" ? "textContentFiles" : "mediaContentFiles";
            const currentFiles = form.getValues(fieldName) || [];
            const newFile = {
              name: result.info.original_filename,
              url: result.info.secure_url,
              publicId: result.info.public_id,
            };

            form.setValue(fieldName, [...currentFiles, newFile]);
            toast({
              title: "Upload Successful",
              description: `${result.info.original_filename} uploaded successfully`,
            });
          } else if (error) {
            toast({
              title: "Upload Error",
              description: "Failed to upload file. Please try again.",
              variant: "destructive",
            });
          }
        },
      );
    } else {
      toast({
        title: "Upload Service Unavailable",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

  // Helper function to collect all selected purchasable items
  const getSelectedPurchasableItems = () => {
    const items: Record<string, any> = {};
    PURCHASABLE_FIELDS.forEach(fieldName => {
      const value = form.getValues(fieldName as any);
      if (value && value !== "none" && value !== "") {
        items[fieldName] = value;
      }
    });
    return items;
  };

  const handleLogoPayment = async (data: FormData, logoType: string) => {
    try {
      setIsSubmitting(true);
      
      // Check if user has saved payment method
      const checkResponse = await fetch("/api/check-saved-payment-method");
      if (checkResponse.ok) {
        const paymentData = await checkResponse.json();
        
        if (paymentData.hasSavedPaymentMethod) {
          // User has saved payment method - show dialog
          setSavedPaymentMethod({
            last4: paymentData.last4,
            brand: paymentData.brand,
          });
          setPendingLogoData({ data, logoType });
          setShowPaymentDialog(true);
          setIsSubmitting(false);
          return;
        }
      }
      
      // No saved payment method - proceed to checkout
      await proceedToCheckout(data, logoType);
      
    } catch (error) {
      console.error("Logo payment error:", error);
      toast({
        title: t("onboarding.toasts.paymentError"),
        description: t("onboarding.toasts.paymentErrorDesc"),
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const proceedToCheckout = async (data: FormData, logoType: string) => {
    try {
      setIsSubmitting(true);
      
      // Store onboarding data in sessionStorage before redirect
      sessionStorage.setItem("onboardingData", JSON.stringify(data));
      sessionStorage.setItem("logoType", logoType);
      
      // Create checkout session (onboarding data stays in sessionStorage)
      const response = await fetch("/api/create-logo-design-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logoType,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { url } = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = url;
      
    } catch (error) {
      console.error("Logo payment error:", error);
      toast({
        title: t("onboarding.toasts.paymentError"),
        description: t("onboarding.toasts.paymentErrorDesc"),
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handlePayWithSavedCard = async () => {
    if (!pendingLogoData) return;
    
    try {
      setIsSubmitting(true);
      setShowPaymentDialog(false);
      
      const response = await fetch("/api/pay-logo-with-saved-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logoType: pendingLogoData.logoType,
        }),
      });

      if (!response.ok) {
        throw new Error("Payment failed");
      }

      const result = await response.json();
      
      if (result.success) {
        // Payment succeeded - store data and proceed
        // Create a serializable copy of the data (excluding File objects and non-serializable values)
        const serializableData = { ...pendingLogoData.data };
        
        // Convert any File objects or complex structures to serializable format
        Object.keys(serializableData).forEach((key) => {
          const value = serializableData[key as keyof typeof serializableData];
          if (value instanceof File || value instanceof FileList) {
            // Skip files - they should already be uploaded to Cloudinary
            delete serializableData[key as keyof typeof serializableData];
          } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Try to serialize objects, if it fails, delete them
            try {
              JSON.stringify(value);
            } catch {
              delete serializableData[key as keyof typeof serializableData];
            }
          }
        });
        
        sessionStorage.setItem("onboardingData", JSON.stringify(serializableData));
        sessionStorage.setItem("logoType", pendingLogoData.logoType);
        sessionStorage.setItem("paymentIntentId", result.paymentIntentId);
        
        // Redirect to success page (simulates coming back from Stripe)
        navigate(`/onboarding-logo-success?payment_intent=${result.paymentIntentId}`);
      } else {
        toast({
          title: t("onboarding.toasts.paymentFailed"),
          description: result.message || t("onboarding.toasts.paymentFailedDesc"),
          variant: "destructive",
        });
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Saved card payment error:", error);
      toast({
        title: t("onboarding.toasts.paymentError"),
        description: t("onboarding.toasts.paymentProcessErrorDesc"),
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleValidationError = (errors: any) => {
    setShowValidationErrors(true);
    console.log("❌ Form validation errors:", errors);
    console.log("📋 Current form values:", form.getValues());
    
    toast({
      title: t("onboarding.toasts.correctErrors"),
      description: t("onboarding.toasts.correctErrorsDesc"),
      variant: "destructive",
    });
  };

  const handlePaymentStepSubmit = () => {
    form.handleSubmit(onSubmit, handleValidationError)();
  };

  const onSubmit = async (data: FormData) => {
    // Find step indices dynamically
    const paymentStepIndex = steps.findIndex(s => s.title === t("onboarding.stepTitles.reviewPayment"));
    const reviewSubmitStepIndex = steps.findIndex(s => s.title === t("onboarding.stepTitles.reviewSubmit"));
    const confirmationStepIndex = steps.findIndex(s => s.title === t("onboarding.stepTitles.confirmation"));
    
    // Handle payment step (if it exists in the steps array)
    if (paymentStepIndex !== -1 && currentStep === paymentStepIndex) {
      // Get all selected purchasable items
      const selectedItems = getSelectedPurchasableItems();
      
      if (Object.keys(selectedItems).length > 0) {
        // User has selected purchasable items - proceed to payment
        // For now, handle logo design service (the current purchasable item)
        // When adding new purchasable items:
        // 1. Update backend API to accept multiple items
        // 2. Calculate total price based on all selected items
        // 3. Process payment for all items together
        
        if (selectedItems.logoDesignService) {
          await handleLogoPayment(data, selectedItems.logoDesignService);
          return;
        }
        
        // TODO: Add handling for other purchasable items here
        // Example:
        // if (selectedItems.websiteHosting) { ... }
        // if (selectedItems.extraPages) { ... }
        
      } else {
        // No purchasable items selected - proceed to review & submit
        setCurrentStep(reviewSubmitStepIndex);
        setShowValidationErrors(false);
        return;
      }
    }

    // Handle review & submit step - move to confirmation
    if (currentStep === reviewSubmitStepIndex) {
      setCurrentStep(confirmationStepIndex);
      setShowValidationErrors(false);
      return;
    }

    // Trigger validation for all fields in the form
    const isFormValid = await form.trigger();

    if (!isFormValid) {
      setShowValidationErrors(true);
      toast({
        title: "Please correct the errors",
        description: "Make sure all required fields are filled correctly",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if user is authenticated first
      if (!user) {
        toast({
          title: t("onboarding.toasts.authRequired"),
          description: t("onboarding.toasts.authRequiredDesc"),
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      const formData = new FormData();

      // Step 1: Business Information
      formData.append("businessName", data.businessName || "");
      formData.append("contactName", data.contactName || "");
      formData.append("contactPhone", data.contactPhone || "");
      formData.append("contactEmail", data.contactEmail || "");
      formData.append("businessDescription", data.businessDescription || "");
      formData.append("websiteLanguage", data.websiteLanguage || "en");

      // Step 2: Domain
      formData.append("hasDomain", data.hasDomain || "");
      formData.append("existingDomain", data.existingDomain || "");
      formData.append(
        "domainConnectionPreference",
        data.domainConnectionPreference || "",
      );
      formData.append(
        "domainPurchasePreference",
        data.domainPurchasePreference || "",
      );
      formData.append("preferredDomains", data.preferredDomains || "");

      // Step 3: Professional Emails
      formData.append("hasEmails", data.hasEmails || "");
      formData.append("emailProvider", data.emailProvider || "");
      formData.append("emailAccess", data.emailAccess || "");
      formData.append("existingEmails", data.existingEmails || "");
      formData.append("emailCount", data.emailCount || "");
      formData.append("emailNames", data.emailNames || "");
      formData.append("emailRedirect", data.emailRedirect || "");
      formData.append("redirectInboxAddress", data.redirectInboxAddress || "");

      // Step 4: Website Foundation
      formData.append("hasWebsite", data.hasWebsite || "");
      formData.append("websiteLink", data.websiteLink || "");
      formData.append("websiteChanges", data.websiteChanges || "");
      formData.append("wantedPages", JSON.stringify(data.wantedPages || []));
      formData.append("notSurePages", data.notSurePages ? "true" : "false");
      formData.append("hasTextContent", data.hasTextContent || "");
      formData.append("hasMediaContent", data.hasMediaContent || "");

      // Step 5: Design Preferences
      formData.append("createTextLogo", data.createTextLogo ? "true" : "false");
      formData.append("colorPalette", data.colorPalette || "");
      formData.append(
        "inspirationWebsites",
        JSON.stringify(data.inspirationWebsites || []),
      );
      formData.append("preferredFonts", data.preferredFonts || "");
      formData.append("siteStyle", data.siteStyle || "");

      // Step 6: Template Selection
      formData.append(
        "selectedTemplateId",
        data.selectedTemplateId?.toString() || "",
      );
      formData.append(
        "customTemplateRequest",
        data.customTemplateRequest || "",
      );

      // Step 7: Social Media
      formData.append("hasSocialMedia", data.hasSocialMedia || "");
      formData.append("facebookLink", data.facebookLink || "");
      formData.append("instagramLink", data.instagramLink || "");
      formData.append("linkedinLink", data.linkedinLink || "");
      formData.append("tiktokLink", data.tiktokLink || "");
      formData.append("youtubeLink", data.youtubeLink || "");
      formData.append("otherSocialLinks", data.otherSocialLinks || "");

      // Step 8: Practical Information
      formData.append("projectDeadline", data.projectDeadline || "");
      formData.append("additionalNotes", data.additionalNotes || "");

      // Handle business logo (Cloudinary URL)
      if (selectedFile) {
        if ((selectedFile as any).url) {
          // Cloudinary upload - send URL and metadata
          formData.append("businessLogoUrl", (selectedFile as any).url);
          formData.append("businessLogoName", (selectedFile as any).name);
          formData.append(
            "businessLogoPublicId",
            (selectedFile as any).publicId || "",
          );
        } else if (selectedFile instanceof File) {
          // Fallback for direct file upload
          formData.append("businessLogo", selectedFile);
        }
      }

      // Add website progress ID if available (from initialization)
      if (websiteProgressId) {
        formData.append("websiteProgressId", websiteProgressId.toString());
      }

      // Add subscription ID if provided (from post-purchase flow)
      if (subscriptionId) {
        formData.append("subscriptionId", subscriptionId);
      }

      const response = await fetch("/api/onboarding-form", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: t("onboarding.toasts.sessionExpired"),
            description: t("onboarding.toasts.sessionExpiredDesc"),
            variant: "destructive",
          });
          navigate("/login");
          return;
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit form");
      }

      // Navigate directly to dashboard on success
      navigate("/dashboard");
    } catch (error) {
      console.error("Form submission error:", error);
      setSubmissionResult({
        success: false,
        title: t("onboarding.submissionFailed"),
        message: t("onboarding.submissionFailedDesc"),
      });
      setShowResultModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleModalClose = () => {
    setShowResultModal(false);
    setSubmissionResult(null);
    if (submissionResult?.success) {
      navigate("/dashboard");
    }
  };

  // Demo data filling function for testing
  const fillDemoData = () => {
    const demoData = {
      // Step 1: Business Information
      businessName: "Acme Coffee Roasters",
      contactName: "John Smith",
      contactPhone: "+1-555-123-4567",
      contactEmail: "john.smith@acmecoffee.com",
      businessDescription:
        "We are a premium coffee roasting company specializing in single-origin beans and custom blends for cafes and restaurants.",

      // Step 2: Domain
      hasDomain: "no" as const,
      domainPurchasePreference: "you_buy" as const,
      preferredDomains: "acmecoffee.com, premiumcoffee.com",

      // Step 3: Professional Emails
      hasEmails: "no" as const,
      emailCount: "3",
      emailNames: "info, orders, support",
      emailRedirect: "main-inbox" as const,
      redirectInboxAddress: "john.smith@acmecoffee.com",

      // Step 4: Website Foundation
      hasWebsite: "no" as const,
      wantedPages: ["Home", "About Us", "Products", "Contact", "Online Store"],
      hasTextContent: "no" as const,
      hasMediaContent: "yes" as const,

      // Step 5: Design Preferences
      colorPalette: "Warm earth tones - browns, creams, deep oranges",
      logoDesignService: "premium" as const,
      inspirationWebsites: [
        "https://bluebottlecoffee.com",
        "https://intelligentsia.com",
      ],
      preferredFonts:
        "Modern serif for headings, clean sans-serif for body text",
      siteStyle: "curved" as const,

      // Step 6: Social Media
      hasSocialMedia: "yes" as const,
      facebookLink: "https://facebook.com/acmecoffee",
      instagramLink: "https://instagram.com/acmecoffee",

      // Step 7: Practical Information
      projectDeadline: "2025-12-01",
      additionalNotes:
        "We're launching a new product line in December and need the website ready for the holiday season. Please emphasize our sustainability practices and local sourcing.",
    };

    // Fill all form fields with demo data
    Object.entries(demoData).forEach(([key, value]) => {
      form.setValue(key as any, value);
    });

    toast({
      title: t("onboarding.toasts.demoDataLoaded"),
      description: t("onboarding.toasts.demoDataLoadedDesc"),
    });
  };

  const handleContinueToForm = () => {
    setShowSuccessMessage(false);
  };

  const renderStepContent = () => {
    const hasDomainValue = form.watch("hasDomain");
    const hasEmailsValue = form.watch("hasEmails");
    const hasWebsiteValue = form.watch("hasWebsite");
    const hasSocialMediaValue = form.watch("hasSocialMedia");
    const hasTextContentValue = form.watch("hasTextContent");
    const hasMediaContentValue = form.watch("hasMediaContent");

    switch (currentStep) {
      // Step 1: Business Information
      case 0:
        return (
          <div key={`step-0-${forceRender}`} className="space-y-6">
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding.fields.businessName")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("onboarding.placeholders.businessName")}
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name="businessName"
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="websiteLanguage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding.fields.websiteLanguage")}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-website-language">
                        <SelectValue placeholder={t("onboarding.placeholders.websiteLanguage")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="en" data-testid="option-language-english">
                        {t("onboarding.languageOptions.english")}
                      </SelectItem>
                      <SelectItem value="gr" data-testid="option-language-greek">
                        {t("onboarding.languageOptions.greek")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t("onboarding.mainContactPerson")}</h3>
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding.fields.contactName")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("onboarding.placeholders.contactName")}
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name="contactName"
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding.fields.contactPhone")}</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder={t("onboarding.placeholders.contactPhone")}
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name="contactPhone"
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Account Email - Pre-filled from user account */}
              <FormField
                control={form.control}
                name="accountEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding.fields.accountEmail")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="account@email.com"
                        value={user?.email || field.value || ""}
                        disabled
                        className="bg-gray-50 text-gray-600"
                      />
                    </FormControl>
                    <div className="text-xs text-gray-500 mt-1">
                      {t("onboarding.helperTexts.accountEmailNote")}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contact Person Email - Editable */}
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding.fields.contactEmail")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("onboarding.placeholders.contactEmail")}
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name="contactEmail"
                        ref={field.ref}
                        className={fieldState.error ? "border-red-500" : ""}
                        data-invalid={fieldState.error ? "true" : "false"}
                      />
                    </FormControl>
                    <div className="text-xs text-gray-500 mt-1">
                      {t("onboarding.helperTexts.contactEmailNote")}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="businessDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("onboarding.fields.businessDescription")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("onboarding.placeholders.businessDescription")}
                      className="min-h-[100px]"
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name="businessDescription"
                      ref={field.ref}
                    />
                  </FormControl>
                  {/* <p className="text-sm text-gray-500 mt-1">
                    {t("onboarding.noteUpdateLater")}
                  </p> */}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      // Step 2: Domain
      case 1:
        const domainConnectionPreferenceValue = form.watch(
          "domainConnectionPreference",
        );
        const domainPurchasePreferenceValue = form.watch(
          "domainPurchasePreference",
        );

        return (
          <div key={`step-1-${forceRender}`} className="space-y-6">
            <FormField
              control={form.control}
              name="hasDomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding.fields.hasDomain")}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="domain-yes" />
                        <label htmlFor="domain-yes">{t("onboarding.options.yes")}</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="domain-no" />
                        <label htmlFor="domain-no">{t("onboarding.options.no")}</label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {hasDomainValue === "yes" && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="existingDomain"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>{t("onboarding.labels.whatIsYourDomain")} <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("onboarding.placeholders.existingDomain")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="existingDomain"
                          ref={field.ref}
                          className={fieldState.error ? "border-red-500" : ""}
                          data-invalid={fieldState.error ? "true" : "false"}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="domainConnectionPreference"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>
                        {t("onboarding.labels.whoWillConnect")} <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div data-invalid={fieldState.error ? "true" : "false"}>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="i_will_connect"
                                id="connect-self"
                              />
                              <label htmlFor="connect-self">
                                {t("onboarding.options.domainConnectionMyself")}
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="you_connect"
                                id="connect-you"
                              />
                              <label htmlFor="connect-you">
                                {t("onboarding.options.domainConnectionYou")}
                              </label>
                            </div>
                          </RadioGroup>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {domainConnectionPreferenceValue === "i_will_connect" && (
                  <div className="text-sm bg-blue-50 p-4 rounded-md border border-blue-200">
                    <p className="text-blue-700">
                      {t("onboarding.options.weWillSendDNSDetails")}
                    </p>
                  </div>
                )}

                {domainConnectionPreferenceValue === "you_connect" && (
                  <div className="text-sm bg-purple-50 p-4 rounded-md border border-purple-200">
                    <p className="text-purple-700">
                      {t("onboarding.options.weWillNeedRegistrarCredentials")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {hasDomainValue === "no" && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="domainPurchasePreference"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>{t("onboarding.labels.whoWillBuy")}</FormLabel>
                      <FormControl>
                        <div data-invalid={fieldState.error ? "true" : "false"}>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="i_will_buy" id="buy-self" />
                              <label htmlFor="buy-self">{t("onboarding.options.domainPurchaseMyself")}</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="you_buy" id="buy-you" />
                              <label htmlFor="buy-you">
                                {t("onboarding.options.domainPurchaseYou")}
                              </label>
                            </div>
                          </RadioGroup>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredDomains"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>
                        {t("onboarding.fields.preferredDomains")} <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("onboarding.placeholders.preferredDomains")}
                          className={`min-h-[100px] ${fieldState.error ? "border-red-500" : ""}`}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="preferredDomains"
                          ref={field.ref}
                          data-invalid={fieldState.error ? "true" : "false"}
                        />
                      </FormControl>
                      <div className="text-sm font-medium text-orange-600 bg-orange-50 p-3 rounded-md mt-2">
                        {t("onboarding.options.domainNotice")}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {domainPurchasePreferenceValue === "i_will_buy" && (
                  <FormField
                    control={form.control}
                    name="domainConnectionPreference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("onboarding.labels.whoWillConnect")} <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="i_will_connect"
                                id="connect-self-buy"
                              />
                              <label htmlFor="connect-self-buy">
                                {t("onboarding.labels.IwillConnectItMyself")}
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="you_connect"
                                id="connect-you-buy"
                              />
                              <label htmlFor="connect-you-buy">
                                {t("onboarding.labels.youWillConnectItForMe")}
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {domainPurchasePreferenceValue === "i_will_buy" &&
                  domainConnectionPreferenceValue === "i_will_connect" && (
                    <div className="text-sm bg-green-50 p-4 rounded-md border border-green-200">
                      <p className="text-green-700">
                        {t("onboarding.labels.onceDomainPurchased")}
                      </p>
                    </div>
                  )}

                {domainPurchasePreferenceValue === "i_will_buy" &&
                  domainConnectionPreferenceValue === "you_connect" && (
                    <div className="text-sm bg-purple-50 p-4 rounded-md border border-purple-200">
                      <p className="text-green-700">
                        {t("onboarding.labels.onceDomainPurchasedCredentials")}
                      </p>
                    </div>
                  )}

                {domainPurchasePreferenceValue === "you_buy" && (
                  <div className="text-sm bg-indigo-50 p-4 rounded-md border border-indigo-200">
                    <p className="font-medium text-green-900 mb-2">
                      {t("onboarding.labels.actionPurchaseAndConnectDomain")}
                    </p>
                    <p className="text-green-700">
                      {t("onboarding.labels.weWillPurchaseAndConnectDomain")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      // Step 3: Professional Emails
      case 2:
        return (
          <div key={`step-2-${forceRender}`} className="space-y-6">
            <FormField
              control={form.control}
              name="hasEmails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding.fields.hasEmails")}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="emails-yes" />
                        <label htmlFor="emails-yes">{t("onboarding.options.yes")}</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="emails-no" />
                        <label htmlFor="emails-no">{t("onboarding.options.no")}</label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {hasEmailsValue === "yes" && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="emailProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("onboarding.fields.emailAccess")}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provider name (Gmail, Outlook, etc.), login credentials..."
                          className="min-h-[80px]"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="emailProvider"
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="existingEmails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("onboarding.fields.existingEmails")}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="info@yourbusiness.com&#10;sales@yourbusiness.com&#10;support@yourbusiness.com"
                          className="min-h-[80px]"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="existingEmails"
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {hasEmailsValue === "no" && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="emailCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("onboarding.fields.emailCount")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 3"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="emailCount"
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emailNames"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("onboarding.fields.emailNames")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="info&#10;sales&#10;support"
                          className="min-h-[80px]"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="emailNames"
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {(hasEmailsValue === "yes" || hasEmailsValue === "no") && (
              <>
                <FormField
                  control={form.control}
                  name="emailRedirect"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("onboarding.fields.emailRedirect")}
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col space-y-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="main-inbox"
                              id="redirect-main"
                            />
                            <label htmlFor="redirect-main">
                              {t("onboarding.options.emailRedirectOne")}
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="separate"
                              id="redirect-separate"
                            />
                            <label htmlFor="redirect-separate">
                              {t("onboarding.options.emailRedirectSeparate")}
                            </label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Redirect Inbox Address - Show when main-inbox is selected */}
                {form.watch("emailRedirect") === "main-inbox" && (
                  <FormField
                    control={form.control}
                    name="redirectInboxAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("onboarding.fields.redirectInboxAddress")} <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder={t("onboarding.placeholders.redirectInboxAddress")}
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name="redirectInboxAddress"
                            ref={field.ref}
                          />
                        </FormControl>
                        <div className="text-xs text-gray-500 mt-1">
                          {t("onboarding.helperTexts.redirectInboxNote")}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}
          </div>
        );

      // Step 4: Website Foundation
      case 3:
        return (
          <div key={`step-3-${forceRender}`} className="space-y-6">
            <FormField
              control={form.control}
              name="hasWebsite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding.fields.hasWebsite")}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="website-yes" />
                        <label htmlFor="website-yes">{t("onboarding.options.yes")}</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="website-no" />
                        <label htmlFor="website-no">{t("onboarding.options.no")}</label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {hasWebsiteValue === "yes" && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="websiteLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("onboarding.fields.websiteLink")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("onboarding.placeholders.websiteLink")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="websiteLink"
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="websiteChanges"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("onboarding.fields.websiteChanges")}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("onboarding.placeholders.websiteChanges")}
                          className="min-h-[100px]"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="websiteChanges"
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {hasWebsiteValue === "no" && (
              <div className="space-y-4">
                <div>
                  <FormLabel className="text-base font-medium">
                    {t("onboarding.fields.wantedPages")}
                  </FormLabel>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      t("onboarding.pages.home"),
                      t("onboarding.pages.about"),
                      t("onboarding.pages.services"),
                      t("onboarding.pages.digitalProducts"),
                      t("onboarding.pages.blog"),
                      t("onboarding.pages.contact"),
                      t("onboarding.pages.other"),
                    ].map((page) => (
                      <div key={page} className="flex items-center space-x-2">
                        <Checkbox
                          id={`page-${page.toLowerCase()}`}
                          checked={
                            form.watch("wantedPages")?.includes(page) || false
                          }
                          onCheckedChange={(checked) => {
                            const currentPages =
                              form.watch("wantedPages") || [];
                            if (checked) {
                              form.setValue("wantedPages", [
                                ...currentPages,
                                page,
                              ]);
                            } else {
                              form.setValue(
                                "wantedPages",
                                currentPages.filter((p) => p !== page),
                              );
                            }
                          }}
                        />
                        <label htmlFor={`page-${page.toLowerCase()}`}>
                          {page}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="notSurePages"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          {t("onboarding.fields.notSurePages")}
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="hasTextContent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding.fields.hasTextContent")}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="text-yes" />
                        <label htmlFor="text-yes">{t("onboarding.options.yes")}</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="text-no" />
                        <label htmlFor="text-no">{t("onboarding.options.no")}</label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {hasTextContentValue === "yes" && (
              <div>
                <FormLabel className="text-base font-medium mb-4 block">
                  {t("onboarding.fields.uploadTextContent")}
                </FormLabel>
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <div className="text-sm text-gray-600 mb-2">
                    {t("onboarding.uploadTexts.uploadTextFiles")}
                  </div>
                  <div className="text-xs text-gray-500 mb-4">
                    {t("onboarding.uploadTexts.textFileFormats")}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleContentUpload("text")}
                    className="bg-white hover:bg-gray-50"
                  >
                    {t("onboarding.uploadTexts.chooseFiles")}
                  </Button>
                </div>
                
                {/* Show uploaded text files */}
                {form.watch("textContentFiles") && form.watch("textContentFiles").length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-green-700">
                      ✓ {t("onboarding.uploadTexts.filesUploaded", { count: form.watch("textContentFiles").length })}
                    </p>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      {form.watch("textContentFiles").map((file: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-2 text-sm text-green-800 py-1">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <CheckCircle className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              const currentFiles = form.watch("textContentFiles") || [];
                              const updatedFiles = currentFiles.filter((_: any, i: number) => i !== index);
                              form.setValue("textContentFiles", updatedFiles);
                            }}
                          >
                            ✕
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-gray-500 mt-2 bg-blue-50 p-3 rounded-md">
                  📝 You can also upload more text content from your dashboard
                  after form submission.
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="hasMediaContent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("onboarding.fields.hasMediaContent")}
                  </FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="media-yes" />
                        <label htmlFor="media-yes">{t("onboarding.options.yes")}</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="media-no" />
                        <label htmlFor="media-no">{t("onboarding.options.no")}</label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {hasMediaContentValue === "yes" && (
              <div>
                <FormLabel className="text-base font-medium mb-4 block">
                  {t("onboarding.fields.uploadMediaContent")}
                </FormLabel>
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <div className="text-sm text-gray-600 mb-2">
                    {t("onboarding.uploadTexts.uploadMediaFiles")}
                  </div>
                  <div className="text-xs text-gray-500 mb-4">
                    {t("onboarding.uploadTexts.mediaFileFormats")}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleContentUpload("media")}
                    className="bg-white hover:bg-gray-50"
                  >
                    {t("onboarding.uploadTexts.chooseFiles")}
                  </Button>
                </div>
                
                {/* Show uploaded media files */}
                {form.watch("mediaContentFiles") && form.watch("mediaContentFiles").length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-green-700">
                      ✓ {t("onboarding.uploadTexts.filesUploaded", { count: form.watch("mediaContentFiles").length })}
                    </p>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {form.watch("mediaContentFiles").map((file: any, index: number) => (
                          <div key={index} className="relative group">
                            <div className="aspect-video bg-white rounded-lg overflow-hidden border border-green-300">
                              {file.url && (file.url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                  <span className="text-xs text-gray-500 truncate px-2">
                                    {file.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                              <CheckCircle className="h-3 w-3 text-white" />
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute bottom-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                const currentFiles = form.watch("mediaContentFiles") || [];
                                const updatedFiles = currentFiles.filter((_: any, i: number) => i !== index);
                                form.setValue("mediaContentFiles", updatedFiles);
                              }}
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-gray-500 mt-2 bg-blue-50 p-3 rounded-md">
                  📸 You can also upload more files from your dashboard after
                  form submission.
                </div>
              </div>
            )}
          </div>
        );

      // Step 5: Design Preferences
      case 4:
        return (
          <div key={`step-4-${forceRender}`} className="space-y-6">
            <div>
              <FormLabel className="text-base font-medium mb-4 block">
                {t("onboarding.fields.businessLogo")}
              </FormLabel>
              <FormField
                control={form.control}
                name="businessLogo"
                render={({ fieldState }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <div className="text-sm text-gray-600 mb-2">
                          {selectedFile
                            ? selectedFile.name
                            : t("onboarding.uploadTexts.uploadLogoFiles")}
                        </div>
                        <div className="text-xs text-gray-500 mb-4">
                          {t("onboarding.uploadTexts.logoFileFormats")}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCloudinaryUpload}
                          className="bg-white hover:bg-gray-50"
                        >
                          {t("onboarding.uploadTexts.chooseFiles")}
                        </Button>
                        {selectedFile && (selectedFile as any).url && (
                          <div className="mt-4 relative inline-block">
                            <img
                              src={(selectedFile as any).url}
                              alt="Logo preview"
                              className="mx-auto max-w-32 max-h-32 object-contain rounded-lg border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                              onClick={() => {
                                setSelectedFile(null);
                                form.setValue("businessLogo", null);
                              }}
                            >
                              ✕
                            </Button>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    {showValidationErrors && fieldState.error && (
                      <p className="text-sm font-medium text-destructive">
                        {fieldState.error.message}
                      </p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="logoDesignService"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("onboarding.fields.logoDesignService")}
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-3"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="none" id="logo-none" />
                          <label htmlFor="logo-none">
                            {t("onboarding.options.logoServiceNone")}
                          </label>
                        </div>
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="basic" id="logo-basic" />
                            <label htmlFor="logo-basic" className="font-medium">
                              {t("onboarding.options.logoServiceBasic")}
                            </label>
                          </div>
                          <p className="text-xs text-gray-600 ml-6">
                            {t("onboarding.options.deliverablesBasicLogo")}
                          </p>
                        </div>
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="premium" id="logo-premium" />
                            <label
                              htmlFor="logo-premium"
                              className="font-medium"
                            >
                              {t("onboarding.options.logoServicePremium")}
                            </label>
                          </div>
                          <p className="text-xs text-gray-600 ml-6">
                            {t("onboarding.options.deliverablesBrandIdentity")}
                          </p>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <FormLabel className="text-base font-medium">
                {t("onboarding.fields.colorPalette")}
              </FormLabel>
              <p className="text-sm text-gray-600">
                {t("onboarding.helperTexts.colorPaletteNote")}
              </p>

              <FormField
                control={form.control}
                name="colorPalette"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding.labels.primaryColor")}</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <Input
                          type="color"
                          value={field.value?.split("|")[0] || "#3B82F6"}
                          onChange={(e) => {
                            const colors = field.value?.split("|") || [
                              "",
                              "",
                              "",
                              "",
                            ];
                            colors[0] = e.target.value;
                            field.onChange(colors.join("|"));
                          }}
                          className="w-20 h-10 cursor-pointer"
                        />
                        <Input
                          type="text"
                          placeholder="#3B82F6"
                          value={field.value?.split("|")[0] || ""}
                          onChange={(e) => {
                            const colors = field.value?.split("|") || [
                              "",
                              "",
                              "",
                              "",
                            ];
                            colors[0] = e.target.value;
                            field.onChange(colors.join("|"));
                          }}
                          className="flex-1"
                        />
                      </div>
                    </FormControl>
                    <p className="text-xs text-gray-500">
                      {t("onboarding.helperTexts.primaryColorDesc")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="colorPalette"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding.labels.backgroundColor")}</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <Input
                          type="color"
                          value={field.value?.split("|")[1] || "#FFFFFF"}
                          onChange={(e) => {
                            const colors = field.value?.split("|") || [
                              "",
                              "",
                              "",
                              "",
                            ];
                            colors[1] = e.target.value;
                            field.onChange(colors.join("|"));
                          }}
                          className="w-20 h-10 cursor-pointer"
                        />
                        <Input
                          type="text"
                          placeholder="#FFFFFF"
                          value={field.value?.split("|")[1] || ""}
                          onChange={(e) => {
                            const colors = field.value?.split("|") || [
                              "",
                              "",
                              "",
                              "",
                            ];
                            colors[1] = e.target.value;
                            field.onChange(colors.join("|"));
                          }}
                          className="flex-1"
                        />
                      </div>
                    </FormControl>
                    <p className="text-xs text-gray-500">
                      {t("onboarding.helperTexts.backgroundColorDesc")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="colorPalette"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding.labels.textColor")}</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <Input
                          type="color"
                          value={field.value?.split("|")[2] || "#1F2937"}
                          onChange={(e) => {
                            const colors = field.value?.split("|") || [
                              "",
                              "",
                              "",
                              "",
                            ];
                            colors[2] = e.target.value;
                            field.onChange(colors.join("|"));
                          }}
                          className="w-20 h-10 cursor-pointer"
                        />
                        <Input
                          type="text"
                          placeholder="#1F2937"
                          value={field.value?.split("|")[2] || ""}
                          onChange={(e) => {
                            const colors = field.value?.split("|") || [
                              "",
                              "",
                              "",
                              "",
                            ];
                            colors[2] = e.target.value;
                            field.onChange(colors.join("|"));
                          }}
                          className="flex-1"
                        />
                      </div>
                    </FormControl>
                    <p className="text-xs text-gray-500">
                      {t("onboarding.helperTexts.textColorDesc")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="colorPalette"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("onboarding.labels.accentColor")}</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <Input
                          type="color"
                          value={field.value?.split("|")[3] || "#10B981"}
                          onChange={(e) => {
                            const colors = field.value?.split("|") || [
                              "",
                              "",
                              "",
                              "",
                            ];
                            colors[3] = e.target.value;
                            field.onChange(colors.join("|"));
                          }}
                          className="w-20 h-10 cursor-pointer"
                        />
                        <Input
                          type="text"
                          placeholder="#10B981"
                          value={field.value?.split("|")[3] || ""}
                          onChange={(e) => {
                            const colors = field.value?.split("|") || [
                              "",
                              "",
                              "",
                              "",
                            ];
                            colors[3] = e.target.value;
                            field.onChange(colors.join("|"));
                          }}
                          className="flex-1"
                        />
                      </div>
                    </FormControl>
                    <p className="text-xs text-gray-500">
                      {t("onboarding.helperTexts.accentColorDesc")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>

            <div className="space-y-2">
              <FormLabel>
                {t("onboarding.fields.inspirationWebsites")}
              </FormLabel>
              {[0, 1, 2].map((index) => (
                <Input
                  key={index}
                  placeholder={t("onboarding.inspirationWebsitesPlaceholder", { number: index + 1 })}
                  value={form.watch("inspirationWebsites")?.[index] || ""}
                  onChange={(e) => {
                    const current = form.watch("inspirationWebsites") || [
                      "",
                      "",
                      "",
                    ];
                    current[index] = e.target.value;
                    form.setValue("inspirationWebsites", [...current]);
                  }}
                />
              ))}
            </div>

            <FormField
              control={form.control}
              name="preferredFonts"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding.fields.preferredFonts")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Any specific font you'd like us to use"
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name="preferredFonts"
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="siteStyle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding.fields.siteStyle")} *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div
                        className={`relative border-2 rounded-lg p-6 cursor-pointer transition-all ${field.value === "sharp" ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"}`}
                      >
                        <RadioGroupItem
                          value="sharp"
                          id="style-sharp"
                          className="sr-only"
                        />
                        <label
                          htmlFor="style-sharp"
                          className="cursor-pointer flex flex-col items-center gap-3"
                        >
                          <Square
                            className="h-16 w-16 text-gray-700"
                            strokeWidth={2}
                          />
                          <span className="font-medium text-center">
                            {t("onboarding.options.siteStyleStraight")}
                          </span>
                          <p className="text-xs text-gray-500 text-center">
                            {t("onboarding.options.siteStyleStraightDesc")}
                          </p>
                        </label>
                      </div>
                      <div
                        className={`relative border-2 rounded-lg p-6 cursor-pointer transition-all ${field.value === "curved" ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"}`}
                      >
                        <RadioGroupItem
                          value="curved"
                          id="style-curved"
                          className="sr-only"
                        />
                        <label
                          htmlFor="style-curved"
                          className="cursor-pointer flex flex-col items-center gap-3"
                        >
                          <Circle
                            className="h-16 w-16 text-gray-700"
                            strokeWidth={2}
                          />
                          <span className="font-medium text-center">
                            {t("onboarding.options.siteStyleCurved")}
                          </span>
                          <p className="text-xs text-gray-500 text-center">
                            {t("onboarding.options.siteStyleCurvedDesc")}
                          </p>
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      // Step 6: Template Selection
      case 5:
        return (
          <div key={`step-5-${forceRender}`} className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">
                {t("onboarding.templateSelection.title")}
              </h3>
              <p className="text-sm text-blue-700">
                {t("onboarding.templateSelection.description")}
              </p>
            </div>

            {/* Browse Templates Button */}
            {!selectedTemplate && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setShowTemplateBrowser(true)}
                  className="w-full md:w-auto"
                  data-testid="button-browse-templates"
                >
                  {t("onboarding.templateSelection.browseTemplates")}
                </Button>
              </div>
            )}

            {/* Selected Template Display */}
            {selectedTemplate && (
              <div className="bg-card rounded-lg border-2 border-primary overflow-hidden">
                <div className="aspect-video overflow-hidden relative">
                  <img
                    src={selectedTemplate.preview}
                    alt={selectedTemplate.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-2">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold mb-1">
                        {selectedTemplate.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedTemplate.category}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTemplateBrowser(true)}
                      data-testid="button-change-template"
                    >
                      {t("onboarding.templateSelection.changeTemplate")}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedTemplate.description}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-8 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
              <FormField
                control={form.control}
                name="customTemplateRequest"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder={t("onboarding.templateSelection.additionalNotes")}
                        className="min-h-[100px] bg-white"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name="customTemplateRequest"
                        ref={field.ref}
                        data-testid="input-custom-template-request"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        );

      // Step 7: Social Media
      case 6:
        return (
          <div key={`step-6-${forceRender}`} className="space-y-6">
            <FormField
              control={form.control}
              name="hasSocialMedia"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding.fields.hasSocialMedia")}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="social-yes" />
                        <label htmlFor="social-yes">{t("onboarding.options.yes")}</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="social-no" />
                        <label htmlFor="social-no">{t("onboarding.options.no")}</label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {hasSocialMediaValue === "yes" && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-700">
                  {t("onboarding.socialMediaSection.provideLinks")}
                </p>
                <FormField
                  control={form.control}
                  name="facebookLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("onboarding.fields.facebookLink")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("onboarding.placeholders.facebookLink")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="facebookLink"
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="instagramLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("onboarding.fields.instagramLink")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("onboarding.placeholders.instagramLink")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="instagramLink"
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="linkedinLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("onboarding.fields.linkedinLink")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("onboarding.placeholders.linkedinLink")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="linkedinLink"
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tiktokLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("onboarding.fields.tiktokLink")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("onboarding.placeholders.tiktokLink")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="tiktokLink"
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="youtubeLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("onboarding.fields.youtubeLink")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("onboarding.placeholders.youtubeLink")}
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="youtubeLink"
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="otherSocialLinks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("onboarding.fields.otherSocialLinks")}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("onboarding.placeholders.otherSocialLinks")}
                          className="min-h-[60px]"
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name="otherSocialLinks"
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        );

      // Step 8: Practical Information
      case 7:
        return (
          <div key={`step-7-${forceRender}`} className="space-y-6">
            <FormField
              control={form.control}
              name="projectDeadline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("onboarding.fields.projectDeadline")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name="projectDeadline"
                      ref={field.ref}
                    />
                  </FormControl>
                  <p className="text-sm text-gray-500">
                    {t("onboarding.helperTexts.projectDeadlineNote")}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additionalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("onboarding.fields.additionalNotes")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("onboarding.placeholders.additionalNotes")}
                      className="min-h-[120px]"
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name="additionalNotes"
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      // Dynamic step handling: Check if current step is "Review & Payment"
      default:
        const currentStepTitle = steps[currentStep]?.title;
        
        // Review & Payment step (dynamically positioned)
        if (currentStepTitle === t("onboarding.stepTitles.reviewPayment")) {
          const logoDesignService = form.watch("logoDesignService");
          const hasLogoSelection = logoDesignService && logoDesignService !== "none";
          const logoPrice = logoDesignService === "basic" ? 250 : logoDesignService === "premium" ? 500 : 0;

          return (
            <div key={`step-payment-${forceRender}`} className="space-y-6">
              {hasLogoSelection ? (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                    <h3 className="text-xl font-bold text-blue-800 mb-4">
                      🎨 {t("onboarding.reviewPayment.logoServiceSelected")}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-2">{t("onboarding.reviewPayment.selectedService")}</p>
                        <p className="text-lg font-semibold">
                          {logoDesignService === "basic" ? t("onboarding.reviewPayment.basicLogoDesign") : t("onboarding.reviewPayment.brandIdentityPackage")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">{t("onboarding.reviewPayment.price")}</p>
                        <p className="text-2xl font-bold text-blue-600">€{logoPrice}</p>
                      </div>
                      <div className="bg-white p-4 rounded border border-blue-100">
                        <p className="text-sm text-gray-700 mb-3">{t("onboarding.reviewPayment.whatsIncluded")}</p>
                        <ul className="text-sm text-gray-600 space-y-2">
                          {logoDesignService === "basic" ? (
                            <>
                              <li>{t("onboarding.reviewPayment.basicLogoFeatures.feature1")}</li>
                              <li>{t("onboarding.reviewPayment.basicLogoFeatures.feature2")}</li>
                              <li>{t("onboarding.reviewPayment.basicLogoFeatures.feature3")}</li>
                              <li>{t("onboarding.reviewPayment.basicLogoFeatures.feature4")}</li>
                            </>
                          ) : (
                            <>
                              <li>{t("onboarding.reviewPayment.premiumLogoFeatures.Feature1")}</li>
                              <li>{t("onboarding.reviewPayment.premiumLogoFeatures.Feature2")}</li>
                              <li>{t("onboarding.reviewPayment.premiumLogoFeatures.Feature3")}</li>
                              <li>{t("onboarding.reviewPayment.premiumLogoFeatures.Feature4")}</li>
                              <li>{t("onboarding.reviewPayment.premiumLogoFeatures.Feature5")}</li>
                              <li>{t("onboarding.reviewPayment.premiumLogoFeatures.Feature6")}</li>
                            </>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <p className="text-gray-600">
                    {t("onboarding.reviewPayment.noLogoSelected")}
                  </p>
                </div>
              )}
            </div>
          );
        }
        
        // Review & Submit step (dynamically positioned)
        if (currentStepTitle === t("onboarding.stepTitles.reviewSubmit")) {
          return (
            <div key={`step-review-${forceRender}`} className="space-y-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-xl font-bold text-blue-800 mb-4">
                  {t("onboarding.reviewSubmit.title")}
                </h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <strong>{t("onboarding.reviewSubmit.businessLabel")}</strong>{" "}
                    {form.watch("businessName")}
                  </div>
                  <div>
                    <strong>{t("onboarding.reviewSubmit.contactLabel")}</strong>{" "}
                    {form.watch("contactName")} ({form.watch("contactEmail")})
                  </div>
                  <div>
                    <strong>{t("onboarding.reviewSubmit.domainLabel")}</strong>{" "}
                    {form.watch("hasDomain") === "yes"
                      ? `${t("onboarding.reviewSubmit.existingDomain")} ${form.watch("existingDomain")}`
                      : t("onboarding.reviewSubmit.newDomainNeeded")}
                  </div>
                  <div>
                    <strong>{t("onboarding.reviewSubmit.emailsLabel")}</strong>{" "}
                    {form.watch("hasEmails") === "yes"
                      ? t("onboarding.reviewSubmit.hasExisting")
                      : t("onboarding.reviewSubmit.needsSetup")}
                  </div>
                  <div>
                    <strong>{t("onboarding.reviewSubmit.websiteLabel")}</strong>{" "}
                    {form.watch("hasWebsite") === "yes"
                      ? t("onboarding.reviewSubmit.hasExisting")
                      : t("onboarding.reviewSubmit.newWebsite")}
                  </div>
                  <div>
                    <strong>{t("onboarding.reviewSubmit.socialMediaLabel")}</strong>{" "}
                    {form.watch("hasSocialMedia") === "yes"
                      ? t("onboarding.reviewSubmit.hasAccounts")
                      : t("onboarding.reviewSubmit.noSocialMedia")}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setCurrentStep(0)}
                >
                  {t("onboarding.reviewSubmit.editInformation")}
                </Button>
              </div>
            </div>
          );
        }
        
        // Confirmation step (dynamically positioned)
        if (currentStepTitle === t("onboarding.stepTitles.confirmation")) {
          return (
            <div key={`step-confirmation-${forceRender}`} className="space-y-6 text-center">
              <div className="mx-auto mb-8">
                <CheckCircle className="h-24 w-24 text-green-500 mx-auto" />
              </div>
              <div className="bg-green-50 p-8 rounded-lg">
                <h3 className="text-2xl font-bold text-green-800 mb-4">
                  {t("onboarding.confirmation.title")}
                </h3>
                <p className="text-green-700 text-lg mb-4">
                  {t("onboarding.confirmation.description")}
                </p>
              </div>
            </div>
          );
        }
        
        // Fallback for unknown steps
        return null;
    }
  };

  if (showSuccessMessage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        {/* Logo Header */}
        <div className="absolute top-6 left-6 z-10">
          <img
            src="/images/hayc-logo.png"
            alt="HAYC Logo"
            className="h-12 w-auto"
          />
        </div>

        {/* Success Notice - Top Right */}
        <div className="absolute top-6 right-6 z-10 max-w-sm">
          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg shadow-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-bold text-green-800">
                  🎉 {t("onboarding.paymentSuccessful")}
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>{t("onboarding.paymentSuccessfulDesc")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Success Content */}
        <div className="flex items-center justify-center min-h-screen py-8 px-4">
          <Card className="w-full max-w-2xl shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <CheckCircle className="h-20 w-20 text-green-500" />
              </div>
              <CardTitle className="text-3xl font-bold text-green-600 mb-4">
                {t("onboarding.welcomeTitle")}
              </CardTitle>
              {/* <p className="text-lg text-gray-600 mb-6">
                {t("onboarding.welcomeSubtitle")}
              </p> */}
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-xl font-bold text-blue-800 mb-3">
                  🚨 {t("onboarding.welcomeMessage")}
                </h3>
                <p className="text-blue-700 mb-4">
                  <strong>{t("onboarding.welcomeDescriptionStrong")}</strong>
                  {/* {t("onboarding.welcomeDescription")} */}
                </p>
                {/* <p className="text-sm text-blue-600">
                  {t("onboarding.continueToFormMessage")}
                </p> */}
              </div>

              <Button
                onClick={handleContinueToForm}
                className="w-full bg-primary hover:bg-primary/90 text-white py-3 text-lg font-semibold"
              >
                {t("onboarding.continueToForm")}
              </Button>

              <p className="text-sm text-gray-500">
                {t("onboarding.formDescription")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Logo Header */}
      <div className="absolute top-6 left-6 z-10">
        <img
          src="/images/hayc-logo.png"
          alt="HAYC Logo"
          className="h-12 w-auto"
        />
      </div>

      {/* Important Notice - Top Right */}
      <div className="absolute top-6 right-6 z-10 max-w-sm">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg shadow-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-red-800">
                🚨 {t("onboarding.required")}
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{t("onboarding.noticeDescription")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-2xl mx-auto">
          <Card className="shadow-xl">
            <CardHeader className="text-center">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {t("onboarding.formTitle")}
                  </CardTitle>
                </div>
                {/* Demo Data Button - Remove for production */}
                {/* <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fillDemoData}
                  className="text-xs"
                  data-testid="button-fill-demo"
                >
                  Fill Demo Data
                </Button> */}
              </div>
              <p className="text-gray-600 mt-2">
                {t("onboarding.step")} {currentStep + 1}{" "}
                {t("onboarding.stepOf")} {steps.length}:{" "}
                {steps[currentStep].title}
              </p>
              <Progress value={progress} className="mt-4" />
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
                  {renderStepContent()}

                  <div className="flex justify-between pt-6">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        disabled={currentStep === 0}
                        className="flex items-center gap-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        {t("onboarding.previous")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => navigate("/dashboard")}
                        disabled={isSavingDraft}
                        className="flex items-center gap-2"
                        data-testid="button-continue-later"
                      >
                        {isSavingDraft ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t("onboarding.saving") || "Saving..."}
                          </>
                        ) : (
                          <>
                            {t("onboarding.continueLater") || "Continue Later"}
                          </>
                        )}
                      </Button>
                    </div>

                    {currentStep === steps.length - 1 ? (
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2"
                        data-testid="button-submit-onboarding"
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        {isSubmitting
                          ? t("onboarding.submitting")
                          : t("onboarding.submitForm")}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={steps[currentStep].title === t("onboarding.stepTitles.reviewPayment") ? handlePaymentStepSubmit : nextStep}
                        disabled={steps[currentStep].title === t("onboarding.stepTitles.reviewPayment") && isSubmitting}
                        className="flex items-center gap-2"
                        data-testid={steps[currentStep].title === t("onboarding.stepTitles.reviewPayment") ? "button-proceed-payment" : "button-next"}
                      >
                        {steps[currentStep].title === t("onboarding.stepTitles.reviewPayment") && isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t("onboarding.buttons.processing")}
                          </>
                        ) : steps[currentStep].title === t("onboarding.stepTitles.reviewPayment") && hasPurchasableItems ? (
                          <>
                            {t("onboarding.buttons.proceedToPayment")}
                            <ArrowRight className="h-4 w-4" />
                          </>
                        ) : (
                          <>
                            {t("onboarding.next")}
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Result Modal */}
          <Dialog open={showResultModal} onOpenChange={() => {}}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle
                  className={`text-center flex items-center gap-2 justify-center ${
                    submissionResult?.success
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {submissionResult?.success ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    <AlertCircle className="h-6 w-6" />
                  )}
                  {submissionResult?.title}
                </DialogTitle>
                <DialogDescription className="text-center pt-4">
                  {submissionResult?.message}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="pt-6">
                <Button
                  onClick={handleModalClose}
                  className={`w-full ${
                    submissionResult?.success
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  } text-white`}
                >
                  {submissionResult?.success
                    ? t("onboarding.goDashboard")
                    : t("onboarding.tryAgain")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Payment Choice Dialog */}
          <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center">{t("onboarding.paymentDialog.title")}</DialogTitle>
                <DialogDescription className="text-center pt-2">
                  {t("onboarding.paymentDialog.description")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {savedPaymentMethod && (
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 flex flex-col items-start gap-2"
                    onClick={handlePayWithSavedCard}
                    disabled={isSubmitting}
                    data-testid="button-pay-saved-card"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-semibold">{t("onboarding.paymentDialog.useSavedCard")}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {savedPaymentMethod.brand?.toUpperCase()} ending in {savedPaymentMethod.last4}
                    </span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full h-auto py-4 flex flex-col items-start gap-2"
                  onClick={() => {
                    setShowPaymentDialog(false);
                    if (pendingLogoData) {
                      proceedToCheckout(pendingLogoData.data, pendingLogoData.logoType);
                    }
                  }}
                  disabled={isSubmitting}
                  data-testid="button-pay-new-card"
                >
                  <div className="flex items-center gap-2">
                    <Circle className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold">{t("onboarding.paymentDialog.useNewCard")}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {t("onboarding.paymentDialog.redirectToPayment")}
                  </span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Template Browser Modal */}
          <TemplateBrowserModal
            open={showTemplateBrowser}
            onClose={() => setShowTemplateBrowser(false)}
            onSelect={(template) => {
              form.setValue("selectedTemplateId", template.id);
              setShowTemplateBrowser(false);
            }}
            selectedTemplateId={selectedTemplateId}
          />
        </div>
      </div>
    </div>
  );
}
