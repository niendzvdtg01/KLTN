export type AuthUser = { id: number; fullName: string; email: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    let message = "Có lỗi xảy ra. Vui lòng thử lại.";
    try {
      const body = await response.json();
      message = body.message ?? body.error ?? message;
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message);
  }
  return response;
}

export async function login(email: string, password: string) {
  await request("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function register(fullName: string, email: string, password: string) {
  await request("/v1/user/create_user", { method: "POST", body: JSON.stringify({ fullName, email, password }) });
}

export async function getCurrentUser() {
  const response = await request("/v1/user/me");
  return response.json() as Promise<AuthUser>;
}

export async function logout() {
  await request("/logout", { method: "POST" });
}
