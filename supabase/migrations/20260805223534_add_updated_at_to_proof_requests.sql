-- Story 7.2: adds updated_at to proof_request, backfilled from created_at,
-- so every status transition can record when it last changed.
alter table "public"."proof_request"
  add column "updated_at" timestamptz;

update "public"."proof_request"
  set "updated_at" = "created_at"
  where "updated_at" is null;

alter table "public"."proof_request"
  alter column "updated_at" set default now(),
  alter column "updated_at" set not null;
