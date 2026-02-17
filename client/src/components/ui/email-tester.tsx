
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Badge } from "./badge";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { User, Shield } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  templateType: z.enum([
    // Customer-facing emails
    "purchased", 
    "cancelled", 
    "refunded", 
    "failed", 
    "card-expiring", 
    "waiting",
    "resumed",
    "upgraded",
    "user-registered",
    "new-tip-notification",
    "review-verified-free-month",
    "stage-update",
    "stage-waiting-reminder",
    "website-change-recorded",
    "website-progress-created",
    "contact-form-email",
    "onboarding-form-confirmation",
    "password-reset-email",
    // Admin-facing emails
    "admin-cancellation-notice",
    "admin-cancellation-notice-admin",
    "admin-change-request-notification",
    "admin-new-lead-notification",
    "admin-new-subscription-notification",
    "admin-onboarding-form-notification",
    "admin-review-check-notification",
    "admin-review-verified-notification",
    "admin-subscription-resumed-notification",
    "admin-subscription-upgrade-notification",
    "admin-website-progress-created"
  ], {
    required_error: "Please select a template type.",
  }),
  language: z.enum(["en", "gr", "el"], {
    required_error: "Please select a language.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export function EmailTester() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      templateType: "purchased",
      language: "en",
    },
  });

  async function onSubmit(data: FormValues) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/send-test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send test email");
      }

      toast({
        title: "Success!",
        description: `Test email sent to ${data.email}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send test email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Email Templates</CardTitle>
        <CardDescription>
          Send test emails using the configured templates
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
                  <FormLabel>Recipient Email</FormLabel>
                  <FormControl>
                    <Input placeholder="email@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="templateType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>Customer Emails</span>
                          <Badge variant="secondary" className="ml-auto">Sent to Users</Badge>
                        </SelectLabel>
                        <SelectItem value="purchased">Subscription Purchased</SelectItem>
                        <SelectItem value="cancelled">Subscription Cancelled</SelectItem>
                        <SelectItem value="refunded">Subscription Refunded</SelectItem>
                        <SelectItem value="failed">Transaction Failed</SelectItem>
                        <SelectItem value="card-expiring">Card Expiring</SelectItem>
                        <SelectItem value="waiting">Waiting for Info</SelectItem>
                        <SelectItem value="resumed">Subscription Resumed</SelectItem>
                        <SelectItem value="upgraded">Subscription Upgraded</SelectItem>
                        <SelectItem value="user-registered">User Registered</SelectItem>
                        <SelectItem value="new-tip-notification">New Tip Notification</SelectItem>
                        <SelectItem value="review-verified-free-month">Review Verified - Free Month</SelectItem>
                        <SelectItem value="stage-update">Stage Update</SelectItem>
                        <SelectItem value="stage-waiting-reminder">Stage Waiting Reminder</SelectItem>
                        <SelectItem value="website-change-recorded">Website Change Recorded</SelectItem>
                        <SelectItem value="change-request-completed">Change Request Completed</SelectItem>
                        <SelectItem value="website-progress-created">Website Progress Created</SelectItem>
                        <SelectItem value="contact-form-email">Contact Form Email</SelectItem>
                        <SelectItem value="onboarding-form-confirmation">Onboarding Form Confirmation</SelectItem>
                        <SelectItem value="password-reset-email">Password Reset</SelectItem>
                      </SelectGroup>
                      
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-2 mt-2">
                          <Shield className="h-4 w-4" />
                          <span>Admin Emails</span>
                          <Badge variant="outline" className="ml-auto">Sent to Support</Badge>
                        </SelectLabel>
                        <SelectItem value="admin-cancellation-notice">Admin: Cancellation Notice</SelectItem>
                        <SelectItem value="admin-cancellation-notice-admin">Admin: Cancellation Notice (Internal)</SelectItem>
                        <SelectItem value="admin-change-request-notification">Admin: Change Request</SelectItem>
                        <SelectItem value="admin-new-lead-notification">Admin: New Lead</SelectItem>
                        <SelectItem value="admin-new-subscription-notification">Admin: New Subscription</SelectItem>
                        <SelectItem value="admin-onboarding-form-notification">Admin: Onboarding Form</SelectItem>
                        <SelectItem value="admin-review-check-notification">Admin: Review Check</SelectItem>
                        <SelectItem value="admin-review-verified-notification">Admin: Review Verified</SelectItem>
                        <SelectItem value="admin-subscription-resumed-notification">Admin: Subscription Resumed</SelectItem>
                        <SelectItem value="admin-subscription-upgrade-notification">Admin: Subscription Upgrade</SelectItem>
                        <SelectItem value="admin-website-progress-created">Admin: Website Progress Created</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose a customer email (sent to users) or admin email (sent to support@hayc.gr)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="el">Greek (el)</SelectItem>
                      <SelectItem value="gr">Greek (gr)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Test Email"}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Test emails will be sent using mock data appropriate for each template type.
      </CardFooter>
    </Card>
  );
}
