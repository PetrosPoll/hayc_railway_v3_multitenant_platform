import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Heart, Mail } from "lucide-react";

interface LegacyUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: number;
}

export function LegacyUpgradeDialog({
  open,
  onOpenChange,
  subscriptionId,
}: LegacyUpgradeDialogProps) {
  const { toast } = useToast();

  const requestUpgradeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/request-legacy-upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send upgrade request");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Request Sent!",
        description: "Our team has been notified and will contact you shortly to help you upgrade to a yearly plan while keeping your special pricing.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500" />
            You're a Valued hayc V1 Subscriber!
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            We appreciate your loyalty
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Special Message */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              You are a subscriber from <strong>hayc version 1</strong>, which means you have a <strong>locked special price</strong> and we are very happy to have you with us! 
            </p>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 mt-3">
              We want you to <strong>keep your old, affordable price</strong> — that's why if you would like to upgrade to a yearly plan, just click the button below and we will get notified.
            </p>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 mt-3">
              Somebody from our team will be in contact with you shortly to give you the following instructions and help you upgrade while maintaining your special pricing.
            </p>
          </div>

          {/* Benefits Highlight */}
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
              <Heart className="h-4 w-4" />
              What You Keep:
            </h4>
            <ul className="space-y-1 text-sm text-green-800 dark:text-green-200">
              <li>✓ Your current special monthly rate</li>
              <li>✓ All your current features and add-ons</li>
              <li>✓ Personalized yearly discount</li>
              <li>✓ Priority support from our team</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={requestUpgradeMutation.isPending}
          >
            Maybe Later
          </Button>
          <Button
            onClick={() => requestUpgradeMutation.mutate()}
            disabled={requestUpgradeMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            data-testid="button-contact-team"
          >
            {requestUpgradeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Request...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Contact Team to Upgrade
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
