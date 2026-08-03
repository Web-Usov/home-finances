-- CreateEnum
CREATE TYPE "MonthStatus" AS ENUM ('draft', 'open', 'closed', 'reopened');

-- CreateEnum
CREATE TYPE "EnvelopeStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('expense', 'transfer', 'adjustment', 'initial_balance');

-- CreateTable
CREATE TABLE "budget_month" (
    "id" UUID NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "status" "MonthStatus" NOT NULL DEFAULT 'open',
    "income_minor" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "budget_month_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envelope" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" "EnvelopeStatus" NOT NULL DEFAULT 'active',
    "created_period" VARCHAR(7) NOT NULL,
    "archived_period" VARCHAR(7),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "envelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation" (
    "id" UUID NOT NULL,
    "month_id" UUID NOT NULL,
    "envelope_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation" (
    "id" UUID NOT NULL,
    "month_id" UUID NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "type" "OperationType" NOT NULL,
    "source_envelope_id" UUID NOT NULL,
    "destination_envelope_id" UUID,
    "requested_minor" INTEGER NOT NULL,
    "sign" VARCHAR(1),
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "comment" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_result" (
    "id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "covered_minor" INTEGER NOT NULL,
    "uncovered_minor" INTEGER NOT NULL,
    "source_balance_before" INTEGER NOT NULL,
    "source_balance_after" INTEGER NOT NULL,
    "destination_balance_before" INTEGER,
    "destination_balance_after" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operation_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envelope_month_snapshot" (
    "id" UUID NOT NULL,
    "month_id" UUID NOT NULL,
    "envelope_id" UUID NOT NULL,
    "opening" INTEGER NOT NULL,
    "initial" INTEGER NOT NULL,
    "allocation" INTEGER NOT NULL,
    "expenses_requested" INTEGER NOT NULL,
    "expenses_covered" INTEGER NOT NULL,
    "adjustment_applied" INTEGER NOT NULL,
    "transfers_in" INTEGER NOT NULL,
    "transfers_out" INTEGER NOT NULL,
    "closing" INTEGER NOT NULL,
    "uncovered_by_type" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "envelope_month_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "locale" VARCHAR(10) NOT NULL DEFAULT 'ru-RU',
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budget_month_period_key" ON "budget_month"("period");

-- CreateIndex
CREATE UNIQUE INDEX "envelope_name_key" ON "envelope"("name");

-- CreateIndex
CREATE UNIQUE INDEX "allocation_month_id_envelope_id_key" ON "allocation"("month_id", "envelope_id");

-- CreateIndex
CREATE UNIQUE INDEX "operation_month_id_sequence_no_key" ON "operation"("month_id", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "operation_result_operation_id_key" ON "operation_result"("operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "envelope_month_snapshot_month_id_envelope_id_key" ON "envelope_month_snapshot"("month_id", "envelope_id");

-- AddForeignKey
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "budget_month"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_envelope_id_fkey" FOREIGN KEY ("envelope_id") REFERENCES "envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation" ADD CONSTRAINT "operation_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "budget_month"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation" ADD CONSTRAINT "operation_source_envelope_id_fkey" FOREIGN KEY ("source_envelope_id") REFERENCES "envelope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation" ADD CONSTRAINT "operation_destination_envelope_id_fkey" FOREIGN KEY ("destination_envelope_id") REFERENCES "envelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_result" ADD CONSTRAINT "operation_result_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envelope_month_snapshot" ADD CONSTRAINT "envelope_month_snapshot_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "budget_month"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envelope_month_snapshot" ADD CONSTRAINT "envelope_month_snapshot_envelope_id_fkey" FOREIGN KEY ("envelope_id") REFERENCES "envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;
