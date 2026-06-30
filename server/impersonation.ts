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
    impersonationStopToken?: string;
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

  const stopToken = getStopTokenForSession(sessionId, req.session);
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

function rememberImpersonationRecord(
  sessionId: string,
  record: ImpersonationRecord,
  session?: Request["session"],
): void {
  impersonationsByToken.set(record.stopToken, record);
  impersonationsBySession.set(sessionId, record.stopToken);
  if (session) {
    session.impersonationStopToken = record.stopToken;
  }
}

export function registerImpersonation(
  sessionId: string,
  adminId: number,
  userId: number,
  session?: Request["session"],
): string {
  clearImpersonation(sessionId, session?.impersonationStopToken, session);

  const stopToken = randomBytes(32).toString("hex");
  rememberImpersonationRecord(
    sessionId,
    { adminId, userId, stopToken },
    session,
  );
  return stopToken;
}

export function getStopTokenForSession(
  sessionId: string,
  session?: Request["session"],
): string | undefined {
  if (session?.impersonationStopToken) {
    return session.impersonationStopToken;
  }
  return impersonationsBySession.get(sessionId);
}

function syncImpersonationMapsFromSession(
  req: Request,
  adminId: number,
  userId: number,
  stopToken: string,
): void {
  if (!req.sessionID) return;
  rememberImpersonationRecord(
    req.sessionID,
    { adminId, userId, stopToken },
    req.session,
  );
}

export async function resolveImpersonationForRequest(
  req: Request,
  getUserById: (id: number) => Promise<SelectUser | undefined>,
): Promise<ImpersonationInfo | null> {
  const adminId = getImpersonationAdminId(req);
  if (!adminId || !req.user?.id || !req.sessionID) return null;

  const adminUser = await getUserById(adminId);
  if (!adminUser) return null;

  let stopToken = getStopTokenForSession(req.sessionID, req.session);
  if (!stopToken) {
    stopToken = registerImpersonation(
      req.sessionID,
      adminId,
      req.user.id,
      req.session,
    );
  } else {
    syncImpersonationMapsFromSession(req, adminId, req.user.id, stopToken);
  }

  return buildImpersonationInfo(adminUser, stopToken);
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
      const sessionToken = getStopTokenForSession(sessionId, req.session);
      if (sessionToken) {
        const sessionRecord = impersonationsByToken.get(sessionToken);
        if (sessionRecord && sessionRecord.userId === req.user.id) {
          return sessionRecord;
        }
        if (sessionRecord) return sessionRecord;
        return {
          adminId: fromPassportAdminId,
          userId: req.user.id,
          stopToken: sessionToken,
        };
      }
    }

    return {
      adminId: fromPassportAdminId,
      userId: req.user.id,
      stopToken: stopToken ?? req.session?.impersonationStopToken ?? "",
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
    const sessionToken = getStopTokenForSession(sessionId, req.session);
    if (sessionToken) {
      const record = impersonationsByToken.get(sessionToken);
      if (record && record.userId === req.user?.id) {
        return record;
      }
    }
  }

  return undefined;
}

export function clearImpersonation(
  sessionId?: string,
  stopToken?: string,
  session?: Request["session"],
): void {
  if (stopToken) {
    impersonationsByToken.delete(stopToken);
  }

  if (session) {
    delete session.impersonationStopToken;
  }

  if (!sessionId) return;

  const token = impersonationsBySession.get(sessionId) ?? stopToken;
  impersonationsBySession.delete(sessionId);
  if (token) {
    impersonationsByToken.delete(token);
  }
}

export async function saveSession(req: Request): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.save((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}
