import { getSession } from "@/lib/auth";
import { ensureSchema, getBindings } from "@/lib/storage";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id } = await context.params;
  const payload = (await request.json()) as { folderId?: number };
  const folderId = Number(payload.folderId);
  if (!Number.isInteger(folderId) || folderId < 0) {
    return Response.json({ error: "目标文件夹不正确" }, { status: 400 });
  }
  try {
    const { DB } = getBindings();
    await ensureSchema(DB);
    const file = await DB.prepare("SELECT uploader_phone AS uploaderPhone FROM files WHERE id = ?")
      .bind(id)
      .first<{ uploaderPhone: string }>();
    if (!file) return Response.json({ error: "资料不存在" }, { status: 404 });
    if (user.role !== "admin" && file.uploaderPhone !== user.phone) {
      return Response.json({ error: "只能移动自己上传的资料" }, { status: 403 });
    }
    if (folderId !== 0) {
      const targetFolder = await DB.prepare("SELECT id FROM folders WHERE id = ?").bind(folderId).first();
      if (!targetFolder) return Response.json({ error: "目标文件夹不存在" }, { status: 404 });
    }
    await DB.prepare("UPDATE files SET folder = ? WHERE id = ?").bind(String(folderId), id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "移动资料失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "只有管理员可以删除资料" }, { status: 403 });
  const { id } = await context.params;
  try {
    const { DB, FILES } = getBindings();
    await ensureSchema(DB);
    const file = await DB.prepare("SELECT object_key AS objectKey FROM files WHERE id = ?").bind(id).first<{ objectKey: string }>();
    if (!file) return Response.json({ error: "资料不存在" }, { status: 404 });
    await FILES.delete(file.objectKey);
    await DB.prepare("DELETE FROM files WHERE id = ?").bind(id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "删除失败" }, { status: 500 });
  }
}
