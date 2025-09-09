/*
  Warnings:

  - The primary key for the `Todo` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `updatedAt` to the `Todo` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "TodoDependency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dependentId" TEXT NOT NULL,
    "dependencyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TodoDependency_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "Todo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TodoDependency_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "Todo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Todo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATETIME,
    "imageUrl" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "earliestStart" DATETIME,
    "criticalPath" BOOLEAN NOT NULL DEFAULT false,
    "position" REAL NOT NULL DEFAULT 0
);
INSERT INTO "new_Todo" ("createdAt", "id", "title") SELECT "createdAt", "id", "title" FROM "Todo";
DROP TABLE "Todo";
ALTER TABLE "new_Todo" RENAME TO "Todo";
CREATE INDEX "Todo_dueDate_idx" ON "Todo"("dueDate");
CREATE INDEX "Todo_position_idx" ON "Todo"("position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TodoDependency_dependentId_idx" ON "TodoDependency"("dependentId");

-- CreateIndex
CREATE INDEX "TodoDependency_dependencyId_idx" ON "TodoDependency"("dependencyId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoDependency_dependentId_dependencyId_key" ON "TodoDependency"("dependentId", "dependencyId");
