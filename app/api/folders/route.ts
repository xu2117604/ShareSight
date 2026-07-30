import { getSession } from "@/lib/auth";
import { ensureSchema, getBindings } from "@/lib/storage";

function parseParentId(value: unknown) {
  const parentId = Number(value ?? 0);
  return Number.isInteger(parentId) && parentId >= 0 ? parentId : null;
}

export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const parentId = parseParentId(new URL(request.url).searchParams.get("parentId"));
  if (parentId === null) return Response.json({ error: "目录位置不正确" }, { status: 400 });
  try {
    const { DB } = getBindings();
    await ensureSchema(DB);
    const result = await DB.prepare(`SELECT
      f.id, f.parent_id AS parentId, f.name,
      COALESCE((SELECT name FROM users creator WHERE creator.phone = f.created_by), '组员') AS createdBy,
      f.created_at AS createdAt,
      (SELECT COUNT(*) FROM folders child WHERE child.parent_id = f.id) AS subfolderCount,
      (SELECT COUNT(*) FROM files item WHERE item.folder = CAST(f.id AS TEXT)) AS fileCount
      FROM folders f WHERE f.parent_id = ? ORDER BY f.created_at ASC, f.name ASC`)
      .bind(parentId)
      .all<{
        id: number;
        parentId: number;
        name: string;
        createdBy: string;
        createdAt: string;
        subfolderCount: number;
        fileCount: number;
      }>();
    return Response.json({ folders: result.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取文件夹失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const payload = (await request.json()) as { name?: string; parentId?: number | null };
  const name = payload.name?.trim().replace(/\s+/g, " ") ?? "";
  const parentId = parseParentId(payload.parentId);
  if (!name || name.length > 50) return Response.json({ error: "文件夹名称需要填写，且不能超过50个字" }, { status: 400 });
  if (/[\\/:*?"<>|]/.test(name)) return Response.json({ error: "文件夹名称不能包含 \\ / : * ? \" < > |" }, { status: 400 });
  if (parentId === null) return Response.json({ error: "目录位置不正确" }, { status: 400 });
  try {
    const { DB } = getBindings();
    await ensureSchema(DB);
    if (parentId !== 0) {
      const parent = await DB.prepare("SELECT id FROM folders WHERE id = ?").bind(parentId).first();
      if (!parent) return Response.json({ error: "上级文件夹不存在" }, { status: 404 });
    }
    const result = await DB.prepare(
      "INSERT INTO folders (parent_id, name, created_by, created_at) VALUES (?, ?, ?, ?) RETURNING id",
    )
      .bind(parentId, name, user.phone, new Date().toISOString())
      .first<{ id: number }>();
    return Response.json({ folder: { id: result?.id, parentId, name, fileCount: 0, subfolderCount: 0 } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") || message.includes("unique")) {
      return Response.json({ error: "当前目录中已经有同名文件夹" }, { status: 409 });
    }
    return Response.json({ error: message || "新建文件夹失败" }, { status: 500 });
  }
}
