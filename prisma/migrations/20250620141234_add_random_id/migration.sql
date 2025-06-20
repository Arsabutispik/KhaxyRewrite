/*
  Warnings:

  - The primary key for the `mod_mail_messages` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "mod_mail_messages" DROP CONSTRAINT "mod_mail_messages_pkey",
ADD COLUMN     "id" BIGSERIAL NOT NULL,
ADD CONSTRAINT "mod_mail_messages_pkey" PRIMARY KEY ("id");
