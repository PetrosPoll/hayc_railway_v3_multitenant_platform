import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function CancelSubscriptionFeedback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [otherDetails, setOtherDetails] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  const feedbackMutation = useMutation({
    mutationFn: async (data: { reason: string; details?: string }) => {
      return await apiRequest("POST", "/api/cancellation-feedback", data);
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error) => {
      toast({
        title: t("dashboard.error"),
        description: error instanceof Error ? error.message : "Failed to submit feedback",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedReason) {
      toast({
        title: "Error",
        description: t("cancellationFeedback.selectReason"),
        variant: "destructive",
      });
      return;
    }

    feedbackMutation.mutate({
      reason: selectedReason,
      details: selectedReason === "reason7" ? otherDetails : undefined,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="max-w-lg w-full shadow-xl" data-testid="card-success">
          <CardContent className="pt-12 pb-8">
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500" data-testid="icon-success" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2" data-testid="heading-success">
                  {t("cancellationFeedback.successTitle")}
                </h2>
                <p className="text-muted-foreground" data-testid="text-success-message">
                  {t("cancellationFeedback.successMessage")}
                </p>
              </div>
              <Button
                onClick={() => navigate("/dashboard")}
                className="w-full sm:w-auto"
                data-testid="button-back-to-dashboard"
              >
                {t("cancellationFeedback.backToDashboard")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="max-w-2xl w-full shadow-xl" data-testid="card-feedback-form">
        <CardHeader>
          <CardTitle className="text-2xl" data-testid="heading-title">
            {t("cancellationFeedback.title")}
          </CardTitle>
          <CardDescription data-testid="text-subtitle">
            {t("cancellationFeedback.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={selectedReason}
            onValueChange={setSelectedReason}
            className="space-y-3"
            data-testid="radio-group-reasons"
          >
            <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <RadioGroupItem value="reason1" id="reason1" data-testid="radio-reason1" />
              <Label htmlFor="reason1" className="flex-1 cursor-pointer font-normal">
                {t("cancellationFeedback.reason1")}
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <RadioGroupItem value="reason2" id="reason2" data-testid="radio-reason2" />
              <Label htmlFor="reason2" className="flex-1 cursor-pointer font-normal">
                {t("cancellationFeedback.reason2")}
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <RadioGroupItem value="reason3" id="reason3" data-testid="radio-reason3" />
              <Label htmlFor="reason3" className="flex-1 cursor-pointer font-normal">
                {t("cancellationFeedback.reason3")}
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <RadioGroupItem value="reason4" id="reason4" data-testid="radio-reason4" />
              <Label htmlFor="reason4" className="flex-1 cursor-pointer font-normal">
                {t("cancellationFeedback.reason4")}
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <RadioGroupItem value="reason5" id="reason5" data-testid="radio-reason5" />
              <Label htmlFor="reason5" className="flex-1 cursor-pointer font-normal">
                {t("cancellationFeedback.reason5")}
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <RadioGroupItem value="reason6" id="reason6" data-testid="radio-reason6" />
              <Label htmlFor="reason6" className="flex-1 cursor-pointer font-normal">
                {t("cancellationFeedback.reason6")}
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <RadioGroupItem value="reason7" id="reason7" data-testid="radio-reason7" />
              <Label htmlFor="reason7" className="flex-1 cursor-pointer font-normal">
                {t("cancellationFeedback.reason7")}
              </Label>
            </div>
          </RadioGroup>

          {selectedReason === "reason7" && (
            <Textarea
              value={otherDetails}
              onChange={(e) => setOtherDetails(e.target.value)}
              placeholder={t("cancellationFeedback.otherPlaceholder")}
              className="min-h-[100px]"
              data-testid="textarea-other-details"
            />
          )}

          <div className="flex gap-4 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="flex-1"
              disabled={feedbackMutation.isPending}
              data-testid="button-skip"
            >
              {t("cancellationFeedback.backToDashboard")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={feedbackMutation.isPending}
              className="flex-1"
              data-testid="button-submit"
            >
              {feedbackMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("cancellationFeedback.submitting")}
                </>
              ) : (
                t("cancellationFeedback.submitButton")
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
