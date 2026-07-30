import { createSession, hashPassword, isReservedPhone, sessionCookie } from "@/lib/auth";
import { ensureSchema, getBindings } from "@/lib/storage";

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; phone?: string; password?: string };
  const name = body.name?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";
  const password = body.password ?? "";
  if (name.length < 2 || name.length > 20) return Response.json({ error: "姓名请填写 2—20 个字" }, { status: 400 });
  if (!/^1\d{10}$/.test(phone)) return Response.json({ error: "请输入正确的 11 位手机号" }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "密码至少需要 8 位" }, { status: 400 });
  if (isReservedPhone(phone)) return Response.json({ error: "这个手机号已经登记，请直接登录" }, { status: 409 });

  try {
    const { DB } = getBindings();
    await ensureSchema(DB);
    const existing = await DB.prepare("SELECT id FROM users WHERE phone = ?").bind(phone).first();
    if (existing) return Response.json({ error: "这个手机号已经注册，请直接登录" }, { status: 409 });
    const passwordHash = await hashPassword(password);
    await DB.prepare("INSERT INTO users (phone, name, password_hash, role, created_at) VALUES (?, ?, ?, 'member', ?)")
      .bind(phone, name, passwordHash, new Date().toISOString())
      .run();
    const user = { phone, name, role: "member" as const };
    const token = await createSession(user);
    return Response.json({ user }, { status: 201, headers: { "Set-Cookie": sessionCookie(token) } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "注册失败" }, { status: 500 });
  }
}
