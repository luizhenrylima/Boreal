create extension if not exists pgcrypto;
create extension if not exists unaccent;

create table if not exists public.partners (
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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id),
  partner_id uuid references public.partners(id),
  name text not null,
  email text not null,
  role text not null check (role in ('master_admin', 'partner_admin', 'seller')),
  can_view_company_quotes boolean default true,
  created_at timestamp default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id),
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
  created_by uuid references public.profiles(id),
  created_at timestamp default now()
);

create table if not exists public.products (
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
  created_at timestamp default now(),
  unique (technology, pixel_pitch)
);

create table if not exists public.product_formats (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  width numeric not null,
  height numeric not null,
  label text,
  format_type text,
  active boolean default true
);

create table if not exists public.processors (
  id uuid primary key default gen_random_uuid(),
  brand text not null default 'NovaStar',
  name text not null unique,
  ports integer not null,
  price numeric default 0,
  active boolean default true,
  created_at timestamp default now()
);

create table if not exists public.service_pricing (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  pricing_type text not null,
  price numeric not null,
  active boolean default true,
  created_at timestamp default now(),
  unique (name, category, pricing_type)
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.partners(id),
  client_id uuid references public.clients(id),
  created_by uuid references public.profiles(id),
  product_id uuid references public.products(id),
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

create table if not exists public.quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.quotes(id) on delete cascade,
  user_id uuid references public.profiles(id),
  event_type text not null,
  description text,
  created_at timestamp default now()
);

alter table public.partners enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.product_formats enable row level security;
alter table public.processors enable row level security;
alter table public.service_pricing enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_events enable row level security;

create or replace function public.is_master_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'master_admin';
$$;

create or replace function public.current_partner_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select partner_id from public.profiles where id = auth.uid();
$$;

drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users read own profile or company profiles" on public.profiles;
drop policy if exists "Master manages profiles" on public.profiles;
drop policy if exists "Partner admin manages own users" on public.profiles;
drop policy if exists "Master reads partners" on public.partners;
drop policy if exists "Partner reads own partner" on public.partners;
drop policy if exists "Master manages partners" on public.partners;
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
drop policy if exists "Master manages quotes" on public.quotes;
drop policy if exists "Quote events follow quote visibility" on public.quote_events;
drop policy if exists "Partners create quote events" on public.quote_events;
drop policy if exists "Master manages quote events" on public.quote_events;

create policy "Master reads partners" on public.partners for select using (public.is_master_admin());
create policy "Partner reads own partner" on public.partners for select using (id = public.current_partner_id());
create policy "Master manages partners" on public.partners for all using (public.is_master_admin()) with check (public.is_master_admin());

create policy "Users read own profile or company profiles" on public.profiles
for select using (id = auth.uid() or public.is_master_admin());
create policy "Master manages profiles" on public.profiles for all using (public.is_master_admin()) with check (public.is_master_admin());

create policy "Products visible to authenticated users" on public.products for select using (auth.uid() is not null and active = true);
create policy "Product formats visible to authenticated users" on public.product_formats for select using (auth.uid() is not null and active = true);
create policy "Processors visible to authenticated users" on public.processors for select using (auth.uid() is not null and active = true);
create policy "Service pricing visible to authenticated users" on public.service_pricing for select using (auth.uid() is not null and active = true);
create policy "Master manages catalog" on public.products for all using (public.is_master_admin()) with check (public.is_master_admin());
create policy "Master manages formats" on public.product_formats for all using (public.is_master_admin()) with check (public.is_master_admin());
create policy "Master manages processors" on public.processors for all using (public.is_master_admin()) with check (public.is_master_admin());
create policy "Master manages service pricing" on public.service_pricing for all using (public.is_master_admin()) with check (public.is_master_admin());

create policy "Clients are partner scoped" on public.clients
for select using (public.is_master_admin() or partner_id = public.current_partner_id());
create policy "Partners create own clients" on public.clients
for insert with check (partner_id = public.current_partner_id());
create policy "Partners update own clients" on public.clients
for update using (partner_id = public.current_partner_id()) with check (partner_id = public.current_partner_id());
create policy "Master manages clients" on public.clients
for all using (public.is_master_admin()) with check (public.is_master_admin());

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
create policy "Master manages quotes" on public.quotes
for all using (public.is_master_admin()) with check (public.is_master_admin());

create policy "Quote events follow quote visibility" on public.quote_events
for select using (
  public.is_master_admin()
  or exists(select 1 from public.quotes q where q.id = quote_id and q.partner_id = public.current_partner_id())
);
create policy "Partners create quote events" on public.quote_events
for insert with check (
  user_id = auth.uid()
  and exists(select 1 from public.quotes q where q.id = quote_id and q.partner_id = public.current_partner_id())
);
create policy "Master manages quote events" on public.quote_events
for all using (public.is_master_admin()) with check (public.is_master_admin());

create or replace function public.check_client_conflict(input_name text, input_document text)
returns table(conflict_type text, message text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if input_document is not null and regexp_replace(input_document, '\D', '', 'g') <> '' then
    if exists (
      select 1 from public.clients
      where regexp_replace(coalesce(document, ''), '\D', '', 'g') = regexp_replace(input_document, '\D', '', 'g')
      and partner_id <> public.current_partner_id()
    ) then
      return query select
        'blocked'::text,
        'Este cliente ja possui registro comercial ativo na Boreal. Entre em contato com a Boreal para validacao comercial.'::text;
      return;
    end if;
  end if;

  if input_name is not null and length(input_name) > 4 then
    if exists (
      select 1 from public.clients
      where lower(unaccent(name)) like '%' || lower(unaccent(left(input_name, 8))) || '%'
      and partner_id <> public.current_partner_id()
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

insert into public.partners (id, company_name, trade_name, email, city, state, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'Boreal Admin',
  'Boreal',
  'Luizhenrylima2002@gmail.com',
  'Cuiaba',
  'MT',
  'active'
)
on conflict (id) do update set
  company_name = excluded.company_name,
  trade_name = excluded.trade_name,
  email = excluded.email,
  status = 'active';

insert into public.profiles (id, partner_id, name, email, role, can_view_company_quotes)
values (
  'fbcd8cea-273c-4dda-a699-509caf33990e',
  '00000000-0000-0000-0000-000000000001',
  'Luiz Henry Lima',
  'Luizhenrylima2002@gmail.com',
  'master_admin',
  true
)
on conflict (id) do update set
  partner_id = excluded.partner_id,
  name = excluded.name,
  email = excluded.email,
  role = 'master_admin',
  can_view_company_quotes = true;

insert into public.processors (brand, name, ports, price) values
('NovaStar', 'VC2', 2, 0),
('NovaStar', 'VX400 PRO', 4, 0),
('NovaStar', 'VX600 PRO', 6, 0),
('NovaStar', 'VX800 PRO', 8, 0),
('NovaStar', 'VX1000 PRO', 10, 0),
('NovaStar', 'VX2000 PRO', 20, 0)
on conflict (name) do update set ports = excluded.ports, price = excluded.price, active = true;

insert into public.service_pricing (name, category, pricing_type, price) values
('Estrutura Indoor', 'indoor', 'per_sqm', 1000),
('Estrutura Outdoor', 'outdoor', 'per_sqm', 2000),
('Instalacao', null, 'per_sqm', 600)
on conflict (name, category, pricing_type) do update set price = excluded.price, active = true;

insert into public.products (category, technology, pixel_pitch, pixel_pitch_mm, cabinet_size, price_per_sqm, supplier, processor_system, lifespan_hours, application, recommended_use, active) values
('indoor', 'COB', 'P1.2', 1.2, '0,60 x 0,33', 37253.82, 'LED Wave', 'NovaStar', 100000, 'Indoor Ultrawide / Cinema', 'Cinema residencial, auditorios premium, salas executivas e ambientes de alto padrao.', true),
('indoor', 'COB', 'P1.5', 1.5, '0,60 x 0,33', 31622.2, 'LED Wave', 'NovaStar', 100000, 'Indoor Ultrawide / Cinema', 'Auditorios, salas de reuniao, ambientes internos premium e projetos corporativos.', true),
('indoor', 'GOB', 'P1.5', 1.5, '0,64 x 0,48', 22169.9, 'LED Wave', 'NovaStar', 100000, 'Indoor Ultrawide / Cinema', 'Auditorios, igrejas, ambientes corporativos e areas de circulacao.', true),
('indoor', 'GOB', 'P1.8', 1.8, '0,64 x 0,48', 19701.08, 'LED Wave', 'NovaStar', 100000, 'Indoor Ultrawide / Cinema', 'Igrejas, lojas, auditorios e ambientes internos com bom custo-beneficio.', true),
('indoor', 'SMD', 'P2.5', 2.5, '0,64 x 0,48', 11672.9, 'LED Wave', 'NovaStar', 100000, 'Indoor Ultrawide / Cinema', 'Ambientes comerciais, igrejas, saloes, varejo e comunicacao interna.', true),
('outdoor', 'SMD Outdoor', 'P2.5', 2.5, null, 19782, 'LED Wave', 'NovaStar', 100000, 'Outdoor', 'Fachadas premium e areas externas com curta distancia de visualizacao.', true),
('outdoor', 'SMD Outdoor', 'P2.9', 2.9, null, 14728, 'LED Wave', 'NovaStar', 100000, 'Outdoor', 'Fachadas, comunicacao externa e paineis publicitarios.', true),
('outdoor', 'SMD Outdoor', 'P3.9', 3.9, null, 12220.88, 'LED Wave', 'NovaStar', 100000, 'Outdoor', 'Outdoors digitais, fachadas comerciais e areas externas.', true)
on conflict (technology, pixel_pitch) do update set
  category = excluded.category,
  pixel_pitch_mm = excluded.pixel_pitch_mm,
  cabinet_size = excluded.cabinet_size,
  price_per_sqm = excluded.price_per_sqm,
  application = excluded.application,
  recommended_use = excluded.recommended_use,
  active = true;

notify pgrst, 'reload schema';
