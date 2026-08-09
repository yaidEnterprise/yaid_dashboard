-- Story 7.3: adds can_create_apps to company. New companies default to false
-- (creation is gated like an opt-in subscription); existing companies are
-- backfilled to true so the flag doesn't retroactively lock anyone out.
-- Column is created NOT NULL DEFAULT false in a single atomic statement
-- (no nullable-then-backfill-then-constrain window), so there is no gap
-- where a concurrent insert could land without a default.
alter table "public"."company"
  add column "can_create_apps" boolean not null default false;

update "public"."company"
  set "can_create_apps" = true;
