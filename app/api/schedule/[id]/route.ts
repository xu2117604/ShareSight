import { getSession } from "@/lib/auth";
import { ensureSchema, getBindings } from "@/lib/storage";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "日程编号不正确" }, { status: 400 });

  try {
    const { DB } = getBindings();
    await ensureSchema(DB);
    const note = await DB.prepare("SELECT id FROM schedule_notes WHERE id = ?").bind(id).first();
    if (!note) return Response.json({ error: "这条日程已经不存在" }, { status: 404 });
    await DB.prepare("DELETE FROM schedule_notes WHERE id = ?").bind(id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "删除日程失败" }, { status: 500 });
  }
}
