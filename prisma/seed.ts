import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await hash("admin123", 12);
  const driverPassword = await hash("driver123", 12);
  const managerPassword = await hash("manager123", 12);

  const admin = await prisma.user.upsert({
    where: { employeeId: "ADMIN001" },
    update: {},
    create: {
      employeeId: "ADMIN001",
      name: "管理者",
      email: "admin@example.com",
      password: adminPassword,
      role: "ADMIN",
      phone: "090-0000-0000",
    },
  });

  const manager = await prisma.user.upsert({
    where: { employeeId: "MGR001" },
    update: {},
    create: {
      employeeId: "MGR001",
      name: "運行管理者 田中",
      password: managerPassword,
      role: "MANAGER",
      phone: "090-9999-9999",
    },
  });

  const driver1 = await prisma.user.upsert({
    where: { employeeId: "DRV001" },
    update: {},
    create: {
      employeeId: "DRV001",
      name: "山田 太郎",
      password: driverPassword,
      role: "DRIVER",
      phone: "090-1111-1111",
      licenseNumber: "大型 第12345号",
    },
  });

  const driver2 = await prisma.user.upsert({
    where: { employeeId: "DRV002" },
    update: {},
    create: {
      employeeId: "DRV002",
      name: "佐藤 次郎",
      password: driverPassword,
      role: "DRIVER",
      phone: "090-2222-2222",
      licenseNumber: "大型 第67890号",
    },
  });

  // デフォルト設定
  const settings = [
    { key: "CLOSING_DAY", value: "10" },
    { key: "DEFAULT_BREAK_HOURS", value: "1.0" },
    { key: "DEFAULT_CATEGORY", value: "WORK1" },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  console.log("シードデータを作成しました:");
  console.log(`  管理者: ${admin.name} (${admin.employeeId}) / admin123`);
  console.log(`  運行管理者: ${manager.name} (${manager.employeeId}) / manager123`);
  console.log(`  運転手1: ${driver1.name} (${driver1.employeeId}) / driver123`);
  console.log(`  運転手2: ${driver2.name} (${driver2.employeeId}) / driver123`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
