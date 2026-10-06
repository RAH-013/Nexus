-- CreateTable
CREATE TABLE "actor_comment" (
    "id" SERIAL NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "userId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actor_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "actor_comment_actorName_createdAt_idx" ON "actor_comment"("actorName", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "actor_comment" ADD CONSTRAINT "actor_comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
