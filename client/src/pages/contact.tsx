import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
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
import { Mail } from "lucide-react";
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

      if (typeof window.fbq === "function") {
        window.fbq("track", "Lead");
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
      setTurnstileToken("");
      turnstileRef.current?.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black mt-[70px]">
      {/* Contact Page Header */}
      <section className="w-full px-4 py-12 lg:px-16 lg:py-24 bg-black flex flex-col justify-center items-center gap-3">
        <h1 className="w-full text-center text-4xl lg:text-6xl font-semibold font-['Montserrat']" style={{ maxWidth: "768px" }}>
          <span className="text-white">Talk to </span>
          <span className="text-[#ED4C14]">HAYC</span>
        </h1>
        <p className="text-center text-white text-lg font-medium font-['Montserrat'] w-full">
          Tell us what you need and we&apos;ll help you choose the best path to launch.
        </p>
      </section>

      {/* Contact Form Section */}
      <section className="w-full px-4 py-12 lg:px-16 lg:py-24 bg-black flex flex-col lg:flex-row justify-start items-start gap-6">
        {/* Left — Contact Information card */}
        <div className="w-full lg:w-96 p-3.5 lg:p-6 bg-gradient-to-br from-neutral-700/5 to-neutral-700/20 rounded-[20px] shadow-[0px_5px_6.5px_-32px_rgba(0,0,0,0.15)] outline outline-1 outline-offset-[-1px] outline-zinc-800/80 flex flex-col justify-start items-start gap-12 flex-shrink-0">
          <span className="text-white text-xl lg:text-2xl font-medium font-['Montserrat'] leading-7">Contact Information</span>

          <div className="w-48 flex flex-col justify-start items-start gap-6">
            <div className="flex items-center gap-6">
              <img src="/images/mail_icon.svg" alt="location" className="w-6 h-6" />
              <span className="text-white text-lg font-medium font-['Montserrat']">info@hayc.gr</span>
            </div>
            <div className="flex items-center gap-6">
              <img src="/images/map_pin_icon.svg" alt="location" className="w-6 h-6" />
              <span className="text-white text-lg font-medium font-['Montserrat']">Athens, Greece</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-slate-100 text-lg font-medium font-['Montserrat']">Find us on Social Media</span>
            <div className="flex items-center gap-6">
              <a href="https://www.instagram.com/hayc_websites/" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
                <img src="/images/insta_icon.svg" alt="Instagram" className="w-6 h-6" />
              </a>
              <a href="https://www.linkedin.com/company/hayc/" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
                <img src="/images/linkedin_icon.svg" alt="LinkedIn" className="w-6 h-6" />
              </a>
              <a href="https://www.facebook.com/haycWebsites" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
                <img src="/images/facebook_icon.svg" alt="Facebook" className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>

        {/* Right — Send us a message card */}
        <div className="w-full flex-1 p-3.5 lg:p-6 bg-gradient-to-br from-neutral-700/5 to-neutral-700/20 rounded-[20px] shadow-[0px_5px_6.5px_-32px_rgba(0,0,0,0.15)] outline outline-1 outline-offset-[-1px] outline-zinc-800/80 flex flex-col justify-start items-start gap-12">
          <span className="text-white text-xl lg:text-2xl font-medium font-['Montserrat'] leading-7">Send us a message</span>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="w-full flex flex-col gap-8">
              <div className="w-full flex flex-col gap-6">
                {/* Full Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="w-full flex flex-col gap-1.5">
                      <FormLabel className="text-slate-100 text-base font-normal font-['Montserrat'] leading-6">Full Name</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Full Name"
                          className="w-full px-4 py-3 rounded-lg outline outline-1 outline-offset-[-1px] outline-neutral-500 bg-transparent text-slate-100 text-sm font-normal font-['Montserrat'] leading-5 placeholder:text-slate-100/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-[#ED4C14] focus-visible:outline-2 transition-all border-0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="w-full flex flex-col gap-1.5">
                      <FormLabel className="text-slate-100 text-base font-normal font-['Montserrat'] leading-6">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@company.com"
                          className="w-full px-4 py-3 rounded-lg outline outline-1 outline-offset-[-1px] outline-neutral-500 bg-transparent text-slate-100 text-sm font-normal font-['Montserrat'] leading-5 placeholder:text-slate-100/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-[#ED4C14] focus-visible:outline-2 transition-all border-0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Subject */}
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem className="w-full flex flex-col gap-1.5">
                      <FormLabel className="text-slate-100 text-base font-normal font-['Montserrat'] leading-6">Subject</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Subject"
                          className="w-full px-4 py-3 rounded-lg outline outline-1 outline-offset-[-1px] outline-neutral-500 bg-transparent text-slate-100 text-sm font-normal font-['Montserrat'] leading-5 placeholder:text-slate-100/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-[#ED4C14] focus-visible:outline-2 transition-all border-0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Message */}
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem className="w-full flex flex-col gap-1.5">
                      <FormLabel className="text-slate-100 text-base font-normal font-['Montserrat'] leading-6">Message</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={6}
                          className="w-full px-3.5 py-2.5 rounded-lg outline outline-1 outline-offset-[-1px] outline-neutral-500 bg-transparent text-slate-100 text-sm font-normal font-['Montserrat'] leading-5 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-[#ED4C14] focus-visible:outline-2 transition-all border-0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Privacy checkbox */}
                <div className="w-full max-w-80 flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded-full border border-neutral-500 bg-transparent accent-[#ED4C14] cursor-pointer"
                  />
                  <span className="text-slate-100 text-sm font-normal font-['Montserrat'] leading-5">
                    You agree to our friendly privacy policy.
                  </span>
                </div>
              </div>

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

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isSubmitting || !turnstileToken}
                className="w-full px-5 py-3 bg-[#ED4C14] rounded-lg shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] flex justify-center items-center gap-2 hover:opacity-80 transition-opacity text-slate-100 text-base font-semibold font-['Montserrat'] leading-5 border-0"
                data-testid="button-submit"
              >
                {isSubmitting ? t("contact.form.sending") : "Send message"}
              </Button>
            </form>
          </Form>
        </div>
      </section>
    </div>
  );
}
