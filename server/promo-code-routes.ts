import type { Express, Request, Response } from "express";
import type Stripe from "stripe";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import {
  UserRole,
  ambassadors,
  promoCodes,
  promoRedemptions,
  users,
} from "@shared/schema";
import {
  createAmbassadorPromoCode,
  discountSummary,
  getPromoAttributionStats,
  resolveActivePromoCode,
} from "./promo-codes";

async function requireAdmin(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const adminUser = await storage.getUserById(req.user!.id);
  if (!adminUser || adminUser.role !== UserRole.ADMINISTRATOR) {
    res.status(403).json({ error: "Not authorized" });
    return null;
  }
  return adminUser;
}

export function registerPromoCodeRoutes(app: Express, stripe: Stripe) {
  const validateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Too many promo validation attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/public/promo-codes/validate", validateLimiter, async (req, res) => {
    try {
      const schema = z.object({
        code: z.string().min(1),
      });
      const { code } = schema.parse(req.body);
      const promo = await resolveActivePromoCode(stripe, code);
      if (!promo) {
        return res.status(404).json({ valid: false, error: "Invalid promo code" });
      }
      const summary = discountSummary(promo);
      return res.json({
        valid: true,
        code: promo.code,
        ...summary,
        duration: promo.duration,
        durationInMonths: promo.durationInMonths,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ valid: false, error: "Invalid request" });
      }
      console.error("Promo validate error:", err);
      return res.status(500).json({ valid: false, error: "Failed to validate promo code" });
    }
  });

  app.get("/api/admin/ambassadors", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const rows = await db
        .select()
        .from(ambassadors)
        .orderBy(desc(ambassadors.createdAt));
      res.json(rows);
    } catch (err) {
      console.error("List ambassadors error:", err);
      res.status(500).json({ error: "Failed to list ambassadors" });
    }
  });

  app.post("/api/admin/ambassadors", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email().optional().nullable(),
        notes: z.string().optional().nullable(),
        active: z.boolean().optional(),
      });
      const body = schema.parse(req.body);
      const [created] = await db
        .insert(ambassadors)
        .values({
          name: body.name.trim(),
          email: body.email?.trim() || null,
          notes: body.notes?.trim() || null,
          active: body.active ?? true,
        })
        .returning();
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: err.errors });
      }
      console.error("Create ambassador error:", err);
      res.status(500).json({ error: "Failed to create ambassador" });
    }
  });

  app.patch("/api/admin/ambassadors/:id", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid ambassador id" });
      }
      const schema = z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional().nullable(),
        notes: z.string().optional().nullable(),
        active: z.boolean().optional(),
      });
      const body = schema.parse(req.body);
      const [updated] = await db
        .update(ambassadors)
        .set({
          ...(body.name != null ? { name: body.name.trim() } : {}),
          ...(body.email !== undefined ? { email: body.email?.trim() || null } : {}),
          ...(body.notes !== undefined ? { notes: body.notes?.trim() || null } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
          updatedAt: new Date(),
        })
        .where(eq(ambassadors.id, id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Ambassador not found" });
      }
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: err.errors });
      }
      console.error("Update ambassador error:", err);
      res.status(500).json({ error: "Failed to update ambassador" });
    }
  });

  app.get("/api/admin/promo-codes", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const ambassadorId = req.query.ambassadorId
        ? parseInt(String(req.query.ambassadorId), 10)
        : null;

      const baseQuery = db
        .select({
          promo: promoCodes,
          ambassadorName: ambassadors.name,
        })
        .from(promoCodes)
        .innerJoin(ambassadors, eq(promoCodes.ambassadorId, ambassadors.id));

      const rows =
        ambassadorId && !Number.isNaN(ambassadorId)
          ? await baseQuery
              .where(eq(promoCodes.ambassadorId, ambassadorId))
              .orderBy(desc(promoCodes.createdAt))
          : await baseQuery.orderBy(desc(promoCodes.createdAt));

      res.json(
        rows.map((r) => ({
          ...r.promo,
          ambassadorName: r.ambassadorName,
          ...discountSummary(r.promo),
        })),
      );
    } catch (err) {
      console.error("List promo codes error:", err);
      res.status(500).json({ error: "Failed to list promo codes" });
    }
  });

  app.post("/api/admin/promo-codes", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const schema = z
        .object({
          ambassadorId: z.number().int().positive(),
          code: z.string().min(3),
          percentOff: z.number().min(1).max(100).optional(),
          amountOff: z.number().int().positive().optional(),
          duration: z.enum(["once", "repeating", "forever"]).optional(),
          durationInMonths: z.number().int().positive().optional(),
          maxRedemptions: z.number().int().positive().optional().nullable(),
        })
        .refine((d) => !!(d.percentOff || d.amountOff), {
          message: "percentOff or amountOff required",
        });

      const body = schema.parse(req.body);
      const created = await createAmbassadorPromoCode(stripe, {
        ambassadorId: body.ambassadorId,
        code: body.code,
        percentOff: body.percentOff,
        amountOff: body.amountOff,
        duration: body.duration,
        durationInMonths: body.durationInMonths,
        maxRedemptions: body.maxRedemptions,
      });
      res.status(201).json({
        ...created,
        ...discountSummary(created),
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: err.errors });
      }
      const message = err?.message || "Failed to create promo code";
      if (
        message.includes("already exists") ||
        message.includes("Promo code must") ||
        message.includes("percentOff") ||
        message.includes("durationInMonths") ||
        message.includes("Ambassador not found")
      ) {
        return res.status(400).json({ error: message });
      }
      if (err?.code === "23505" || message.includes("duplicate")) {
        return res.status(409).json({ error: "Promo code already exists" });
      }
      console.error("Create promo code error:", err);
      res.status(500).json({ error: message });
    }
  });

  app.patch("/api/admin/promo-codes/:id", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid promo code id" });
      }
      const schema = z.object({
        active: z.boolean(),
      });
      const { active } = schema.parse(req.body);

      const [existing] = await db
        .select()
        .from(promoCodes)
        .where(eq(promoCodes.id, id))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: "Promo code not found" });
      }

      try {
        await stripe.promotionCodes.update(existing.stripePromotionCodeId, {
          active,
        });
      } catch (stripeErr) {
        console.error("Failed to update Stripe promotion code active flag:", stripeErr);
        return res.status(502).json({ error: "Failed to update Stripe promotion code" });
      }

      const [updated] = await db
        .update(promoCodes)
        .set({ active, updatedAt: new Date() })
        .where(eq(promoCodes.id, id))
        .returning();

      res.json({ ...updated, ...discountSummary(updated) });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: err.errors });
      }
      console.error("Update promo code error:", err);
      res.status(500).json({ error: "Failed to update promo code" });
    }
  });

  app.get("/api/admin/promo-codes/:id/stats", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid promo code id" });
      }
      const from = req.query.from ? new Date(String(req.query.from)) : undefined;
      const to = req.query.to ? new Date(String(req.query.to)) : undefined;
      const stats = await getPromoAttributionStats({
        promoCodeId: id,
        from: from && !Number.isNaN(from.getTime()) ? from : undefined,
        to: to && !Number.isNaN(to.getTime()) ? to : undefined,
      });
      res.json(stats);
    } catch (err) {
      console.error("Promo code stats error:", err);
      res.status(500).json({ error: "Failed to load promo code stats" });
    }
  });

  app.get("/api/admin/ambassadors/:id/stats", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid ambassador id" });
      }
      const from = req.query.from ? new Date(String(req.query.from)) : undefined;
      const to = req.query.to ? new Date(String(req.query.to)) : undefined;
      const stats = await getPromoAttributionStats({
        ambassadorId: id,
        from: from && !Number.isNaN(from.getTime()) ? from : undefined,
        to: to && !Number.isNaN(to.getTime()) ? to : undefined,
      });
      res.json(stats);
    } catch (err) {
      console.error("Ambassador stats error:", err);
      res.status(500).json({ error: "Failed to load ambassador stats" });
    }
  });

  app.get("/api/admin/promo-codes/:id/redemptions", async (req, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid promo code id" });
      }

      const rows = await db
        .select({
          id: promoRedemptions.id,
          userId: promoRedemptions.userId,
          username: users.username,
          email: users.email,
          subscriptionId: promoRedemptions.subscriptionId,
          checkoutSessionId: promoRedemptions.checkoutSessionId,
          codeSnapshot: promoRedemptions.codeSnapshot,
          redeemedAt: promoRedemptions.redeemedAt,
        })
        .from(promoRedemptions)
        .innerJoin(users, eq(promoRedemptions.userId, users.id))
        .where(eq(promoRedemptions.promoCodeId, id))
        .orderBy(desc(promoRedemptions.redeemedAt));

      res.json(rows);
    } catch (err) {
      console.error("List redemptions error:", err);
      res.status(500).json({ error: "Failed to list redemptions" });
    }
  });
}

export { normalizePromoCode, resolveActivePromoCode, applyPromoToCheckoutSession };
