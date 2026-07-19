-- Backfill existing payments: historically stored as USD amounts.
UPDATE "FamilyPayment"
SET "receivedAmount" = "amount",
    "exchangeRateUsed" = 1
WHERE "receivedAmount" IS NULL;

-- Seed default exchange pairs for every organization that has none yet.
INSERT INTO "ExchangeRate" (
  "id",
  "fromCurrency",
  "toCurrency",
  "rate",
  "isActive",
  "organizationId",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  v.from_c::"CurrencyCode",
  v.to_c::"CurrencyCode",
  v.rate,
  true,
  o.id,
  NOW(),
  NOW()
FROM "organization" o
CROSS JOIN (
  VALUES
    ('USD', 'CDF', 2800.0),
    ('CDF', 'USD', 1.0 / 2800.0),
    ('USD', 'AOA', 918.0),
    ('AOA', 'USD', 1.0 / 918.0)
) AS v(from_c, to_c, rate)
WHERE NOT EXISTS (
  SELECT 1
  FROM "ExchangeRate" er
  WHERE er."organizationId" = o.id
);
