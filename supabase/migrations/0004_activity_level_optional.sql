-- Make a pet's activity level optional, and stop inventing one.
--
-- The column was `not null default 'moderate'` and the create RPC coalesced a
-- missing value to 'moderate', so an untouched selector silently recorded
-- "moderate" as if the tutor had chosen it. That is the same failure the
-- `spayedNeutered` tri-state was built to avoid: a default that cannot be told
-- apart from an answer.
--
-- Activity level exists to feed weight tracking and future nutrition guidance.
-- A fabricated value there is worse than no value, because a later
-- recommendation would be computed from something nobody said.
--
-- The check constraint stays as it is: `activity_level in ('low','moderate',
-- 'high')` evaluates to NULL for a NULL value, and Postgres treats a NULL
-- check result as satisfied, so it keeps rejecting any other non-null string.

alter table public.pets
  alter column activity_level drop not null,
  alter column activity_level drop default;

-- The RPC has to stop substituting a value too, or the column change achieves
-- nothing. Only the activity_level line differs from 0001; everything else is
-- reproduced verbatim so this stays a drop-in replacement.
create or replace function public.create_pet_with_owner(pet jsonb)
returns public.pets
language plpgsql
security definer
set search_path = public
as $$
declare
  new_pet public.pets;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.pets (
    name, sex, breed_primary, breed_secondary, is_mixed,
    birth_date, birth_date_approximate, spayed_neutered, activity_level
  )
  values (
    pet ->> 'name',
    pet ->> 'sex',
    pet ->> 'breed_primary',
    pet ->> 'breed_secondary',
    coalesce((pet ->> 'is_mixed')::boolean, false),
    (pet ->> 'birth_date')::date,
    coalesce((pet ->> 'birth_date_approximate')::boolean, false),
    (pet ->> 'spayed_neutered')::boolean,
    pet ->> 'activity_level'
  )
  returning * into new_pet;

  insert into public.pet_owners (pet_id, user_id, role)
  values (new_pet.id, auth.uid(), 'owner');

  return new_pet;
end;
$$;
