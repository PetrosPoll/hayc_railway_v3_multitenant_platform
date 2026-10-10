import type { QueryClient } from "@tanstack/react-query";

/** Shared contact list key for a website (list + filtered campaign variants). */
export function contactsQueryKey(websiteProgressId: number) {
  return ["/api/contacts", websiteProgressId] as const;
}

/** Shared tags list key for a website. */
export function tagsQueryKey(websiteProgressId: number) {
  return ["/api/tags", websiteProgressId] as const;
}

export async function invalidateWebsiteContacts(
  queryClient: QueryClient,
  websiteProgressId: number,
) {
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const first = query.queryKey[0];
      if (typeof first !== "string") return false;
      if (first === `/api/contacts?websiteProgressId=${websiteProgressId}`) return true;
      if (first.startsWith("/api/contacts?") && first.includes(`websiteProgressId=${websiteProgressId}`)) {
        return true;
      }
      if (first !== "/api/contacts") return false;
      const second = query.queryKey[1];
      if (second === websiteProgressId) return true;
      if (
        second &&
        typeof second === "object" &&
        (second as { websiteProgressId?: number }).websiteProgressId === websiteProgressId
      ) {
        return true;
      }
      return false;
    },
  });
}

export async function invalidateWebsiteTags(
  queryClient: QueryClient,
  websiteProgressId: number,
) {
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const first = query.queryKey[0];
      if (typeof first !== "string") return false;
      if (first === `/api/tags?websiteProgressId=${websiteProgressId}`) return true;
      if (first === "/api/tags" && query.queryKey[1] === websiteProgressId) return true;
      return false;
    },
  });
}

/** After contact/tag edits — refresh contacts + tags across newsletter tabs. */
export async function invalidateNewsletterAudience(
  queryClient: QueryClient,
  websiteProgressId: number,
) {
  await Promise.all([
    invalidateWebsiteContacts(queryClient, websiteProgressId),
    invalidateWebsiteTags(queryClient, websiteProgressId),
  ]);
}
