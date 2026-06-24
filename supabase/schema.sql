create extension if not exists pgcrypto;
create extension if not exists unaccent;

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  trade_name text,
  cnpj text,
  email text,
  phone text,
  city text,
  state text,
  status text default 'active',
  created_at timestamp default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id),
  partner_id uuid references partners(id),
  name text not null,
  email text not null,
  role text not null check (role in ('master_admin', 'partner_admin', 'seller')),
  can_view_company_quotes boolean default true,
  created_at timestamp default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references partners(id),
  name text not null,
  document text,
  phone text,
  email text,
  city text,
  state text,
  project_name text,
  installation_site text,
  notes text,
  commercial_status text default 'active',
  created_by uuid references profiles(id),
  created_at timestamp default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('indoor', 'outdoor')),
  technology text not null,
  pixel_pitch text not null,
  pixel_pitch_mm numeric not null,
  cabinet_size text,
  price_per_sqm numeric not null,
  supplier text default 'LED Wave',
  processor_system text default 'NovaStar',
  lifespan_hours integer default 100000,
  application text,
  description text,
  recommended_use text,
  technical_specs jsonb,
  active boolean default true,
  created_at timestamp default now()
);

create table if not exists product_formats (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  width numeric not null,
  height numeric not null,
  label text,
  format_type text,
  active boolean default true
);

create table if not exists processors (
  id uuid primary key default gen_random_uuid(),
  brand text not null default 'NovaStar',
  name text not null,
  ports integer not null,
  price numeric default 0,
  active boolean default true,
  created_at timestamp default now()
);

create table if not exists service_pricing (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  pricing_type text not null,
  price numeric not null,
  active boolean default true,
  created_at timestamp default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references partners(id),
  client_id uuid references clients(id),
  created_by uuid references profiles(id),
  product_id uuid references products(id),
  quote_number text unique,
  status text default 'draft',
  width numeric not null,
  height numeric not null,
  area numeric not null,
  aspect_ratio numeric,
  format_type text,
  pixel_pitch_mm numeric,
  pixels_width integer,
  pixels_height integer,
  total_pixels integer,
  required_processor_ports integer,
  suggested_processor_name text,
  suggested_processor_ports integer,
  price_per_sqm numeric not null,
  panel_subtotal numeric not null,
  include_structure boolean default false,
  include_installation boolean default false,
  include_processor boolean default true,
  include_freight boolean default false,
  include_technical_visit boolean default false,
  include_extended_warranty boolean default false,
  structure_base_cost numeric default 0,
  installation_base_cost numeric default 0,
  processor_cost numeric default 0,
  freight_cost numeric default 0,
  technical_visit_cost numeric default 0,
  extended_warranty_cost numeric default 0,
  margin_percent numeric default 0,
  internal_margin_value numeric default 0,
  subtotal_with_margin numeric default 0,
  discount_percent numeric default 0,
  discount_value numeric default 0,
  total numeric not null,
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references quotes(id) on delete cascade,
  user_id uuid references profiles(id),
  event_type text not null,
  description text,
  created_at timestamp default now()
);

alter table partners enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table products enable row level security;
alter table product_formats enable row level security;
alter table processors enable row level security;
alter table service_pricing enable row level security;
alter table quotes enable row level security;
alter table quote_events enable row level security;

create or replace function public.current_profile()
returns profiles
language sql
security definer
stable
as $$
  select * from profiles where id = auth.uid();
$$;

create or replace function public.is_master_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'master_admin');
$$;

create or replace function public.current_partner_id()
returns uuid
language sql
security definer
stable
as $$
  select partner_id from profiles where id = auth.uid();
$$;

create policy "Master reads partners" on partners for select using (is_master_admin());
create policy "Partner reads own partner" on partners for select using (id = current_partner_id());
create policy "Master manages partners" on partners for all using (is_master_admin()) with check (is_master_admin());

create policy "Users read own profile or company profiles" on profiles
for select using (is_master_admin() or partner_id = current_partner_id() or id = auth.uid());
create policy "Master manages profiles" on profiles for all using (is_master_admin()) with check (is_master_admin());
create policy "Partner admin manages own users" on profiles
for all using (
  partner_id = current_partner_id()
  and exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'partner_admin')
) with check (partner_id = current_partner_id());

create policy "Products visible to authenticated users" on products for select using (auth.uid() is not null and active = true);
create policy "Product formats visible to authenticated users" on product_formats for select using (auth.uid() is not null and active = true);
create policy "Processors visible to authenticated users" on processors for select using (auth.uid() is not null and active = true);
create policy "Service pricing visible to authenticated users" on service_pricing for select using (auth.uid() is not null and active = true);
create policy "Master manages catalog" on products for all using (is_master_admin()) with check (is_master_admin());
create policy "Master manages formats" on product_formats for all using (is_master_admin()) with check (is_master_admin());
create policy "Master manages processors" on processors for all using (is_master_admin()) with check (is_master_admin());
create policy "Master manages service pricing" on service_pricing for all using (is_master_admin()) with check (is_master_admin());

create policy "Clients are partner scoped" on clients
for select using (is_master_admin() or partner_id = current_partner_id());
create policy "Partners create own clients" on clients
for insert with check (partner_id = current_partner_id());
create policy "Partners update own clients" on clients
for update using (partner_id = current_partner_id()) with check (partner_id = current_partner_id());

create policy "Quotes are partner scoped" on quotes
for select using (
  is_master_admin()
  or partner_id = current_partner_id()
  and (
    created_by = auth.uid()
    or exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'partner_admin')
    or exists(select 1 from profiles p where p.id = auth.uid() and p.can_view_company_quotes = true)
  )
);
create policy "Partners create own quotes" on quotes
for insert with check (partner_id = current_partner_id() and created_by = auth.uid());
create policy "Partners update own quotes" on quotes
for update using (partner_id = current_partner_id()) with check (partner_id = current_partner_id());

create policy "Quote events follow quote visibility" on quote_events
for select using (
  is_master_admin()
  or exists(select 1 from quotes q where q.id = quote_id and q.partner_id = current_partner_id())
);
create policy "Partners create quote events" on quote_events
for insert with check (
  user_id = auth.uid()
  and exists(select 1 from quotes q where q.id = quote_id and q.partner_id = current_partner_id())
);

create or replace function public.check_client_conflict(input_name text, input_document text)
returns table(conflict_type text, message text)
language plpgsql
security definer
as $$
begin
  if input_document is not null and regexp_replace(input_document, '\D', '', 'g') <> '' then
    if exists (
      select 1 from clients
      where regexp_replace(coalesce(document, ''), '\D', '', 'g') = regexp_replace(input_document, '\D', '', 'g')
      and partner_id <> current_partner_id()
    ) then
      return query select
        'blocked'::text,
        'Este cliente já possui registro comercial ativo na Boreal. Entre em contato com a Boreal para validação comercial.'::text;
      return;
    end if;
  end if;

  if input_name is not null and length(input_name) > 4 then
    if exists (
      select 1 from clients
      where lower(unaccent(name)) like '%' || lower(unaccent(left(input_name, 8))) || '%'
      and partner_id <> current_partner_id()
    ) then
      return query select
        'similar'::text,
        'Encontramos um cliente com nome semelhante. Verifique antes de prosseguir.'::text;
      return;
    end if;
  end if;

  return query select 'none'::text, ''::text;
end;
$$;

insert into processors (brand, name, ports, price) values
('NovaStar', 'VC2', 2, 0),
('NovaStar', 'VX400 PRO', 4, 0),
('NovaStar', 'VX600 PRO', 6, 0),
('NovaStar', 'VX800 PRO', 8, 0),
('NovaStar', 'VX1000 PRO', 10, 0),
('NovaStar', 'VX2000 PRO', 20, 0)
on conflict do nothing;

insert into service_pricing (name, category, pricing_type, price) values
('Estrutura Indoor', 'indoor', 'per_sqm', 1000),
('Estrutura Outdoor', 'outdoor', 'per_sqm', 2000),
('Instalação', null, 'per_sqm', 600)
on conflict do nothing;
