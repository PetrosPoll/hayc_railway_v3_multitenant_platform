import type { Express, Request, Response } from "express";
import { contactCardUrl, getContactCard } from "@shared/contact-cards";
import {
  appleWalletConfigured,
  buildContactCardPass,
  buildContactCardQrPng,
  contactCardOriginFromHost,
} from "./contact-card-pass";

function slugFrom(req: Request): string {
  const slug = req.params.slug;
  return Array.isArray(slug) ? slug[0] : slug;
}

function originFrom(req: Request): string {
  const forwardedHost = req.headers["x-forwarded-host"];
  const forwardedProto = req.headers["x-forwarded-proto"];
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.get("host");
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol;
  return contactCardOriginFromHost(host, proto);
}

export function registerContactCardRoutes(app: Express): void {
  app.get("/card/:slug/download", async (req, res) => {
    await sendQrDownload(req, res);
  });

  app.get("/cards/:slug/wallet", (req, res) => {
    const card = getContactCard(slugFrom(req));
    if (!card) {
      res.status(404).json({ available: false });
      return;
    }
    res.set("Cache-Control", "no-store");
    res.json({
      available: appleWalletConfigured(),
      url: contactCardUrl(card.slug, originFrom(req)),
    });
  });

  app.get("/cards/:slug/pass.pkpass", async (req, res) => {
    await sendPass(req, res);
  });
}

async function sendQrDownload(req: Request, res: Response): Promise<void> {
  const card = getContactCard(slugFrom(req));
  if (!card) {
    res.status(404).json({ message: "Η κάρτα δεν βρέθηκε." });
    return;
  }

  try {
    const png = await buildContactCardQrPng(contactCardUrl(card.slug, originFrom(req)));
    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${card.slug}-qr.png"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.send(png);
  } catch (error) {
    console.error("Contact card QR failed:", error);
    res.status(500).json({ message: "Το QR δεν δημιουργήθηκε." });
  }
}

async function sendPass(req: Request, res: Response): Promise<void> {
  const card = getContactCard(slugFrom(req));
  if (!card) {
    res.status(404).json({ message: "Η κάρτα δεν βρέθηκε." });
    return;
  }
  if (!appleWalletConfigured()) {
    res.status(501).json({
      message: "Το Apple Wallet θέλει πιστοποιητικό υπογραφής από την Apple.",
    });
    return;
  }

  try {
    const pass = await buildContactCardPass(card, contactCardUrl(card.slug, originFrom(req)));
    res.set({
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${card.slug}.pkpass"`,
      "Cache-Control": "no-store",
    });
    res.send(pass);
  } catch (error) {
    console.error("Contact card pass failed:", error);
    res.status(500).json({ message: "Η κάρτα για το Apple Wallet δεν δημιουργήθηκε." });
  }
}
