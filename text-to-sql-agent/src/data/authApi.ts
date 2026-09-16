import { request } from "./http";

export type AuthUser = { id: number; fullName: string; email: string };

export async function login(email: string, password: string) {
  await request<void>("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function register(fullName: string, email: string, password: string) {
  await request<void>("/v1/user/create_user", { method: "POST", body: JSON.stringify({ fullName, email, password }) });
}

export async function getCurrentUser() {
  return request<AuthUser>("/v1/user/me");
}

export async function logout() {
  await request<void>("/logout", { method: "POST" });
}
