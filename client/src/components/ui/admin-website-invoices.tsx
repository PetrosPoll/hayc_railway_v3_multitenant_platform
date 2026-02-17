import { useState, useRef, useEffect } from "react";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Download, Upload, Trash2, ChevronDown, ChevronRight, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Info, Pencil, RefreshCw, Plus } from "lucide-react";

declare global {
  interface Window {
    cloudinary: any;
  }
}

export function AdminWebsiteInvoices() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [expandedWebsiteId, setExpandedWebsiteId] = useState<number | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const selectedInvoiceIdRef = useRef<number | null>(null); // Ref to ensure Cloudinary callback has current value
  const [uploading, setUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedPublicId, setUploadedPublicId] = useState<string | null>(null);
  const [isCloudinaryWidgetOpen, setIsCloudinaryWidgetOpen] = useState(false);
  const [wrappConfirmDialogOpen, setWrappConfirmDialogOpen] = useState(false);
  const [invoiceIdForWrapp, setInvoiceIdForWrapp] = useState<number | null>(null);
  const [creatingWrapp, setCreatingWrapp] = useState(false);
  const [cancelWrappDialogOpen, setCancelWrappDialogOpen] = useState(false);
  const [invoiceIdForCancel, setInvoiceIdForCancel] = useState<number | null>(null);
  const [cancellingWrapp, setCancellingWrapp] = useState(false);
  const [updatingInvoices, setUpdatingInvoices] = useState(false);
  const [billingInfoDialogOpen, setBillingInfoDialogOpen] = useState(false);
  const [selectedWebsiteForBilling, setSelectedWebsiteForBilling] = useState<number | null>(null);
  const [selectedInvoiceForBilling, setSelectedInvoiceForBilling] = useState<number | null>(null);
  const [editingBilling, setEditingBilling] = useState(false);
  const [invoiceTypeValue, setInvoiceTypeValue] = useState("");
  const [vatValue, setVatValue] = useState("");
  const [cityValue, setCityValue] = useState("");
  const [streetValue, setStreetValue] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const [postalCodeValue, setPostalCodeValue] = useState("");
  const [classificationTypeValue, setClassificationTypeValue] = useState("");
  const [invoiceTypeCodeValue, setInvoiceTypeCodeValue] = useState("");
  const [productNameValue, setProductNameValue] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<"all" | "draft">("all");
  
  // Sort state
  const [sortColumn, setSortColumn] = useState<"id" | "email" | "domain" | "projectName" | "invoiceCount" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Invoice filter state - per website, default to current month and year
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [invoiceYearFilter, setInvoiceYearFilter] = useState<Record<number, number>>({});
  const [invoiceMonthFilter, setInvoiceMonthFilter] = useState<Record<number, number>>({});
  const [draftYearFilter, setDraftYearFilter] = useState<number>(currentYear);
  const [draftMonthFilter, setDraftMonthFilter] = useState<number>(currentMonth);

  // Create draft invoice dialog state
  const [createDraftDialogOpen, setCreateDraftDialogOpen] = useState(false);
  const [selectedWebsiteForDraft, setSelectedWebsiteForDraft] = useState<number | null>(null);
  const [createDraftForm, setCreateDraftForm] = useState({
    title: "",
    description: "",
    amount: "",
    currency: "EUR",
  });

  // Form state for upload
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    amount: "",
    currency: "eur",
    issueDate: "",
    invoiceNumber: "",
  });

  // Fetch all invoices with website details
  const { data: invoicesData, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ["/api/admin/invoices"],
  });

  // Fetch all websites
  const { data: websitesData, isLoading: websitesLoading } = useQuery({
    queryKey: ["/api/admin/websites"],
  });

  // Fetch subscriptions for expanded website or selected website for billing
  const websiteIdForSubscriptions = expandedWebsiteId || selectedWebsiteForBilling;
  const { data: subscriptionsData, isLoading: subscriptionsLoading, isFetching: subscriptionsFetching, refetch: refetchSubscriptions } = useQuery({
    queryKey: ["/api/subscriptions", websiteIdForSubscriptions],
    queryFn: async () => {
      if (!websiteIdForSubscriptions) return null;
      const response = await fetch(
        `/api/subscriptions?websiteProgressId=${websiteIdForSubscriptions}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch subscriptions");
      }
      return response.json();
    },
    enabled: !!websiteIdForSubscriptions,
    refetchOnMount: 'always',
  });

  // Update billing mutation
  const updateBillingMutation = useMutation({
    mutationFn: async ({ subscriptionId, invoiceType, vatNumber, city, street, number, postalCode, classificationType, invoiceTypeCode, productName }: { subscriptionId: number; invoiceType: string; vatNumber: string; city: string; street: string; number: string; postalCode: string; classificationType: string; invoiceTypeCode: string; productName: string }) => {
      const response = await fetch("/api/admin/update-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ subscriptionId, invoiceType, vatNumber, city, street, number, postalCode, classificationType, invoiceTypeCode, productName }),
      });
      if (!response.ok) {
        throw new Error("Failed to update billing information");
      }
      return response.json();
    },
    onSuccess: () => {
      const websiteId = expandedWebsiteId || selectedWebsiteForBilling;
      if (websiteId) {
        queryClient.invalidateQueries({ queryKey: ["/api/subscriptions", websiteId] });
      }
      toast({
        title: "Success",
        description: "Billing information updated successfully",
      });
      setEditingBilling(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update billing information",
        variant: "destructive",
      });
    },
  });

  // Group invoices by website
  const allInvoices = (invoicesData as any[]) || [];
  const invoicesByWebsite = allInvoices.reduce((acc: any, invoice: any) => {
    if (!acc[invoice.websiteProgressId]) {
      acc[invoice.websiteProgressId] = [];
    }
    acc[invoice.websiteProgressId].push(invoice);
    return acc;
  }, {});

  // Get all draft invoices
  const draftInvoices = allInvoices.filter((invoice: any) => 
    invoice.status?.toLowerCase() === "draft"
  );

  // Auto-populate form when dialog opens
  useEffect(() => {
    // Check both state and ref for invoice ID (ref is more reliable during state transitions)
    const currentInvoiceId = selectedInvoiceIdRef.current ?? selectedInvoiceId;
    
    if (uploadDialogOpen && currentInvoiceId) {
      // Editing existing invoice - populate with invoice data
      const allInvoices = (invoicesData as any[]) || [];
      const invoice = allInvoices.find((inv: any) => inv.id === currentInvoiceId);
      
      if (invoice) {
        setUploadForm({
          title: invoice.title || "",
          description: invoice.description || "",
          amount: invoice.amount ? String(invoice.amount / 100) : "",
          currency: invoice.currency?.toLowerCase() || "eur",
          issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString().split('T')[0] : "",
          invoiceNumber: invoice.invoiceNumber || "",
        });
        
        // Ensure state and ref are in sync
        if (selectedInvoiceId !== currentInvoiceId) {
          setSelectedInvoiceId(currentInvoiceId);
        }
        if (selectedInvoiceIdRef.current !== currentInvoiceId) {
          selectedInvoiceIdRef.current = currentInvoiceId;
        }
        
        console.log('[UseEffect] Populated form for existing invoice:', currentInvoiceId);
      } else {
        console.warn('[UseEffect] Invoice not found in data, but invoice ID exists:', currentInvoiceId);
      }
      
      setUploadedFileUrl(null);
      setUploadedPublicId(null);
    } else if (!uploadDialogOpen && !isCloudinaryWidgetOpen && !uploading) {
      // Reset form when dialog closes (but not when Cloudinary widget is open or upload is in progress)
      // This prevents clearing selectedInvoiceId during the upload process
      // Only clear if ref is also null (double-check to avoid clearing during state transitions)
      const currentInvoiceId = selectedInvoiceIdRef.current ?? selectedInvoiceId;
      if (!currentInvoiceId) {
        setUploadForm({
          title: "",
          description: "",
          amount: "",
          currency: "eur",
          issueDate: "",
          invoiceNumber: "",
        });
        setUploadedFileUrl(null);
        setUploadedPublicId(null);
        setSelectedInvoiceId(null);
        selectedInvoiceIdRef.current = null; // Clear ref as well
      } else {
        console.log('[UseEffect] Skipping clear - invoice ID still exists:', currentInvoiceId);
      }
    }
  }, [uploadDialogOpen, selectedInvoiceId, isCloudinaryWidgetOpen, uploading, invoicesData, invoicesByWebsite]);

  // Sync ref with state to ensure Cloudinary callback always has current value
  useEffect(() => {
    selectedInvoiceIdRef.current = selectedInvoiceId;
  }, [selectedInvoiceId]);

  // Initialize billing field values when subscription data loads
  useEffect(() => {
    if (subscriptionsData && !editingBilling) {
      const subscriptions = (subscriptionsData as any[]) || [];
      const planSubscription = subscriptions.find((sub: any) => sub.productType === "plan");
      if (planSubscription) {
        setInvoiceTypeValue(planSubscription.invoiceType || "invoice");
        setVatValue(planSubscription.vatNumber || "");
        setCityValue(planSubscription.city || "");
        setStreetValue(planSubscription.street || "");
        setNumberValue(planSubscription.number || "");
        setPostalCodeValue(planSubscription.postalCode || "");
        setClassificationTypeValue(planSubscription.classificationType || "");
        setInvoiceTypeCodeValue(planSubscription.invoiceTypeCode || "");
        setProductNameValue(planSubscription.productName || "");
      }
    }
  }, [subscriptionsData, editingBilling]);

  // Close expanded view when switching between all and draft tables
  useEffect(() => {
    setExpandedWebsiteId(null);
  }, [invoiceFilter]);

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const response = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete invoice");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete invoice",
        variant: "destructive",
      });
    },
  });

  // Create draft invoice mutation
  const createDraftMutation = useMutation({
    mutationFn: async (data: { websiteProgressId: number; title: string; description: string; amount: string; currency: string }) => {
      const response = await fetch("/api/admin/invoices/create-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create draft invoice");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      toast({
        title: "Success",
        description: "Draft invoice created successfully",
      });
      setCreateDraftDialogOpen(false);
      setSelectedWebsiteForDraft(null);
      setCreateDraftForm({ title: "", description: "", amount: "", currency: "EUR" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create draft invoice",
        variant: "destructive",
      });
    },
  });

  // Handle create draft invoice
  const handleCreateDraftInvoice = async () => {
    if (!selectedWebsiteForDraft) {
      toast({
        title: "Error",
        description: "Please select a website",
        variant: "destructive",
      });
      return;
    }
    if (!createDraftForm.title) {
      toast({
        title: "Error",
        description: "Please enter a title",
        variant: "destructive",
      });
      return;
    }
    if (!createDraftForm.amount || parseFloat(createDraftForm.amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    createDraftMutation.mutate({
      websiteProgressId: selectedWebsiteForDraft,
      title: createDraftForm.title,
      description: createDraftForm.description,
      amount: createDraftForm.amount,
      currency: createDraftForm.currency,
    });
  };

  // Open Wrapp confirmation dialog
  const handleOpenWrappDialog = (invoiceId: number) => {
    setInvoiceIdForWrapp(invoiceId);
    setWrappConfirmDialogOpen(true);
  };

  // Create invoice with Wrapp handler
  const handleCreateWithWrapp = async (invoiceId: number) => {
    console.log('[Create with Wrapp] Starting for invoice:', invoiceId);
    setCreatingWrapp(true);

    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/create-with-wrapp`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        const errorMessage = data.error && data.message 
          ? `${data.message}: ${data.error}`
          : data.error || data.message || t("dashboard.wrappInvoiceCreateFailed") || "Failed to create invoice with Wrapp";
        toast({
          title: t("dashboard.error") || "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("dashboard.success") || "Success",
          description: t("dashboard.wrappInvoiceCreated") || "Invoice created with Wrapp successfully",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      }
    } catch (error: any) {
      console.error('[Create with Wrapp] Error:', error);
      toast({
        title: t("dashboard.error") || "Error",
        description: error.message || t("dashboard.wrappInvoiceCreateFailed") || "Failed to create invoice with Wrapp",
        variant: "destructive",
      });
    } finally {
      setCreatingWrapp(false);
      setWrappConfirmDialogOpen(false);
      setInvoiceIdForWrapp(null);
    }
  };

  // Confirm and proceed with Wrapp creation
  const handleConfirmWrapp = () => {
    if (invoiceIdForWrapp) {
      handleCreateWithWrapp(invoiceIdForWrapp);
    }
  };

  // Update invoices handler
  const handleUpdateInvoices = async () => {
    setUpdatingInvoices(true);
    try {
      await refetchInvoices();
      toast({
        title: t("dashboard.success") || "Success",
        description: "Invoices updated successfully",
      });
    } catch (error: any) {
      toast({
        title: t("dashboard.error") || "Error",
        description: error.message || "Failed to update invoices",
        variant: "destructive",
      });
    } finally {
      setUpdatingInvoices(false);
    }
  };

  // Generate PDF handler
  const handleGeneratePdf = async (invoiceId: number) => {
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/generate-pdf`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ locale: 'el' }) // Default to Greek, can be made configurable
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "PDF Generation Started",
          description: "PDF generation has been initiated. You will be notified when it's ready.",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to generate PDF",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('[Generate PDF] Error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  // Open Cancel Wrapp confirmation dialog
  const handleOpenCancelWrappDialog = (invoiceId: number) => {
    setInvoiceIdForCancel(invoiceId);
    setCancelWrappDialogOpen(true);
  };

  // Cancel Wrapp Invoice handler
  const handleConfirmCancelWrapp = async () => {
    if (!invoiceIdForCancel) return;

    setCancellingWrapp(true);
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceIdForCancel}/cancel-wrapp`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Wrapp invoice cancelled successfully",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
        setCancelWrappDialogOpen(false);
        setInvoiceIdForCancel(null);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to cancel Wrapp invoice",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('[Cancel Wrapp Invoice] Error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel Wrapp invoice",
        variant: "destructive",
      });
    } finally {
      setCancellingWrapp(false);
    }
  };

  // Handle Cloudinary widget upload
  const handleCloudinaryUpload = async () => {
    // CRITICAL: Capture invoice ID from ref FIRST (most reliable), then fallback to state
    // The ref should always have the value since we set it in handleOpenUploadDialog
    // Capture it IMMEDIATELY before any async operations or state changes
    const invoiceIdToUpdate = selectedInvoiceIdRef.current ?? selectedInvoiceId;
    
    console.log('[Handle Cloudinary Upload] Starting upload:', {
      selectedInvoiceId,
      refInvoiceId: selectedInvoiceIdRef.current,
      invoiceIdToUpdate,
      isEditing: !!invoiceIdToUpdate,
      uploadDialogOpen,
      isCloudinaryWidgetOpen,
      uploading
    });
    
    // If we have an invoice ID, we MUST be editing - don't allow creation
    if (!invoiceIdToUpdate) {
      console.error('[Handle Cloudinary Upload] ⚠️ No invoice ID found! This should not happen when editing.');
      toast({
        title: "Error",
        description: "Invoice ID not found. Please close and try again.",
        variant: "destructive",
      });
      return;
    }
    
    // CRITICAL: Re-set the ref to ensure it's preserved even if state changes
    selectedInvoiceIdRef.current = invoiceIdToUpdate;

    if (!uploadForm.title) {
      toast({
        title: "Title required",
        description: "Please enter a title before uploading",
        variant: "destructive",
      });
      return;
    }

    if (!invoiceIdToUpdate) {
      toast({
        title: "Error",
        description: "Invoice ID not found. Cannot proceed with upload.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get website domain from invoice
      const allInvoices = (invoicesData as any[]) || [];
      const invoice = allInvoices.find((inv: any) => inv.id === invoiceIdToUpdate);
      
      if (!invoice) {
        toast({
          title: "Error",
          description: "Invoice not found",
          variant: "destructive",
        });
        return;
      }

      const website = (websitesData as any)?.websites?.find((w: any) => w.id === invoice.websiteProgressId);
      const websiteDomain = website?.domain || "";

      if (!websiteDomain) {
        toast({
          title: "Error",
          description: "Website domain not found",
          variant: "destructive",
        });
        return;
      }

      // Get Cloudinary configuration from server
      const folder = `transactions/${websiteDomain}`;
      let cloudinaryConfig = { apiKey: "", cloudName: "" };
      
      const configResponse = await fetch("/api/cloudinary/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paramsToSign: { folder } }),
        credentials: "include",
      });

      if (!configResponse.ok) {
        throw new Error("Failed to get configuration");
      }

      const configData = await configResponse.json();
      cloudinaryConfig.apiKey = configData.apiKey;
      cloudinaryConfig.cloudName = configData.cloudName;

      // Open Cloudinary upload widget
      if (window.cloudinary) {
        const widget = window.cloudinary.createUploadWidget(
          {
            cloudName: cloudinaryConfig.cloudName,
            apiKey: cloudinaryConfig.apiKey,
            uploadSignature: async (callback: any, paramsToSign: any) => {
              try {
                const response = await fetch("/api/cloudinary/signature", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ paramsToSign }),
                  credentials: "include",
                });

                if (!response.ok) {
                  throw new Error("Failed to get upload signature");
                }

                const data = await response.json();
                callback({ signature: data.signature, timestamp: data.timestamp });
              } catch (error) {
                console.error("Signature generation error:", error);
                toast({
                  title: "Error",
                  description: "Failed to prepare upload. Please try again.",
                  variant: "destructive",
                });
              }
            },
            folder: folder,
            resourceType: "raw",
            clientAllowedFormats: ["pdf"],
            maxFileSize: 10000000, // 10MB
            maxFiles: 1,
            sources: ["local", "url"],
          },
          async (error: any, result: any) => {
            if (error) {
              console.error("Upload error:", error);
              toast({
                title: "Upload Error",
                description: "Failed to upload file. Please try again.",
                variant: "destructive",
              });
              setUploading(false);
              setIsCloudinaryWidgetOpen(false);
              return;
            }

            // Handle widget close/cancel
            if (result?.event === "close" || result?.event === "abort") {
              setUploading(false);
              setIsCloudinaryWidgetOpen(false);
              return;
            }

            if (result?.event === "success") {
              const fileUrl = result.info.secure_url;
              const publicId = result.info.public_id;
              
              // Use the captured invoice ID from closure (guaranteed to be correct)
              // Also double-check the ref in case closure didn't capture it
              const finalInvoiceId = invoiceIdToUpdate || selectedInvoiceIdRef.current;
              
              console.log('[Cloudinary Upload] PDF uploaded successfully:', {
                fileUrl,
                publicId,
                invoiceIdFromClosure: invoiceIdToUpdate,
                invoiceIdFromRef: selectedInvoiceIdRef.current,
                finalInvoiceId,
                isEditing: !!finalInvoiceId
              });
              
              if (!finalInvoiceId) {
                console.error('[Cloudinary Upload] ❌ ERROR: No invoice ID available! Cannot update invoice.');
                toast({
                  title: "Error",
                  description: "Failed to identify invoice to update. Please try again.",
                  variant: "destructive",
                });
                setIsCloudinaryWidgetOpen(false);
                setUploading(false);
                return;
              }
              
              // Auto-save invoice after successful upload
              toast({
                title: "Uploading",
                description: "File uploaded! Saving invoice...",
              });
              
              // Always pass the captured invoice ID to ensure we update, not create
              await submitInvoice(fileUrl, publicId, finalInvoiceId);
              setIsCloudinaryWidgetOpen(false);
            }
          }
        );
        
        if (!widget) {
          toast({
            title: "Error",
            description: "Failed to initialize upload widget. Please refresh and try again.",
            variant: "destructive",
          });
          return;
        }

        // CRITICAL: Set widget open flag FIRST to prevent useEffect from clearing selectedInvoiceId
        setIsCloudinaryWidgetOpen(true);
        
        // Temporarily close dialog so Cloudinary widget appears on top
        // Form state is preserved via isCloudinaryWidgetOpen flag
        setUploadDialogOpen(false);
        setUploading(true);
        widget.open();
      } else {
        toast({
          title: "Upload Service Unavailable",
          description: "Please refresh the page and try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to initialize upload",
        variant: "destructive",
      });
      setUploading(false);
    }
  };

  // Shared save logic - can be called from button or Cloudinary callback
  const submitInvoice = async (fileUrl: string, publicId: string, invoiceIdOverride?: number | null) => {
    // Use override if provided, otherwise use state (for backward compatibility)
    const invoiceIdToUpdate = invoiceIdOverride !== undefined ? invoiceIdOverride : selectedInvoiceId;
    
    console.log('[Submit Invoice] Called with:', {
      invoiceIdOverride,
      selectedInvoiceId,
      invoiceIdToUpdate,
      willUpdate: !!invoiceIdToUpdate
    });
    
    // Validate required fields
    if (!uploadForm.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Invoice title is required",
        variant: "destructive",
      });
      return false;
    }

    setUploading(true);

    try {
      // If editing existing invoice, update it with Cloudinary URL
      if (invoiceIdToUpdate) {
        console.log('[Submit Invoice] ✅ UPDATING existing invoice:', {
          invoiceId: invoiceIdToUpdate,
          pdfUrl: fileUrl,
          cloudinaryPublicId: publicId
        });

        const updateResponse = await fetch(
          `/api/admin/invoices/${invoiceIdToUpdate}/pdf`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              pdfUrl: fileUrl, // Cloudinary secure URL - this updates the database
              cloudinaryPublicId: publicId, // Cloudinary public ID
              title: uploadForm.title,
              description: uploadForm.description,
              amount: uploadForm.amount ? parseFloat(uploadForm.amount) : null,
              currency: uploadForm.currency,
              issueDate: uploadForm.issueDate || null,
              invoiceNumber: uploadForm.invoiceNumber || null,
            }),
          }
        );
        
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          console.error('[Submit Invoice] Update failed:', errorData);
          throw new Error(errorData.message || "Failed to update invoice");
        }

        const updatedData = await updateResponse.json();
        console.log('[Submit Invoice] Invoice updated in database:', updatedData);

        // Invalidate queries to refresh the UI
        await queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });

        toast({
          title: "Success",
          description: "Invoice PDF URL updated successfully in database",
        });

        // Reset form and close dialog
        setUploadDialogOpen(false);
        setUploadedFileUrl(null);
        setUploadedPublicId(null);
        setSelectedInvoiceId(null);
        selectedInvoiceIdRef.current = null; // Clear ref as well
        setUploadForm({
          title: "",
          description: "",
          amount: "",
          currency: "eur",
          issueDate: "",
          invoiceNumber: "",
        });
        
        return true;
      }

      // This should never happen - invoice ID is required
      console.error('[Submit Invoice] ❌ ERROR: No invoice ID provided, but invoice creation is not allowed');
      toast({
        title: "Error",
        description: "Invoice ID is required. This component only supports updating existing invoices.",
        variant: "destructive",
      });
      return false;
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save invoice",
        variant: "destructive",
      });
      return false;
    } finally {
      setUploading(false);
    }
  };

  // Save invoice - manual button handler
  const handleSaveInvoice = async () => {
    if (!uploadedFileUrl || !uploadedPublicId) {
      toast({
        title: "No file uploaded",
        description: "Please upload a PDF file first",
        variant: "destructive",
      });
      return;
    }

    await submitInvoice(uploadedFileUrl, uploadedPublicId);
  };

  const handleOpenUploadDialog = (invoiceId: number) => {
    console.log('[Handle Open Upload Dialog] Called with invoice ID:', invoiceId);
    
    // CRITICAL: Set ref FIRST and IMMEDIATELY (synchronous), before any state updates
    // This ensures it's always available even if state updates are batched/delayed
    selectedInvoiceIdRef.current = invoiceId;
    
    // Set state
    setSelectedInvoiceId(invoiceId);
    
    // Open dialog
    setUploadDialogOpen(true);
    
    // Verify the ref is still set after state updates
    console.log('[Handle Open Upload Dialog] ✅ Invoice ID set:', {
      invoiceId,
      refSet: selectedInvoiceIdRef.current,
      stateSet: invoiceId,
      willEdit: true
    });
    
    // Double-check: if ref is not set, set it again (defensive)
    if (selectedInvoiceIdRef.current !== invoiceId) {
      console.error('[Handle Open Upload Dialog] ⚠️ Ref was cleared! Resetting...');
      selectedInvoiceIdRef.current = invoiceId;
    }
  };

  const toggleWebsiteExpand = (websiteId: number) => {
    const isCurrentlyExpanded = expandedWebsiteId === websiteId;
    if (!isCurrentlyExpanded) {
      setExpandedWebsiteId(websiteId);
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions", websiteId] });
    } else {
      setExpandedWebsiteId(null);
    }
  };

  const formatDate = (date: string | Date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatAmount = (amount: number | null, currency: string = "eur") => {
    if (!amount) return "N/A";
    return (amount / 100).toLocaleString("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    });
  };

  // Generate month options for the last 24 months

  // Filter invoices by month
  const filterInvoicesByMonth = (invoices: any[], selectedYear: number | undefined, selectedMonth: number | undefined) => {
    if (!selectedYear || !selectedMonth) {
      return invoices;
    }

    return invoices.filter((invoice) => {
      // Use issueDate if available, otherwise use createdAt
      const dateToCheck = invoice.issueDate || invoice.createdAt;
      if (!dateToCheck) return false;

      const invoiceDate = new Date(dateToCheck);
      return invoiceDate.getFullYear() === selectedYear && invoiceDate.getMonth() + 1 === selectedMonth;
    });
  };

  if (invoicesLoading || websitesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const allWebsites = (websitesData as any)?.websites || [];
  
  // Apply sorting
  const websites = [...allWebsites].sort((a: any, b: any) => {
    if (!sortColumn) return 0;
    
    let aValue: any;
    let bValue: any;
    
    switch (sortColumn) {
      case "id":
        aValue = a.id;
        bValue = b.id;
        break;
      case "email":
        aValue = (a.userEmail || "").toLowerCase();
        bValue = (b.userEmail || "").toLowerCase();
        break;
      case "domain":
        aValue = (a.domain || "").toLowerCase();
        bValue = (b.domain || "").toLowerCase();
        break;
      case "projectName":
        aValue = (a.projectName || "").toLowerCase();
        bValue = (b.projectName || "").toLowerCase();
        break;
      case "invoiceCount":
        aValue = (invoicesByWebsite[a.id] || []).length;
        bValue = (invoicesByWebsite[b.id] || []).length;
        break;
      default:
        return 0;
    }
    
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
  
  const handleSort = (column: "id" | "email" | "domain" | "projectName" | "invoiceCount") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };
  
  const SortIcon = ({ column }: { column: "id" | "email" | "domain" | "projectName" | "invoiceCount" }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-2 opacity-30" />;
    return sortDirection === "asc" ? 
      <ArrowUp className="h-4 w-4 ml-2" /> : 
      <ArrowDown className="h-4 w-4 ml-2" />;
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">Invoices Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage invoices for each website project. Upload, view, and delete invoice PDFs. Click column headers to sort.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setInvoiceFilter("all")}
            variant={invoiceFilter === "all" ? "default" : "outline"}
          >
            All Invoices
          </Button>
          <Button
            onClick={() => setInvoiceFilter("draft")}
            variant={invoiceFilter === "draft" ? "default" : "outline"}
          >
            Draft Invoices
          </Button>
          <Button
            onClick={handleUpdateInvoices}
            disabled={updatingInvoices || invoicesLoading}
            variant="outline"
          >
            {updatingInvoices ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Update Invoices
              </>
            )}
          </Button>
        </div>
      </div>

      {invoiceFilter === "draft" ? (
        draftInvoices.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No draft invoices found
          </div>
        ) : (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-end mb-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="draft-year-filter" className="text-sm">
                  Filter:
                </Label>
                <Select
                  value={draftYearFilter.toString()}
                  onValueChange={(value) => {
                    setDraftYearFilter(parseInt(value));
                  }}
                >
                  <SelectTrigger className="w-[120px]" id="draft-year-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={draftMonthFilter.toString()}
                  onValueChange={(value) => {
                    setDraftMonthFilter(parseInt(value));
                  }}
                >
                  <SelectTrigger className="w-[150px]" id="draft-month-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1;
                      const monthDate = new Date(draftYearFilter, month - 1, 1);
                      const monthName = monthDate.toLocaleDateString('en-US', { month: 'long' });
                      return (
                        <SelectItem key={month} value={month.toString()}>
                          {monthName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(() => {
              const filteredInvoices = filterInvoicesByMonth(
                draftInvoices,
                draftYearFilter,
                draftMonthFilter
              );

              return filteredInvoices.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  No draft invoices found for the selected month
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>User Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice: any) => {
                      const invoiceType = invoice.description?.toLowerCase().includes('add-on') ? 'Addon' : 'Plan';
                      const website = (websitesData as any)?.websites?.find((w: any) => w.id === invoice.websiteProgressId);
                      const userEmail = website?.userEmail || "N/A";
                      const subscriptions = (subscriptionsData as any[]) || [];
                      const planSubscription = subscriptions.find((sub: any) => sub.productType === "plan");
                      const canCreateWithWrapp = planSubscription?.classificationType && planSubscription?.invoiceTypeCode && planSubscription?.productName;
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell>
                            {invoice.invoiceNumber || `#${invoice.id}`}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{userEmail}</span>
                          </TableCell>
                          <TableCell>
                            {invoice.status}
                          </TableCell>
                          <TableCell>{invoiceType}</TableCell>
                          <TableCell>{invoice.title}</TableCell>
                          <TableCell>
                            {formatAmount(invoice.amount, invoice.currency)}
                          </TableCell>
                          <TableCell>
                            {formatDate(invoice.issueDate)}
                          </TableCell>
                          <TableCell>
                            {formatDate(invoice.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {!invoice.wrappInvoiceId && !invoice.pdfUrl && <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedWebsiteForBilling(invoice.websiteProgressId);
                                  setSelectedInvoiceForBilling(invoice.id);
                                  setBillingInfoDialogOpen(true);
                                  queryClient.invalidateQueries({ queryKey: ["/api/subscriptions", invoice.websiteProgressId] });
                                }}
                                data-testid={`button-create-wrapp-${invoice.id}`}
                              >
                                Create with Wrapp
                              </Button>
                              }
                              {invoice.wrappInvoiceId && !invoice.pdfUrl && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleGeneratePdf(invoice.id)}
                                    data-testid={`button-generate-pdf-${invoice.id}`}
                                  >
                                    Generate Wrapp PDF
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenCancelWrappDialog(invoice.id)}
                                    data-testid={`button-cancel-wrapp-${invoice.id}`}
                                  >
                                    Cancel Wrapp Invoice
                                  </Button>
                                </>
                              )}
                              {!invoice.pdfUrl && !invoice.wrappInvoiceId && <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setExpandedWebsiteId(invoice.websiteProgressId);
                                  handleOpenUploadDialog(invoice.id);
                                }}
                                data-testid={`button-manual-upload-${invoice.id}`}
                              >
                                Manual Upload
                              </Button> 
                              }
                              {invoice.pdfUrl && <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  window.open(invoice.pdfUrl, "_blank")
                                }
                                data-testid={`button-view-invoice-${invoice.id}`}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                View PDF
                              </Button>
                              }
                              {invoice.pdfUrl &&
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Are you sure you want to delete this invoice?"
                                    )
                                  ) {
                                    deleteInvoiceMutation.mutate(invoice.id);
                                  }
                                }}
                                disabled={true}
                                data-testid={`button-delete-invoice-${invoice.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>    }
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              );
            })()}
          </div>
        )
      ) : websites.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No websites found
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  className="font-semibold p-0 h-auto hover:bg-transparent"
                  onClick={() => handleSort("id")}
                  data-testid="sort-id"
                >
                  Website ID
                  <SortIcon column="id" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  className="font-semibold p-0 h-auto hover:bg-transparent"
                  onClick={() => handleSort("email")}
                  data-testid="sort-email"
                >
                  User Email
                  <SortIcon column="email" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  className="font-semibold p-0 h-auto hover:bg-transparent"
                  onClick={() => handleSort("domain")}
                  data-testid="sort-domain"
                >
                  Domain
                  <SortIcon column="domain" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  className="font-semibold p-0 h-auto hover:bg-transparent"
                  onClick={() => handleSort("projectName")}
                  data-testid="sort-project-name"
                >
                  Project Name
                  <SortIcon column="projectName" />
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  className="font-semibold p-0 h-auto hover:bg-transparent"
                  onClick={() => handleSort("invoiceCount")}
                  data-testid="sort-invoice-count"
                >
                  Invoices Count
                  <SortIcon column="invoiceCount" />
                </Button>
              </TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {websites.map((website: any) => {
              const websiteInvoices = invoicesByWebsite[website.id] || [];
              const isExpanded = expandedWebsiteId === website.id;
              
              return [
                <TableRow key={website.id}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleWebsiteExpand(website.id)}
                      data-testid={`button-expand-website-${website.id}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>{website.id}</TableCell>
                  <TableCell>
                    <span className="text-sm">{website.userEmail || "N/A"}</span>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {website.domain}
                    </code>
                  </TableCell>
                  <TableCell>{website.projectName || "N/A"}</TableCell>
                  <TableCell>
                    <span className="font-semibold">{websiteInvoices.length}</span>
                  </TableCell>
                  {/* <TableCell>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleOpenUploadDialog(website.id)}
                      data-testid={`button-upload-invoice-${website.id}`}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Invoice
                    </Button>
                  </TableCell> */}
                </TableRow>,
                
                isExpanded && (
                  <TableRow key={`${website.id}-expanded`}>
                    <TableCell colSpan={8}>
                      <div className="p-4 bg-muted/50 rounded-lg relative">
                        {(subscriptionsLoading || subscriptionsFetching) && expandedWebsiteId === website.id && (
                          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
                            <Loader2 className="h-8 w-8 animate-spin" />
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold">
                            Invoices for {website.domain}
                          </h3>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedWebsiteForDraft(website.id);
                                setCreateDraftForm({ title: "", description: "", amount: "", currency: "EUR" });
                                setCreateDraftDialogOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Create Draft
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setExpandedWebsiteId(website.id);
                                setSelectedWebsiteForBilling(website.id);
                                setSelectedInvoiceForBilling(null);
                                setBillingInfoDialogOpen(true);
                                queryClient.invalidateQueries({ queryKey: ["/api/subscriptions", website.id] });
                              }}
                            >
                              <Info className="h-4 w-4 mr-1" />
                              Billing Info
                            </Button>
                            <Label htmlFor={`year-filter-${website.id}`} className="text-sm">
                              Filter:
                            </Label>
                            <Select
                              value={(invoiceYearFilter[website.id] || currentYear).toString()}
                              onValueChange={(value) => {
                                setInvoiceYearFilter((prev) => ({
                                  ...prev,
                                  [website.id]: parseInt(value),
                                }));
                              }}
                            >
                              <SelectTrigger className="w-[120px]" id={`year-filter-${website.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="2026">2026</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={(invoiceMonthFilter[website.id] || currentMonth).toString()}
                              onValueChange={(value) => {
                                setInvoiceMonthFilter((prev) => ({
                                  ...prev,
                                  [website.id]: parseInt(value),
                                }));
                              }}
                            >
                              <SelectTrigger className="w-[150px]" id={`month-filter-${website.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => {
                                  const month = i + 1;
                                  const monthDate = new Date(invoiceYearFilter[website.id] || currentYear, month - 1, 1);
                                  const monthName = monthDate.toLocaleDateString('en-US', { month: 'long' });
                                  return (
                                    <SelectItem key={month} value={month.toString()}>
                                      {monthName}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {websiteInvoices.length === 0 ? (
                          <div className="text-center text-muted-foreground py-4">
                            No invoices created yet
                          </div>
                        ) : (() => {
                          const filteredInvoices = filterInvoicesByMonth(
                            websiteInvoices,
                            invoiceYearFilter[website.id] || currentYear,
                            invoiceMonthFilter[website.id] || currentMonth
                          );
                          
                          return filteredInvoices.length === 0 ? (
                            <div className="text-center text-muted-foreground py-4">
                              No invoices found for the selected month
                            </div>
                          ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Issue Date</TableHead>
                                <TableHead>Uploaded</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredInvoices.map((invoice: any) => {
                                const invoiceType = invoice.description?.toLowerCase().includes('add-on') ? 'Addon' : 'Plan';
                                const subscriptions = (subscriptionsData as any[]) || [];
                                const planSubscription = subscriptions.find((sub: any) => sub.productType === "plan");
                                const canCreateWithWrapp = planSubscription?.classificationType && planSubscription?.invoiceTypeCode && planSubscription?.productName;
                                return (
                                <TableRow key={invoice.id}>
                                  <TableCell>
                                    {invoice.invoiceNumber || `#${invoice.id}`}
                                  </TableCell>
                                  <TableCell>
                                    {invoice.status}
                                  </TableCell>
                                  <TableCell>{invoiceType}</TableCell>
                                  <TableCell>{invoice.title}</TableCell>
                                  <TableCell>
                                    {formatAmount(invoice.amount, invoice.currency)}
                                  </TableCell>
                                  <TableCell>
                                    {formatDate(invoice.issueDate)}
                                  </TableCell>
                                  <TableCell>
                                    {formatDate(invoice.createdAt)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-2">
                                          {!invoice.wrappInvoiceId && !invoice.pdfUrl && <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpenWrappDialog(invoice.id)}
                                            disabled={!canCreateWithWrapp}
                                            data-testid={`button-create-wrapp-${invoice.id}`}
                                          >
                                            Create with Wrapp
                                          </Button>
                                        }
                                        {invoice.wrappInvoiceId && !invoice.pdfUrl && (
                                          <>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleGeneratePdf(invoice.id)}
                                              data-testid={`button-generate-pdf-${invoice.id}`}
                                            >
                                              Generate Wrapp PDF
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleOpenCancelWrappDialog(invoice.id)}
                                              data-testid={`button-cancel-wrapp-${invoice.id}`}
                                            >
                                              Cancel Wrapp Invoice
                                            </Button>
                                          </>
                                        )}
                                        {!invoice.pdfUrl && !invoice.wrappInvoiceId && <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpenUploadDialog(invoice.id)}
                                            data-testid={`button-manual-upload-${invoice.id}`}
                                          >
                                            Manual Upload
                                          </Button> 
                                          }
                                          {invoice.pdfUrl && <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              window.open(invoice.pdfUrl, "_blank")
                                            }
                                            data-testid={`button-view-invoice-${invoice.id}`}
                                          >
                                            <Download className="h-4 w-4 mr-2" />
                                            View PDF
                                          </Button>
                                          }
                                          {invoice.pdfUrl &&
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => {
                                              if (
                                                confirm(
                                                  "Are you sure you want to delete this invoice?"
                                                )
                                              ) {
                                                deleteInvoiceMutation.mutate(invoice.id);
                                              }
                                            }}
                                            // disabled={deleteInvoiceMutation.isPending}
                                            disabled={true}
                                            data-testid={`button-delete-invoice-${invoice.id}`}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>    }
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                              })}
                            </TableBody>
                          </Table>
                          );
                        })()}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              ];
            })}
          </TableBody>
        </Table>
      )}

      {/* Upload Dialog */}
      <Dialog 
        open={uploadDialogOpen} 
        onOpenChange={(open) => {
          // Only allow closing if not uploading
          if (!open && !uploading && !isCloudinaryWidgetOpen) {
            setUploadDialogOpen(false);
          } else if (open) {
            setUploadDialogOpen(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedInvoiceId ? "Upload Invoice PDF" : "Upload Invoice"}
            </DialogTitle>
            <DialogDescription>
              {selectedInvoiceId 
                ? "Update invoice details and upload a PDF file. All changes will be saved."
                : "Fill in the invoice details and upload the PDF file. The invoice will be saved automatically after upload."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={uploadForm.title}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, title: e.target.value })
                }
                placeholder="e.g., Monthly Invoice - January 2024"
                data-testid="input-invoice-title"
              />
            </div>
            <div>
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={uploadForm.invoiceNumber}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, invoiceNumber: e.target.value })
                }
                placeholder="e.g., INV-2024-001"
                data-testid="input-invoice-number"
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount (in main currency units)</Label>
              <Input
                id="amount"
                type="number"
                value={uploadForm.amount}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, amount: e.target.value })
                }
                placeholder="e.g., 99.99"
                data-testid="input-invoice-amount"
              />
            </div>
            <div>
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                type="date"
                value={uploadForm.issueDate}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, issueDate: e.target.value })
                }
                data-testid="input-invoice-date"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={uploadForm.description}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, description: e.target.value })
                }
                placeholder="Additional notes about this invoice"
                data-testid="input-invoice-description"
              />
            </div>
            <div>
              <Label>PDF File *</Label>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloudinaryUpload}
                  disabled={uploading || (!selectedInvoiceId && !uploadForm.title)}
                  className="w-full"
                  data-testid="button-upload-pdf"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading PDF...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload PDF & Update Invoice
                    </>
                  )}
                </Button>
                {!uploadForm.title && (
                  <p className="text-sm text-muted-foreground">
                    Please enter a title first
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              disabled={uploading}
              data-testid="button-cancel-upload"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wrapp Confirmation Dialog */}
      <Dialog 
        open={wrappConfirmDialogOpen} 
        onOpenChange={(open) => {
          if (!open && !creatingWrapp) {
            setWrappConfirmDialogOpen(false);
            setInvoiceIdForWrapp(null);
          } else if (open) {
            setWrappConfirmDialogOpen(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice with Wrapp</DialogTitle>
            <DialogDescription>
              {creatingWrapp 
                ? "Creating invoice with Wrapp..." 
                : "Are you sure you want to create this invoice with Wrapp? This action will generate the invoice using Wrapp's service."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setWrappConfirmDialogOpen(false);
                setInvoiceIdForWrapp(null);
              }}
              disabled={creatingWrapp}
              data-testid="button-cancel-wrapp"
            >
              No, Cancel
            </Button>
            <Button
              onClick={handleConfirmWrapp}
              disabled={creatingWrapp}
              data-testid="button-confirm-wrapp"
            >
              {creatingWrapp ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Yes, Create with Wrapp"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Wrapp Confirmation Dialog */}
      <Dialog 
        open={cancelWrappDialogOpen} 
        onOpenChange={(open) => {
          if (!open && !cancellingWrapp) {
            setCancelWrappDialogOpen(false);
            setInvoiceIdForCancel(null);
          } else if (open) {
            setCancelWrappDialogOpen(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Wrapp Invoice</DialogTitle>
            <DialogDescription>
              {cancellingWrapp 
                ? "Cancelling Wrapp invoice..." 
                : "Are you sure you want to cancel this Wrapp invoice? This will reset it to DRAFT status and clear the Wrapp invoice ID."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelWrappDialogOpen(false);
                setInvoiceIdForCancel(null);
              }}
              disabled={cancellingWrapp}
              data-testid="button-cancel-cancel-wrapp"
            >
              No, Cancel
            </Button>
            <Button
              onClick={handleConfirmCancelWrapp}
              disabled={cancellingWrapp}
              variant="destructive"
              data-testid="button-confirm-cancel-wrapp"
            >
              {cancellingWrapp ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel Wrapp Invoice"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Billing Info Dialog */}
      <Dialog open={billingInfoDialogOpen} onOpenChange={(open) => {
        setBillingInfoDialogOpen(open);
        if (!open) {
          setEditingBilling(false);
          setSelectedWebsiteForBilling(null);
          setSelectedInvoiceForBilling(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Billing Information</DialogTitle>
            <DialogDescription>
              Subscription billing details for this website
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(subscriptionsLoading || subscriptionsFetching) ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (() => {
              const subscriptions = (subscriptionsData as any[]) || [];
              const planSubscription = subscriptions.find((sub: any) => sub.productType === "plan");
              
              if (!planSubscription) {
                return (
                  <div className="text-center text-muted-foreground py-4">
                    No plan subscription found for this website
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Document Type</span>
                    {editingBilling ? (
                      <Select
                        value={invoiceTypeValue}
                        onValueChange={setInvoiceTypeValue}
                        disabled={updateBillingMutation.isPending}
                      >
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="invoice">Invoice</SelectItem>
                          <SelectItem value="receipt">Receipt</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm font-medium capitalize">
                        {planSubscription.invoiceType || "Not provided"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">VAT Number</span>
                    {editingBilling ? (
                      <Input
                        value={vatValue}
                        onChange={(e) => setVatValue(e.target.value)}
                        className="w-40 h-8"
                        placeholder="Enter VAT"
                        disabled={updateBillingMutation.isPending}
                      />
                    ) : (
                      <span className="text-sm font-medium">
                        {planSubscription.vatNumber || (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">City</span>
                    {editingBilling ? (
                      <Input
                        value={cityValue}
                        onChange={(e) => setCityValue(e.target.value)}
                        className="w-40 h-8"
                        placeholder="Enter city"
                        disabled={updateBillingMutation.isPending}
                      />
                    ) : (
                      <span className="text-sm font-medium">
                        {planSubscription.city || (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Street</span>
                    {editingBilling ? (
                      <Input
                        value={streetValue}
                        onChange={(e) => setStreetValue(e.target.value)}
                        className="w-40 h-8"
                        placeholder="Enter street"
                        disabled={updateBillingMutation.isPending}
                      />
                    ) : (
                      <span className="text-sm font-medium">
                        {planSubscription.street || (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Number</span>
                    {editingBilling ? (
                      <Input
                        value={numberValue}
                        onChange={(e) => setNumberValue(e.target.value)}
                        className="w-40 h-8"
                        placeholder="Enter number"
                        disabled={updateBillingMutation.isPending}
                      />
                    ) : (
                      <span className="text-sm font-medium">
                        {planSubscription.number || (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Postal Code</span>
                    {editingBilling ? (
                      <Input
                        value={postalCodeValue}
                        onChange={(e) => setPostalCodeValue(e.target.value)}
                        className="w-40 h-8"
                        placeholder="Enter postal code"
                        disabled={updateBillingMutation.isPending}
                      />
                    ) : (
                      <span className="text-sm font-medium">
                        {planSubscription.postalCode || (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Invoice Type Code</span>
                    {editingBilling ? (
                      <Select
                        value={invoiceTypeCodeValue}
                        onValueChange={(value) => {
                          setInvoiceTypeCodeValue(value);
                          const codeToTypeMap: Record<string, string> = {
                            "2.1": "E3_561_001",
                            "2.2": "E3_561_005",
                            "2.3": "E3_561_006",
                            "11.2": "E3_561_003"
                          };
                          if (value && codeToTypeMap[value]) {
                            setClassificationTypeValue(codeToTypeMap[value]);
                          }
                        }}
                        disabled={updateBillingMutation.isPending}
                      >
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue placeholder="Select invoice type code" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2.1">2.1 - ΤΠΥ Ελλάδα</SelectItem>
                          <SelectItem value="2.2">2.2 - ΤΠΥ Ευρωπή</SelectItem>
                          <SelectItem value="2.3">2.3 - ΤΠΥ Rest of the World</SelectItem>
                          <SelectItem value="11.2">11.2 - ΑΠΥ</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm font-medium">
                        {planSubscription.invoiceTypeCode || (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Classification Type</span>
                    {editingBilling ? (
                      <Select
                        value={classificationTypeValue}
                        onValueChange={setClassificationTypeValue}
                      >
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue placeholder="Select classification type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="E3_561_003" disabled>E3_561_003 - ΑΠΥ</SelectItem>
                          <SelectItem value="E3_561_001" disabled>E3_561_001 - ΤΠΥ Ελλάδα</SelectItem>
                          <SelectItem value="E3_561_005" disabled>E3_561_005 - ΤΠΥ Ευρώπη</SelectItem>
                          <SelectItem value="E3_561_006" disabled>E3_561_006 - ΤΠΥ rest of the world</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm font-medium">
                        {planSubscription.classificationType || (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium text-muted-foreground">Product name</span>
                    {editingBilling ? (
                      <Select
                        value={productNameValue}
                        onValueChange={setProductNameValue}
                        disabled={updateBillingMutation.isPending}
                      >
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue placeholder="Select product name" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ΛΙΑΝΙΚΗ ΠΑΡΟΧΗ ΥΠΗΡΕΣΙΩΝ ΕΞΩΤΕΡΙΚΟΥ">ΛΙΑΝΙΚΗ ΠΑΡΟΧΗ ΥΠΗΡΕΣΙΩΝ ΕΞΩΤΕΡΙΚΟΥ</SelectItem>
                          <SelectItem value="ΥΠΗΡΕΣΙΕΣ ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΥ, ΣΧΕΔΙΑΣΜΟΥ ΚΑΙ ΑΝΑΠΤΥΞΗΣ ΛΟΓΙΣΜΙΚΟΥ, ΤΡΙΤΩΝ ΧΩΡΩΝ">ΥΠΗΡΕΣΙΕΣ ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΥ, ΣΧΕΔΙΑΣΜΟΥ ΚΑΙ ΑΝΑΠΤΥΞΗΣ ΛΟΓΙΣΜΙΚΟΥ, ΤΡΙΤΩΝ ΧΩΡΩΝ</SelectItem>
                          <SelectItem value="ΥΠΗΡΕΣΙΕΣ ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΥ, ΣΧΕΔΙΑΣΜΟΥ ΚΑΙ ΑΝΑΠΤΥΞΗΣ ΛΟΓΙΣΜΙΚΟΥ">ΥΠΗΡΕΣΙΕΣ ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΥ, ΣΧΕΔΙΑΣΜΟΥ ΚΑΙ ΑΝΑΠΤΥΞΗΣ ΛΟΓΙΣΜΙΚΟΥ</SelectItem>
                          <SelectItem value="ΥΠΗΡΕΣΙΕΣ ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΥ, ΣΧΕΔΙΑΣΜΟΥ ΚΑΙ ΑΝΑΠΤΥΞΗΣ ΛΟΓΙΣΜΙΚΟΥ ΣΕ ΕΥΡΩΠΗ">ΥΠΗΡΕΣΙΕΣ ΠΡΟΓΡΑΜΜΑΤΙΣΜΟΥ, ΣΧΕΔΙΑΣΜΟΥ ΚΑΙ ΑΝΑΠΤΥΞΗΣ ΛΟΓΙΣΜΙΚΟΥ ΣΕ ΕΥΡΩΠΗ</SelectItem>
                          <SelectItem value="ΛΙΑΝΙΚΗ ΠΑΡΟΧΗ ΥΠΗΡΕΣΙΩΝ ΕΝΤΟΣ ΕΛΛΑΔΟΣ">ΛΙΑΝΙΚΗ ΠΑΡΟΧΗ ΥΠΗΡΕΣΙΩΝ ΕΝΤΟΣ ΕΛΛΑΔΟΣ</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm font-medium">
                        {planSubscription.productName || (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </span>
                    )}
                  </div>
                  {editingBilling ? (
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          updateBillingMutation.mutate({
                            subscriptionId: planSubscription.id,
                            invoiceType: invoiceTypeValue,
                            vatNumber: vatValue,
                            city: cityValue,
                            street: streetValue,
                            number: numberValue,
                            postalCode: postalCodeValue,
                            classificationType: classificationTypeValue,
                            invoiceTypeCode: invoiceTypeCodeValue,
                            productName: productNameValue
                          });
                        }}
                        disabled={updateBillingMutation.isPending}
                      >
                        {updateBillingMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingBilling(false)}
                        disabled={updateBillingMutation.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2 pt-2">
                      {invoiceFilter === "draft" && selectedInvoiceForBilling && planSubscription?.classificationType && planSubscription?.invoiceTypeCode && planSubscription?.productName && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setBillingInfoDialogOpen(false);
                            setSelectedWebsiteForBilling(null);
                            setEditingBilling(false);
                            const invoiceId = selectedInvoiceForBilling;
                            setSelectedInvoiceForBilling(null);
                            handleOpenWrappDialog(invoiceId);
                          }}
                        >
                          Create Invoice
                        </Button>
                      )}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setInvoiceTypeValue(planSubscription.invoiceType || "invoice");
                          setVatValue(planSubscription.vatNumber || "");
                          setCityValue(planSubscription.city || "");
                          setStreetValue(planSubscription.street || "");
                          setNumberValue(planSubscription.number || "");
                          setPostalCodeValue(planSubscription.postalCode || "");
                          setClassificationTypeValue(planSubscription.classificationType || "");
                          setInvoiceTypeCodeValue(planSubscription.invoiceTypeCode || "");
                          setProductNameValue(planSubscription.productName || "");
                          setEditingBilling(true);
                        }}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBillingInfoDialogOpen(false);
                          setSelectedWebsiteForBilling(null);
                          setSelectedInvoiceForBilling(null);
                          setEditingBilling(false);
                        }}
                      >
                        Close
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Draft Invoice Dialog */}
      <Dialog open={createDraftDialogOpen} onOpenChange={(open) => {
        setCreateDraftDialogOpen(open);
        if (!open) {
          setSelectedWebsiteForDraft(null);
          setCreateDraftForm({ title: "", description: "", amount: "", currency: "EUR" });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Draft Invoice</DialogTitle>
            <DialogDescription>
              Create a new draft invoice for this website
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="draft-title">Title *</Label>
              <Input
                id="draft-title"
                placeholder="e.g., Invoice for Custom Service"
                value={createDraftForm.title}
                onChange={(e) => setCreateDraftForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-description">Description</Label>
              <Textarea
                id="draft-description"
                placeholder="Optional description"
                value={createDraftForm.description}
                onChange={(e) => setCreateDraftForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="draft-amount">Amount * (€)</Label>
                <Input
                  id="draft-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={createDraftForm.amount}
                  onChange={(e) => setCreateDraftForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-currency">Currency</Label>
                <Select
                  value={createDraftForm.currency}
                  onValueChange={(value) => setCreateDraftForm(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger id="draft-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDraftDialogOpen(false);
                setSelectedWebsiteForDraft(null);
                setCreateDraftForm({ title: "", description: "", amount: "", currency: "EUR" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateDraftInvoice}
              disabled={createDraftMutation.isPending}
            >
              {createDraftMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Draft"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
