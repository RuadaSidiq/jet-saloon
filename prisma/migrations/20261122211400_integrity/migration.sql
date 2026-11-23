-- ── Integrity constraints that Prisma cannot express ──

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. No overlapping active bookings for the same staff member (prep/cleanup buffers included).
ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "staffId" WITH =,
    tsrange("blockStart", "blockEnd", '[)') WITH &&
  ) WHERE ("status" IN ('AWAITING_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'));

ALTER TABLE "Booking" ADD CONSTRAINT booking_time_order CHECK ("blockStart" <= "startsAt" AND "startsAt" < "endsAt" AND "endsAt" <= "blockEnd");
ALTER TABLE "Booking" ADD CONSTRAINT booking_money_nonneg CHECK ("subtotalMinor" >= 0 AND "totalMinor" >= 0 AND "commissionMinor" >= 0 AND "discountMinor" >= 0 AND "travelFeeMinor" >= 0);

-- 2. Money sanity.
ALTER TABLE "Service" ADD CONSTRAINT service_price_nonneg CHECK ("priceMinor" >= 0 AND ("promoPriceMinor" IS NULL OR "promoPriceMinor" >= 0) AND "durationMinutes" > 0);
ALTER TABLE "Payout" ADD CONSTRAINT payout_positive CHECK ("amountMinor" > 0);
ALTER TABLE "Refund" ADD CONSTRAINT refund_positive CHECK ("amountMinor" > 0);
ALTER TABLE "CommissionRule" ADD CONSTRAINT commission_rate_range CHECK ("rateBps" >= 0 AND "rateBps" <= 10000);
ALTER TABLE "Review" ADD CONSTRAINT review_rating_range CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "WorkingHours" ADD CONSTRAINT working_hours_range CHECK ("weekday" BETWEEN 0 AND 6 AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute");
ALTER TABLE "TimeOff" ADD CONSTRAINT time_off_order CHECK ("startsAt" < "endsAt");

-- 3. Ledger entries must match their account's currency and be non-zero.
ALTER TABLE "LedgerEntry" ADD CONSTRAINT ledger_entry_nonzero CHECK ("amountMinor" <> 0);

CREATE OR REPLACE FUNCTION ledger_entry_currency_check() RETURNS trigger AS $$
BEGIN
  IF NEW."currency" <> (SELECT "currency" FROM "LedgerAccount" WHERE "id" = NEW."accountId") THEN
    RAISE EXCEPTION 'Ledger entry currency % does not match account currency', NEW."currency";
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER ledger_entry_currency BEFORE INSERT ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_entry_currency_check();

-- 4. Every ledger transaction must balance to zero per currency (checked at commit).
CREATE OR REPLACE FUNCTION ledger_balance_check() RETURNS trigger AS $$
DECLARE imbalance RECORD;
BEGIN
  SELECT "currency", SUM("amountMinor") AS total INTO imbalance
    FROM "LedgerEntry" WHERE "transactionId" = NEW."transactionId"
    GROUP BY "currency" HAVING SUM("amountMinor") <> 0 LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Ledger transaction % is unbalanced in % by %', NEW."transactionId", imbalance."currency", imbalance.total;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER ledger_balanced AFTER INSERT ON "LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_balance_check();

-- 5. The ledger is append-only. Corrections are new reversing/adjusting transactions.
CREATE OR REPLACE FUNCTION ledger_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'The financial ledger is immutable; record a reversing entry instead';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER ledger_entry_immutable BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_immutable();
CREATE TRIGGER ledger_tx_immutable BEFORE UPDATE OR DELETE ON "LedgerTransaction"
  FOR EACH ROW EXECUTE FUNCTION ledger_immutable();

-- 6. Audit log is append-only too.
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION ledger_immutable();

-- 7. Search support.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX provider_search_trgm ON "ProviderProfile" USING gin ((lower("businessName" || ' ' || "displayName" || ' ' || coalesce("bio", ''))) gin_trgm_ops);
CREATE INDEX service_search_trgm ON "Service" USING gin ((lower("name" || ' ' || coalesce("description", ''))) gin_trgm_ops);
