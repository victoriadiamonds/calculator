-- Apply with an administrative database connection. The checkout service uses
-- a server-only connection. Never grant browser roles access to this schema.
CREATE SCHEMA IF NOT EXISTS promotions;
REVOKE ALL ON SCHEMA promotions FROM PUBLIC;

CREATE TABLE IF NOT EXISTS promotions.klubby_campaign (
    id text PRIMARY KEY CHECK (id = 'klubby'),
    starts_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    CHECK (expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS promotions.klubby_code (
    digest text PRIMARY KEY CHECK (digest ~ '^[a-f0-9]{64}$'),
    campaign_id text NOT NULL REFERENCES promotions.klubby_campaign(id),
    order_id text UNIQUE,
    redeemed_at timestamptz,
    CHECK (redeemed_at IS NULL OR order_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION promotions.reserve_klubby_code(code_digest text, merchant_order text)
RETURNS boolean LANGUAGE sql SET search_path = pg_catalog AS $$
    WITH reserved AS (
        UPDATE promotions.klubby_code AS code
        SET order_id = merchant_order
        FROM promotions.klubby_campaign AS campaign
        WHERE code.digest = code_digest AND code.campaign_id = campaign.id
          AND statement_timestamp() >= campaign.starts_at
          AND statement_timestamp() < campaign.expires_at
          AND code.redeemed_at IS NULL
          AND (code.order_id IS NULL OR code.order_id = merchant_order)
        RETURNING code.digest
    ) SELECT EXISTS (SELECT 1 FROM reserved);
$$;

CREATE OR REPLACE FUNCTION promotions.redeem_klubby_code(merchant_order text)
RETURNS boolean LANGUAGE sql SET search_path = pg_catalog AS $$
    WITH redeemed AS (
        UPDATE promotions.klubby_code
        SET redeemed_at = COALESCE(redeemed_at, statement_timestamp())
        WHERE order_id = merchant_order
        RETURNING digest
    ) SELECT EXISTS (SELECT 1 FROM redeemed);
$$;

-- Call only after confirming the payment link cannot be used again, or if
-- the provider definitively rejected link creation. A failed charge alone
-- can still leave a payment link usable.
CREATE OR REPLACE FUNCTION promotions.release_klubby_code(merchant_order text)
RETURNS boolean LANGUAGE sql SET search_path = pg_catalog AS $$
    WITH released AS (
        UPDATE promotions.klubby_code SET order_id = NULL
        WHERE order_id = merchant_order AND redeemed_at IS NULL
        RETURNING digest
    ) SELECT EXISTS (SELECT 1 FROM released);
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA promotions FROM PUBLIC;
