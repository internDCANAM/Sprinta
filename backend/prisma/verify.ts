import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { decrypt } from "../src/lib/crypto.js";

const prisma = new PrismaClient();

async function main() {
  const [users, customers, properties, deals, events, posts, costs, payments] =
    await Promise.all([
      prisma.user.count(),
      prisma.customer.count(),
      prisma.property.count(),
      prisma.deal.count(),
      prisma.dealEvent.count(),
      prisma.timberPost.count(),
      prisma.dealCost.count(),
      prisma.payment.count(),
    ]);

  console.log("📊 Radantal:");
  console.log(`   users:        ${users}`);
  console.log(`   customers:    ${customers}`);
  console.log(`   properties:   ${properties}`);
  console.log(`   deals:        ${deals}`);
  console.log(`   deal_events:  ${events}`);
  console.log(`   timber_posts: ${posts}`);
  console.log(`   deal_costs:   ${costs}`);
  console.log(`   payments:     ${payments}`);

  const customer = await prisma.customer.findFirst({
    include: { user: true, properties: true, deals: true },
  });
  if (customer) {
    console.log("\n👤 Kund:");
    console.log(`   ${customer.user.name} <${customer.user.email}>`);
    console.log(`   adress: ${customer.addressStreet}, ${customer.addressPostal} ${customer.addressCity}`);
    console.log(`   bankkonto (maskat): ${customer.bankAccountMasked}`);
    if (customer.personalIdEncrypted) {
      console.log(`   personnr (dekrypterat): ${decrypt(customer.personalIdEncrypted)}`);
    }
    if (customer.bankAccountEncrypted) {
      console.log(`   bankkonto (dekrypterat): ${decrypt(customer.bankAccountEncrypted)}`);
    }
    console.log(`   fastigheter: ${customer.properties.length}, affärer: ${customer.deals.length}`);
  }

  const dealsWithDetails = await prisma.deal.findMany({
    include: { events: true, timberPosts: true, costs: true, payments: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("\n📦 Affärer:");
  for (const d of dealsWithDetails) {
    console.log(
      `   ${d.externalId} — ${d.title} [${d.status}] ` +
        `events=${d.events.length} posts=${d.timberPosts.length} ` +
        `costs=${d.costs.length} payments=${d.payments.length}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
