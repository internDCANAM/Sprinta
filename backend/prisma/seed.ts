import "dotenv/config";
import { Locale } from "./generated/prisma/client.js";
import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";

const BCRYPT_COST = 12;

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to run the admin bootstrap seed.",
    );
  }

  console.log("Bootstrapping admin user...");

  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_COST);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {},
    create: {
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: "ADMIN",
      name: "Admin",
      isActive: true,
      locale: Locale.EN,
    },
  });

  console.log(`Admin ready: ${admin.email} (${admin.id})`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
