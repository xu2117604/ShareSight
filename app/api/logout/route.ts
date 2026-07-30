export async function POST() {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": "zh_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure" } },
  );
}
