import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/ui/authContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type KitStatus = "added" | "waiting" | "optional";

function KitStatusLabel({ status }: { status: KitStatus }) {
  const { t } = useTranslation();
  const key = `getStarted.contentMedia.contentKit.status.${status}`;
  const colorClass =
    status === "added"
      ? "text-[#37c24c]"
      : status === "waiting"
        ? "text-[#c79539]"
        : "text-[#6a6a6a]";
  return (
    <span className={`${colorClass} text-lg font-medium font-brand`}>
      {t(key)}
    </span>
  );
}

function KitStatusCircle({ status }: { status: KitStatus }) {
  if (status === "added") {
    return (
      <div className="w-[30px] h-[30px] rounded-full bg-[#37c24c] flex items-center justify-center flex-shrink-0">
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
          <path d="M1 5L5 9L13 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
  }
  if (status === "waiting") {
    return (
      <div className="w-[30px] h-[30px] rounded-full border-[1.5px] border-[#c79539] flex-shrink-0" />
    );
  }
  return (
    <div className="w-[30px] h-[30px] rounded-full border-[1.5px] border-[#6a6a6a] flex-shrink-0" />
  );
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "image/heic", "image/heif", "image/bmp", "image/tiff",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/rtf", "text/rtf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "application/csv",
  "application/zip", "application/x-zip-compressed",
]);

const ACCEPTED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif",
  ".heic", ".heif", ".bmp", ".tiff", ".tif",
  ".pdf", ".docx", ".txt", ".rtf",
  ".xlsx", ".csv",
  ".zip",
]);

const DANGEROUS_EXTENSIONS = new Set([
  ".exe", ".app", ".dmg", ".pkg", ".msi", ".bat", ".sh", ".cmd", ".com",
  ".vbs", ".ps1", ".php", ".js", ".jsx", ".ts", ".tsx", ".py", ".rb",
  ".pl", ".jar", ".war", ".class", ".dll", ".so", ".dylib", ".bin",
  ".run", ".apk", ".ipa", ".pif", ".scr", ".hta", ".cpl", ".svg",
]);

export default function GetStartedContentMedia() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMock = import.meta.env.DEV && searchParams.get("mock") === "true";
  const mockSessionId = "mock-session-id-dev";
  const sessionId =
    isMock
      ? mockSessionId
      : (searchParams.get("s") ?? "");

  const [websiteContent, setWebsiteContent] = useState("");
  const [successVision, setSuccessVision] = useState("");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);

  useEffect(() => {
    const s = location.state?.submission;
    if (!s) return;
    if (s.websiteContent) setWebsiteContent(s.websiteContent);
    if (s.successVision) setSuccessVision(s.successVision);
  }, [location.state]);

  if (!isMock && !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white font-brand">{t("getStarted.contentMedia.loading")}</p>
      </div>
    );
  }

  const contentStatus: KitStatus = websiteContent.trim() ? "added" : "waiting";
  const mediaStatus: KitStatus = stagedFiles.length > 0 ? "added" : "waiting";
  const successVisionStatus: KitStatus = successVision.trim() ? "added" : "optional";

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const blocked: string[] = [];
    const tooLarge: string[] = [];
    const wrongType: string[] = [];
    const accepted: File[] = [];

    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase();
      const parts = lower.split(".");

      const hasDangerousExt = parts.slice(1).some((p) => DANGEROUS_EXTENSIONS.has(`.${p}`));
      if (hasDangerousExt) { blocked.push(file.name); continue; }

      if (file.size > MAX_FILE_SIZE) { tooLarge.push(file.name); continue; }

      const ext = `.${parts[parts.length - 1]}`;
      if (!ACCEPTED_MIME_TYPES.has(file.type) && !ACCEPTED_EXTENSIONS.has(ext)) {
        wrongType.push(file.name); continue;
      }

      accepted.push(file);
    }

    if (blocked.length > 0) {
      toast({
        title: t(
          blocked.length > 1
            ? "getStarted.contentMedia.errors.filesBlocked"
            : "getStarted.contentMedia.errors.fileBlocked",
          { count: blocked.length },
        ),
        description: t("getStarted.contentMedia.errors.fileBlockedDesc"),
        variant: "destructive",
      });
    }
    if (tooLarge.length > 0) {
      toast({
        title: t(
          tooLarge.length > 1
            ? "getStarted.contentMedia.errors.filesTooLarge"
            : "getStarted.contentMedia.errors.fileTooLarge",
          { count: tooLarge.length },
        ),
        description: t("getStarted.contentMedia.errors.fileTooLargeDesc"),
        variant: "destructive",
      });
    }
    if (wrongType.length > 0) {
      toast({
        title: t(
          wrongType.length > 1
            ? "getStarted.contentMedia.errors.filesNotAccepted"
            : "getStarted.contentMedia.errors.fileNotAccepted",
          { count: wrongType.length },
        ),
        description: t("getStarted.contentMedia.errors.fileNotAcceptedDesc"),
        variant: "destructive",
      });
    }
    if (accepted.length > 0) {
      setStagedFiles((prev) => [...prev, ...accepted]);
    }
  };

  const removeFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const [missingFields, setMissingFields] = useState<string[]>([]);

  const getMissingFieldLabels = (): string[] => {
    const missing: string[] = [];
    if (!websiteContent.trim()) missing.push(t("getStarted.contentMedia.sections.websiteContent.title"));
    if (stagedFiles.length === 0) missing.push(t("getStarted.contentMedia.sections.media.title"));
    return missing;
  };

  const handleSubmit = async () => {
    const missing = getMissingFieldLabels();
    if (missing.length > 0) {
      setMissingFields(missing);
      return;
    }

    if (isMock) {
      toast({ title: t("getStarted.contentMedia.errors.mockComplete") });
      navigate("/dashboard");
      return;
    }

    setIsSubmitting(true);
    try {
      const patchResponse = await fetch(`/api/get-started/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          websiteContent: websiteContent.trim() || null,
          successVision: successVision.trim() || null,
        }),
      });

      if (!patchResponse.ok) throw new Error("Failed to save content");

      const completeResponse = await fetch(`/api/get-started/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!completeResponse.ok) throw new Error("Failed to complete setup");

      const completeData = await completeResponse.json();
      const { domain, websiteProgressId } = completeData;
      const uploadedMediaUrls: { url: string; name: string; publicId: string }[] = [];

      if (stagedFiles.length > 0 && user?.email && domain) {
        const cloudinaryFolder = `Website Media/${user.email}/${domain}`;

        for (const file of stagedFiles) {
          try {
            const sigResponse = await fetch("/api/cloudinary/signature", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                paramsToSign: { folder: cloudinaryFolder },
              }),
            });

            if (!sigResponse.ok) {
              console.warn(`Failed to get signature for ${file.name}, skipping`);
              continue;
            }

            const { signature, timestamp, apiKey, cloudName } = await sigResponse.json();

            const formData = new FormData();
            formData.append("file", file);
            formData.append("signature", signature);
            formData.append("timestamp", String(timestamp));
            formData.append("api_key", apiKey);
            formData.append("folder", cloudinaryFolder);

            const uploadResponse = await fetch(
              `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
              { method: "POST", body: formData },
            );

            if (!uploadResponse.ok) {
              console.warn(`Cloudinary upload failed for ${file.name}, skipping`);
              continue;
            }

            const uploadData = await uploadResponse.json();
            uploadedMediaUrls.push({
              url: uploadData.secure_url,
              name: file.name,
              publicId: uploadData.public_id,
            });

            const rt = uploadData.resource_type as string | undefined;
            const resourceType =
              rt === "image" || rt === "video" || rt === "raw" ? rt : undefined;

            await fetch(`/api/websites/${websiteProgressId}/media`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                url: uploadData.secure_url,
                publicId: uploadData.public_id,
                name: file.name,
                ...(resourceType ? { resourceType } : {}),
              }),
            });
          } catch (fileErr) {
            console.error(`Error uploading ${file.name}:`, fileErr);
          }
        }
      }

      if (uploadedMediaUrls.length > 0) {
        try {
          await fetch(`/api/get-started/${sessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              mediaUrls: uploadedMediaUrls,
            }),
          });
        } catch (mediaUrlsErr) {
          // Non-blocking — files are already on Cloudinary and website_progress.media
          console.warn("Failed to update mediaUrls on submission row:", mediaUrlsErr);
        }
      }

      localStorage.removeItem("hayc_gs_pre_checkout");
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      toast({ title: t("getStarted.contentMedia.errors.submitFailed"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveLater = async () => {
    if (stagedFiles.length > 0) {
      setShowLeaveWarning(true);
      return;
    }
    await doSaveLater();
  };

  const doSaveLater = async () => {
    if (isMock) {
      navigate("/dashboard");
      return;
    }
    try {
      const payload = {
        websiteContent: websiteContent.trim() || undefined,
        successVision: successVision.trim() || undefined,
        currentStep: 9,
      };
      const body = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== undefined && v !== null),
      );
      await fetch(`/api/get-started/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.warn("Save later failed silently:", err);
    }
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-black flex flex-col px-4 md:px-[70px] py-8 md:py-[50px] gap-6 md:gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-white text-2xl md:text-4xl font-semibold font-brand">
          {t("getStarted.contentMedia.title")}
        </h1>
        <p className="text-white text-base leading-[160%] font-brand">
          {t("getStarted.contentMedia.subtitle")}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 md:gap-12 flex-1">
        <div className="flex-1 flex flex-col justify-between gap-8">
          <div className="flex flex-col">
            <div className="flex flex-col gap-3 border-b border-[#6a6a6a] pb-6">
              <div className="flex flex-col gap-1">
                <p className="text-[#eff6ff] text-lg font-medium font-brand">
                  {t("getStarted.contentMedia.sections.websiteContent.title")}
                </p>
                <p className="text-[#f2f6fa] text-base leading-[160%] font-brand">
                  {t("getStarted.contentMedia.sections.websiteContent.subtitle")}
                </p>
              </div>
              <textarea
                value={websiteContent}
                onChange={(e) => setWebsiteContent(e.target.value)}
                placeholder={t("getStarted.contentMedia.sections.websiteContent.placeholder")}
                rows={8}
                className="w-full px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-brand placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14] resize-none leading-[22px]"
              />
            </div>

            <div className="flex flex-col gap-3 pt-6">
              <div className="flex flex-col gap-1">
                <p className="text-[#eff6ff] text-lg font-medium font-brand">
                  {t("getStarted.contentMedia.sections.successVision.title")}{" "}
                  <span className="text-[#6a6a6a] font-normal">
                    {t("getStarted.contentMedia.sections.successVision.optional")}
                  </span>
                </p>
                <p className="text-[#f2f6fa] text-base leading-[160%] font-brand">
                  {t("getStarted.contentMedia.sections.successVision.subtitle")}
                </p>
              </div>
              <textarea
                value={successVision}
                onChange={(e) => setSuccessVision(e.target.value)}
                placeholder={t("getStarted.contentMedia.sections.successVision.placeholder")}
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-brand placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14] resize-none leading-[22px]"
              />
              <p className="text-[#f2f6fa] text-base leading-[160%] font-brand">
                {t("getStarted.contentMedia.sections.successVision.helper")}
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full md:w-1/3 h-11 px-5 bg-[#ED4C14] rounded-[10px] flex items-center justify-center text-white text-base font-semibold font-brand leading-5 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? stagedFiles.length > 0
                  ? t("getStarted.contentMedia.buttons.uploading")
                  : t("getStarted.contentMedia.buttons.submitting")
                : t("getStarted.contentMedia.buttons.submit")}
            </button>
            <button
              type="button"
              onClick={handleSaveLater}
              className="w-full md:w-auto h-11 px-5 rounded-[10px] flex items-center justify-center border border-white/30 cursor-pointer bg-transparent hover:bg-white/10 transition-colors"
            >
              <span className="text-white text-base font-semibold font-brand leading-5">
                {t("getStarted.contentMedia.buttons.completeLater")}
              </span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-start gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-[#eff6ff] text-lg font-medium font-brand">
                {t("getStarted.contentMedia.sections.media.title")}
              </p>
              <p className="text-[#eff6ff] text-base leading-[160%] font-brand">
                {t("getStarted.contentMedia.sections.media.subtitle")}
              </p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "rounded-[26px] bg-[#141414] border-[1.5px] border-dashed flex flex-col items-center justify-center p-[25px] gap-3 transition-colors cursor-pointer",
                isDragging ? "border-[#ED4C14]" : "border-[#6a6a6a]",
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <img
                src="https://res.cloudinary.com/dem12vqtl/image/upload/v1779355559/upload_grey_qphz4z.svg"
                alt=""
                className="w-[46px] h-[47px] flex-shrink-0"
              />
              <div className="flex flex-col items-center gap-1">
                <span className="text-white text-lg font-medium font-brand text-center">
                  {t("getStarted.contentMedia.sections.media.dragDrop")}
                </span>
                <span className="text-[#d1dced] text-base leading-[160%] font-brand">
                  {t("getStarted.contentMedia.sections.media.or")}
                </span>
              </div>
              <div className="rounded-[10px] border-2 border-[#6a6a6a] flex items-center justify-center px-[15px] py-[10px] gap-[10px]">
                <img
                  src="https://res.cloudinary.com/dem12vqtl/image/upload/v1779355423/document_white_kmwobi.svg"
                  alt=""
                  className="w-6 h-6 flex-shrink-0"
                />
                <span className="text-[#d1dced] text-base font-semibold font-brand">
                  {t("getStarted.contentMedia.sections.media.browseComputer")}
                </span>
              </div>
              <span className="text-[#6a6a6a] text-xs font-normal font-brand text-center">
                {t("getStarted.contentMedia.sections.media.fileTypes")}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/bmp,image/tiff,.pdf,.docx,.txt,.rtf,.xlsx,.csv,.zip"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {stagedFiles.length > 0 && (
              <div className="flex flex-col gap-2">
                {stagedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#141414] border border-[#2a2a2a]"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-white text-sm font-medium font-brand truncate">
                        {file.name}
                      </span>
                      <span className="text-[#6a6a6a] text-xs font-brand">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="ml-3 text-[#6a6a6a] hover:text-white text-lg leading-none border-0 bg-transparent cursor-pointer flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[#eff6ff] text-base leading-[160%] font-brand">
              {t("getStarted.contentMedia.sections.media.addMoreLater")}
            </p>
          </div>

          <div className="rounded-[15px] border border-[#6a6a6a] flex flex-col">
            <div className="border-b border-[#6a6a6a] px-[25px] py-[10px]">
              <span className="text-white text-2xl font-medium font-brand">
                {t("getStarted.contentMedia.contentKit.title")}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#6a6a6a] px-[33px] py-3 gap-5">
              <div className="flex items-center gap-3">
                <KitStatusCircle status={contentStatus} />
                <div className="flex flex-col">
                  <span className="text-white text-lg font-medium font-brand">
                    {t("getStarted.contentMedia.contentKit.websiteContent.label")}
                  </span>
                  <span className="text-[#d1dced] text-base leading-[160%] font-brand">
                    {t("getStarted.contentMedia.contentKit.websiteContent.description")}
                  </span>
                </div>
              </div>
              <KitStatusLabel status={contentStatus} />
            </div>

            <div className="flex items-center justify-between border-b border-[#6a6a6a] px-[33px] py-3 gap-5">
              <div className="flex items-center gap-3">
                <KitStatusCircle status={mediaStatus} />
                <div className="flex flex-col">
                  <span className="text-white text-lg font-medium font-brand">
                    {t("getStarted.contentMedia.contentKit.photosAssets.label")}
                  </span>
                  <span className="text-[#d1dced] text-base leading-[160%] font-brand">
                    {t("getStarted.contentMedia.contentKit.photosAssets.description")}
                  </span>
                </div>
              </div>
              <KitStatusLabel status={mediaStatus} />
            </div>

            <div className="flex items-center justify-between px-[33px] py-3 gap-5">
              <div className="flex items-center gap-3">
                <KitStatusCircle status={successVisionStatus} />
                <div className="flex flex-col">
                  <span className="text-white text-lg font-medium font-brand">
                    {t("getStarted.contentMedia.contentKit.successVision.label")}
                  </span>
                  <span className="text-[#d1dced] text-base leading-[160%] font-brand">
                    {t("getStarted.contentMedia.contentKit.successVision.description")}
                  </span>
                </div>
              </div>
              <KitStatusLabel status={successVisionStatus} />
            </div>
          </div>
        </div>
      </div>

      {isSubmitting && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-black pointer-events-none">
          <svg
            width="52"
            height="52"
            viewBox="0 0 24.24 23.468"
            fill="none"
            style={{ animation: "pulse 1.5s ease-in-out infinite" }}
          >
            <path
              d="M9.327,0l.059,7.248L2.852,3.327,0,8.2l6.476,3.563L0,15.267,2.852,20.14l6.534-3.92-.059,7.248h5.584l-.119-7.189,6.536,3.861,2.91-4.873-6.474-3.5L24.238,8.2l-2.91-4.873L14.792,7.248,14.911,0Z"
              fill="#ED4C14"
            />
          </svg>
          <div className="flex flex-col items-center gap-1 pointer-events-none">
            <span className="text-white text-lg font-semibold font-brand">
              {stagedFiles.length > 0
                ? t("getStarted.contentMedia.uploadOverlay.uploading")
                : t("getStarted.contentMedia.uploadOverlay.submitting")}
            </span>
            <span className="text-white/50 text-sm font-normal font-brand">
              {t("getStarted.contentMedia.uploadOverlay.pleaseWait")}
            </span>
          </div>
        </div>
      )}

      {showLeaveWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[#111111] border border-zinc-800 rounded-2xl p-6 max-w-md w-full mx-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-white text-xl font-semibold font-brand">
                {t("getStarted.contentMedia.leaveWarning.title")}
              </h3>
              <p className="text-white/60 text-sm font-normal font-brand leading-6">
                {t("getStarted.contentMedia.leaveWarning.description")}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowLeaveWarning(false)}
                className="h-10 px-5 rounded-[10px] border border-white/30 bg-transparent text-white text-sm font-semibold font-brand cursor-pointer hover:bg-white/10 transition-colors"
              >
                {t("getStarted.contentMedia.leaveWarning.stayAndComplete")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLeaveWarning(false);
                  doSaveLater();
                }}
                className="h-10 px-5 rounded-[10px] bg-[#ED4C14] border-0 text-white text-sm font-semibold font-brand cursor-pointer hover:bg-[#d44310] transition-colors"
              >
                {t("getStarted.contentMedia.leaveWarning.leaveAnyway")}
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={missingFields.length > 0} onOpenChange={(open) => { if (!open) setMissingFields([]); }}>
        <DialogContent className="bg-zinc-900 border border-zinc-700 text-white max-w-sm">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2 text-white font-brand">
              <AlertCircle className="w-5 h-5 text-[#ED4C14] flex-shrink-0" />
              {t("getStarted.summary.missingFieldsTitle", "Please fill in the required fields")}
            </DialogTitle>
          </DialogHeader>
          <ul className="flex flex-col gap-2 mt-2">
            {missingFields.map((label) => (
              <li key={label} className="flex items-center gap-2 text-sm font-brand text-white/80">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ED4C14] flex-shrink-0" />
                {label}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setMissingFields([])}
            className="mt-4 w-full h-10 bg-[#ED4C14] rounded-[10px] text-white text-sm font-semibold font-brand border-0 cursor-pointer hover:bg-[#d44310] transition-colors"
          >
            {t("getStarted.summary.missingFieldsDismiss", "Got it")}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

