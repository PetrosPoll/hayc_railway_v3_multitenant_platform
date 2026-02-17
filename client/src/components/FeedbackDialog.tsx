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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Send } from "lucide-react";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [feedback, setFeedback] = useState("");
  const { toast } = useToast();
  const { t } = useTranslation();

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackText: string) => {
      return await apiRequest("POST", "/api/feedback", {
        feedback: feedbackText,
      });
    },
    onSuccess: () => {
      toast({
        title: "Thank you for your feedback!",
        description: "We appreciate you taking the time to help us improve.",
      });
      setFeedback("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send feedback",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!feedback.trim()) {
      toast({
        title: "Please enter your feedback",
        description: "Your feedback cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    submitFeedbackMutation.mutate(feedback);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-feedback">
        <DialogHeader>
          <DialogTitle>{t("dashboard.shareFeedback")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <Textarea
            placeholder={t("dashboard.shareFeedbackPlaceHolder")}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="min-h-[150px] resize-none"
            disabled={submitFeedbackMutation.isPending}
            data-testid="textarea-feedback"
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitFeedbackMutation.isPending}
              data-testid="button-cancel-feedback"
            >
              {t("dashboard.shareFeedbackCancelButton")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitFeedbackMutation.isPending}
              data-testid="button-submit-feedback"
            >
              {submitFeedbackMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("dashboard.shareFeedbackSendLoading")}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t("dashboard.shareFeedbackSendButton")}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
