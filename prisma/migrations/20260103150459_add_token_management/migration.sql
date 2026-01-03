-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "chainId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WalletToken" (
    "walletId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,

    PRIMARY KEY ("walletId", "tokenId"),
    CONSTRAINT "WalletToken_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WalletToken_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "entityId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "secret" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Token_address_key" ON "Token"("address");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
