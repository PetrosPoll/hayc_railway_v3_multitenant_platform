import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/ui/authContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type KitStatus = "added" | "waiting" | "optional";

function KitStatusLabel({ status }: { status: KitStatus }) {
  if (status === "added") {
    return <span className="text-[#37c24c] text-lg font-medium font-['Montserrat']">Added</span>;
  }
  if (status === "waiting") {
    return <span className="text-[#c79539] text-lg font-medium font-['Montserrat']">Waiting for files</span>;
  }
  return <span className="text-[#6a6a6a] text-lg font-medium font-['Montserrat']">Optional</span>;
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
  // Safe images — SVG excluded (can embed scripts)
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "image/heic", "image/heif", "image/bmp", "image/tiff",
  // Documents
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain",
  "application/rtf", "text/rtf",
  // Spreadsheets
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "text/csv", "application/csv",
  // Archive
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
        <p className="text-white font-['Montserrat']">Loading...</p>
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

      // Block anything with a dangerous extension anywhere in the filename
      const hasDangerousExt = parts.slice(1).some((p) => DANGEROUS_EXTENSIONS.has(`.${p}`));
      if (hasDangerousExt) { blocked.push(file.name); continue; }

      // Reject files over 25 MB
      if (file.size > MAX_FILE_SIZE) { tooLarge.push(file.name); continue; }

      // Allowlist check — MIME type or extension must match
      const ext = `.${parts[parts.length - 1]}`;
      if (!ACCEPTED_MIME_TYPES.has(file.type) && !ACCEPTED_EXTENSIONS.has(ext)) {
        wrongType.push(file.name); continue;
      }

      accepted.push(file);
    }

    if (blocked.length > 0) {
      toast({
        title: `${blocked.length} file${blocked.length > 1 ? "s" : ""} blocked`,
        description: "This file type is not permitted for security reasons.",
        variant: "destructive",
      });
    }
    if (tooLarge.length > 0) {
      toast({
        title: `${tooLarge.length} file${tooLarge.length > 1 ? "s" : ""} too large`,
        description: "Each file must be under 25 MB.",
        variant: "destructive",
      });
    }
    if (wrongType.length > 0) {
      toast({
        title: `${wrongType.length} file${wrongType.length > 1 ? "s" : ""} not accepted`,
        description: "Accepted: images, PDF, DOCX, TXT, RTF, XLSX, CSV, ZIP.",
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

  const canSubmit = websiteContent.trim().length > 0 && stagedFiles.length > 0;

  const handleSubmit = async () => {
    if (!websiteContent.trim()) {
      toast({ title: "Please add your website content before submitting", variant: "destructive" });
      return;
    }

    if (stagedFiles.length === 0) {
      toast({ title: "Please upload at least one file before submitting", variant: "destructive" });
      return;
    }

    if (isMock) {
      toast({ title: "Mock mode — setup complete!" });
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

      // PATCH mediaUrls back to submission row if any files were uploaded
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
      toast({ title: "Failed to submit. Please try again.", variant: "destructive" });
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
    <div className="min-h-screen bg-black flex flex-col px-[70px] py-[50px] gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-white text-4xl font-semibold font-['Montserrat']">
          Content & Media
        </h1>
        <p className="text-white text-base leading-[160%] font-['Montserrat']">
          Share the content, images and details we'll use to build your website.
        </p>
      </div>

      <div className="flex gap-12 flex-1">
      <div className="flex-1 flex flex-col justify-between gap-8">
        <div className="flex flex-col">
          <div className="flex flex-col gap-3 border-b border-[#6a6a6a] pb-6">
            <div className="flex flex-col gap-1">
              <p className="text-[#eff6ff] text-lg font-medium font-['Montserrat']">
                Website Content
              </p>
              <p className="text-[#f2f6fa] text-base leading-[160%] font-['Montserrat']">
                Add any text you already have, or tell us if you need help.
              </p>
            </div>
            <textarea
              value={websiteContent}
              onChange={(e) => setWebsiteContent(e.target.value)}
              placeholder="Paste your text, page notes, service descriptions or anything you want us to include."
              rows={8}
              className="w-full px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-['Montserrat'] placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14] resize-none leading-[22px]"
            />
          </div>

          <div className="flex flex-col gap-3 pt-6">
            <div className="flex flex-col gap-1">
              <p className="text-[#eff6ff] text-lg font-medium font-['Montserrat']">
                Success Vision <span className="text-[#6a6a6a] font-normal">(optional)</span>
              </p>
              <p className="text-[#f2f6fa] text-base leading-[160%] font-['Montserrat']">
                In one sentence, what does success look like for you 6 months after your website launches?
              </p>
            </div>
            <textarea
              value={successVision}
              onChange={(e) => setSuccessVision(e.target.value)}
              placeholder="e.g. I want to be getting 5 new enquiries a week through my website"
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-transparent border border-[#6a6a6a] text-[#f2f6fa] text-sm font-['Montserrat'] placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ED4C14] resize-none leading-[22px]"
            />
            <p className="text-[#f2f6fa] text-base leading-[160%] font-['Montserrat']">
              This helps us understand your real goal. There's no wrong answer.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            className="w-1/3 h-11 px-5 bg-[#ED4C14] rounded-[10px] flex items-center justify-center text-white text-base font-semibold font-['Montserrat'] leading-5 border-0 cursor-pointer hover:bg-[#d44310] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? stagedFiles.length > 0
                ? "Uploading & submitting..."
                : "Submitting..."
              : "Submit Setup"}
          </button>
          <button
            type="button"
            onClick={handleSaveLater}
            className="h-11 px-5 py-3.5 rounded-[10px] inline-flex justify-start items-center gap-4 border border-white/30 cursor-pointer bg-transparent hover:bg-white/10 transition-colors"
          >
            <span className="text-white text-base font-semibold font-['Montserrat'] leading-5">
              Complete later
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-start gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-[#eff6ff] text-lg font-medium font-['Montserrat']">
              Photos & brand assets
            </p>
            <p className="text-[#eff6ff] text-base leading-[160%] font-['Montserrat']">
              Upload your logo, photos or any files you want us to use.
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
              <span className="text-white text-lg font-medium font-['Montserrat'] text-center">
                Drag & drop files here
              </span>
              <span className="text-[#d1dced] text-base leading-[160%] font-['Montserrat']">or</span>
            </div>
            <div className="rounded-[10px] border-2 border-[#6a6a6a] flex items-center justify-center px-[15px] py-[10px] gap-[10px]">
              <img
                src="https://res.cloudinary.com/dem12vqtl/image/upload/v1779355423/document_white_kmwobi.svg"
                alt=""
                className="w-6 h-6 flex-shrink-0"
              />
              <span className="text-[#d1dced] text-base font-semibold font-['Montserrat']">
                Browse Computer
              </span>
            </div>
            <span className="text-[#6a6a6a] text-xs font-normal font-['Montserrat'] text-center">
              Images, PDF, DOCX, TXT, RTF, XLSX, CSV, ZIP — max 25 MB each
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
                    <span className="text-white text-sm font-medium font-['Montserrat'] truncate">
                      {file.name}
                    </span>
                    <span className="text-[#6a6a6a] text-xs font-['Montserrat']">
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

          <p className="text-[#eff6ff] text-base leading-[160%] font-['Montserrat']">
            You can also add more files later from your dashboard.
          </p>
        </div>

        <div className="rounded-[15px] border border-[#6a6a6a] flex flex-col">
          <div className="border-b border-[#6a6a6a] px-[25px] py-[10px]">
            <span className="text-white text-2xl font-medium font-['Montserrat']">
              Your content kit
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-[#6a6a6a] px-[33px] py-3 gap-5">
            <div className="flex items-center gap-3">
              <KitStatusCircle status={contentStatus} />
              <div className="flex flex-col">
                <span className="text-white text-lg font-medium font-['Montserrat']">Website content</span>
                <span className="text-[#d1dced] text-base leading-[160%] font-['Montserrat']">Added from your notes</span>
              </div>
            </div>
            <KitStatusLabel status={contentStatus} />
          </div>

          <div className="flex items-center justify-between border-b border-[#6a6a6a] px-[33px] py-3 gap-5">
            <div className="flex items-center gap-3">
              <KitStatusCircle status={mediaStatus} />
              <div className="flex flex-col">
                <span className="text-white text-lg font-medium font-['Montserrat']">Photos & assets</span>
                <span className="text-[#d1dced] text-base leading-[160%] font-['Montserrat']">Logo, photos, brand files</span>
              </div>
            </div>
            <KitStatusLabel status={mediaStatus} />
          </div>

          <div className="flex items-center justify-between px-[33px] py-3 gap-5">
            <div className="flex items-center gap-3">
              <KitStatusCircle status={successVisionStatus} />
              <div className="flex flex-col">
                <span className="text-white text-lg font-medium font-['Montserrat']">Success vision</span>
                <span className="text-[#d1dced] text-base leading-[160%] font-['Montserrat']">Your 6-month goal</span>
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
            <span className="text-white text-lg font-semibold font-['Montserrat']">
              {stagedFiles.length > 0 ? "Uploading files & submitting…" : "Submitting…"}
            </span>
            <span className="text-white/50 text-sm font-normal font-['Montserrat']">
              This may take a moment. Please don't close this page.
            </span>
          </div>
        </div>
      )}

      {showLeaveWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-[#111111] border border-zinc-800 rounded-2xl p-6 max-w-md w-full mx-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-white text-xl font-semibold font-['Montserrat']">
                Files won't be saved
              </h3>
              <p className="text-white/60 text-sm font-normal font-['Montserrat'] leading-6">
                You have files ready to upload. If you leave now, they won't be saved. To save your files, complete and submit this step.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowLeaveWarning(false)}
                className="h-10 px-5 rounded-[10px] border border-white/30 bg-transparent text-white text-sm font-semibold font-['Montserrat'] cursor-pointer hover:bg-white/10 transition-colors"
              >
                Stay and complete
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLeaveWarning(false);
                  doSaveLater();
                }}
                className="h-10 px-5 rounded-[10px] bg-[#ED4C14] border-0 text-white text-sm font-semibold font-['Montserrat'] cursor-pointer hover:bg-[#d44310] transition-colors"
              >
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
