// Creates the first administrator account. Run once after migrating:
//   npm run db:seed
// Override the defaults with env vars so you don't ship a known password:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... ADMIN_NAME="Your Name" npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });

  const email = (process.env.ADMIN_EMAIL || "admin@nexamove.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const name = process.env.ADMIN_NAME || "NexaMove Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists — skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: { email, name, passwordHash, role: "ADMIN" },
  });

  console.log(`Created admin user: ${email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`Using default password "${password}" — sign in and change it immediately.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
