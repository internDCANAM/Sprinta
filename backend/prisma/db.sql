-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'sv');

-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('REGENERATION_FELLING', 'THINNING', 'ENERGY_WOOD', 'MISC');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('PLANNED', 'ONGOING', 'COMPLETED', 'INVOICED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DealEventType" AS ENUM ('DEAL_SIGNED', 'HARVEST_STARTED', 'HARVEST_COMPLETE', 'MEASUREMENT_REPORT', 'PAYMENT_DISBURSEMENT', 'MISC');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRACT', 'SETTLEMENT', 'MEASUREMENT_REPORT', 'STANFORD', 'MISC');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PLANNED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SecurityEventSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "address_street" TEXT,
    "address_postal" TEXT,
    "address_city" TEXT,
    "phone" TEXT,
    "bank_account_masked" TEXT,
    "bank_account_encrypted" TEXT,
    "bank_account_updated_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "cadastral_id" TEXT NOT NULL,
    "municipality" TEXT NOT NULL,
    "area_ha" DECIMAL(10,2) NOT NULL,
    "geojson" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "property_id" UUID,
    "external_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "deal_type" "DealType" NOT NULL,
    "status" "DealStatus" NOT NULL,
    "estimated_gross_minor" BIGINT,
    "final_gross_minor" BIGINT,
    "assigned_to_id" UUID,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_events" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "event_type" "DealEventType" NOT NULL,
    "label" TEXT NOT NULL,
    "planned_date" TIMESTAMP(3),
    "actual_date" TIMESTAMP(3),
    "note" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timber_posts" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "assortment" TEXT NOT NULL,
    "volume_m3" DECIMAL(12,3) NOT NULL,
    "price_per_m3_minor" BIGINT NOT NULL,
    "gross_minor" BIGINT NOT NULL,
    "measurement_source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timber_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_costs" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "cost_type" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "deal_id" UUID,
    "owner_id" UUID NOT NULL,
    "doc_type" "DocumentType" NOT NULL,
    "filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "reference" TEXT,
    "bank_account_masked" TEXT NOT NULL,
    "external_payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" UUID NOT NULL,
    "changed_by" UUID NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value_hash" TEXT,
    "new_value_hash" TEXT,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "severity" "SecurityEventSeverity" NOT NULL,
    "user_id" UUID,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT,
    "path" TEXT,
    "method" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "properties_owner_id_idx" ON "properties"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "deals_external_id_key" ON "deals"("external_id");

-- CreateIndex
CREATE INDEX "deals_owner_id_idx" ON "deals"("owner_id");

-- CreateIndex
CREATE INDEX "deals_property_id_idx" ON "deals"("property_id");

-- CreateIndex
CREATE INDEX "deals_status_idx" ON "deals"("status");

-- CreateIndex
CREATE INDEX "deal_events_deal_id_idx" ON "deal_events"("deal_id");

-- CreateIndex
CREATE INDEX "timber_posts_deal_id_idx" ON "timber_posts"("deal_id");

-- CreateIndex
CREATE INDEX "deal_costs_deal_id_idx" ON "deal_costs"("deal_id");

-- CreateIndex
CREATE INDEX "documents_deal_id_idx" ON "documents"("deal_id");

-- CreateIndex
CREATE INDEX "documents_owner_id_idx" ON "documents"("owner_id");

-- CreateIndex
CREATE INDEX "messages_deal_id_idx" ON "messages"("deal_id");

-- CreateIndex
CREATE INDEX "payments_deal_id_idx" ON "payments"("deal_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "audit_log_table_name_record_id_idx" ON "audit_log"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "audit_log_changed_by_idx" ON "audit_log"("changed_by");

-- CreateIndex
CREATE INDEX "security_events_event_type_idx" ON "security_events"("event_type");

-- CreateIndex
CREATE INDEX "security_events_severity_idx" ON "security_events"("severity");

-- CreateIndex
CREATE INDEX "security_events_created_at_idx" ON "security_events"("created_at");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timber_posts" ADD CONSTRAINT "timber_posts_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_costs" ADD CONSTRAINT "deal_costs_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

