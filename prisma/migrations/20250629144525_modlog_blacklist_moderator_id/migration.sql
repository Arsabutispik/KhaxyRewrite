/*
  Warnings:

  - Added the required column `moderator_id` to the `modmail_blacklist` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "modmail_blacklist" ADD COLUMN     "moderator_id" BIGINT NOT NULL;
