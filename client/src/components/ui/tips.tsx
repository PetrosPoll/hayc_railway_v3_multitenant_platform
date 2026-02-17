import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, Eye, Bell, BellOff, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Tip {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  createdBy: number;
  createdByUsername: string;
}

export function Tips() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAllTips, setShowAllTips] = useState(false);

  const { data: tipsData, isLoading, error } = useQuery<{ tips: Tip[] }>({
    queryKey: ["/api/tips"],
  });

  const { data: userData } = useQuery<{ user: any }>({
    queryKey: ["/api/user"],
  });

  const notificationMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch("/api/user/tips-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        throw new Error("Failed to update notification preference");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: t("tips.success"),
        description: t("tips.notificationPreferenceUpdated"),
      });
    },
    onError: () => {
      toast({
        title: t("dashboard.error"),
        description: "Failed to update notification preference",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isNotificationsEnabled =
    userData?.user?.tipsEmailNotifications === true ||
    userData?.user?.tipsEmailNotifications === "true";

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            💡 {t('tips.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('tips.description')}
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">{t('tips.noTips')}</p>
            <p className="text-sm text-muted-foreground">{t('tips.noTipsDescription')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tipsData?.tips || tipsData.tips.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-[#EFF8FF] rounded-lg">
          <div className="flex items-center space-x-3">
            {isNotificationsEnabled ? (
              <Bell className="h-5 w-5 text-blue-600" />
            ) : (
              <BellOff className="h-5 w-5 text-gray-400" />
            )}
            <Label htmlFor="tips-notifications" className="text-sm font-medium text-[#182B53]">
              {t('tips.emailNotifications')}
            </Label>
          </div>
          <Switch
            id="tips-notifications"
            checked={isNotificationsEnabled}
            onCheckedChange={(checked) => notificationMutation.mutate(checked)}
            disabled={notificationMutation.isPending}
            className="data-[state=checked]:bg-[#182B53]"
          />
        </div>
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2 text-[#182B53]">
            {t("tips.noTips")}
          </h3>
          <p className="text-gray-600">{t("tips.noTipsDescription")}</p>
        </div>
      </div>
    );
  }

  const tips = tipsData.tips;
  const displayedTips = showAllTips ? tips : tips.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-[#EFF8FF] rounded-lg">
        <div className="flex items-center space-x-3">
          {isNotificationsEnabled ? (
            <Bell className="h-5 w-5 text-blue-600" />
          ) : (
            <BellOff className="h-5 w-5 text-gray-400" />
          )}
          <Label htmlFor="tips-notifications" className="text-sm font-medium">
            {t('tips.emailNotifications')}
          </Label>
        </div>
        <Switch
          id="tips-notifications"
          checked={isNotificationsEnabled}
          onCheckedChange={(checked) => notificationMutation.mutate(checked)}
          disabled={notificationMutation.isPending}
          className="data-[state=checked]:bg-[#182B53]"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold text-[#182B53]">
            💡 {t('tips.title')}
          </CardTitle>
          <CardDescription>
            {t('tips.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="space-y-2">
            {(showAllTips ? tipsData.tips : tipsData.tips.slice(0, 12)).map(
              (tip, index) => {
                const isNewest = index === 0;
                return (
                  <AccordionItem
                    key={tip.id}
                    value={`tip-${tip.id}`}
                    className={`border rounded-lg px-4 text-[#182B53] bg-[#EFF8FF] data-[state=open]:bg-[#182B53] data-[state=open]:text-white ${
                      isNewest ? "border-2 border-blue-400" : ""
                    }`}
                  >
                    <AccordionTrigger className="hover:no-underline group">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-[#182B53] group-data-[state=open]:text-white">
                              {tip.title}
                            </h3>
                            {isNewest && (
                              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 group-data-[state=open]:text-white mt-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(tip.createdAt)}
                            {/* {tip.createdByUsername && (
                              <span>
                                • {t("tips.by")} {tip.createdByUsername}
                              </span>
                            )} */}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-6">
                      <div className="prose prose-sm max-w-none">
                        <p className="whitespace-pre-wrap leading-relaxed text-white">
                          {tip.content}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              },
            )}
          </Accordion>

          {tipsData.tips.length > 3 && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => setShowAllTips(!showAllTips)}
                className="min-w-[120px] text-[#182B53]"
              >
                <ChevronDown
                  className={`h-4 w-4 mr-2 transition-transform ${showAllTips ? "rotate-180" : ""}`}
                />
                {showAllTips
                  ? t('tips.showLess')
                  : t('tips.loadMore', { count: tipsData.tips.length - 3 })}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}