import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-lg p-8 backdrop-blur-sm mx-4">
          <h2 className="text-xl font-semibold text-white font-brand flex items-center gap-2 mb-6">
            <CheckCircle className="h-5 w-5 text-green-400" />
            {t("forgotPassword.emailSentTitle")}
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-white/80 text-sm font-brand">
                {t("forgotPassword.emailSentMessage", { email })}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-white/50 font-brand">
                {t("forgotPassword.noEmailReceived")}
              </p>
              <button
                onClick={() => setEmailSent(false)}
                className="w-full py-2.5 px-4 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 hover:text-white transition-colors font-brand text-sm"
              >
                {t("forgotPassword.sendAnother")}
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="w-full py-2.5 px-4 rounded-lg text-white/60 hover:text-white transition-colors font-brand text-sm flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("forgotPassword.backToLogin")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-lg p-8 backdrop-blur-sm mx-4">
        <h2 className="text-xl font-semibold text-white font-brand mb-1">{t("forgotPassword.title")}</h2>
        <p className="text-sm text-white/50 font-brand mb-6">
          {t("forgotPassword.description")}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/80 font-brand">{t("forgotPassword.emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("forgotPassword.emailPlaceholder")}
              required
              data-testid="input-email"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/30"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-white text-black hover:bg-white/90 font-brand"
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

          <button
            type="button"
            onClick={() => navigate("/auth")}
            className="w-full py-2.5 px-4 rounded-lg text-white/60 hover:text-white transition-colors font-brand text-sm flex items-center justify-center gap-2"
            data-testid="button-back-to-login"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("forgotPassword.backToLogin")}
          </button>
        </form>
      </div>
    </div>
  );
}
