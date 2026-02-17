
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import i18n from '../i18n'; // Import i18n module

// Debug current language
console.log('Current i18n language in queryClient:', i18n.language);

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage;
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || res.statusText;
    } catch {
      errorMessage = res.statusText;
    }
    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`Making ${method} request to ${url}`, { data });
  
  // Always fetch the current language right before making the request
  const currentLanguage = i18n.language || 'en';
  console.log(`Setting Accept-Language header to: ${currentLanguage}`);

  const res = await fetch(url, {
    method,
    headers: { 
      "Content-Type": "application/json",
      "Accept-Language": currentLanguage
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Always fetch the current language right before making the request
    const currentLanguage = i18n.language || 'en';
    console.log(`Setting Accept-Language header to: ${currentLanguage} for query`);
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: {
        "Accept-Language": currentLanguage,
        "Content-Type": "application/json"
      }
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
