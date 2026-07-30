import { demoMembers, getSession } from "@/lib/auth";
import { ensureSchema, getBindings } from "@/lib/storage";

function maskPhone(phone: string) {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  try {
    const { DB } = getBindings();
    await ensureSchema(DB);
    const registered = await DB.prepare("SELECT name, phone, role FROM users ORDER BY created_at ASC LIMIT 30")
      .all<{ name: string; phone: string; role: "admin" | "member" }>();
    const members = [
      ...demoMembers(),
      ...registered.results,
    ].map((member) => ({ ...member, phone: maskPhone(member.phone) }));
    return Response.json({ total: members.length, members });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取成员信息失败" }, { status: 500 });
  }
}
