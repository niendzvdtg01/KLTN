const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    let message = "Có lỗi xảy ra. Vui lòng thử lại.";
    if (contentType.includes("application/json")) {
      const body = await response.json() as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } else {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? response.json() as Promise<T> : undefined as T;
}
