import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, employeeId, role, phone, licenseNumber, email, password, isActive } = body;

  try {
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (employeeId !== undefined) data.employeeId = employeeId;
    if (role !== undefined) data.role = role;
    if (phone !== undefined) data.phone = phone || null;
    if (licenseNumber !== undefined) data.licenseNumber = licenseNumber || null;
    if (email !== undefined) data.email = email || null;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.password = await hash(password, 12);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, employeeId: true, name: true, role: true, phone: true, licenseNumber: true, email: true, isActive: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
