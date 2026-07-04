create or replace function public.is_master_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'master_admin'
  );
$$;

drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users read own profile or company profiles" on public.profiles;
drop policy if exists "Master manages profiles" on public.profiles;
drop policy if exists "Partner admin manages own users" on public.profiles;

create policy "Users read own profile or company profiles" on public.profiles
for select using (id = auth.uid() or public.is_master_admin());

create policy "Master manages profiles" on public.profiles
for all using (public.is_master_admin()) with check (public.is_master_admin());

update public.profiles
set
  role = 'master_admin',
  partner_id = '00000000-0000-0000-0000-000000000001',
  can_view_company_quotes = true
where id = 'fbcd8cea-273c-4dda-a699-509caf33990e';

notify pgrst, 'reload schema';
