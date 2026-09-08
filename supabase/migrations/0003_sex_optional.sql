-- Make a pet's sex optional.
--
-- Sex was `not null` from the initial schema, which made it impossible to
-- register an animal without stating it. Reviewed against what the app
-- actually needs to work, only two fields qualify as required: the name, which
-- identifies the animal, and the birth date, which yields its age and anchors
-- the vaccine and deworming due dates. Nothing in v0 reads sex at all — it
-- becomes useful later, for adult-weight estimation in nutrition or for
-- tracking heat cycles in females — so blocking a registration on it asks for
-- data to satisfy a constraint rather than a need.
--
-- Breed is in the same category and was already nullable.
--
-- The existing check constraint needs no change. `sex in ('male', 'female')`
-- evaluates to NULL for a NULL value, and Postgres treats a NULL check result
-- as satisfied, so dropping NOT NULL is sufficient and the constraint keeps
-- rejecting any other non-null string.
--
-- `create_pet_with_owner` passes sex straight through from its jsonb argument,
-- so the RPC needs no change either.

alter table public.pets
  alter column sex drop not null;
