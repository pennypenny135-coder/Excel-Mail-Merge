// 僅供部署平台健康檢查使用；不處理、不儲存任何用戶資料。
export const dynamic = "force-static";

export function GET() {
  return Response.json({ ok: true });
}
