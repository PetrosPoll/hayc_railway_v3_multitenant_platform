import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [userInfo, setUserInfo] = useState<{ username?: string; email?: string }>({});
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      return;
    }

    fetch(`/api/validate-reset-token/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setTokenValid(true);
          setUserInfo({ username: data.username, email: data.email });
        }
      })
      .catch(() => {
        toast({
          title: t("resetPassword.error"),
          description: t("resetPassword.validateError"),
          variant: "destructive",
        });
      })
      .finally(() => {
        setIsValidating(false);
      });
  }, [token, toast, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: t("resetPassword.passwordTooShort"),
        description: t("resetPassword.passwordTooShortDesc"),
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: t("resetPassword.passwordsDontMatch"),
        description: t("resetPassword.passwordsDontMatchDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);

    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (data.success) {
        setResetComplete(true);
        toast({
          title: t("resetPassword.successTitle"),
          description: t("resetPassword.successMessage"),
        });
      } else {
        toast({
          title: t("resetPassword.resetFailed"),
          description: data.error || t("resetPassword.resetFailedDesc"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("resetPassword.error"),
        description: t("resetPassword.errorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black px-4">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-lg p-8 backdrop-blur-sm">
          <div className="flex items-center justify-center text-white/70 font-brand">
            <Loader2 className="h-6 w-6 animate-spin mr-3 flex-shrink-0" />
            {t("resetPassword.validating")}
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black px-4">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-lg p-8 backdrop-blur-sm text-center">
          <div className="rounded-full bg-red-500/20 p-4 mb-6 inline-flex">
            <XCircle className="h-10 w-10 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white font-brand mb-2">{t("resetPassword.invalidTitle")}</h2>
          <p className="text-white/50 font-brand text-sm mb-6">
            {t("resetPassword.invalidMessage")}
          </p>
          <button
            onClick={() => navigate("/forgot-password")}
            className="px-6 py-2.5 rounded-lg bg-white text-black hover:bg-white/90 transition-colors font-brand text-sm"
          >
            {t("resetPassword.requestNewLink")}
          </button>
        </div>
      </div>
    );
  }

  if (resetComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black px-4">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-lg p-8 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white font-brand flex items-center gap-2 mb-6">
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
            {t("resetPassword.successTitle")}
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-white/80 text-sm font-brand">
                {t("resetPassword.successMessage")}
              </p>
            </div>
            <Button
              onClick={() => navigate("/auth")}
              className="w-full bg-white text-black hover:bg-white/90 font-brand"
            >
              {t("resetPassword.goToLogin")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-black px-4">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-lg p-8 backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-white font-brand mb-1">{t("resetPassword.title")}</h2>
        {userInfo.username && (
          <p className="text-sm text-white/50 font-brand mb-6">
            {t("resetPassword.welcomeBack", { username: userInfo.username })}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-white/50 mt-0.5 flex-shrink-0" />
            <p className="text-white/60 text-sm font-brand">
              {t("resetPassword.hint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/80 font-brand">{t("resetPassword.newPassword")}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("resetPassword.newPasswordPlaceholder")}
                required
                minLength={6}
                className="pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                data-testid="button-toggle-password-visibility"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-white/80 font-brand">{t("resetPassword.confirmPassword")}</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                required
                minLength={6}
                className="pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-white/30"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                aria-pressed={showConfirmPassword}
                data-testid="button-toggle-confirm-password-visibility"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-white text-black hover:bg-white/90 font-brand"
            disabled={isResetting}
          >
            {isResetting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("resetPassword.resetting")}
              </>
            ) : (
              t("resetPassword.resetButton")
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
