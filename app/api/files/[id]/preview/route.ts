import { getSession } from "@/lib/auth";
import { ensureSchema, getBindings } from "@/lib/storage";

function previewContentType(fileName: string, storedType: string) {
  if (/\.pdf$/i.test(fileName)) return "application/pdf";
  if (/\.txt$/i.test(fileName)) return "text/plain; charset=utf-8";
  if (/\.md$/i.test(fileName)) return "text/markdown; charset=utf-8";
  return storedType;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id } = await context.params;
  try {
    const { DB, FILES } = getBindings();
    await ensureSchema(DB);
    const file = await DB.prepare(
      "SELECT object_key AS objectKey, file_name AS fileName, content_type AS contentType FROM files WHERE id = ?",
    )
      .bind(id)
      .first<{ objectKey: string; fileName: string; contentType: string }>();
    if (!file) return Response.json({ error: "资料不存在" }, { status: 404 });
    if (!/\.(pdf|txt|md|pptx|docx|xlsx)$/i.test(file.fileName)) {
      return Response.json({ error: "此格式暂不支持在线预览" }, { status: 415 });
    }
    const object = await FILES.get(file.objectKey);
    if (!object) return Response.json({ error: "文件内容不存在" }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type": previewContentType(file.fileName, file.contentType),
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "预览失败" }, { status: 500 });
  }
}
