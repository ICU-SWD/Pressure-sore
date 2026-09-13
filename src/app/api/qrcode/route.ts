import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";

// Renders a printable QR code (PNG) that links to a bed's check-in page.
// GET /api/qrcode?code=ICU-01
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const targetUrl = `${baseUrl}/bed/${encodeURIComponent(code)}/checkin`;

  const png = await QRCode.toBuffer(targetUrl, { width: 320, margin: 2 });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
