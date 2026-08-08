export interface UserRegister {
  email: string;
  password: string;
  username: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
}

export interface UserResponse {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
}

export const AUTH_TOKEN_KEY = "omnisite_auth_token";
export const AUTH_USER_KEY = "omnisite_auth_user";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export function getAuthUser(): UserResponse | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem(AUTH_USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setAuthUser(user: UserResponse | null) {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
}
