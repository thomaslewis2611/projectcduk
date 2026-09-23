-- 002: lock down access, fix referential/uniqueness rules, add a flat query view.

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Tables in `public` are exposed through PostgREST to anyone holding the
-- publishable (anon) key, which ships to the browser. Without RLS that means
-- anyone can read AND write every row. Enable RLS everywhere, then allow
-- read-only access. All writes go through server functions using the
-- service-role key, which bypasses RLS.
alter table public.reports enable row level security;
alter table public.regions enable row level security;
alter table public.building_types enable row level security;
alter table public.size_bands enable row level security;
alter table public.price_indices enable row level security;

create policy "Public read" on public.reports for select to anon, authenticated using (true);
create policy "Public read" on public.regions for select to anon, authenticated using (true);
create policy "Public read" on public.building_types for select to anon, authenticated using (true);
create policy "Public read" on public.size_bands for select to anon, authenticated using (true);
create policy "Public read" on public.price_indices for select to anon, authenticated using (true);

-- Source PDFs are not public. Server functions access them with the service role.
update storage.buckets set public = false where id = 'reports';

-- ---------------------------------------------------------------------------
-- Deleting a report removes its data points
-- ---------------------------------------------------------------------------
alter table public.price_indices
  drop constraint price_indices_report_id_fkey,
  add constraint price_indices_report_id_fkey
    foreign key (report_id) references public.reports (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Dedupe key: treat NULL region/type/size as equal (Postgres 15+)
-- ---------------------------------------------------------------------------
-- The original constraint's auto-generated name exceeds 63 chars and is
-- truncated by Postgres, so look it up rather than hard-coding it.
do $$
declare
  con text;
begin
  select c.conname into con
  from pg_constraint c
  where c.conrelid = 'public.price_indices'::regclass and c.contype = 'u';
  if con is not null then
    execute format('alter table public.price_indices drop constraint %I', con);
  end if;
end $$;
alter table public.price_indices
  add constraint price_indices_dedupe_key
    unique nulls not distinct (report_id, region_id, building_type_id, size_band_id);

-- ---------------------------------------------------------------------------
-- Flat view for querying/filtering/ordering without nested joins
-- ---------------------------------------------------------------------------
-- security_invoker: the view applies the caller's RLS, not the owner's.
create view public.price_index_rows
with (security_invoker = true) as
select
  pi.id,
  pi.report_id,
  r.year,
  r.quarter,
  r.report_date,
  pi.region_id,
  rg.name as region,
  pi.building_type_id,
  bt.name as building_type,
  bt.category as building_category,
  pi.size_band_id,
  sb.label as size_band,
  sb.min_sqft,
  sb.max_sqft,
  pi.index_value,
  pi.price_per_sqft,
  pi.base_period,
  pi.currency,
  pi.notes
from public.price_indices pi
join public.reports r on r.id = pi.report_id
left join public.regions rg on rg.id = pi.region_id
left join public.building_types bt on bt.id = pi.building_type_id
left join public.size_bands sb on sb.id = pi.size_band_id;

grant select on public.price_index_rows to anon, authenticated;
