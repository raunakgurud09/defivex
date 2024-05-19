/*
  Warnings:

  - Added the required column `amount` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "amount" INTEGER NOT NULL,
ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "title" SET DEFAULT 'Select the most clickable thumbnail';
