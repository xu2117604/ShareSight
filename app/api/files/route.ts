import { getSession } from "@/lib/auth";
import { ensureSchema, getBindings, type StoredFile } from "@/lib/storage";

const MAX_FILE_SIZE = 80 * 1024 * 1024;
const allowedExtensions = [
  ".ppt", ".pptx", ".pdf", ".doc", ".docx", ".txt", ".md",
  ".xlsx", ".xls", ".csv", ".zip", ".db", ".sqlite",
];

export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  try {
    const { DB } = getBindings();
    await ensureSchema(DB);
    const result = await DB.prepare(`SELECT
      id, object_key AS objectKey, title, file_name AS fileName, file_size AS fileSize,
      content_type AS contentType, category, folder, notes, uploader_phone AS uploaderPhone,
      uploader_name AS uploaderName, uploaded_at AS uploadedAt
      FROM files ORDER BY uploaded_at DESC`).all<StoredFile>();
    return Response.json({ files: result.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取资料失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const title = (url.searchParams.get("title") ?? "").trim();
    const category = url.searchParams.get("category") ?? "";
    const folder = url.searchParams.get("folder") ?? "0";
    const notes = (url.searchParams.get("notes") ?? "").trim().slice(0, 500);
    const fileName = (url.searchParams.get("fileName") ?? "").trim();
    const contentType = url.searchParams.get("contentType") ?? "application/octet-stream";
    const fileSize = Number(url.searchParams.get("fileSize") ?? "0");
    const declaredSize = Number(request.headers.get("content-length") ?? "0");
    if (!title || !fileName || !request.body || !Number.isFinite(fileSize) || fileSize <= 0) return Response.json({ error: "请填写标题并选择文件" }, { status: 400 });
    if (!["journal", "presentation", "document"].includes(category)) return Response.json({ error: "资料类型不正确" }, { status: 400 });
    const folderId = Number(folder);
    if (!Number.isInteger(folderId) || folderId < 0) return Response.json({ error: "保存位置不正确" }, { status: 400 });
    if (fileSize > MAX_FILE_SIZE || declaredSize > MAX_FILE_SIZE) return Response.json({ error: "文件不能超过 80MB" }, { status: 400 });
    if (declaredSize > 0 && declaredSize !== fileSize) return Response.json({ error: "文件大小校验失败，请重新选择文件" }, { status: 400 });
    const extension = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
    if (!allowedExtensions.includes(extension)) return Response.json({ error: "暂不支持这种文件格式" }, { status: 400 });

    const { DB, FILES } = getBindings();
    await ensureSchema(DB);
    if (folderId !== 0) {
      const targetFolder = await DB.prepare("SELECT id FROM folders WHERE id = ?").bind(folderId).first();
      if (!targetFolder) return Response.json({ error: "要保存的文件夹不存在" }, { status: 404 });
    }
    const objectKey = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${fileName.replace(/[^\w.\-\u4e00-\u9fff]/g, "_")}`;
    await FILES.put(objectKey, request.body, { httpMetadata: { contentType } });
    try {
      await DB.prepare(`INSERT INTO files
        (object_key, title, file_name, file_size, content_type, category, folder, notes, uploader_phone, uploader_name, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(objectKey, title.slice(0, 100), fileName, fileSize, contentType, category, folder, notes, user.phone, user.name, new Date().toISOString())
        .run();
    } catch (error) {
      await FILES.delete(objectKey);
      throw error;
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "上传失败" }, { status: 500 });
  }
}
