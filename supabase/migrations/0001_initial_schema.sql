-- Profiles: one row per auth user.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Pets.
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text not null default 'dog',
  sex text not null check (sex in ('male', 'female')),
  breed_primary text,
  breed_secondary text,
  is_mixed boolean not null default false,
  birth_date date,
  birth_date_approximate boolean not null default false,
  photo_url text,
  spayed_neutered boolean,
  activity_level text not null default 'moderate'
    check (activity_level in ('low', 'moderate', 'high')),
  exercise_goal_minutes integer,
  vet_primary jsonb,
  vet_emergency jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Membership: which users may see and edit which pets.
-- This table is what makes v1 sharing an INSERT rather than a redesign.
create table public.pet_owners (
  pet_id uuid not null references public.pets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (pet_id, user_id)
);

create index pet_owners_user_id_idx on public.pet_owners (user_id);

-- Membership check as SECURITY DEFINER so pet policies can consult
-- pet_owners without triggering that table's own RLS (infinite recursion).
create or replace function public.is_pet_owner(p_pet_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pet_owners
    where pet_id = p_pet_id and user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.pet_owners enable row level security;

create policy "profiles are self-readable"
  on public.profiles for select using (id = auth.uid());
create policy "profiles are self-writable"
  on public.profiles for update using (id = auth.uid());

create policy "pets readable by their owners"
  on public.pets for select using (public.is_pet_owner(id));
create policy "pets writable by their owners"
  on public.pets for update using (public.is_pet_owner(id));
create policy "pets deletable by their owners"
  on public.pets for delete using (public.is_pet_owner(id));

create policy "memberships readable by the member"
  on public.pet_owners for select using (user_id = auth.uid());

-- Create the profile row automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Atomic pet creation: a pet must never exist without an owner, and there
-- is no INSERT policy on either table, so this function is the only path in.
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
    coalesce(pet ->> 'activity_level', 'moderate')
  )
  returning * into new_pet;

  insert into public.pet_owners (pet_id, user_id, role)
  values (new_pet.id, auth.uid(), 'owner');

  return new_pet;
end;
$$;

-- Explicit grants so the app works whether or not the Supabase project has
-- "Automatically expose new tables" enabled. RLS still decides which rows
-- are visible/writable; these grants only unlock the operations the
-- policies above already allow. Deliberately no INSERT on pets or
-- pet_owners and no grants to anon: create_pet_with_owner (SECURITY
-- DEFINER) is the only insert path for both tables.
grant select, update on public.profiles to authenticated;
grant select, update, delete on public.pets to authenticated;
grant select on public.pet_owners to authenticated;
grant execute on function public.is_pet_owner(uuid) to authenticated;
grant execute on function public.create_pet_with_owner(jsonb) to authenticated;
