import { env } from "cloudflare:workers";
import { ensureSchema, getBindings } from "./storage";

export type AppUser = {
  phone: string;
  name: string;
  role: "admin" | "member";
};

type DemoUser = AppUser & { password: string };

const DEMO_USERS: DemoUser[] = [
  { phone: "13800000001", password: "Admin123!", name: "管理员一", role: "admin" },
  { phone: "13800000002", password: "Admin123!", name: "管理员二", role: "admin" },
  { phone: "13900000000", password: "Member123!", name: "组会成员", role: "member" },
];

const encoder = new TextEncoder();

function encode(value: string) {
  const bytes = encoder.encode(value);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function sign(value: string) {
  const bindings = env as unknown as { SESSION_SECRET?: string };
  const secret = bindings.SESSION_SECRET ?? "local-preview-only-secret";
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return encode(String.fromCharCode(...new Uint8Array(signature)));
}

async function derivePassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 120_000 },
    key,
    256,
  );
  return encode(String.fromCharCode(...new Uint8Array(bits)));
}

export async function hashPassword(password: string) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = encode(String.fromCharCode(...saltBytes));
  return `${salt}.${await derivePassword(password, salt)}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(".");
  if (!salt || !expected) return false;
  const actual = await derivePassword(password, salt);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

export function isReservedPhone(phone: string) {
  return DEMO_USERS.some((user) => user.phone === phone);
}

export function demoMembers(): AppUser[] {
  return DEMO_USERS.map(({ phone, name, role }) => ({ phone, name, role }));
}

export async function authenticate(phone: string, password: string): Promise<AppUser | null> {
  const match = DEMO_USERS.find((user) => user.phone === phone && user.password === password);
  if (match) return { phone: match.phone, name: match.name, role: match.role };
  const { DB } = getBindings();
  await ensureSchema(DB);
  const registered = await DB.prepare("SELECT phone, name, role, password_hash AS passwordHash FROM users WHERE phone = ?")
    .bind(phone)
    .first<AppUser & { passwordHash: string }>();
  if (!registered || !(await verifyPassword(password, registered.passwordHash))) return null;
  return { phone: registered.phone, name: registered.name, role: registered.role };
}

export async function createSession(user: AppUser) {
  const payload = encode(JSON.stringify({ ...user, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 }));
  return `${payload}.${await sign(payload)}`;
}

export async function getSession(request: Request): Promise<AppUser | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("zh_session="))?.slice(11);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || (await sign(payload)) !== signature) return null;
  try {
    const parsed = JSON.parse(decode(payload)) as AppUser & { expiresAt: number };
    if (parsed.expiresAt < Date.now()) return null;
    return { phone: parsed.phone, name: parsed.name, role: parsed.role };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  return `zh_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800; Secure`;
}
