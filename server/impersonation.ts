import { randomBytes } from "crypto";
import type { Request } from "express";
import type { User as SelectUser } from "@shared/schema";

export interface ImpersonationInfo {
  active: boolean;
  adminId: number;
  adminUsername: string;
  adminEmail: string;
  stopToken: string;
}

export type PassportSessionUser =
  | number
  | { id: number; impersonatedBy: number };

export type UserWithImpersonation = SelectUser & {
  __impersonatedBy?: number;
};

interface ImpersonationRecord {
  adminId: number;
  userId: number;
  stopToken: string;
}

declare module "express-session" {
  interface SessionData {
    passport?: {
      user?: PassportSessionUser;
    };
  }
}

const impersonationsByToken = new Map<string, ImpersonationRecord>();
const impersonationsBySession = new Map<string, string>();

function getFromPassportSession(req: Request): number | undefined {
  const sessionUser = req.session?.passport?.user;
  if (
    sessionUser &&
    typeof sessionUser === "object" &&
    typeof sessionUser.impersonatedBy === "number"
  ) {
    return sessionUser.impersonatedBy;
  }
  return undefined;
}

export function getImpersonationAdminId(req: Request): number | undefined {
  const fromPassport = getFromPassportSession(req);
  if (fromPassport) return fromPassport;

  const sessionId = req.sessionID;
  if (!sessionId) return undefined;

  const stopToken = impersonationsBySession.get(sessionId);
  if (!stopToken) return undefined;

  return impersonationsByToken.get(stopToken)?.adminId;
}

export function isImpersonating(req: Request): boolean {
  return getImpersonationAdminId(req) !== undefined;
}

export function buildImpersonationInfo(
  adminUser: { id: number; username: string; email: string },
  stopToken: string,
): ImpersonationInfo {
  return {
    active: true,
    adminId: adminUser.id,
    adminUsername: adminUser.username,
    adminEmail: adminUser.email,
    stopToken,
  };
}

export function userForImpersonationLogin(
  targetUser: SelectUser,
  adminId: number,
): UserWithImpersonation {
  return { ...targetUser, __impersonatedBy: adminId };
}

export function registerImpersonation(
  sessionId: string,
  adminId: number,
  userId: number,
): string {
  clearImpersonation(sessionId);

  const stopToken = randomBytes(32).toString("hex");
  impersonationsByToken.set(stopToken, { adminId, userId, stopToken });
  impersonationsBySession.set(sessionId, stopToken);
  return stopToken;
}

export function resolveImpersonationForStop(
  req: Request,
  stopToken?: string,
): ImpersonationRecord | undefined {
  const fromPassportAdminId = getFromPassportSession(req);
  if (fromPassportAdminId && req.user?.id) {
    const record = stopToken ? impersonationsByToken.get(stopToken) : undefined;
    if (record && record.adminId === fromPassportAdminId && record.userId === req.user.id) {
      return record;
    }

    const sessionId = req.sessionID;
    if (sessionId) {
      const sessionToken = impersonationsBySession.get(sessionId);
      if (sessionToken) {
        const sessionRecord = impersonationsByToken.get(sessionToken);
        if (sessionRecord && sessionRecord.userId === req.user.id) {
          return sessionRecord;
        }
      }
    }

    return {
      adminId: fromPassportAdminId,
      userId: req.user.id,
      stopToken: stopToken ?? "",
    };
  }

  if (stopToken) {
    const record = impersonationsByToken.get(stopToken);
    if (record && record.userId === req.user?.id) {
      return record;
    }
  }

  const sessionId = req.sessionID;
  if (sessionId) {
    const sessionToken = impersonationsBySession.get(sessionId);
    if (sessionToken) {
      const record = impersonationsByToken.get(sessionToken);
      if (record && record.userId === req.user?.id) {
        return record;
      }
    }
  }

  return undefined;
}

export function getStopTokenForSession(sessionId: string): string | undefined {
  return impersonationsBySession.get(sessionId);
}

export function clearImpersonation(sessionId?: string, stopToken?: string): void {
  if (stopToken) {
    impersonationsByToken.delete(stopToken);
  }

  if (!sessionId) return;

  const token = impersonationsBySession.get(sessionId);
  impersonationsBySession.delete(sessionId);
  if (token) {
    impersonationsByToken.delete(token);
  }
}
