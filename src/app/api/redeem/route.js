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
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "兑换码不能为空" }, { status: 400 });
    }
    const redeemCode = await prisma.redeemCode.findUnique({ where: { code } });
    if (!redeemCode) {
      return NextResponse.json({ error: "兑换码不存在" }, { status: 404 });
    }
    if (redeemCode.used) {
      return NextResponse.json({ error: "兑换码已使用" }, { status: 400 });
    }
    await prisma.redeemCode.update({
      where: { code },
      data: { used: true, usedBy: session.user.id, usedAt: new Date() },
    });
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { credits: { increment: redeemCode.credits } },
    });
    return NextResponse.json({ success: true, creditsAdded: redeemCode.credits, totalCredits: updatedUser.credits });
  } catch (error) {
    console.error("[REDEEM_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
