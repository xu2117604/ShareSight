import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });
  return Response.json({ user });
}
