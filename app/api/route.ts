import { getSession } from "@/lib/auth";
import { ensureSchema, getBindings } from "@/lib/storage";

type ScheduleNote = {
  id: number;
  date: string;
  content: string;
  createdByPhone: string;
  createdByName: string;
  createdAt: string;
};

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isValidDate(value: string) {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!monthPattern.test(month)) return Response.json({ error: "月份格式不正确" }, { status: 400 });

  try {
    const { DB } = getBindings();
    await ensureSchema(DB);
    const result = await DB.prepare(`SELECT
      id, note_date AS date, content,
      created_by_phone AS createdByPhone,
      created_by_name AS createdByName,
      created_at AS createdAt
      FROM schedule_notes
      WHERE note_date >= ? AND note_date < ?
      ORDER BY note_date ASC, created_at ASC`)
      .bind(`${month}-01`, `${nextMonth(month)}-01`)
      .all<ScheduleNote>();
    return Response.json({ notes: result.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "读取日程失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const payload = (await request.json()) as { date?: string; content?: string };
  const date = payload.date?.trim() ?? "";
  const content = payload.content?.trim().replace(/\s+/g, " ") ?? "";
  if (!isValidDate(date)) return Response.json({ error: "日期格式不正确" }, { status: 400 });
  if (!content || content.length > 200) {
    return Response.json({ error: "备注需要填写，且不能超过200个字" }, { status: 400 });
  }

  try {
    const { DB } = getBindings();
    await ensureSchema(DB);
    const createdAt = new Date().toISOString();
    const result = await DB.prepare(`INSERT INTO schedule_notes
      (note_date, content, created_by_phone, created_by_name, created_at)
      VALUES (?, ?, ?, ?, ?) RETURNING id`)
      .bind(date, content, user.phone, user.name, createdAt)
      .first<{ id: number }>();
    return Response.json({
      note: { id: result?.id, date, content, createdByPhone: user.phone, createdByName: user.name, createdAt },
    }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "添加日程失败" }, { status: 500 });
  }
}
