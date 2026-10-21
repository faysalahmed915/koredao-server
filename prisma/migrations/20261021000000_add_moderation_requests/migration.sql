-- CreateTable
CREATE TABLE "moderation_request" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ModerationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "moderatorId" TEXT,
    "moderatorNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderator_admin_request" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ModeratorAdminRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminId" TEXT,
    "adminNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderator_admin_request_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "ModerationRequestStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ModeratorAdminRequestStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- AddForeignKey
ALTER TABLE "moderation_request" ADD CONSTRAINT "moderation_request_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_request" ADD CONSTRAINT "moderation_request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_request" ADD CONSTRAINT "moderation_request_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderator_admin_request" ADD CONSTRAINT "moderator_admin_request_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderator_admin_request" ADD CONSTRAINT "moderator_admin_request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderator_admin_request" ADD CONSTRAINT "moderator_admin_request_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "moderation_request_orderId_idx" ON "moderation_request"("orderId");

-- CreateIndex
CREATE INDEX "moderation_request_requestedById_idx" ON "moderation_request"("requestedById");

-- CreateIndex
CREATE INDEX "moderation_request_status_idx" ON "moderation_request"("status");

-- CreateIndex
CREATE INDEX "moderation_request_moderatorId_idx" ON "moderation_request"("moderatorId");

-- CreateIndex
CREATE INDEX "moderator_admin_request_orderId_idx" ON "moderator_admin_request"("orderId");

-- CreateIndex
CREATE INDEX "moderator_admin_request_requestedById_idx" ON "moderator_admin_request"("requestedById");

-- CreateIndex
CREATE INDEX "moderator_admin_request_status_idx" ON "moderator_admin_request"("status");

-- CreateIndex
CREATE INDEX "moderator_admin_request_adminId_idx" ON "moderator_admin_request"("adminId");
