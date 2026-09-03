-- Harden the UPDATE policies with a WITH CHECK clause.
--
-- 0001 created both UPDATE policies with USING only. Postgres then defaults
-- WITH CHECK to the USING expression *for the row as it exists*, but the
-- guarantee people assume — that the row still satisfies the predicate
-- *after* the update — only holds when WITH CHECK is stated explicitly.
-- Without it, an owner could in principle rewrite the primary key of a row
-- they own into one they don't, moving it outside their own visibility.
--
-- ALTER POLICY is used rather than DROP + CREATE so the existing USING
-- expression is preserved verbatim and there is no window in which the table
-- is unprotected. ALTER POLICY ... WITH CHECK (...) adds the clause to a
-- policy that has none.

alter policy "profiles are self-writable"
  on public.profiles
  with check (id = auth.uid());

alter policy "pets writable by their owners"
  on public.pets
  with check (public.is_pet_owner(id));
