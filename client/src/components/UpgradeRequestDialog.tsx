import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Loader2, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface UpgradeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier?: string;
  feature: string;
  websiteId?: number;
}

export function UpgradeRequestDialog({
  open,
  onOpenChange,
  currentTier = "basic",
  feature,
  websiteId,
}: UpgradeRequestDialogProps) {
  const { toast } = useToast();
  const [requestedTier, setRequestedTier] = useState<string>("essential");
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const { t } = useTranslation();
  
  const requestMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/upgrade-request", {
        requestedTier,
        currentTier,
        feature,
        message,
        websiteId,
      });
    },
    onSuccess: () => {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onOpenChange(false);
        setMessage("");
        setRequestedTier("essential");
      }, 3000);
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!requestedTier) {
      toast({
        title: "Please select a tier",
        description: "Choose which subscription tier you'd like to upgrade to.",
        variant: "destructive",
      });
      return;
    }
    requestMutation.mutate();
  };

  // Show success state
  if (showSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>

            <h3 className="text-xl font-semibold mb-2">
              {t("dashboard.upgradeModal.successTitle")}
            </h3>

            <p className="text-muted-foreground">
              {t("dashboard.upgradeModal.successDescription")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dashboard.upgradeModal.title")}</DialogTitle>
          <DialogDescription>
            {t("dashboard.upgradeModal.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Select Tier */}
          <div className="space-y-2">
            <Label htmlFor="tier">{t("dashboard.upgradeModal.selectTierLabel")}</Label>

            <Select value={requestedTier} onValueChange={setRequestedTier}>
              <SelectTrigger id="tier" data-testid="select-tier">
                <SelectValue placeholder={t("dashboard.upgradeModal.selectTierPlaceholder")} />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="essential">
                  {t("dashboard.upgradeModal.essential")}
                </SelectItem>
                <SelectItem value="pro">
                  {t("dashboard.upgradeModal.pro")}
                </SelectItem>
              </SelectContent>
            </Select>

            <p className="text-xs text-muted-foreground">
              {t("dashboard.upgradeModal.featureLabel")}:{" "}
              <span className="font-medium">{feature}</span>
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="message">{t("dashboard.upgradeModal.notesLabel")}</Label>

            <Textarea
              id="message"
              placeholder={t("dashboard.upgradeModal.notesPlaceholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              data-testid="textarea-message"
            />
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              💡 {t("dashboard.upgradeModal.infoBox")}
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            data-testid="button-cancel"
          >
            {t("dashboard.upgradeModal.cancel")}
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={requestMutation.isPending}
            className="flex-1"
            data-testid="button-submit-request"
          >
            {requestMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("dashboard.upgradeModal.sending")}
              </>
            ) : (
              t("dashboard.upgradeModal.submit")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

}
