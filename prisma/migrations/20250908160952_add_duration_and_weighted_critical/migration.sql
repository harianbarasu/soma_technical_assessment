-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Todo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationDays" INTEGER NOT NULL DEFAULT 1,
    "dueDate" DATETIME,
    "imageUrl" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "earliestStart" DATETIME,
    "earliestFinish" DATETIME,
    "latestStart" DATETIME,
    "latestFinish" DATETIME,
    "criticalPath" BOOLEAN NOT NULL DEFAULT false,
    "position" REAL NOT NULL DEFAULT 0
);
INSERT INTO "new_Todo" ("completed", "completedAt", "createdAt", "criticalPath", "description", "dueDate", "earliestStart", "id", "imageUrl", "position", "title", "updatedAt") SELECT "completed", "completedAt", "createdAt", "criticalPath", "description", "dueDate", "earliestStart", "id", "imageUrl", "position", "title", "updatedAt" FROM "Todo";
DROP TABLE "Todo";
ALTER TABLE "new_Todo" RENAME TO "Todo";
CREATE INDEX "Todo_dueDate_idx" ON "Todo"("dueDate");
CREATE INDEX "Todo_position_idx" ON "Todo"("position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
