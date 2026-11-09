CREATE SCHEMA IF NOT EXISTS "tradesim";
SET search_path TO "tradesim";
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tradesim";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenExpiresAt" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthThrottle" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "VirtualAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'AED',
    "startingCapitalFils" BIGINT NOT NULL DEFAULT 10000000,
    "cashBalanceFils" BIGINT NOT NULL DEFAULT 10000000,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "VirtualAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Security" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'AED',
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Security_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatedQuote" (
    "id" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "priceFils" BIGINT NOT NULL,
    "previousCloseFils" BIGINT NOT NULL,
    "volume" TEXT NOT NULL,
    "snapshotAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatedQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL,
    "costBasisFils" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" BIGINT NOT NULL,
    "priceFils" BIGINT NOT NULL,
    "totalValueFils" BIGINT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccount_userId_key" ON "VirtualAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Security_exchange_symbol_key" ON "Security"("exchange", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatedQuote_securityId_snapshotAt_key" ON "SimulatedQuote"("securityId", "snapshotAt");

-- CreateIndex
CREATE INDEX "Holding_securityId_idx" ON "Holding"("securityId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_accountId_securityId_key" ON "Holding"("accountId", "securityId");

-- CreateIndex
CREATE INDEX "Trade_accountId_createdAt_idx" ON "Trade"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "Trade_securityId_idx" ON "Trade"("securityId");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_accountId_idempotencyKey_key" ON "Trade"("accountId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Watchlist_securityId_idx" ON "Watchlist"("securityId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_securityId_key" ON "Watchlist"("userId", "securityId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualAccount" ADD CONSTRAINT "VirtualAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedQuote" ADD CONSTRAINT "SimulatedQuote_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "VirtualAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "VirtualAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_securityId_fkey" FOREIGN KEY ("securityId") REFERENCES "Security"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep app/auth data out of Supabase's public Data API.
REVOKE ALL ON SCHEMA tradesim FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA tradesim FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA tradesim FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA tradesim FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA tradesim FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA tradesim FROM authenticated;
  END IF;
END $$;

ALTER TABLE "VirtualAccount" ADD CONSTRAINT "VirtualAccount_money_check"
  CHECK ("cashBalanceFils" >= 0 AND "startingCapitalFils" = 10000000 AND currency = 'AED');
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized" CHECK (email = lower(btrim(email)));
ALTER TABLE "Security" ADD CONSTRAINT "Security_market_check" CHECK (currency = 'AED' AND exchange IN ('DFM','ADX'));
ALTER TABLE "SimulatedQuote" ADD CONSTRAINT "SimulatedQuote_prices_check" CHECK ("priceFils" > 0 AND "previousCloseFils" > 0);
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_nonnegative_check" CHECK (quantity >= 0 AND "costBasisFils" >= 0);
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_values_check" CHECK (side IN ('BUY','SELL') AND quantity > 0 AND "priceFils" > 0 AND "totalValueFils"::numeric = quantity::numeric * "priceFils"::numeric);

-- Provisioning participates in the user-insert transaction. ON CONFLICT never
-- resets an existing balance. The application runtime cannot write accounts.
CREATE FUNCTION tradesim.provision_virtual_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = tradesim, pg_temp AS $$
BEGIN
  INSERT INTO "VirtualAccount" (id, "userId", "startingCapitalFils", "cashBalanceFils", currency, "createdAt", "updatedAt")
  VALUES (gen_random_uuid()::text, NEW.id, 10000000, 10000000, 'AED', now(), now())
  ON CONFLICT ("userId") DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tradesim.provision_virtual_account() FROM PUBLIC;
CREATE TRIGGER "User_provision_account" AFTER INSERT ON "User"
FOR EACH ROW EXECUTE FUNCTION tradesim.provision_virtual_account();

-- A deferred constraint also prevents owner/admin operations from leaving an
-- existing user with zero accounts at commit (uniqueness prevents more than one).
CREATE FUNCTION tradesim.require_virtual_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = tradesim, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" u WHERE NOT EXISTS (SELECT 1 FROM "VirtualAccount" a WHERE a."userId" = u.id)) THEN
    RAISE EXCEPTION 'Each user must have exactly one virtual account' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION tradesim.require_virtual_account() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER "User_requires_account" AFTER INSERT OR UPDATE ON "User"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tradesim.require_virtual_account();
CREATE CONSTRAINT TRIGGER "Account_required_by_user" AFTER DELETE OR UPDATE ON "VirtualAccount"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tradesim.require_virtual_account();
