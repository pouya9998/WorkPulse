-- CreateEnum
CREATE TYPE "GitLabConnectionStatus" AS ENUM ('ACTIVE', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "MergeRequestState" AS ENUM ('OPENED', 'MERGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('CREATED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CompensationProposalStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "gitlab_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "token_encrypted" TEXT NOT NULL,
    "status" "GitLabConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gitlab_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gitlab_projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "gitlab_project_id" INTEGER NOT NULL,
    "path_with_namespace" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_connected" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gitlab_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gitlab_user_mappings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "gitlab_user_id" INTEGER NOT NULL,
    "gitlab_username" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gitlab_user_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gitlab_webhook_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gitlab_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merge_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT,
    "gitlab_mr_iid" INTEGER NOT NULL,
    "gitlab_mr_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "state" "MergeRequestState" NOT NULL,
    "source_branch" TEXT NOT NULL,
    "target_branch" TEXT NOT NULL,
    "author_gitlab_id" INTEGER,
    "opened_at" TIMESTAMP(3),
    "merged_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "updated_at_gitlab" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merge_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "merge_request_id" TEXT NOT NULL,
    "user_id" TEXT,
    "gitlab_note_id" INTEGER,
    "reviewer_gitlab_id" INTEGER,
    "state" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT,
    "gitlab_pipeline_id" INTEGER NOT NULL,
    "ref" TEXT NOT NULL,
    "status" "PipelineStatus" NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engineering_metrics" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "mr_opened" INTEGER NOT NULL DEFAULT 0,
    "mr_merged" INTEGER NOT NULL DEFAULT 0,
    "reviews_given" INTEGER NOT NULL DEFAULT 0,
    "pipelines_run" INTEGER NOT NULL DEFAULT 0,
    "commit_count" INTEGER NOT NULL DEFAULT 0,
    "notes_fa" TEXT,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engineering_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "contract_type" "ContractType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_versions" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "contract_type" "ContractType" NOT NULL,
    "hourly_rate" DECIMAL(18,4),
    "base_monthly" DECIMAL(18,2),
    "effective_from" TIMESTAMP(3) NOT NULL,
    "note_fa" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name_fa" TEXT NOT NULL,
    "default_currency" TEXT NOT NULL DEFAULT 'IRR',
    "hourly_rounding_minutes" INTEGER NOT NULL DEFAULT 15,
    "notes_fa" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compensation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "label_fa" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_proposals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "payroll_period_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "contract_version_id" TEXT,
    "status" "CompensationProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "proposed_amount" DECIMAL(18,2) NOT NULL,
    "approved_payable_hours" DECIMAL(10,4),
    "formula_breakdown" JSONB NOT NULL,
    "reviewer_notes" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compensation_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_adjustments" (
    "id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "label_fa" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "is_deduction" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gitlab_connections_organization_id_key" ON "gitlab_connections"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "gitlab_projects_organization_id_gitlab_project_id_key" ON "gitlab_projects"("organization_id", "gitlab_project_id");

-- CreateIndex
CREATE INDEX "gitlab_projects_organization_id_is_connected_idx" ON "gitlab_projects"("organization_id", "is_connected");

-- CreateIndex
CREATE UNIQUE INDEX "gitlab_user_mappings_organization_id_user_id_key" ON "gitlab_user_mappings"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gitlab_user_mappings_organization_id_gitlab_user_id_key" ON "gitlab_user_mappings"("organization_id", "gitlab_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gitlab_webhook_events_organization_id_delivery_id_key" ON "gitlab_webhook_events"("organization_id", "delivery_id");

-- CreateIndex
CREATE INDEX "gitlab_webhook_events_organization_id_event_type_idx" ON "gitlab_webhook_events"("organization_id", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "merge_requests_project_id_gitlab_mr_iid_key" ON "merge_requests"("project_id", "gitlab_mr_iid");

-- CreateIndex
CREATE INDEX "merge_requests_organization_id_user_id_idx" ON "merge_requests"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "reviews_merge_request_id_idx" ON "reviews"("merge_request_id");

-- CreateIndex
CREATE INDEX "reviews_organization_id_user_id_idx" ON "reviews"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pipelines_project_id_gitlab_pipeline_id_key" ON "pipelines"("project_id", "gitlab_pipeline_id");

-- CreateIndex
CREATE INDEX "pipelines_organization_id_user_id_idx" ON "pipelines"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "engineering_metrics_organization_id_user_id_period_start_period_end_key" ON "engineering_metrics"("organization_id", "user_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_organization_id_user_id_key" ON "contracts"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "contracts_organization_id_is_active_idx" ON "contracts"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "contract_versions_contract_id_version_number_key" ON "contract_versions"("contract_id", "version_number");

-- CreateIndex
CREATE INDEX "contract_versions_contract_id_effective_from_idx" ON "contract_versions"("contract_id", "effective_from");

-- CreateIndex
CREATE INDEX "compensation_policies_organization_id_is_active_idx" ON "compensation_policies"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_organization_id_period_start_period_end_key" ON "payroll_periods"("organization_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "payroll_periods_organization_id_status_idx" ON "payroll_periods"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_proposals_payroll_period_id_user_id_key" ON "compensation_proposals"("payroll_period_id", "user_id");

-- CreateIndex
CREATE INDEX "compensation_proposals_organization_id_status_idx" ON "compensation_proposals"("organization_id", "status");

-- CreateIndex
CREATE INDEX "compensation_adjustments_proposal_id_idx" ON "compensation_adjustments"("proposal_id");

-- AddForeignKey
ALTER TABLE "gitlab_connections" ADD CONSTRAINT "gitlab_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gitlab_projects" ADD CONSTRAINT "gitlab_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gitlab_user_mappings" ADD CONSTRAINT "gitlab_user_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gitlab_user_mappings" ADD CONSTRAINT "gitlab_user_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gitlab_webhook_events" ADD CONSTRAINT "gitlab_webhook_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "gitlab_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_merge_request_id_fkey" FOREIGN KEY ("merge_request_id") REFERENCES "merge_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "gitlab_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engineering_metrics" ADD CONSTRAINT "engineering_metrics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engineering_metrics" ADD CONSTRAINT "engineering_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_policies" ADD CONSTRAINT "compensation_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_proposals" ADD CONSTRAINT "compensation_proposals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_proposals" ADD CONSTRAINT "compensation_proposals_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_proposals" ADD CONSTRAINT "compensation_proposals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_adjustments" ADD CONSTRAINT "compensation_adjustments_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "compensation_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
