import { useNavigate, Link } from "react-router-dom";
import { SubscriptionCard } from "@/components/ui/subscription-card";
import { subscriptionPlans, type User } from "@shared/schema";
import { createCheckoutSession } from "@/lib/api";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Server,
  Wrench,
} from "lucide-react";
import { usePrevNextButtons } from "@/components/ui/emblaCarouselArrowButtons";
import { usePricing } from "@/hooks/use-pricing";
import "../i18n";

import { ENVATO_TEMPLATES } from "@/data/envato-templates";
import { PROJECTS } from "@/data/projects";
import { FacebookReviewWidget, TrustpilotReviewWidget, G2ReviewWidget } from "@/components/ui/review-widget";
import { TemplatePreviewModal } from "@/components/TemplatePreviewModal";
import type { Template } from "@shared/schema";

// Selected templates to display on home page carousel
// You can change these IDs to display different templates
const SELECTED_TEMPLATE_IDS = [1, 5, 10, 15, 20, 25, 30, 35];

const TESTIMONIALS = [
  {
    name: "Sarah Johnson",
    role: "CEO, TechStart",
    content:
      "Είμαι πολύ ικανοποιημένη από τις υπηρεσίες της hayc και το προτείνω ανεπιφύλακτα σε όποιον θέλει υπηρεσίες website για την επιχείρησή του με ποιότητα, συνέπεια, άριστη εξυπηρέτηση και εξυπηρέτηση πελατών.",
    rating: 5,
  },
  {
    name: "Michael Chen",
    role: "Founder, GrowthLabs",
    content:
      "Έμεινα πάρα πολύ ευχαριστημένος με τις υπηρεσίες της hayc. Μου δημιούργησαν ένα site πάνω στις ανάγκες μου , άμεσα και χωρίς προβλήματα !!! Τον συνιστώ για οποιονδήποτε θέλει μια ιστοσελίδα !",
    rating: 5,
  },
  {
    name: "Emma Davis",
    role: "CTO, InnovateCo",
    content:
      "Η Hayc είναι πλήρως επαγγελματίες που με βοήθησαν δημιουργώντας έναν ιστότοπο για την επιχείρησή μου. Η Hayc ήταν εξαιρετικά γρήγοροι και ανταποκρινόμενοι στην παράδοση του ιστότοπου σε ένα πολύ σφιχτό χρονοδιάγραμμα και σύμφωνα με τις προδιαγραφές. Άρχισαν να εργάζονται για το έργο από την ημέρα μηδέν και ολοκλήρωσαν τη δουλειά με επιτυχία σε λιγότερο από 9 ημέρες. Τους συνιστώ ανεπιφύλακτα για συνεργασία και να τους εμπιστευτείτε για την ποιότητα της δουλειάς τους.",
    rating: 5,
  },
];

const schema = z.object({
  email: z.string().email("Please enter a valid email"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  vatNumber: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function Home() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<
    keyof typeof subscriptionPlans | null
  >(null);
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedAddOns, setExpandedAddOns] = useState<{ [key: string]: boolean }>({});
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const { toast } = useToast();

  // Basic testimonial and templates carousels (without autoScroll).
  const [testimonialsRef] = useEmblaCarousel({ loop: true });
  const [templatesRef, templatesApi] = useEmblaCarousel({
    loop: true,
    dragFree: true,
  });

  // Arrow buttons for projects slider
  const {
    prevBtnDisabled: projectsPrevDisabled,
    nextBtnDisabled: projectsNextDisabled,
    onPrevButtonClick: onProjectsPrevClick,
    onNextButtonClick: onProjectsNextClick,
  } = usePrevNextButtons(templatesApi, undefined);

  // Example query for user data
  const { data } = useQuery<{ user: User | null }>({
    queryKey: ["/api/user"],
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Fetch dynamic pricing from Stripe
  const { data: prices, isLoading: pricesLoading } = usePricing();

  // Subscription form
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Filter templates to display only selected ones
  const selectedTemplates = useMemo(() => {
    return ENVATO_TEMPLATES.filter(template => 
      SELECTED_TEMPLATE_IDS.includes(template.id)
    );
  }, []);

  const handleSubscription = async (
    planId: keyof typeof subscriptionPlans,
    formData?: FormData,
    selectedAddOns: string[] = [],
  ) => {
    setLoading(true);
    try {
      const checkoutData = data?.user
        ? {
            email: data.user.email,
            username: data.user.username,
            planId,
            billingPeriod: (isYearly ? "yearly" : "monthly") as "yearly" | "monthly", // Add billing period
            addOns: selectedAddOns,
            language: i18n.language,
          }
        : {
            ...formData!,
            planId,
            billingPeriod: (isYearly ? "yearly" : "monthly") as "yearly" | "monthly", // Add billing period
            addOns: selectedAddOns,
            language: i18n.language,
          };

      const response = await createCheckoutSession(checkoutData);

      if (response.url) {
        window.location.href = response.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  const onSubscribe = (planId: keyof typeof subscriptionPlans) => {
    setSelectedPlan(planId);
  };

  const onSubmit = async (formData: FormData) => {
    if (!selectedPlan) return;
  };

  const handleAddOnsSubmit = (selectedAddOns: string[]) => {
    if (!selectedPlan) return;
    if (data?.user) {
      handleSubscription(selectedPlan, undefined, selectedAddOns);
    } else {
      const formData = form.getValues();
      handleSubscription(selectedPlan, formData, selectedAddOns);
    }
  };

  const toggleAddOnExpansion = (addonId: string) => {
    setExpandedAddOns(prev => ({
      ...prev,
      [addonId]: !prev[addonId]
    }));
  };

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template);
    setIsTemplateModalOpen(true);
  };

  const handleTemplateModalOpenChange = (open: boolean) => {
    setIsTemplateModalOpen(open);
    if (!open) {
      setSelectedTemplate(null);
    }
  };

  // Embla carousel with AutoScroll plugin for the "Website Templates" section
  // --------------------------------------------------------------------------
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    AutoScroll({ playOnInit: true }) as any,
  ]);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;

    const pluginMap = emblaApi.plugins();
    const autoScrollApi = pluginMap?.autoScroll;

    if (!autoScrollApi) return;

    setIsPlaying((autoScrollApi as any).isPlaying());

    emblaApi
      .on("autoScroll:play" as any, () => setIsPlaying(true))
      .on("autoScroll:stop" as any, () => setIsPlaying(false))
      .on("reInit", () => {
        setIsPlaying((autoScrollApi as any).isPlaying());
      });
  }, [emblaApi]);

  // NEW: Pause/Resume AutoScroll on hover
  // -------------------------------------
  const handleMouseEnter = useCallback(() => {
    if (!emblaApi) return;
    const autoScrollApi = emblaApi.plugins()?.autoScroll;
    (autoScrollApi as any)?.stop();
  }, [emblaApi]);

  const handleMouseLeave = useCallback(() => {
    if (!emblaApi) return;
    const autoScrollApi = emblaApi.plugins()?.autoScroll;
    (autoScrollApi as any)?.play();
  }, [emblaApi]);

  return (
    <div className="min-h-screen bg-background  mt-md-[65px]">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center bg-gradient-to-r from-[#ffffff] to-[#488ced] overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col-reverse lg:flex-row gap-12 items-center">
            {/* Left Column - Content */}
            <div className="text-center lg:text-left w-full lg:w-1/4 flex-shrink-0">
              <h1 className="text-3xl lg:text-5xl font-bold tracking-tight mb-6">
                {t("home.title")}
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                {t("home.hero.subtitle")}
              </p>
              <Button
                size="lg"
                className="group bg-gradient-main hover:bg-[#182b53]/90"
                onClick={() => {
                  const pricingSection = document.querySelector('main');
                  pricingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {t("home.hero.cta")}
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>

            {/* Right Column - Image */}
            <div className="lg:flex justify-center lg:justify-end lg:w-3/4">
              <div className="relative max-w-[1100px]">
                <img
                  src="/images/HAYC_HERO.png"
                  alt="HAYC Hero Image"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Integrations Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">{t("home.addons.title")}</h2>
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Left Column - Integration Cards */}
            <div className="lg:col-span-3">
              <div className="grid md:grid-cols-3 gap-4 items-start">
                {/* Prototype */}
                {/* <div className="flex items-start space-x-4 p-4 bg-card rounded-lg border hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#4285F4">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">Google Analytics & SEO</h3>
                    <div className="flex items-center mb-2">
                      <span className="text-sm text-gray-600">4.8 ★ (15,420) • Free to install</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Track website performance, understand your visitors, and optimize for search engines
                    </p>
                    <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                      ✓ Built for Performance
                    </div>
                  </div>
                </div> */}

                {/* Booking */}
                <div className="bg-card rounded-lg border hover:shadow-md transition-shadow">
                  <div className="p-2 cursor-pointer relative" onClick={() => toggleAddOnExpansion('booking')}>
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img
                          src="/images/booking-add-on-icon.svg"
                          alt={t("home.addons.bookingAddon.alt")}
                          className="w-full h-auto"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="row justify-content-between">
                        <h3 className="font-semibold mb-1" style={{ fontSize: '12px' }}>
                          {t("home.addons.bookingAddon.title")}
                        </h3>
                        </div>
                        <p className="text-gray-600" style={{ fontSize: '11px' }}>
                          {t("home.addons.bookingAddon.description")}
                        </p>
                      </div>
                      <div className="absolute top-2 right-4">
                        {expandedAddOns['booking'] ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedAddOns['booking'] && (
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        {(t("home.addons.bookingAddon.tags", { returnObjects: true }) as string[]).map((tag: string, index: number) => (
                          <div key={index} className="text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block" style={{ fontSize: '11px' }}>
                            ✓ {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* LMS */}
                <div className="bg-card rounded-lg border hover:shadow-md transition-shadow">
                  <div className="p-2 cursor-pointer relative" onClick={() => toggleAddOnExpansion('lms')}>
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img
                          src="/images/lms-add-on-icon.svg"
                          alt={t("home.addons.lmsAddon.alt")}
                          className="w-full h-auto"
                        />
                      </div>
                      <div className="flex-1 min-w-0 ">
                        <h3 className="font-semibold mb-1" style={{ fontSize: '12px' }}>{t("home.addons.lmsAddon.title")}</h3>
                        <p className="text-gray-600" style={{ fontSize: '11px' }}>
                          {t("home.addons.lmsAddon.description")}
                        </p>
                      </div>
                      <div className="absolute top-2 right-4">
                        {expandedAddOns['lms'] ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedAddOns['lms'] && (
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        {(t("home.addons.lmsAddon.tags", { returnObjects: true }) as string[]).map((tag: string, index: number) => (
                          <div key={index} className="text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block" style={{ fontSize: '11px' }}>
                            ✓ {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Multistep Form */}
                <div className="bg-card rounded-lg border hover:shadow-md transition-shadow">
                  <div className="p-2 cursor-pointer relative" onClick={() => toggleAddOnExpansion('multistep')}>
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img
                          src="/images/multistep-form-add-on-icon.svg"
                          alt={t("home.addons.multistepFormAddon.alt")}
                          className="w-full h-auto"
                        />
                      </div>
                      <div className="flex-1 min-w-0 ">
                        <h3 className="font-semibold mb-1" style={{ fontSize: '12px' }}>
                          {t("home.addons.multistepFormAddon.title")}
                        </h3>
                        <p className="text-gray-600" style={{ fontSize: '11px' }}>
                          {t("home.addons.multistepFormAddon.description")}
                        </p>
                      </div>
                      <div className="absolute top-2 right-4">
                        {expandedAddOns['multistep'] ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedAddOns['multistep'] && (
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        {(t("home.addons.multistepFormAddon.tags", { returnObjects: true }) as string[]).map((tag: string, index: number) => (
                          <div key={index} className="text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block" style={{ fontSize: '11px' }}>
                            ✓ {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* QR Code Addon */}
                <div className="bg-card rounded-lg border hover:shadow-md transition-shadow">
                  <div className="p-2 cursor-pointer relative" onClick={() => toggleAddOnExpansion('qrcode')}>
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img
                          src="/images/qr-code-add-on-icon.svg"
                          alt={t("home.addons.qrCodeAddon.alt")}
                          className="w-full h-auto"
                        />
                      </div>
                      <div className="flex-1 min-w-0 ">
                        <h3 className="font-semibold mb-1" style={{ fontSize: '12px' }}>
                          {t("home.addons.qrCodeAddon.title")}
                        </h3>
                        <p className="text-gray-600" style={{ fontSize: '11px' }}>
                          {t("home.addons.qrCodeAddon.description")}
                        </p>
                      </div>
                      <div className="absolute top-2 right-4">
                        {expandedAddOns['qrcode'] ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedAddOns['qrcode'] && (
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        {(t("home.addons.qrCodeAddon.tags", { returnObjects: true }) as string[]).map((tag: string, index: number) => (
                          <div key={index} className="text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block" style={{ fontSize: '11px' }}>
                            ✓ {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Donation add-on */}
                <div className="bg-card rounded-lg border hover:shadow-md transition-shadow">
                  <div className="p-2 cursor-pointer relative" onClick={() => toggleAddOnExpansion('donation')}>
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img
                          src="/images/donation-system-add-on-icon.svg"
                          alt={t("home.addons.donationaddon.alt")}
                          className="w-full h-auto"
                        />
                      </div>
                      <div className="flex-1 min-w-0 ">
                        <h3 className="font-semibold mb-1" style={{ fontSize: '12px' }}>
                          {t("home.addons.donationaddon.title")}
                        </h3>
                        <p className="text-gray-600" style={{ fontSize: '11px' }}>
                          {t("home.addons.donationaddon.description")}
                        </p>
                      </div>
                      <div className="absolute top-2 right-4">
                        {expandedAddOns['donation'] ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedAddOns['donation'] && (
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        {(t("home.addons.donationaddon.tags", { returnObjects: true }) as string[]).map((tag: string, index: number) => (
                          <div key={index} className="text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block" style={{ fontSize: '11px' }}>
                            ✓ {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Online payments add-on */}
                <div className="bg-card rounded-lg border hover:shadow-md transition-shadow">
                  <div className="p-2 cursor-pointer relative" onClick={() => toggleAddOnExpansion('payments')}>
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img
                          src="/images/online-payment-add-on-icon.svg"
                          alt={t("home.addons.realEstateAddon.alt")}
                          className="w-full h-auto"
                        />
                      </div>
                      <div className="flex-1 min-w-0 ">
                        <h3 className="font-semibold mb-1" style={{ fontSize: '12px' }}>
                          {t("home.addons.onlinepayments.title")}
                        </h3>
                        <p className="text-gray-600" style={{ fontSize: '11px' }}>
                          {t("home.addons.onlinepayments.description")}
                        </p>
                      </div>
                      <div className="absolute top-2 right-4">
                        {expandedAddOns['payments'] ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedAddOns['payments'] && (
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        {(t("home.addons.onlinepayments.tags", { returnObjects: true }) as string[]).map((tag: string, index: number) => (
                          <div key={index} className="text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block" style={{ fontSize: '11px' }}>
                            ✓ {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Real Estate Addon */}
                <div className="bg-card rounded-lg border hover:shadow-md transition-shadow">
                  <div className="p-2 cursor-pointer relative" onClick={() => toggleAddOnExpansion('realestate')}>
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img
                          src="/images/real-estate-add-on-icon.svg"
                          alt={t("home.addons.realEstateAddon.alt")}
                          className="w-full h-auto"
                        />
                      </div>
                      <div className="flex-1 min-w-0 ">
                        <h3 className="font-semibold mb-1" style={{ fontSize: '12px' }}>
                          {t("home.addons.realEstateAddon.title")}
                        </h3>
                        <p className="text-gray-600" style={{ fontSize: '11px' }}>
                          {t("home.addons.realEstateAddon.description")}
                        </p>
                      </div>
                      <div className="absolute top-2 right-4">
                        {expandedAddOns['realestate'] ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedAddOns['realestate'] && (
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        {(t("home.addons.realEstateAddon.tags", { returnObjects: true }) as string[]).map((tag: string, index: number) => (
                          <div key={index} className="text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block" style={{ fontSize: '11px' }}>
                            ✓ {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Transport Booking Addon */}
                <div className="bg-card rounded-lg border hover:shadow-md transition-shadow">
                  <div className="p-2 cursor-pointer relative" onClick={() => toggleAddOnExpansion('transport')}>
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <img
                          src="/images/transport-booking-add-on-icon.svg"
                          alt={t("home.addons.transportBookingAddon.alt")}
                          className="w-full h-auto"
                        />
                      </div>
                      <div className="flex-1 min-w-0 ">
                        <h3 className="font-semibold mb-1" style={{ fontSize: '12px' }}>
                          {t("home.addons.transportBookingAddon.title")}
                        </h3>
                        <p className="text-gray-600" style={{ fontSize: '11px' }}>
                          {t("home.addons.transportBookingAddon.description")}
                        </p>
                      </div>
                      <div className="absolute top-2 right-4">
                        {expandedAddOns['transport'] ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  {expandedAddOns['transport'] && (
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        {(t("home.addons.transportBookingAddon.tags", { returnObjects: true }) as string[]).map((tag: string, index: number) => (
                          <div key={index} className="text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block" style={{ fontSize: '11px' }}>
                            ✓ {tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Call to Action */}
            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-red-400 to-red-500 rounded-lg p-6 text-white h-full flex flex-col justify-between">
                <h3 className="text-xl font-bold mb-4">
                  {t("home.addons.cta.title")}
                </h3>
                <p className="mb-6 text-red-50">
                  {t("home.addons.cta.description")}
                </p>
                <Button
                  variant="secondary"
                  className="w-full bg-white text-red-500 hover:bg-gray-100"
                  onClick={() => navigate("/fast-and-affordable-websites-book-a-call")}
                >
                  {t("home.addons.cta.button")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Subscription Plans Section */}
      <main className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight">
            {t("home.plans.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("home.plans.subtitle")}
          </p>
          


          {/* Billing Period Toggle */}
          <div className="mt-8 inline-flex items-center rounded-full border p-1 bg-muted">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-4 py-2 rounded-full text-sm ${
                !isYearly ? "bg-background shadow-sm" : ""
              }`}
            >
              {t("home.plans.monthly")}
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-4 py-2 rounded-full text-sm ${
                isYearly ? "bg-background shadow-sm" : ""
              }`}
            >
              {t("home.plans.yearly")}{" "}
              <span className="text-green-500 text-xs ml-1">{t("home.plans.saveLabel")}</span>
            </button>
          </div>
        </div>
        
        {/* All plans notice */}
        <div className="mt-3 p-4 bg-blue-50 border mb-8 border-blue-200 rounded-lg">
          <p className="text-blue-800 font-medium text-center flex items-center justify-center flex-wrap gap-x-6 gap-y-2">
            {t("pricing.allPlansInclude")}

            <span className="flex items-center gap-2">
              {t("pricing.zeroTransactionFee")}
            </span>

            <span className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              {t("pricing.hosting")}
            </span>

            <span className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {t("pricing.maintenance")}
            </span>
          </p>
        </div>

        
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(subscriptionPlans).map(([id, plan]) => (
            <SubscriptionCard
              key={id}
              plan={plan}
              loading={loading && selectedPlan === id}
              onSubscribe={() =>
                onSubscribe(id as keyof typeof subscriptionPlans)
              }
              isYearly={isYearly}
              dynamicPrices={prices}
              pricesLoading={pricesLoading}
            />
          ))}
        </div>

        {/* Guarantee Section */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold mb-8">{t("home.guarantees.title")}</h3>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-green-500 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="font-semibold text-green-800 mb-2">{t("home.guarantees.performance.title")}</h4>
              <p className="text-green-700">
                {t("home.guarantees.performance.description")}
              </p>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-orange-500 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h4 className="font-semibold text-orange-800 mb-2">{t("home.guarantees.moneyBack.title")}</h4>
              <p className="text-orange-700">
                {t("home.guarantees.moneyBack.description")}
              </p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-500 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="font-semibold text-blue-800 mb-2">{t("home.guarantees.uptime.title")}</h4>
              <p className="text-blue-700">
                {t("home.guarantees.uptime.description")}
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* Website Templates Section */}
      <section className="py-24 bg-secondary/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              {t("home.templates.title")}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t("home.templates.subtitle")}
            </p>
          </div>

          {/* IMPORTANT: Added onMouseEnter / onMouseLeave for pause on hover */}
          <div
            className="embla overflow-hidden"
            ref={emblaRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="embla__container flex">
              {selectedTemplates.map((template) => (
                <div
                  key={template.id}
                  className="embla__slide flex-[0_0_100%] min-w-0 pl-4 md:flex-[0_0_50%] lg:flex-[0_0_33.33%]"
                >
                  <div className="bg-card rounded-lg overflow-hidden h-full transition-transform hover:scale-[1.02]">
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={template.preview}
                        alt={template.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-semibold mb-4">
                        {template.name}
                      </h3>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleTemplateClick(template)}
                        data-testid={`button-preview-${template.id}`}
                      >
                        {t("home.templates.livePreview")}
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* End embla */}
        </div>
      </section>

      {/* Projects Showcase Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              {t("home.projects.title")}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t("home.projects.subtitle")}
            </p>
          </div>

          <div className="relative">
            <div className="embla overflow-hidden" ref={templatesRef}>
              <div className="embla__container flex">
                {PROJECTS.map((project) => (
                  <div
                    key={`${project.id}-${project.translationKey}`}
                    className="embla__slide flex-[0_0_100%] min-w-0 pl-4 md:flex-[0_0_50%] lg:flex-[0_0_33.33%]"
                  >
                    <Link
                      to={project.url}
                      className="group relative overflow-hidden rounded-lg bg-card h-full block"
                    >
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={project.image}
                          alt={t(`home.projects.items.${project.translationKey}.title`)}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                      <div className="p-6">
                        <h3 className="text-xl font-semibold mb-2">
                          {t(`home.projects.items.${project.translationKey}.title`)}
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          {t(`home.projects.items.${project.translationKey}.description`)}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {project.tech.map((tech) => (
                            <span
                              key={tech}
                              className="px-2 py-1 text-sm bg-[#2777E9] text-[#ffffff] rounded-full"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                        <span className="inline-flex items-center text-[#182B53] hover:underline">
                          {t("home.projects.view")}{" "}
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </span>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Arrows */}
            <Button
              onClick={onProjectsPrevClick}
              disabled={projectsPrevDisabled}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg border-0 h-12 w-12 rounded-full disabled:opacity-50"
              variant="outline"
              size="icon"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>

            <Button
              onClick={onProjectsNextClick}
              disabled={projectsNextDisabled}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg border-0 h-12 w-12 rounded-full disabled:opacity-50"
              variant="outline"
              size="icon"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section - Hidden since we now have Facebook and Trustpilot widgets */}
      {/* <section className="py-24 bg-secondary/10">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t("home.testimonials.title")}
          </h2>
          <div className="overflow-hidden" ref={testimonialsRef}>
            <div className="flex">
              {TESTIMONIALS.map((testimonial, index) => (
                <div
                  key={index}
                  className="flex-[0_0_100%] min-w-0 pl-4 md:flex-[0_0_50%] lg:flex-[0_0_33.33%]"
                >
                  <div className="bg-card rounded-lg p-6 shadow-sm h-full">
                    <div className="flex mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <StarIcon
                          key={i}
                          className="h-5 w-5 fill-primary text-primary"
                        />
                      ))}
                    </div>
                    <blockquote className="text-lg mb-4">
                      {testimonial.content}
                    </blockquote>
                    <footer>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role}
                      </div>
                    </footer>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section> */}

      {/* Review Widgets Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight mb-4">
              {t("home.reviews.title")}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t("home.reviews.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div>
              <FacebookReviewWidget
                rating={5.0}
                totalReviews={5}
                profileUrl="https://www.facebook.com/haycWebsites/reviews"
                size="lg"
                className="h-full"
              />
            </div>
            <div>
              <TrustpilotReviewWidget
                rating={4.4}
                totalReviews={12}
                profileUrl="https://www.trustpilot.com/review/hayc.gr"
                size="lg"
                className="h-full"
              />
            </div>
            <div>
              <G2ReviewWidget
                rating={0}
                totalReviews={0}
                profileUrl="https://www.g2.com/products/hayc/reviews"
                size="lg"
                className="h-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Template Preview Modal */}
      <TemplatePreviewModal
        template={selectedTemplate}
        open={isTemplateModalOpen}
        onOpenChange={handleTemplateModalOpenChange}
      />

    </div>
  );
}