import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronUp, Star, Phone, Mail, CheckCircle, Clock, Zap, Shield, Users, ArrowRight, Play } from "lucide-react";
import { FacebookReviewWidget, TrustpilotReviewWidget, G2ReviewWidget } from "@/components/ui/review-widget";
import { useTranslation } from "react-i18next";
import { getStoredUTMParams } from "@/lib/utm";

type LeadFormData = {
  email: string;
  phone: string;
};

export default function WebsiteCreationLanding() {
  const [showCalendly, setShowCalendly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>("");
  const { t, i18n } = useTranslation();
  const leadEventFired = useRef(false);
  
  const leadSchema = z.object({
    email: z.string().email(t('landingPage.form.emailValidation')),
    phone: z.string().min(1, t('landingPage.form.phoneValidation')),
  });

  const benefits = [
    {
      icon: <Clock className="h-6 w-6" />,
      title: t('landingPage.benefits.benefit1.title'),
      description: t('landingPage.benefits.benefit1.description')
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: t('landingPage.benefits.benefit2.title'),
      description: t('landingPage.benefits.benefit2.description')
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: t('landingPage.benefits.benefit3.title'),
      description: t('landingPage.benefits.benefit3.description')
    },
    {
      icon: <Star className="h-6 w-6" />,
      title: t('landingPage.benefits.benefit4.title'),
      description: t('landingPage.benefits.benefit4.description')
    }
  ];

  const howItWorksSteps = [
    {
      step: 1,
      title: t('landingPage.howItWorks.step1.title'),
      description: t('landingPage.howItWorks.step1.description')
    },
    {
      step: 2,
      title: t('landingPage.howItWorks.step2.title'),
      description: t('landingPage.howItWorks.step2.description')
    },
    {
      step: 3,
      title: t('landingPage.howItWorks.step3.title'),
      description: t('landingPage.howItWorks.step3.description')
    },
    {
      step: 4,
      title: t('landingPage.howItWorks.step4.title'),
      description: t('landingPage.howItWorks.step4.description')
    }
  ];

  const qualificationQuestions = [
    t('landingPage.qualification.question1'),
    t('landingPage.qualification.question2'),
    t('landingPage.qualification.question3'),
    t('landingPage.qualification.question4')
  ];

  const faqs = [
    {
      question: t('landingPage.faq.question1'),
      answer: t('landingPage.faq.answer1')
    },
    {
      question: t('landingPage.faq.question2'),
      answer: t('landingPage.faq.answer2')
    },
    {
      question: t('landingPage.faq.question3'),
      answer: t('landingPage.faq.answer3')
    },
    {
      question: t('landingPage.faq.question4'),
      answer: t('landingPage.faq.answer4')
    },
    {
      question: t('landingPage.faq.question5'),
      answer: t('landingPage.faq.answer5')
    },
    {
      question: t('landingPage.faq.question6'),
      answer: t('landingPage.faq.answer6')
    }
  ];

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      email: "",
      phone: "",
    },
  });

  const onSubmit = async (data: LeadFormData) => {
    setIsSubmitting(true);

    try {
      const utmParams = getStoredUTMParams();
      const response = await fetch('/api/submit-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          phone: data.phone,
          source: 'website-creation-landing',
          ...(utmParams && { utm: utmParams }),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit lead');
      }

      const result = await response.json();
      console.log('Lead captured:', result);

      // ✅ FIRE META LEAD EVENT (SPA-safe)
      if (!leadEventFired.current && window.fbq) {
        setTimeout(() => {
          window.fbq('track', 'Lead');
        }, 0);

        leadEventFired.current = true;
      }

      // UI success
      setSubmittedEmail(data.email);
      setShowCalendly(true);

    } catch (error) {
      console.error('Error submitting lead:', error);
      // ❌ DO NOT fire Lead here
      // Optional: show retry UI
    } finally {
      setIsSubmitting(false);
    }
  };



  const scrollToForm = () => {
    document.getElementById('lead-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (showCalendly) {
      // Small delay to ensure DOM is fully rendered before loading HubSpot script
      const timer = setTimeout(() => {
        const script = document.createElement('script');
        script.src = 'https://static.hsappstatic.net/MeetingsEmbed/ex/MeetingsEmbedCode.js';
        script.type = 'text/javascript';
        script.async = true;
        document.body.appendChild(script);
      }, 100);

      // Listen for HubSpot meeting booking events
      const handleMeetingBooked = async (event: MessageEvent) => {
        // Debug: Log all postMessage events for troubleshooting
        if (event.data && typeof event.data === 'object') {
          console.log('🔍 postMessage received:', {
            origin: event.origin,
            dataKeys: Object.keys(event.data)
          });
        }
        
        // Security: Strict whitelist of known HubSpot domains
        const allowedHostnames = [
          'meetings.hubspot.com',
          'app.hubspot.com',
          'static.hsappstatic.net',
          'meetings-eu1.hubspot.com',
          'meetings.hubspoteu.net',
          'local.hubspot.com',
          'api.hubspot.com',
          'forms.hubspot.com',
          'js.hsappstatic.net'
        ];
        
        try {
          const originUrl = new URL(event.origin);
          const isAllowed = allowedHostnames.some(host => originUrl.hostname === host);
          if (!isAllowed) {
            return;
          }
        } catch {
          // Invalid origin URL, reject
          return;
        }
        
        // HubSpot meetings embed sends postMessage events - check multiple possible event formats
        if (event.data && (event.data.meetingBookSucceeded || event.data.type === 'hsFormCallback' || event.data.meetingBooked)) {
          // Debug: Log the full meeting data structure to understand what HubSpot sends
          console.log('📅 Meeting booked - Full event data:', JSON.stringify(event.data, null, 2));
          
          // Extract meeting start time - HubSpot sends the time in meetingsPayload.bookingResponse
          let meetingDateString: string | null = null;
          
          // Try multiple possible locations where HubSpot might send the meeting time
          const possibleStartTimeFields = [
            // Primary location in HubSpot meetings embed
            event.data?.meetingsPayload?.bookingResponse?.event?.dateTime,
            event.data?.meetingsPayload?.bookingResponse?.postResponse?.timerange?.start,
            // Alternative locations
            event.data?.meetingBooked?.startTime,
            event.data?.meetingBooked?.dateTime,
            event.data?.startTime,
            event.data?.start,
            event.data?.dateTime,
          ];
          
          console.log('📅 Checking possible start time fields:', possibleStartTimeFields);
          
          for (const field of possibleStartTimeFields) {
            if (field !== undefined && field !== null) {
              if (typeof field === 'number') {
                // Convert epoch milliseconds to ISO string
                meetingDateString = new Date(field).toISOString();
                console.log('📅 Found meeting time (number):', field, '→', meetingDateString);
                break;
              } else if (typeof field === 'string' && field.trim() !== '') {
                meetingDateString = field;
                console.log('📅 Found meeting time (string):', meetingDateString);
                break;
              }
            }
          }
          
          // If still no date found, send debug data to server for production debugging
          if (!meetingDateString) {
            console.warn('⚠️ Could not extract meeting date from HubSpot event. Full data:', event.data);
            // Send debug data to server so we can see what HubSpot is sending in production
            try {
              await fetch('/api/debug-meeting-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: submittedEmail || 'unknown',
                  eventOrigin: event.origin,
                  eventData: event.data,
                  timestamp: new Date().toISOString(),
                }),
              });
            } catch (e) {
              console.error('Failed to send debug data:', e);
            }
            // Skip the update if we can't determine the actual meeting time
            return;
          }
          
          // Update HubSpot with meeting info using the email we captured from the form
          if (submittedEmail) {
            try {
              const response = await fetch('/api/update-meeting-booked', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  email: submittedEmail,
                  meetingDate: meetingDateString,
                }),
              });
              
              if (response.ok) {
                console.log('✅ HubSpot updated with meeting booking info');
              } else {
                console.error('❌ Failed to update HubSpot with meeting info');
              }
            } catch (error) {
              console.error('❌ Error updating HubSpot:', error);
            }
          }
        }
      };

      window.addEventListener('message', handleMeetingBooked);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('message', handleMeetingBooked);
      };
    }
  }, [showCalendly, submittedEmail]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Notice Bar */}
      {/* <div className="bg-orange-100 border-b border-orange-200 py-3">
        <div className="container mx-auto px-4">
          <p className="text-center text-orange-800 text-sm font-medium">
            {t('landingPage.notice')}
          </p>
        </div>
      </div> */}

      {/* Hero Section */}
      <section className="py-10 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4">
          {/* Logo, Hero Content, and Language Switcher Row */}
          <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:justify-between md:gap-8 mb-12">
            {/* Logo and Language Switcher Row on Mobile */}
            <div className="flex items-center justify-between w-full md:w-auto md:flex-shrink-0">
              {/* Logo */}
              <div className="flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width="6em" height="3em" viewBox="0 0 148 49.81"><defs><clipPath id="clip-path"><rect id="Rectangle_93" data-name="Rectangle 93" width="148" height="49.81" fill="none"></rect></clipPath></defs><g id="Group_117" data-name="Group 117" transform="translate(0 0)"><path id="Path_901" data-name="Path 901" d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z" transform="translate(0 0)" fill="#ed4c14"></path><g id="Group_116" data-name="Group 116" transform="translate(0 0)"><g id="Group_115" data-name="Group 115" clip-path="url(#clip-path)"><path id="Path_902" data-name="Path 902" d="M61.828,22.27V38.076H53.823V23.5c0-4.465-2.052-6.518-5.594-6.518-3.849,0-6.619,2.362-6.619,7.441V38.076H33.6V0H41.61V13.34a12.138,12.138,0,0,1,8.775-3.285c6.517,0,11.444,3.8,11.444,12.215" transform="translate(-6.611 0)" fill="#00398e"></path><path id="Path_903" data-name="Path 903" d="M102.242,12.917v27.61H94.6v-3.18c-2,2.41-4.927,3.591-8.622,3.591-7.8,0-13.8-5.542-13.8-14.214s6-14.216,13.8-14.216a10.606,10.606,0,0,1,8.263,3.338V12.917ZM94.39,26.723c0-4.774-3.079-7.648-7.03-7.648-4,0-7.082,2.874-7.082,7.648s3.079,7.646,7.082,7.646c3.951,0,7.03-2.873,7.03-7.646" transform="translate(-14.197 -2.46)" fill="#00398e"></path><path id="Path_904" data-name="Path 904" d="M140.745,13.019V37.388c0,10.264-5.388,14.983-15.037,14.983-5.08,0-10.006-1.282-13.187-3.8l3.182-5.747a15.335,15.335,0,0,0,9.339,3.079c5.388,0,7.7-2.514,7.7-7.494V37.49a11.314,11.314,0,0,1-8.159,3.183c-6.928,0-11.8-3.849-11.8-12.42V13.019h8.006V27.072c0,4.67,2.053,6.723,5.594,6.723,3.7,0,6.364-2.362,6.364-7.44V13.019Z" transform="translate(-22.135 -2.561)" fill="#00398e"></path><path id="Path_905" data-name="Path 905" d="M149.683,26.724c0-8.315,6.414-14.214,15.395-14.214,5.8,0,10.366,2.513,12.367,7.03l-6.209,3.335a6.881,6.881,0,0,0-6.209-3.8c-4.054,0-7.236,2.821-7.236,7.646s3.182,7.646,7.236,7.646a6.794,6.794,0,0,0,6.209-3.8l6.209,3.386c-2,4.414-6.569,6.979-12.367,6.979-8.981,0-15.395-5.9-15.395-14.214" transform="translate(-29.445 -2.461)" fill="#00398e"></path></g></g></g></svg>
              </div>
              
              {/* Language Switcher - visible next to logo on mobile */}
              <div className="flex gap-2 md:hidden">
                <button
                  onClick={() => {
                    i18n.changeLanguage("en");
                    localStorage.setItem("language", "en");
                  }}
                  className={`px-3 py-1.5 text-sm rounded bg-white border text-gray-900 hover:bg-gray-50 transition-colors ${i18n.language === "en" ? "border-blue-600 ring-2 ring-blue-600" : "border-gray-300"}`}
                >
                  🇬🇧
                </button>
                <button
                  onClick={() => {
                    i18n.changeLanguage("gr");
                    localStorage.setItem("language", "gr");
                  }}
                  className={`px-3 py-1.5 text-sm rounded bg-white border text-gray-900 hover:bg-gray-50 transition-colors ${i18n.language === "gr" ? "border-blue-600 ring-2 ring-blue-600" : "border-gray-300"}`}
                >
                  🇬🇷
                </button>
              </div>
            </div>
            
            {/* Title and Subtitle in center */}
            <div className="text-center flex-1">
              <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
                {t('landingPage.hero.title')}
              </h1>
              <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
                {t('landingPage.hero.subtitle')}
              </p>
            </div>

            {/* Language Switcher on the right - hidden on mobile, visible on desktop */}
            <div className="hidden md:flex gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  i18n.changeLanguage("en");
                  localStorage.setItem("language", "en");
                }}
                className={`px-3 py-1.5 text-sm rounded bg-white border text-gray-900 hover:bg-gray-50 transition-colors ${i18n.language === "en" ? "border-blue-600 ring-2 ring-blue-600" : "border-gray-300"}`}
              >
                🇬🇧
              </button>
              <button
                onClick={() => {
                  i18n.changeLanguage("gr");
                  localStorage.setItem("language", "gr");
                }}
                className={`px-3 py-1.5 text-sm rounded bg-white border text-gray-900 hover:bg-gray-50 transition-colors ${i18n.language === "gr" ? "border-blue-600 ring-2 ring-blue-600" : "border-gray-300"}`}
              >
                🇬🇷
              </button>
            </div>
          </div>

          <div className={showCalendly ? "max-w-5xl mx-auto" : "grid lg:grid-cols-2 gap-12 items-center"}>
            {/* Video Section - Hidden when booking form is shown */}
            {!showCalendly && (
              <div className="order-1 lg:order-1">
                <div style={{ padding: '56.25% 0 0 0', position: 'relative' }} className="rounded-lg overflow-hidden shadow-2xl">
                  <iframe
                    src="https://player.vimeo.com/video/1147172069?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                    title="WEBSITE_V2"
                  ></iframe>
                </div>
              </div>
            )}

            {/* Form Section */}
            <div className={showCalendly ? "w-full" : "order-2 lg:order-2"} id="lead-form">
              <div className={showCalendly ? "w-full" : "mx-auto lg:mx-0"}>
                
                {!showCalendly ? (
                  <Card className="shadow-xl border-0">
                    <CardHeader>
                      <CardTitle className="text-center">{t('landingPage.form.title')}</CardTitle>
                      <CardDescription className="text-center">
                        {t('landingPage.form.subtitle')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('landingPage.form.emailLabel')}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input 
                                      placeholder={t('landingPage.form.emailPlaceholder')}
                                      className="pl-10"
                                      {...field} 
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('landingPage.form.phoneLabel')}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <Input 
                                      placeholder={t('landingPage.form.phonePlaceholder')}
                                      className="pl-10"
                                      {...field} 
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button 
                            type="submit" 
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? t('landingPage.form.submitting') : t('landingPage.form.submitButton')}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="shadow-xl border-0">
                    <CardHeader>
                      <CardTitle className="text-center text-green-600 flex items-center justify-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        {t('landingPage.form.successTitle')}
                      </CardTitle>
                      <CardDescription className="text-center">
                        {t('landingPage.form.successSubtitle')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="w-full" style={{ minHeight: '700px' }}>
                        <div 
                          className="meetings-iframe-container" 
                          data-src={`https://meetings.hubspot.com/hayc-websites?embed=true${submittedEmail ? `&email=${encodeURIComponent(submittedEmail)}` : ''}`}
                        ></div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Testimonial Video Section */}
      <section className="py-20 bg-blue-900 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-12">{t('landingPage.testimonialVideo.title')}</h2>

            {/* 3-column responsive grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                "https://player.vimeo.com/video/1124268232",
                "https://player.vimeo.com/video/1129865306",
              ].map((url, i) => (
                <div key={i} className="aspect-[9/16] rounded-lg overflow-hidden shadow-2xl">
                  <iframe
                    src={url}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                    title={`Customer Testimonial ${i + 1}`}
                  ></iframe>
                </div>
              ))}
            </div>

            {/* Optional quote below */}
            <blockquote className="text-xl italic mt-12 mb-4">
              "{t('landingPage.testimonialVideo.quote')}"
            </blockquote>
            <p className="font-semibold">{t('landingPage.testimonialVideo.author')}</p>
          </div>
        </div>
      </section>
      

      {/* Reason Why Benefits Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">{t('landingPage.benefits.title')}</h2>
            <p className="text-xl text-gray-600">
              {t('landingPage.benefits.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-full mb-6">
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-bold mb-4">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews from Clients Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">{t('landingPage.reviews.title')}</h2>
            <p className="text-xl text-gray-600">
              {t('landingPage.reviews.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Review 1 */}
            <Card className="shadow-lg border border-gray-200 h-full">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-gray-700 mb-4 flex-grow text-sm leading-relaxed">
                  "{t('landingPage.reviews.review1.text')}"
                </blockquote>
                <div className="mt-auto">
                  <p className="font-semibold text-gray-900">{t('landingPage.reviews.review1.author')}</p>
                  <p className="text-sm text-gray-600">{t('landingPage.reviews.review1.role')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Review 2 */}
            <Card className="shadow-lg border border-gray-200 h-full">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-gray-700 mb-4 flex-grow text-sm leading-relaxed">
                  "{t('landingPage.reviews.review2.text')}"
                </blockquote>
                <div className="mt-auto">
                  <p className="font-semibold text-gray-900">{t('landingPage.reviews.review2.author')}</p>
                  <p className="text-sm text-gray-600">{t('landingPage.reviews.review2.role')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Review 3 */}
            <Card className="shadow-lg border border-gray-200 h-full">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-gray-700 mb-4 flex-grow text-sm leading-relaxed">
                  "{t('landingPage.reviews.review3.text')}"
                </blockquote>
                <div className="mt-auto">
                  <p className="font-semibold text-gray-900">{t('landingPage.reviews.review3.author')}</p>
                  <p className="text-sm text-gray-600">{t('landingPage.reviews.review3.role')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Review 4 */}
            <Card className="shadow-lg border border-gray-200 h-full">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-gray-700 mb-4 flex-grow text-sm leading-relaxed">
                  "{t('landingPage.reviews.review4.text')}"
                </blockquote>
                <div className="mt-auto">
                  <p className="font-semibold text-gray-900">{t('landingPage.reviews.review4.author')}</p>
                  <p className="text-sm text-gray-600">{t('landingPage.reviews.review4.role')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Review 5 */}
            <Card className="shadow-lg border border-gray-200 h-full">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-gray-700 mb-4 flex-grow text-sm leading-relaxed">
                  "{t('landingPage.reviews.review5.text')}"
                </blockquote>
                <div className="mt-auto">
                  <p className="font-semibold text-gray-900">{t('landingPage.reviews.review5.author')}</p>
                  <p className="text-sm text-gray-600">{t('landingPage.reviews.review5.role')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Review 6 */}
            <Card className="shadow-lg border border-gray-200 h-full">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-gray-700 mb-4 flex-grow text-sm leading-relaxed">
                  "{t('landingPage.reviews.review6.text')}"
                </blockquote>
                <div className="mt-auto">
                  <p className="font-semibold text-gray-900">{t('landingPage.reviews.review6.author')}</p>
                  <p className="text-sm text-gray-600">{t('landingPage.reviews.review6.role')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>


      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">{t('landingPage.howItWorks.title')}</h2>
            <p className="text-xl text-gray-600">
              {t('landingPage.howItWorks.subtitle')}
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-12">
              {howItWorksSteps.map((step, index) => (
                <div key={index} className="flex items-start gap-8">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                      {step.step}
                    </div>
                  </div>
                  <div className="flex-1 pt-2">
                    <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                    <p className="text-gray-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Customer Call Out Section */}
      <section className="py-20 bg-gradient-to-r from-orange-400 to-red-500 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">
              {t('landingPage.cta1.title')}
            </h2>
            <p className="text-xl mb-8 opacity-90">
              {t('landingPage.cta1.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-full overflow-hidden">
              <Button 
                onClick={scrollToForm}
                size="lg"
                className="bg-white text-orange-600 hover:bg-gray-100 px-6 md:px-8 py-4 text-lg font-semibold w-full sm:w-auto max-w-full"
              >
                {t('landingPage.cta1.button')}
              </Button>
              <span className="text-white/80">{t('landingPage.cta1.badge')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Qualification Panel Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">{t('landingPage.qualification.title')}</h2>
              <p className="text-xl text-gray-600">
                {t('landingPage.qualification.subtitle')}
              </p>
            </div>

            <Card className="shadow-xl">
              <CardContent className="p-8">
                <div className="space-y-6">
                  {qualificationQuestions.map((question, index) => (
                    <div key={index} className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <p className="text-lg font-medium text-gray-800 pt-1">{question}</p>
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 p-6 bg-blue-50 rounded-lg">
                  <h3 className="font-bold text-lg mb-2">{t('landingPage.qualification.resultTitle')}</h3>
                  <p className="text-gray-700 mb-4">
                    {t('landingPage.qualification.resultDescription')}
                  </p>
                  <Button 
                    onClick={scrollToForm}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {t('landingPage.qualification.resultButton')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">{t('landingPage.faq.title')}</h2>
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`} className="border rounded-lg px-6">
                  <AccordionTrigger className="text-left hover:no-underline">
                    <span className="font-semibold">{faq.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 pb-6">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-800 to-indigo-700 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">
              {t('landingPage.final.title')}
            </h2>
            <p className="text-xl mb-8 opacity-90">
              {t('landingPage.final.subtitle')}
            </p>
            
            <div className="bg-white/10 rounded-lg p-6 mb-8">
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-3xl font-bold">{t('landingPage.final.stat1.value')}</div>
                  <div className="text-white/80">{t('landingPage.final.stat1.label')}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{t('landingPage.final.stat2.value')}</div>
                  <div className="text-white/80">{t('landingPage.final.stat2.label')}</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{t('landingPage.final.stat3.value')}</div>
                  <div className="text-white/80">{t('landingPage.final.stat3.label')}</div>
                </div>
              </div>
            </div>
      
            <Button 
              onClick={scrollToForm}
              size="lg"
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 md:px-12 py-4 text-lg md:text-xl font-semibold max-w-full"
            >
              {t('landingPage.final.button')}
              <ChevronUp className="ml-2 h-5 w-5" />
            </Button>
            
            <p className="mt-4 text-white/70">
              {t('landingPage.final.badges')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
