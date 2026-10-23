import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmailEditor, { EditorRef } from "react-email-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Save, Loader2, Eye } from "lucide-react";
import { impersonationHSvh } from "@/lib/impersonation-layout";
import { resolvePopupThumbnail } from "@/lib/popup-thumbnail";
import type { PopupTemplate } from "@shared/schema";

export default function PopupBuilderPage() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isDemo, blockIfDemo } = useDemoMode();
  const queryClient = useQueryClient();
  const emailEditorRef = useRef<EditorRef>(null);

  const [editorReady, setEditorReady] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showExitConfirmDialog, setShowExitConfirmDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [popupName, setPopupName] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [delayMs, setDelayMs] = useState(1500);
  const [showOnceEveryDays, setShowOnceEveryDays] = useState(7);
  const [selectedPopupId, setSelectedPopupId] = useState<number | null>(null);
  const selectedPopupIdRef = useRef<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    selectedPopupIdRef.current = selectedPopupId;
  }, [selectedPopupId]);

  const { data: popups = [] } = useQuery<PopupTemplate[]>({
    queryKey: ["/api/popup-templates", websiteId],
    queryFn: async () => {
      const response = await fetch(`/api/popup-templates/${websiteId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch popups");
      return response.json();
    },
    enabled: !!websiteId,
  });

  useEffect(() => {
    const idToLoad = sessionStorage.getItem("loadPopupId");
    if (!idToLoad || !popups.length || !editorReady || !emailEditorRef.current?.editor) {
      return;
    }
    const popup = popups.find((p) => p.id === parseInt(idToLoad, 10));
    if (!popup) {
      sessionStorage.removeItem("loadPopupId");
      return;
    }

    const unlayer = emailEditorRef.current.editor;
    try {
      let design: any = null;
      try {
        design = typeof popup.design === "string" ? JSON.parse(popup.design) : popup.design;
      } catch {
        design = null;
      }

      if (design?.body) {
        unlayer.loadDesign(design);
      } else if (popup.html) {
        unlayer.loadDesign({
          body: {
            rows: [
              {
                cells: [1],
                columns: [
                  {
                    contents: [
                      {
                        type: "html",
                        values: { html: popup.html },
                      },
                    ],
                  },
                ],
              },
            ],
            values: {},
          },
        });
      }

      setSelectedPopupId(popup.id);
      setPopupName(popup.name);
      setEnabled(!!popup.enabled);
      setDelayMs(popup.delayMs ?? 1500);
      setShowOnceEveryDays(popup.showOnceEveryDays ?? 7);
      setHasUnsavedChanges(false);
      sessionStorage.removeItem("loadPopupId");
      toast({
        title: t("dashboard.success") || "Success",
        description:
          t("dashboard.popupLoaded", { name: popup.name }) ||
          `Popup "${popup.name}" loaded`,
      });
    } catch (error) {
      console.error("Failed to load popup:", error);
      sessionStorage.removeItem("loadPopupId");
      toast({
        title: t("dashboard.error") || "Error",
        description: t("dashboard.failedToLoadPopup") || "Failed to load popup",
        variant: "destructive",
      });
    }
  }, [popups, editorReady, toast, t]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      html: string;
      design: string;
      thumbnail: string | null;
      enabled: boolean;
      delayMs: number;
      showOnceEveryDays: number;
    }) => {
      const existingId = selectedPopupIdRef.current;
      const url = existingId
        ? `/api/popup-templates/${existingId}`
        : "/api/popup-templates";
      const method = existingId ? "PATCH" : "POST";
      const body = existingId
        ? payload
        : { ...payload, websiteProgressId: Number(websiteId) };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save popup");
      }
      return response.json() as Promise<PopupTemplate>;
    },
    onSuccess: (saved) => {
      setSelectedPopupId(saved.id);
      setHasUnsavedChanges(false);
      setShowSaveDialog(false);
      queryClient.invalidateQueries({
        queryKey: ["/api/popup-templates", websiteId],
      });
      toast({
        title: t("dashboard.success") || "Success",
        description: t("dashboard.popupSaved") || "Popup saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("dashboard.error") || "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onReady = (unlayer: any) => {
    setEditorReady(true);
    unlayer.addEventListener("design:updated", () => {
      setHasUnsavedChanges(true);
    });
  };

  const openSaveDialog = () => {
    if (blockIfDemo()) return;
    if (!emailEditorRef.current?.editor) return;
    setShowSaveDialog(true);
  };

  const handleConfirmSave = async () => {
    if (blockIfDemo()) return;
    if (!popupName.trim()) {
      toast({
        title: t("dashboard.error") || "Error",
        description: t("dashboard.popupNameRequired") || "Please enter a popup name",
        variant: "destructive",
      });
      return;
    }

    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) return;

    setIsSaving(true);
    try {
      const { design, html, unlayerThumbUrl } = await new Promise<{
        design: any;
        html: string;
        unlayerThumbUrl: string | null;
      }>((resolve) => {
        unlayer.exportHtml((data: { design: any; html: string }) => {
          let settled = false;
          const finish = (url: string | null) => {
            if (settled) return;
            settled = true;
            resolve({
              design: data.design,
              html: data.html,
              unlayerThumbUrl: url,
            });
          };

          try {
            unlayer.exportImage(
              (imageData: { url?: string | null }) => {
                finish(imageData?.url || null);
              },
              { fullPage: true, width: 800, height: 800 },
            );
          } catch {
            finish(null);
          }

          // Unlayer sometimes never calls back — don't block save forever
          setTimeout(() => finish(null), 8000);
        });
      });

      let validDesign = design;
      if (!validDesign || typeof validDesign !== "object") {
        validDesign = { body: { rows: [], values: {} } };
      }

      const thumbnail = await resolvePopupThumbnail({
        unlayerUrl: unlayerThumbUrl,
        html,
      });

      saveMutation.mutate({
        name: popupName.trim(),
        html,
        design: JSON.stringify(validDesign),
        thumbnail,
        enabled,
        delayMs: Number.isFinite(delayMs) ? Math.max(0, delayMs) : 1500,
        showOnceEveryDays: Number.isFinite(showOnceEveryDays)
          ? Math.max(0, showOnceEveryDays)
          : 7,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirmDialog(true);
      return;
    }
    navigate(`/dashboard/website/${websiteId}?tab=popups`);
  };

  const handlePreview = () => {
    const unlayer = emailEditorRef.current?.editor;
    if (!unlayer) return;
    unlayer.exportHtml((data: { html: string }) => {
      const previewWindow = window.open("", "_blank");
      if (previewWindow) {
        previewWindow.document.write(data.html);
        previewWindow.document.close();
      }
    });
  };

  return (
    <div
      className={`flex flex-col bg-background ${impersonationHSvh}`}
      data-testid="popup-builder"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            data-testid="button-popup-builder-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("dashboard.back") || "Back"}
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">
              {selectedPopupId
                ? t("dashboard.editPopup") || "Edit Popup"
                : t("dashboard.createPopup") || "Create Popup"}
            </h1>
            {popupName ? (
              <p className="text-xs text-muted-foreground truncate">{popupName}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            data-testid="button-popup-preview"
          >
            <Eye className="h-4 w-4 mr-2" />
            {t("dashboard.preview") || "Preview"}
          </Button>
          <Button
            size="sm"
            onClick={openSaveDialog}
            disabled={isDemo || saveMutation.isPending || isSaving}
            data-testid="button-popup-save"
          >
            {saveMutation.isPending || isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t("dashboard.savePopup") || "Save Popup"}
          </Button>
        </div>
      </div>

      <div className="flex-1">
        <EmailEditor
          ref={emailEditorRef}
          onReady={onReady}
          minHeight="100%"
          data-testid="popup-editor"
          options={{
            features: {
              textEditor: {
                spellChecker: true,
              },
            },
          }}
        />
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent data-testid="dialog-save-popup">
          <DialogHeader>
            <DialogTitle>
              {selectedPopupId
                ? t("dashboard.updatePopup") || "Update Popup"
                : t("dashboard.savePopup") || "Save Popup"}
            </DialogTitle>
            <DialogDescription>
              {t("dashboard.savePopupDesc") ||
                "Name your popup and choose when it should appear on the site."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="popup-name">
                {t("dashboard.popupName") || "Popup name"}
              </Label>
              <Input
                id="popup-name"
                value={popupName}
                onChange={(e) => setPopupName(e.target.value)}
                placeholder={
                  t("dashboard.popupNamePlaceholder") || "e.g. Welcome offer"
                }
                data-testid="input-popup-name"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="popup-enabled">
                  {t("dashboard.popupEnabled") || "Enabled on site"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("dashboard.popupEnabledHint") ||
                    "Turn on when you are ready to show this popup to visitors."}
                </p>
              </div>
              <Switch
                id="popup-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
                data-testid="switch-popup-enabled"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="popup-delay">
                {t("dashboard.popupDelayMs") || "Delay before show (ms)"}
              </Label>
              <Input
                id="popup-delay"
                type="number"
                min={0}
                max={120000}
                value={delayMs}
                onChange={(e) => setDelayMs(parseInt(e.target.value, 10) || 0)}
                data-testid="input-popup-delay"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="popup-frequency">
                {t("dashboard.popupShowOnceEveryDays") ||
                  "Show again after (days)"}
              </Label>
              <Input
                id="popup-frequency"
                type="number"
                min={0}
                max={365}
                value={showOnceEveryDays}
                onChange={(e) =>
                  setShowOnceEveryDays(parseInt(e.target.value, 10) || 0)
                }
                data-testid="input-popup-frequency"
              />
              <p className="text-xs text-muted-foreground">
                {t("dashboard.popupShowOnceEveryDaysHint") ||
                  "0 = every visit. After dismiss, wait this many days before showing again."}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              data-testid="button-cancel-save-popup"
            >
              {t("dashboard.cancel") || "Cancel"}
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={saveMutation.isPending || isSaving}
              data-testid="button-confirm-save-popup"
            >
              {saveMutation.isPending || isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {t("dashboard.save") || "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExitConfirmDialog} onOpenChange={setShowExitConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("dashboard.unsavedChanges") || "Unsaved changes"}
            </DialogTitle>
            <DialogDescription>
              {t("dashboard.unsavedChangesDesc") ||
                "You have unsaved changes. Leave without saving?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowExitConfirmDialog(false)}
            >
              {t("dashboard.stay") || "Stay"}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                navigate(`/dashboard/website/${websiteId}?tab=popups`)
              }
            >
              {t("dashboard.leave") || "Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
