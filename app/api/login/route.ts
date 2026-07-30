import { authenticate, createSession, sessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { phone?: string; password?: string };
  const user = await authenticate(body.phone?.trim() ?? "", body.password ?? "");
  if (!user) return Response.json({ error: "手机号或密码不正确" }, { status: 401 });
  const token = await createSession(user);
  return Response.json({ user }, { headers: { "Set-Cookie": sessionCookie(token) } });
}
