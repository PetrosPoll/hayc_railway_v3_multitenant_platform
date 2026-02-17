import React, { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

export default function Profile() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: userData } = useQuery<any>({
        queryKey: ["/api/user"],
        queryFn: async () => {
            const response = await fetch("/api/user", {
                credentials: "include",
            });
            if (!response.ok) {
                throw new Error("Failed to fetch user");
            }
            return response.json();
        },
    });

    // Load user's language preference from database when user data is loaded
    useEffect(() => {
        if (userData?.user?.language) {
            const userLanguage = userData.user.language;
            // Only update if different from current language
            if (i18n.language !== userLanguage) {
                i18n.changeLanguage(userLanguage);
                localStorage.setItem("language", userLanguage);
            }
        }
    }, [userData]);

    const updateLanguageMutation = useMutation({
        mutationFn: async (language: string) => {
            const response = await fetch("/api/user/language", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ language }),
                credentials: "include",
            });
            if (!response.ok) {
                throw new Error("Failed to update language");
            }
            return response.json();
        },
        onSuccess: (data, language) => {
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            toast({
                title: t("dashboard.success") || "Success",
                description: t("dashboard.languageUpdated") || "Language preference updated successfully",
            });
            i18n.changeLanguage(language);
            localStorage.setItem("language", language);
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to update language preference",
                variant: "destructive",
            });
        },
    });

    return (
        <div className="min-h-[calc(100vh-4rem)] pt-20 pb-12">
            <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8" data-testid="heading-profile">
                        {t("dashboard.accountSettings") || "Account Settings"}
                    </h1>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t("dashboard.accountSettings") || "Account Settings"}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Basic Information Section */}
                            <div>
                                <h3 className="text-lg font-medium mb-4">{t("dashboard.basicInfo") || "Basic Information"}</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm text-muted-foreground">{t("dashboard.name") || "Name"}</span>
                                        <span className="text-sm font-medium" data-testid="user-name">
                                            {userData?.user?.username || t("dashboard.notProvided")}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm text-muted-foreground">{t("dashboard.email") || "Email"}</span>
                                        <span className="text-sm font-medium" data-testid="user-email">
                                            {userData?.user?.email || t("dashboard.notProvided")}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b">
                                        <span className="text-sm text-muted-foreground">{t("dashboard.phone") || "Phone"}</span>
                                        <span className="text-sm font-medium" data-testid="user-phone">
                                            {userData?.user?.phone || t("dashboard.notProvided")}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Language Preference Section */}
                            <div>
                                <h3 className="text-lg font-medium mb-4">{t("dashboard.languagePreference") || "Language Preference"}</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {t("dashboard.languageDescription") || "Choose your preferred language for dashboard and email notifications"}
                                </p>
                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => updateLanguageMutation.mutate("en")}
                                        disabled={updateLanguageMutation.isPending}
                                        variant={(userData?.user?.language || i18n.language) === "en" ? "default" : "outline"}
                                        data-testid="button-language-en"
                                    >
                                        🇬🇧 English
                                    </Button>
                                    <Button
                                        onClick={() => updateLanguageMutation.mutate("gr")}
                                        disabled={updateLanguageMutation.isPending}
                                        variant={(userData?.user?.language || i18n.language) === "gr" ? "default" : "outline"}
                                        data-testid="button-language-gr"
                                    >
                                        🇬🇷 Ελληνικά (Greek)
                                    </Button>
                                </div>
                                {updateLanguageMutation.isPending && (
                                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {t("dashboard.updating") || "Updating..."}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

