-- CreateTable
CREATE TABLE "modmail_blacklist" (
    "id" BIGSERIAL NOT NULL,
    "guild_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "modmail_blacklist_pkey" PRIMARY KEY ("id")
);
