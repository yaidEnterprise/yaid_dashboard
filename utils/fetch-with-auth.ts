export async function fetchWithAuth(
  url: RequestInfo | URL,
  options?: RequestInit
): Promise<Response> {
  const res = await fetch(url, options);

  if (res.status === 401 && typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = `/sign-in?next=${next}`;
    throw new Error("Session expired");
  }

  return res;
}
