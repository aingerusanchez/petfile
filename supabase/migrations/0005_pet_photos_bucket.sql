-- A private bucket for the one photo a pet has: its avatar.
--
-- **Why private, and why the column holds a path.** The project's posture is
-- that data is protected by RLS and not by hiding it, so a public bucket —
-- where anyone holding the URL can fetch the object forever — would be the one
-- place that contradicts it. The bucket is therefore private, `pets.photo_url`
-- stores the **object path** rather than a URL, and the app signs a short-lived
-- URL when it renders the image. The column name is inherited from the initial
-- schema and is now half a lie; renaming it would break nothing today but is
-- not worth a migration until something else touches the table.
--
-- **Why one object per pet.** The path is `<pet_id>/avatar.<ext>`, so a new
-- photo replaces the old one instead of accumulating orphans nobody will ever
-- look at. `upsert: true` on the client side is what makes that a replace.
--
-- Both policies read ownership from `pet_owners`, the same join table the
-- `pets` policies use, so sharing a pet with a second tutor in a future
-- version gives them the photo too without touching storage.

insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', false)
on conflict (id) do nothing;

-- The first path segment is the pet's id: `storage.foldername(name)` splits the
-- object name on "/" and returns the folder parts, so `[1]` is that id.
create policy "pet photos readable by their owners"
  on storage.objects for select
  using (
    bucket_id = 'pet-photos'
    and exists (
      select 1
      from public.pet_owners po
      where po.user_id = auth.uid()
        and po.pet_id::text = (storage.foldername(name))[1]
    )
  );

-- INSERT and UPDATE are separate policies in Postgres, and an upsert needs
-- both: the first write inserts, every later one updates the same object.
create policy "pet photos writable by their owners"
  on storage.objects for insert
  with check (
    bucket_id = 'pet-photos'
    and exists (
      select 1
      from public.pet_owners po
      where po.user_id = auth.uid()
        and po.pet_id::text = (storage.foldername(name))[1]
    )
  );

create policy "pet photos replaceable by their owners"
  on storage.objects for update
  using (
    bucket_id = 'pet-photos'
    and exists (
      select 1
      from public.pet_owners po
      where po.user_id = auth.uid()
        and po.pet_id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'pet-photos'
    and exists (
      select 1
      from public.pet_owners po
      where po.user_id = auth.uid()
        and po.pet_id::text = (storage.foldername(name))[1]
    )
  );

-- Removing the photo is part of editing it: a tutor who picked the wrong image
-- must be able to end up with no image rather than a worse one.
create policy "pet photos deletable by their owners"
  on storage.objects for delete
  using (
    bucket_id = 'pet-photos'
    and exists (
      select 1
      from public.pet_owners po
      where po.user_id = auth.uid()
        and po.pet_id::text = (storage.foldername(name))[1]
    )
  );
