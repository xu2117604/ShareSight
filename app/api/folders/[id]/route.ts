import { getSession } from "@/lib/auth";
import { ensureSchema, getBindings } from "@/lib/storage";

const descendantsQuery = `WITH RECURSIVE descendants(id) AS (
  SELECT id FROM folders WHERE id = ?
  UNION ALL
  SELECT child.id FROM folders child
  JOIN descendants parent ON child.parent_id = parent.id
)`;

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "只有管理员可以删除文件夹" }, { status: 403 });
  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "文件夹位置不正确" }, { status: 400 });

  try {
    const { DB, FILES } = getBindings();
    await ensureSchema(DB);
    const folder = await DB.prepare("SELECT id FROM folders WHERE id = ?").bind(id).first();
    if (!folder) return Response.json({ error: "文件夹不存在" }, { status: 404 });

    const storedFiles = await DB.prepare(
      `${descendantsQuery}
      SELECT object_key AS objectKey FROM files
      WHERE folder IN (SELECT CAST(id AS TEXT) FROM descendants)`,
    )
      .bind(id)
      .all<{ objectKey: string }>();

    await DB.batch([
      DB.prepare(
        `${descendantsQuery}
        DELETE FROM files
        WHERE folder IN (SELECT CAST(id AS TEXT) FROM descendants)`,
      ).bind(id),
      DB.prepare(
        `${descendantsQuery}
        DELETE FROM folders WHERE id IN (SELECT id FROM descendants)`,
      ).bind(id),
    ]);

    const objectKeys = storedFiles.results.map((file) => file.objectKey);
    for (let index = 0; index < objectKeys.length; index += 1000) {
      await FILES.delete(objectKeys.slice(index, index + 1000));
    }
    return Response.json({ ok: true, deletedFiles: objectKeys.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "删除文件夹失败" }, { status: 500 });
  }
}
