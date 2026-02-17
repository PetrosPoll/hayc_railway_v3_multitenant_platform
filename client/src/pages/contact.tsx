
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Turnstile } from "@marsidev/react-turnstile";
import { getStoredUTMParams } from "@/lib/utm";

const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const turnstileRef = useRef<any>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormValues) => {
    if (!turnstileToken) {
      toast({
        title: "Error",
        description: "Please complete the security verification",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const utmParams = getStoredUTMParams();
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          "cf-turnstile-response": turnstileToken,
          ...(utmParams && { utm: utmParams }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to send message");
      }

      toast({
        title: "Success",
        description: t("contact.form.success"),
      });
      
      // Track Facebook Pixel Lead event
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'Lead');
      }
      
      form.reset();
      setTurnstileToken("");
      turnstileRef.current?.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : t("contact.form.error"),
        variant: "destructive",
      });
      // Reset turnstile on error
      setTurnstileToken("");
      turnstileRef.current?.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 mt-[70px] py-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#182B53] mb-4">{t("contact.title")}</h1>
          <p className="text-gray-600">{t("contact.subtitle")}</p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left Column - Contact Info */}
          <div className="space-y-8">
            <Card className="p-6">
              <h2 className="text-2xl font-semibold text-[#182B53] mb-6">{t("contact.contactInformation")}</h2>
              
              <div className="space-y-6">

                {/* Email */}
                <div className="flex items-center space-x-4">
                  <div className="bg-[#182B53] rounded-full p-3">
                    <Mail className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#182B53]">{t("contact.emailUs")}</h3>
                    <a 
                      href="mailto:info@hayc.gr" 
                      className="text-gray-600 hover:text-[#182B53] transition-colors"
                    >
                      info@hayc.gr
                    </a>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center space-x-4">
                  <div className="bg-[#182B53] rounded-full p-3">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#182B53]">{t("contact.ourLocation")}</h3>
                    <p className="text-gray-600">{t("contact.location")}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Social Media */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-[#182B53] mb-4">{t("contact.socialMedia")}</h2>
              <div className="flex space-x-4">
                <a 
                  href="https://www.facebook.com/haycWebsites"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#182B53] hover:text-blue-700 rounded-full p-3 transition-colors"
                >
                  <Facebook className="h-5 w-5" />
                </a>
                <a 
                  href="https://www.instagram.com/hayc_websites/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#182B53] hover:text-blue-700 rounded-full p-3 transition-colors"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              </div>
            </Card>
          </div>

          {/* Right Column - Contact Form */}
          <div>
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Mail className="h-6 w-6 text-[#182B53]" />
                <h2 className="text-2xl font-bold text-[#182B53]">{t("contact.sendMessage")}</h2>
              </div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("contact.form.name")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("contact.form.name")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("contact.form.email")}</FormLabel>
                        <FormControl>
                          <Input placeholder="your.email@example.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("contact.form.subject")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("contact.form.subject")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("contact.form.message")}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t("contact.form.message")}
                            className="min-h-[150px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-center" data-testid="turnstile-container">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey="0x4AAAAAACCS5AVJwke-jjgf"
                      onSuccess={setTurnstileToken}
                      onError={() => {
                        setTurnstileToken("");
                        toast({
                          title: "Error",
                          description: "Security verification failed. Please try again.",
                          variant: "destructive",
                        });
                      }}
                      onExpire={() => setTurnstileToken("")}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !turnstileToken}
                    className="w-full bg-[#182B53] hover:bg-blue-700"
                    data-testid="button-submit"
                  >
                    {isSubmitting ? t("contact.form.sending") : t("contact.form.submit")}
                  </Button>
                </form>
              </Form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
