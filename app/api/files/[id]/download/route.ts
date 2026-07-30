import { getSession } from "@/lib/auth";
import { ensureSchema, getBindings } from "@/lib/storage";

function safeFileName(value: string) {
  return encodeURIComponent(value).replaceAll("'", "%27");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const { id } = await context.params;
  try {
    const { DB, FILES } = getBindings();
    await ensureSchema(DB);
    const file = await DB.prepare("SELECT object_key AS objectKey, file_name AS fileName, content_type AS contentType FROM files WHERE id = ?")
      .bind(id)
      .first<{ objectKey: string; fileName: string; contentType: string }>();
    if (!file) return Response.json({ error: "资料不存在" }, { status: 404 });
    const object = await FILES.get(file.objectKey);
    if (!object) return Response.json({ error: "文件内容不存在" }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${safeFileName(file.fileName)}`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "下载失败" }, { status: 500 });
  }
}
