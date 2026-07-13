import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ error: "密码至少4位" }, { status: 400 });
    }
    const existing = await prisma.user.findFirst({ where: { name: username } });
    if (existing) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name: username, password: hashedPassword },
    });
    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("[REGISTER_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
