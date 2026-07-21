import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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

export type DemoBuyerCredentials = {
  email: string;
  password: string;
  name?: string;
  createdAt?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  websiteId: number;
  onCreated: (credentials: DemoBuyerCredentials) => void;
};

function generateDemoPassword(length = 12): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

function generateDemoEmail(): string {
  const values = crypto.getRandomValues(new Uint8Array(5));
  const id = Array.from(values, (b) => b.toString(16).padStart(2, "0")).join("");
  return `demo.${id}@haycdemo.com`;
}

export function CreateDemoBuyerDialog({
  open,
  onOpenChange,
  siteId,
  websiteId,
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) setIsSubmitting(false);
  }, [open]);

  const handleCreate = async () => {
    setIsSubmitting(true);
    const email = generateDemoEmail();
    const password = generateDemoPassword();
    const name = `Demo Buyer ${websiteId}`;

    try {
      const res = await fetch(`/api/hdp/buyers/${encodeURIComponent(siteId)}/demo-buyer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      let body: Record<string, unknown> = {};
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          body = (await res.json()) as Record<string, unknown>;
        } catch {
          body = {};
        }
      }

      if (res.status === 409 && body.demoBuyer && typeof body.demoBuyer === "object") {
        const existing = body.demoBuyer as Record<string, unknown>;
        if (typeof existing.email === "string" && typeof existing.password === "string") {
          onCreated({
            email: existing.email,
            password: existing.password,
            name: typeof existing.name === "string" ? existing.name : undefined,
            createdAt: typeof existing.createdAt === "string" ? existing.createdAt : undefined,
          });
          onOpenChange(false);
          return;
        }
      }

      if (!res.ok) {
        const msg =
          typeof body.error === "string"
            ? body.error
            : t("digitalProductsManagement.buyers.demoBuyer.createFailed");
        toast({
          title: t("digitalProductsManagement.toasts.errorTitle"),
          description: msg,
          variant: "destructive",
        });
        return;
      }

      const demoBuyer =
        body.demoBuyer && typeof body.demoBuyer === "object"
          ? (body.demoBuyer as Record<string, unknown>)
          : null;

      onCreated({
        email: typeof demoBuyer?.email === "string" ? demoBuyer.email : email,
        password: typeof demoBuyer?.password === "string" ? demoBuyer.password : password,
        name: typeof demoBuyer?.name === "string" ? demoBuyer.name : name,
        createdAt:
          typeof demoBuyer?.createdAt === "string" ? demoBuyer.createdAt : new Date().toISOString(),
      });
      onOpenChange(false);
    } catch {
      toast({
        title: t("digitalProductsManagement.toasts.errorTitle"),
        description: t("digitalProductsManagement.buyers.demoBuyer.createFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("digitalProductsManagement.buyers.demoBuyer.title")}</DialogTitle>
          <DialogDescription>
            {t("digitalProductsManagement.buyers.demoBuyer.subtitle")}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("digitalProductsManagement.buyers.demoBuyer.enrollNote")}
        </p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("digitalProductsManagement.common.cancel")}
          </Button>
          <Button type="button" onClick={() => void handleCreate()} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("digitalProductsManagement.buyers.demoBuyer.creating")}
              </>
            ) : (
              t("digitalProductsManagement.buyers.demoBuyer.createButton")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
