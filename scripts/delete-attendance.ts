import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const employeeId = "1003";

  const user = await prisma.user.findUnique({
    where: { employeeId },
    include: { attendances: true },
  });

  if (!user) {
    console.error(`社員番号 ${employeeId} のユーザーが見つかりません。`);
    process.exit(1);
  }

  const count = await prisma.attendance.deleteMany({
    where: { userId: user.id },
  });

  console.log(`社員番号 ${employeeId} (${user.name}) の勤怠データを ${count.count} 件削除しました。`);
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
