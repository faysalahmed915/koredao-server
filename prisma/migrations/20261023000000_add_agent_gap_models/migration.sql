-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('STUDENT', 'ASSISTANT', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "agent_session" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "holderUserId" TEXT NOT NULL,
    "contextJson" jsonb NOT NULL DEFAULT '{}',
    "status" "HandoffStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_handoff" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromAgentType" "AgentType" NOT NULL,
    "toAgentType" "AgentType" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "HandoffStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_handoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_kpi" (
    "id" TEXT NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "userId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_assignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "GigCategory" NOT NULL DEFAULT 'ASSIGNMENT',
    "subject" TEXT NOT NULL,
    "type" "AssignmentType" NOT NULL DEFAULT 'SOFTCOPY',
    "deadline" TIMESTAMP(3) NOT NULL,
    "budgetMin" DOUBLE PRECISION NOT NULL,
    "budgetMax" DOUBLE PRECISION NOT NULL,
    "deliveryAddress" TEXT,
    "preferredCampus" TEXT,
    "preferredHandwritingStyle" "HandwritingStyle",
    "sampleFileUrls" TEXT[] NOT NULL DEFAULT '{}',
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "draft_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "oldValueJson" jsonb,
    "newValueJson" jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_change_audit" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "oldRole" "UserRole" NOT NULL,
    "newRole" "UserRole" NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_change_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderator_action_log" (
    "id" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetId" TEXT,
    "detailsJson" jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "moderator_action_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence_packet" (
    "id" TEXT NOT NULL,
    "moderationRequestId" TEXT NOT NULL,
    "chatMessageIds" TEXT[] NOT NULL DEFAULT '{}',
    "deliveryFileUrls" TEXT[] NOT NULL DEFAULT '{}',
    "checkpointIds" TEXT[] NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dispute_evidence_packet_pkey" PRIMARY KEY ("id")
);

-- AlterTable (moderation_request extensions)
ALTER TABLE "moderation_request" ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "moderation_request" ADD COLUMN "assignedModeratorId" TEXT;
ALTER TABLE "moderation_request" ADD COLUMN "escalatedToAdminId" TEXT;

-- AddForeignKey
ALTER TABLE "agent_session" ADD CONSTRAINT "agent_session_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_session" ADD CONSTRAINT "agent_session_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_handoff" ADD CONSTRAINT "agent_handoff_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "agent_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_kpi" ADD CONSTRAINT "agent_kpi_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_assignment" ADD CONSTRAINT "draft_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_change_audit" ADD CONSTRAINT "role_change_audit_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_change_audit" ADD CONSTRAINT "role_change_audit_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderator_action_log" ADD CONSTRAINT "moderator_action_log_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_setting" ADD CONSTRAINT "platform_setting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence_packet" ADD CONSTRAINT "dispute_evidence_packet_moderationRequestId_fkey" FOREIGN KEY ("moderationRequestId") REFERENCES "moderation_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_request" ADD CONSTRAINT "moderation_request_assignedModeratorId_fkey" FOREIGN KEY ("assignedModeratorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "moderation_request" ADD CONSTRAINT "moderation_request_escalatedToAdminId_fkey" FOREIGN KEY ("escalatedToAdminId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "agent_session_orderId_idx" ON "agent_session"("orderId");
CREATE INDEX "agent_session_holderUserId_idx" ON "agent_session"("holderUserId");
CREATE INDEX "agent_session_agentType_idx" ON "agent_session"("agentType");
CREATE INDEX "agent_session_status_idx" ON "agent_session"("status");
CREATE INDEX "agent_handoff_sessionId_idx" ON "agent_handoff"("sessionId");
CREATE INDEX "agent_handoff_status_idx" ON "agent_handoff"("status");
CREATE INDEX "agent_kpi_userId_idx" ON "agent_kpi"("userId");
CREATE INDEX "agent_kpi_agentType_idx" ON "agent_kpi"("agentType");
CREATE INDEX "agent_kpi_periodStart_periodEnd_idx" ON "agent_kpi"("periodStart", "periodEnd");
CREATE INDEX "draft_assignment_userId_idx" ON "draft_assignment"("userId");
CREATE INDEX "draft_assignment_status_idx" ON "draft_assignment"("status");
CREATE INDEX "audit_log_actorUserId_idx" ON "audit_log"("actorUserId");
CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");
CREATE INDEX "role_change_audit_targetUserId_idx" ON "role_change_audit"("targetUserId");
CREATE INDEX "role_change_audit_changedById_idx" ON "role_change_audit"("changedById");
CREATE INDEX "role_change_audit_createdAt_idx" ON "role_change_audit"("createdAt");
CREATE INDEX "moderator_action_log_moderatorId_idx" ON "moderator_action_log"("moderatorId");
CREATE INDEX "moderator_action_log_actionType_idx" ON "moderator_action_log"("actionType");
CREATE INDEX "moderator_action_log_createdAt_idx" ON "moderator_action_log"("createdAt");
CREATE UNIQUE INDEX "platform_setting_key_idx" ON "platform_setting"("key");
CREATE UNIQUE INDEX "dispute_evidence_packet_moderationRequestId_key" ON "dispute_evidence_packet"("moderationRequestId");
CREATE INDEX "moderation_request_priority_idx" ON "moderation_request"("priority");
CREATE INDEX "moderation_request_assignedModeratorId_idx" ON "moderation_request"("assignedModeratorId");

