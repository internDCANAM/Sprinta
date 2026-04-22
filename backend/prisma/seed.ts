import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { encrypt, maskBankAccount } from "../src/lib/crypto.js";

const prisma = new PrismaClient();
const BCRYPT_COST = 12;

async function main() {
  console.log("🌱 Startar seed...");

  // --- Admin-användare ---
  const adminPasswordHash = await bcrypt.hash("Admin123!", BCRYPT_COST);
  const admin = await prisma.user.upsert({
    where: { email: "admin@skogsbo.se" },
    update: {},
    create: {
      email: "admin@skogsbo.se",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      name: "Anna Admin",
      isActive: true,
    },
  });
  console.log(`  ✓ Admin: ${admin.email} (${admin.id})`);

  // --- Kund-användare ---
  const customerPasswordHash = await bcrypt.hash("Skog123!", BCRYPT_COST);
  const customerUser = await prisma.user.upsert({
    where: { email: "klas@example.se" },
    update: {},
    create: {
      email: "klas@example.se",
      passwordHash: customerPasswordHash,
      role: "CUSTOMER",
      name: "Klas Åkerskog",
      isActive: true,
    },
  });
  console.log(`  ✓ Kund-användare: ${customerUser.email} (${customerUser.id})`);

  // --- Kundprofil med krypterat personnummer + bankkonto ---
  const personalId = "19700515-1234";
  const bankAccount = "6789-1234567890";
  const customer = await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: {},
    create: {
      userId: customerUser.id,
      personalIdEncrypted: encrypt(personalId),
      addressStreet: "Skogsvägen 12",
      addressPostal: "73010",
      addressCity: "Ramsberg",
      phone: "+46701234567",
      bankAccountMasked: maskBankAccount(bankAccount),
      bankAccountEncrypted: encrypt(bankAccount),
      bankAccountUpdatedAt: new Date(),
    },
  });
  console.log(`  ✓ Kundprofil: ${customer.id}`);

  // --- Fastighet ---
  const property = await prisma.property.create({
    data: {
      customerId: customer.id,
      name: "Granliden 1:4",
      cadastralId: "LINDESBERG GRANLIDEN 1:4",
      municipality: "Lindesberg",
      areaHa: new Prisma.Decimal("42.75"),
      geojson: {
        type: "Polygon",
        coordinates: [
          [
            [15.201, 59.612],
            [15.215, 59.612],
            [15.215, 59.620],
            [15.201, 59.620],
            [15.201, 59.612],
          ],
        ],
      },
    },
  });
  console.log(`  ✓ Fastighet: ${property.name} (${property.id})`);

  // --- Affär 1: PÅGÅENDE (gallring) ---
  const dealOngoing = await prisma.deal.create({
    data: {
      customerId: customer.id,
      propertyId: property.id,
      externalId: "SB-2026-0001",
      title: "Gallring Granliden östra",
      dealType: "GALLRING",
      status: "PAGAENDE",
      estimatedGrossSek: new Prisma.Decimal("185000.00"),
      totalCostsSek: new Prisma.Decimal("12500.00"),
      assignedAdminId: admin.id,
      syncedAt: new Date(),
      events: {
        create: [
          {
            eventType: "AVTAL_SIGNERAT",
            label: "Avtal signerat",
            plannedDate: new Date("2026-02-01"),
            actualDate: new Date("2026-02-03"),
            note: "Signerat digitalt via BankID.",
            createdBy: admin.id,
          },
          {
            eventType: "AVVERKNING_START",
            label: "Avverkning påbörjad",
            plannedDate: new Date("2026-04-10"),
            actualDate: new Date("2026-04-12"),
            createdBy: admin.id,
          },
          {
            eventType: "AVVERKNING_SLUT",
            label: "Avverkning avslutas",
            plannedDate: new Date("2026-05-05"),
            createdBy: admin.id,
          },
        ],
      },
      timberPosts: {
        create: [
          {
            assortment: "Tallmassaved",
            volumeM3: new Prisma.Decimal("120.500"),
            pricePerM3Sek: new Prisma.Decimal("380.00"),
            grossSek: new Prisma.Decimal("45790.00"),
            measurementSource: "STANFORD/SDC",
          },
          {
            assortment: "Grantimmer",
            volumeM3: new Prisma.Decimal("80.250"),
            pricePerM3Sek: new Prisma.Decimal("650.00"),
            grossSek: new Prisma.Decimal("52162.50"),
            measurementSource: "STANFORD/SDC",
          },
        ],
      },
      costs: {
        create: [
          {
            costType: "Avverkningskostnad",
            amountSek: new Prisma.Decimal("9500.00"),
            note: "Entreprenör Nordskog AB",
          },
          {
            costType: "Vägunderhåll",
            amountSek: new Prisma.Decimal("3000.00"),
          },
        ],
      },
    },
  });
  console.log(`  ✓ Affär (pågående): ${dealOngoing.externalId}`);

  // --- Affär 2: AVSLUTAD (slutavverkning) ---
  const dealClosed = await prisma.deal.create({
    data: {
      customerId: customer.id,
      propertyId: property.id,
      externalId: "SB-2025-0042",
      title: "Slutavverkning Granliden västra",
      dealType: "SLUTAVVERKNING",
      status: "AVSLUTAD",
      estimatedGrossSek: new Prisma.Decimal("520000.00"),
      finalGrossSek: new Prisma.Decimal("548320.00"),
      totalCostsSek: new Prisma.Decimal("68000.00"),
      assignedAdminId: admin.id,
      syncedAt: new Date("2025-11-20"),
      events: {
        create: [
          {
            eventType: "AVTAL_SIGNERAT",
            label: "Avtal signerat",
            plannedDate: new Date("2025-06-15"),
            actualDate: new Date("2025-06-15"),
            createdBy: admin.id,
          },
          {
            eventType: "AVVERKNING_START",
            label: "Avverkning påbörjad",
            plannedDate: new Date("2025-09-01"),
            actualDate: new Date("2025-09-03"),
            createdBy: admin.id,
          },
          {
            eventType: "AVVERKNING_SLUT",
            label: "Avverkning avslutad",
            plannedDate: new Date("2025-10-15"),
            actualDate: new Date("2025-10-18"),
            createdBy: admin.id,
          },
          {
            eventType: "MATBESKED",
            label: "Mätbesked inkommit",
            actualDate: new Date("2025-11-02"),
            note: "Slutlig volym enligt VMF.",
            createdBy: admin.id,
          },
          {
            eventType: "UTBETALNING",
            label: "Slutlikvid utbetald",
            actualDate: new Date("2025-11-20"),
            createdBy: admin.id,
          },
        ],
      },
      timberPosts: {
        create: [
          {
            assortment: "Grantimmer",
            volumeM3: new Prisma.Decimal("640.000"),
            pricePerM3Sek: new Prisma.Decimal("680.00"),
            grossSek: new Prisma.Decimal("435200.00"),
            measurementSource: "VMF",
          },
          {
            assortment: "Talltimmer",
            volumeM3: new Prisma.Decimal("180.000"),
            pricePerM3Sek: new Prisma.Decimal("620.00"),
            grossSek: new Prisma.Decimal("111600.00"),
            measurementSource: "VMF",
          },
          {
            assortment: "Energived",
            volumeM3: new Prisma.Decimal("35.000"),
            pricePerM3Sek: new Prisma.Decimal("44.00"),
            grossSek: new Prisma.Decimal("1540.00"),
            measurementSource: "VMF",
          },
        ],
      },
      costs: {
        create: [
          {
            costType: "Avverkningskostnad",
            amountSek: new Prisma.Decimal("52000.00"),
            note: "Entreprenör Nordskog AB",
          },
          {
            costType: "Transport",
            amountSek: new Prisma.Decimal("12000.00"),
          },
          {
            costType: "Skogsvårdsavgift",
            amountSek: new Prisma.Decimal("4000.00"),
          },
        ],
      },
      payments: {
        create: [
          {
            customerId: customer.id,
            amountSek: new Prisma.Decimal("480320.00"),
            paymentDate: new Date("2025-11-20"),
            status: "GENOMFORD",
            reference: "SB-2025-0042 slutlikvid",
            bankAccountMasked: maskBankAccount(bankAccount),
            externalPaymentId: "PAY-2025-11-20-0042",
          },
        ],
      },
    },
  });
  console.log(`  ✓ Affär (avslutad): ${dealClosed.externalId}`);

  console.log("✅ Seed klar.");
}

main()
  .catch((err) => {
    console.error("❌ Seed misslyckades:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
