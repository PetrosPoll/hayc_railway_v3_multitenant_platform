import type { ImpersonationInfo } from "@/components/ui/authContext";

const STORAGE_KEY = "hayc_impersonation";

export function readStoredImpersonation(): ImpersonationInfo | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImpersonationInfo;
    return parsed?.active ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredImpersonation(impersonation: ImpersonationInfo | null): void {
  try {
    if (impersonation?.active) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(impersonation));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore quota / private mode errors
  }
}
