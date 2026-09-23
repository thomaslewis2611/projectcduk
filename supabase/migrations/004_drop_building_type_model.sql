-- 004: the site is TPI-focused. Drop the building type × size band × £/sqft
-- model from the initial build; no source provides that data, and its
-- ingestion never stored any rows.

drop view if exists public.price_index_rows;
drop table if exists public.price_indices;
drop table if exists public.regions;
drop table if exists public.building_types;
drop table if exists public.size_bands;

-- Only used by the generic parser.
alter table public.reports drop column if exists report_date;
