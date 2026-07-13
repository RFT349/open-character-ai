import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.name !== "349380pp") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { credits, count } = await req.json();
    const c = credits || 200;
    const n = Math.min(count || 5, 20);
    const codes = [];
    for (let i = 0; i < n; i++) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let j = 0; j < 8; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const rc = await prisma.redeemCode.create({ data: { code, credits: c } });
      codes.push(rc.code);
    }
    return NextResponse.json({ codes, credits: c });
  } catch (error) {
    console.error("[REDEEM_GENERATE_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
