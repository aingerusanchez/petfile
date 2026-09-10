-- The logging half of the product: what happened, what he weighs, what he was
-- given.
--
-- **The shape follows one rule: what the app computes from gets columns; what
-- it only lists does not.** A walk, a meal, a medication and an incident are
-- homogeneous "this happened at this time" entries that the day view reads
-- back as a list, so they share one table and carry their specifics in
-- `details`. A weight feeds a line and a treatment feeds a due date, and a
-- calculation reading out of jsonb is a fragile calculation, so those get
-- tables of their own with real columns and real constraints.
--
-- Three deliberate consequences of that rule:
--
--   * `duration_minutes` is promoted out of `details`, because the profile's
--     `exercise_goal_minutes` is compared against the sum of it.
--   * An **incident** is a `pet_events` row rather than a health table, even
--     though PRODUCT.md files it under health. What separates the two groups
--     here is not the subject matter but whether anything is derived from it,
--     and nothing is derived from an incident yet. If that changes, it moves.
--   * `next_due_on` is **stored, not computed**. The vet says "in three
--     months" or "in a year", and that instruction is the fact. The form
--     proposes a date from a per-kind default so the tutor rarely types one —
--     that is what "the next date calculates itself" means — but what lands in
--     the row is what they confirmed, not a schedule the app invented.
--
-- Weight is stored in **grams as an integer**. A 12.4 kg dog is 12400, and the
-- line is drawn from integers rather than from floats that drift by a gram
-- every time they are averaged.
--
-- `created_by` records which tutor logged the entry, which is what makes a
-- shared log readable once a pet has two owners. It is nullable and
-- `on delete set null`: an account going away must not take the animal's
-- history with it.

-- ---------------------------------------------------------------------------
-- The day's log
-- ---------------------------------------------------------------------------

create table public.pet_events (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  kind text not null check (kind in ('walk', 'meal', 'medication', 'incident')),
  -- When it happened, which is not when it was logged: the normal pattern is
  -- to record a walk after getting home, so the tutor can move this back.
  occurred_at timestamptz not null default now(),
  -- Only a walk has one, and the exercise goal is measured against the sum.
  duration_minutes integer
    check (duration_minutes is null or duration_minutes between 1 and 1440),
  note text,
  -- Per-kind specifics the app lists and does not calculate from: whether he
  -- pooped and how it looked, which food and how much, which drug and what
  -- dose. Promote a key out of here the moment something computes from it.
  details jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The day view asks for one pet's entries, newest first, within a date range.
create index pet_events_pet_occurred_idx
  on public.pet_events (pet_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- The weight line
-- ---------------------------------------------------------------------------

create table public.pet_weights (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  -- A date, not a timestamp: nobody cares that the scale happened at 19:42,
  -- and a date is what makes "one weight per day" expressible.
  measured_on date not null,
  grams integer not null check (grams > 0 and grams <= 200000),
  note text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Weighing him twice in a day is a correction, not two data points.
  unique (pet_id, measured_on)
);

create index pet_weights_pet_measured_idx
  on public.pet_weights (pet_id, measured_on desc);

-- ---------------------------------------------------------------------------
-- Vaccines, deworming, antiparasitics
-- ---------------------------------------------------------------------------

create table public.pet_treatments (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  kind text not null check (kind in ('vaccine', 'deworming', 'antiparasitic')),
  -- What was actually given: "Polivalente", "Milbemax", "Seresto". Optional
  -- because a tutor who does not remember the brand still knows it happened.
  name text,
  administered_on date not null,
  -- What the app's alerts read. Null is a real answer: a one-off treatment
  -- with nothing scheduled after it.
  next_due_on date
    check (next_due_on is null or next_due_on >= administered_on),
  note text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The alert surface asks "what is due, soonest first", so the index leads with
-- the due date and skips the rows that have none.
create index pet_treatments_due_idx
  on public.pet_treatments (pet_id, next_due_on)
  where next_due_on is not null;

create index pet_treatments_pet_administered_idx
  on public.pet_treatments (pet_id, administered_on desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
--
-- Through `public.is_pet_owner(uuid)`, the `security definer` helper `0001`
-- already defines and the `pets` policies already use. Two reasons not to
-- inline the `exists` subquery here: `pet_owners` carries RLS policies of its
-- own, so a policy on another table querying it directly evaluates a policy
-- inside a policy; and there should be exactly one place where "who owns this
-- pet" is decided.
--
-- Four policies per table rather than one FOR ALL, because INSERT needs
-- WITH CHECK, SELECT and DELETE need USING, and UPDATE needs both. That is the
-- lesson `0002_harden_update_policies.sql` recorded: an UPDATE policy with no
-- WITH CHECK lets an owner rewrite a row's `pet_id` and hand it to someone
-- else.

alter table public.pet_events enable row level security;
alter table public.pet_weights enable row level security;
alter table public.pet_treatments enable row level security;

create policy "events readable by the pet's owners"
  on public.pet_events for select using (public.is_pet_owner(pet_id));
create policy "events insertable by the pet's owners"
  on public.pet_events for insert with check (public.is_pet_owner(pet_id));
create policy "events updatable by the pet's owners"
  on public.pet_events for update
  using (public.is_pet_owner(pet_id))
  with check (public.is_pet_owner(pet_id));
create policy "events deletable by the pet's owners"
  on public.pet_events for delete using (public.is_pet_owner(pet_id));

create policy "weights readable by the pet's owners"
  on public.pet_weights for select using (public.is_pet_owner(pet_id));
create policy "weights insertable by the pet's owners"
  on public.pet_weights for insert with check (public.is_pet_owner(pet_id));
create policy "weights updatable by the pet's owners"
  on public.pet_weights for update
  using (public.is_pet_owner(pet_id))
  with check (public.is_pet_owner(pet_id));
create policy "weights deletable by the pet's owners"
  on public.pet_weights for delete using (public.is_pet_owner(pet_id));

create policy "treatments readable by the pet's owners"
  on public.pet_treatments for select using (public.is_pet_owner(pet_id));
create policy "treatments insertable by the pet's owners"
  on public.pet_treatments for insert with check (public.is_pet_owner(pet_id));
create policy "treatments updatable by the pet's owners"
  on public.pet_treatments for update
  using (public.is_pet_owner(pet_id))
  with check (public.is_pet_owner(pet_id));
create policy "treatments deletable by the pet's owners"
  on public.pet_treatments for delete using (public.is_pet_owner(pet_id));

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
--
-- Revoke first, then grant explicitly, for the reason `0001` records: with
-- "Automatically expose new tables" on, Supabase's default privileges hand out
-- broad access at CREATE TABLE time, and an invariant that rests on RLS alone
-- rests on one layer instead of two.
--
-- Unlike `pets`, these tables **do** get INSERT: a row here hangs off a pet
-- that already exists, so there is nothing to make atomic across two tables
-- and no reason for a `security definer` RPC to stand in the way.

revoke all on public.pet_events, public.pet_weights, public.pet_treatments
  from anon, authenticated;

grant select, insert, update, delete
  on public.pet_events, public.pet_weights, public.pet_treatments
  to authenticated;
