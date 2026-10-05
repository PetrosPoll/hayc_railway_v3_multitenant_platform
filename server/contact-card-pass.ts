import fs from "node:fs";
import QRCode from "qrcode";
import { PKPass } from "passkit-generator";
import {
  contactCardLink,
  type ContactCard,
} from "@shared/contact-cards";
import { createBrandIconPng } from "./lib/brand-icon-png";
import { APPLE_WWDR_CERT } from "./apple-wwdr-cert";

const NAVY = "rgb(24, 43, 83)";
const WHITE = "rgb(255, 255, 255)";
const LABEL = "rgb(160, 186, 243)";

export function contactCardOriginFromHost(
  host: string | undefined,
  proto: string | undefined,
): string {
  const normalizedHost = host?.split(",")[0]?.trim() ?? "";
  if (!normalizedHost || /^(localhost|127\.0\.0\.1)(:|$)/.test(normalizedHost)) {
    return "https://hayc.gr";
  }
  const normalizedProto = proto?.split(",")[0]?.trim() === "http" ? "http" : "https";
  return `${normalizedProto}://${normalizedHost}`;
}

function pemFromValue(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
  if (normalized.includes("BEGIN")) return normalized;
  if (fs.existsSync(normalized)) return fs.readFileSync(normalized, "utf8");
  return null;
}

function signingMaterial(): {
  signerCert: string;
  signerKey: string;
  signerKeyPassphrase?: string;
  passTypeIdentifier: string;
  teamIdentifier: string;
} | null {
  const signerCert = pemFromValue(process.env.APPLE_PASS_CERT);
  const signerKey = pemFromValue(process.env.APPLE_PASS_KEY);
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER?.trim();
  const teamIdentifier = process.env.APPLE_TEAM_IDENTIFIER?.trim();
  if (!signerCert || !signerKey || !passTypeIdentifier || !teamIdentifier) return null;
  const signerKeyPassphrase = process.env.APPLE_PASS_KEY_PASSPHRASE;
  return {
    signerCert,
    signerKey,
    passTypeIdentifier,
    teamIdentifier,
    ...(signerKeyPassphrase ? { signerKeyPassphrase } : {}),
  };
}

export function appleWalletConfigured(): boolean {
  return signingMaterial() !== null;
}

export async function buildContactCardQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 720,
    margin: 1,
    errorCorrectionLevel: "H",
    color: {
      dark: "#182B53",
      light: "#FFFFFF",
    },
  });
}

export async function buildContactCardPass(card: ContactCard, url: string): Promise<Buffer> {
  const material = signingMaterial();
  if (!material) {
    throw new Error("Apple Wallet signing is not configured");
  }

  const buffers: Record<string, Buffer> = {
    "icon.png": createBrandIconPng(29),
    "icon@2x.png": createBrandIconPng(58),
    "icon@3x.png": createBrandIconPng(87),
  };

  const pass = new PKPass(buffers, {
    wwdr: pemFromValue(process.env.APPLE_WWDR_CERT) ?? APPLE_WWDR_CERT,
    signerCert: material.signerCert,
    signerKey: material.signerKey,
    ...(material.signerKeyPassphrase
      ? { signerKeyPassphrase: material.signerKeyPassphrase }
      : {}),
  }, {
    serialNumber: card.slug,
    description: card.name,
    organizationName: "hayc",
    passTypeIdentifier: material.passTypeIdentifier,
    teamIdentifier: material.teamIdentifier,
    foregroundColor: WHITE,
    backgroundColor: NAVY,
    labelColor: LABEL,
    logoText: "hayc",
  });

  pass.type = "storeCard";

  const phone = contactCardLink(card, "phone");
  const email = contactCardLink(card, "email");
  const website = contactCardLink(card, "website");

  pass.headerFields.push({
    key: "brand",
    label: "HAYC",
    value: "Κάρτα",
  });
  pass.primaryFields.push({
    key: "name",
    label: "ΟΝΟΜΑ",
    value: card.name,
  });
  if (phone) {
    pass.secondaryFields.push({
      key: "phone",
      label: "ΤΗΛΕΦΩΝΟ",
      value: phone.text,
    });
  }
  pass.auxiliaryFields.push({
    key: "role",
    label: "ΡΟΛΟΣ",
    value: card.role,
  });

  pass.backFields.push(
    { key: "page", label: "Σελίδα κάρτας", value: url },
    ...(website ? [{ key: "website", label: "Ιστοσελίδα", value: website.href }] : []),
    ...(email ? [{ key: "email", label: "Email", value: email.text }] : []),
    ...card.links
      .filter((link) => link.kind === "instagram" || link.kind === "facebook" || link.kind === "linkedin")
      .map((link) => ({ key: link.kind, label: link.label, value: link.href })),
  );

  pass.setBarcodes({
    format: "PKBarcodeFormatQR",
    message: url,
    messageEncoding: "iso-8859-1",
    altText: url.replace(/^https?:\/\//, ""),
  });

  return pass.getAsBuffer();
}
