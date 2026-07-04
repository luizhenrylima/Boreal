create or replace function public.is_master_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles
      where id = (select auth.uid())
        and role = 'master_admin'
    );
$$;

drop policy if exists "Clients are partner scoped" on public.clients;
drop policy if exists "Partners create own clients" on public.clients;
drop policy if exists "Partners update own clients" on public.clients;
drop policy if exists "Master manages clients" on public.clients;

create policy "Clients are partner scoped" on public.clients
for select using (public.is_master_admin() or partner_id = public.current_partner_id());

create policy "Partners create own clients" on public.clients
for insert with check (partner_id = public.current_partner_id());

create policy "Partners update own clients" on public.clients
for update using (partner_id = public.current_partner_id()) with check (partner_id = public.current_partner_id());

create policy "Master manages clients" on public.clients
for all using (public.is_master_admin()) with check (public.is_master_admin());

drop policy if exists "Quotes are partner scoped" on public.quotes;
drop policy if exists "Partners create own quotes" on public.quotes;
drop policy if exists "Partners update own quotes" on public.quotes;
drop policy if exists "Master manages quotes" on public.quotes;
drop policy if exists "Quote owners delete own quotes" on public.quotes;

create policy "Quotes are partner scoped" on public.quotes
for select using (
  public.is_master_admin()
  or partner_id = public.current_partner_id()
  and (
    created_by = auth.uid()
    or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'partner_admin')
    or exists(select 1 from public.profiles p where p.id = auth.uid() and p.can_view_company_quotes = true)
  )
);

create policy "Partners create own quotes" on public.quotes
for insert with check (partner_id = public.current_partner_id() and created_by = auth.uid());

create policy "Partners update own quotes" on public.quotes
for update using (partner_id = public.current_partner_id()) with check (partner_id = public.current_partner_id());

create policy "Quote owners delete own quotes" on public.quotes
for delete using (created_by = auth.uid());

create policy "Master manages quotes" on public.quotes
for all using (public.is_master_admin()) with check (public.is_master_admin());

update public.profiles
set
  role = 'master_admin',
  partner_id = '00000000-0000-0000-0000-000000000001',
  can_view_company_quotes = true
where id = 'fbcd8cea-273c-4dda-a699-509caf33990e';

notify pgrst, 'reload schema';
