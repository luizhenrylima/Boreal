-- Run this in the Supabase SQL editor after creating the tables from setup_complete.sql.
-- It requires every app user to exist in public.profiles and keeps quotes partner-scoped.

alter table public.partners enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.product_formats enable row level security;
alter table public.processors enable row level security;
alter table public.service_pricing enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_events enable row level security;

grant usage on schema public to authenticated;

revoke all on public.partners from anon;
revoke all on public.profiles from anon;
revoke all on public.clients from anon;
revoke all on public.products from anon;
revoke all on public.product_formats from anon;
revoke all on public.processors from anon;
revoke all on public.service_pricing from anon;
revoke all on public.quotes from anon;
revoke all on public.quote_events from anon;

grant select, insert, update, delete on public.partners to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_formats to authenticated;
grant select, insert, update, delete on public.processors to authenticated;
grant select, insert, update, delete on public.service_pricing to authenticated;
grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert, update, delete on public.quote_events to authenticated;

create or replace function public.is_master_admin()
returns boolean
language sql
security definer
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

create or replace function public.current_partner_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select partner_id
  from public.profiles
  where id = (select auth.uid());
$$;

create or replace function public.can_manage_partner_quotes()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and (
        role = 'partner_admin'
        or can_view_company_quotes = true
      )
  );
$$;

revoke all on function public.is_master_admin() from public, anon;
revoke all on function public.current_partner_id() from public, anon;
revoke all on function public.can_manage_partner_quotes() from public, anon;
grant execute on function public.is_master_admin() to authenticated;
grant execute on function public.current_partner_id() to authenticated;
grant execute on function public.can_manage_partner_quotes() to authenticated;

drop policy if exists "Master reads partners" on public.partners;
drop policy if exists "Partner reads own partner" on public.partners;
drop policy if exists "Master manages partners" on public.partners;
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users read own profile or company profiles" on public.profiles;
drop policy if exists "Master manages profiles" on public.profiles;
drop policy if exists "Partner admin manages own users" on public.profiles;
drop policy if exists "Products visible to authenticated users" on public.products;
drop policy if exists "Product formats visible to authenticated users" on public.product_formats;
drop policy if exists "Processors visible to authenticated users" on public.processors;
drop policy if exists "Service pricing visible to authenticated users" on public.service_pricing;
drop policy if exists "Master manages catalog" on public.products;
drop policy if exists "Master manages formats" on public.product_formats;
drop policy if exists "Master manages processors" on public.processors;
drop policy if exists "Master manages service pricing" on public.service_pricing;
drop policy if exists "Clients are partner scoped" on public.clients;
drop policy if exists "Partners create own clients" on public.clients;
drop policy if exists "Partners update own clients" on public.clients;
drop policy if exists "Master manages clients" on public.clients;
drop policy if exists "Quotes are partner scoped" on public.quotes;
drop policy if exists "Partners create own quotes" on public.quotes;
drop policy if exists "Partners update own quotes" on public.quotes;
drop policy if exists "Quote owners delete own quotes" on public.quotes;
drop policy if exists "Master manages quotes" on public.quotes;
drop policy if exists "Quote events follow quote visibility" on public.quote_events;
drop policy if exists "Partners create quote events" on public.quote_events;
drop policy if exists "Master manages quote events" on public.quote_events;

create policy "Master reads partners"
on public.partners for select
to authenticated
using (public.is_master_admin());

create policy "Partner reads own partner"
on public.partners for select
to authenticated
using (id = public.current_partner_id());

create policy "Master manages partners"
on public.partners for all
to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

create policy "Users read own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or public.is_master_admin());

create policy "Master manages profiles"
on public.profiles for all
to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

create policy "Products visible to authenticated users"
on public.products for select
to authenticated
using (active = true);

create policy "Product formats visible to authenticated users"
on public.product_formats for select
to authenticated
using (active = true);

create policy "Processors visible to authenticated users"
on public.processors for select
to authenticated
using (active = true);

create policy "Service pricing visible to authenticated users"
on public.service_pricing for select
to authenticated
using (active = true);

create policy "Master manages catalog"
on public.products for all
to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

create policy "Master manages formats"
on public.product_formats for all
to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

create policy "Master manages processors"
on public.processors for all
to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

create policy "Master manages service pricing"
on public.service_pricing for all
to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

create policy "Clients are partner scoped"
on public.clients for select
to authenticated
using (public.is_master_admin() or partner_id = public.current_partner_id());

create policy "Partners create own clients"
on public.clients for insert
to authenticated
with check (partner_id = public.current_partner_id() and created_by = (select auth.uid()));

create policy "Partners update own clients"
on public.clients for update
to authenticated
using (
  partner_id = public.current_partner_id()
  and (created_by = (select auth.uid()) or public.can_manage_partner_quotes())
)
with check (
  partner_id = public.current_partner_id()
  and (created_by = (select auth.uid()) or public.can_manage_partner_quotes())
);

create policy "Master manages clients"
on public.clients for all
to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

create policy "Quotes are partner scoped"
on public.quotes for select
to authenticated
using (
  public.is_master_admin()
  or (
    partner_id = public.current_partner_id()
    and (created_by = (select auth.uid()) or public.can_manage_partner_quotes())
  )
);

create policy "Partners create own quotes"
on public.quotes for insert
to authenticated
with check (partner_id = public.current_partner_id() and created_by = (select auth.uid()));

create policy "Partners update own quotes"
on public.quotes for update
to authenticated
using (
  partner_id = public.current_partner_id()
  and (created_by = (select auth.uid()) or public.can_manage_partner_quotes())
)
with check (
  partner_id = public.current_partner_id()
  and (created_by = (select auth.uid()) or public.can_manage_partner_quotes())
);

create policy "Quote owners delete own quotes"
on public.quotes for delete
to authenticated
using (
  created_by = (select auth.uid())
  or public.is_master_admin()
  or (partner_id = public.current_partner_id() and public.can_manage_partner_quotes())
);

create policy "Master manages quotes"
on public.quotes for all
to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

create policy "Quote events follow quote visibility"
on public.quote_events for select
to authenticated
using (
  public.is_master_admin()
  or exists (
    select 1
    from public.quotes q
    where q.id = quote_id
      and q.partner_id = public.current_partner_id()
      and (q.created_by = (select auth.uid()) or public.can_manage_partner_quotes())
  )
);

create policy "Partners create quote events"
on public.quote_events for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.quotes q
    where q.id = quote_id
      and q.partner_id = public.current_partner_id()
  )
);

create policy "Master manages quote events"
on public.quote_events for all
to authenticated
using (public.is_master_admin())
with check (public.is_master_admin());

create index if not exists profiles_partner_id_idx on public.profiles(partner_id);
create index if not exists clients_partner_id_idx on public.clients(partner_id);
create index if not exists clients_created_by_idx on public.clients(created_by);
create index if not exists quotes_partner_id_idx on public.quotes(partner_id);
create index if not exists quotes_created_by_idx on public.quotes(created_by);
create index if not exists quotes_client_id_idx on public.quotes(client_id);
create index if not exists quote_events_quote_id_idx on public.quote_events(quote_id);
create index if not exists quote_events_user_id_idx on public.quote_events(user_id);

notify pgrst, 'reload schema';
