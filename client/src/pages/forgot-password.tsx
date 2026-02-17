import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        title: t("forgotPassword.emailRequired"),
        description: t("forgotPassword.emailRequiredMessage"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setEmailSent(true);
        toast({
          title: t("forgotPassword.resetEmailSent"),
          description: t("forgotPassword.resetEmailSentMessage"),
        });
      } else {
        toast({
          title: t("forgotPassword.requestFailed"),
          description: data.error || t("forgotPassword.requestError"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("forgotPassword.error"),
        description: t("forgotPassword.errorMessage"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (emailSent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              {t("forgotPassword.emailSentTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {t("forgotPassword.emailSentMessage", { email })}
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t("forgotPassword.noEmailReceived")}
              </p>
              <Button 
                variant="outline"
                onClick={() => setEmailSent(false)} 
                className="w-full"
              >
                {t("forgotPassword.sendAnother")}
              </Button>
              <Button 
                variant="ghost"
                onClick={() => navigate("/auth")} 
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("forgotPassword.backToLogin")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("forgotPassword.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("forgotPassword.description")}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("forgotPassword.emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("forgotPassword.emailPlaceholder")}
                required
                data-testid="input-email"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
              data-testid="button-send-reset-link"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("forgotPassword.sending")}
                </>
              ) : (
                t("forgotPassword.sendButton")
              )}
            </Button>

            <Button 
              type="button"
              variant="ghost"
              onClick={() => navigate("/auth")} 
              className="w-full"
              data-testid="button-back-to-login"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("forgotPassword.backToLogin")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
