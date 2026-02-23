import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options: {
    method: string;
    body?: string;
  } = { method: "GET" },
): Promise<Response> {
  const res = await fetch(url, {
    method: options.method,
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body,
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
    const baseUrl = queryKey[0] as string;
    const hasObject = queryKey.length > 1 && typeof queryKey[1] === "object";

    let url = baseUrl;
    if (hasObject) {
      const params = new URLSearchParams();
      const obj = queryKey[1] as Record<string, any>;
      Object.entries(obj).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, value.toString());
        }
      });
      const queryString = params.toString();
      if (queryString) {
        url += (url.includes("?") ? "&" : "?") + queryString;
      }
    } else if (queryKey.length > 1) {
      url = queryKey.join("/");
    }

    const res = await fetch(url, {
      credentials: "include",
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
