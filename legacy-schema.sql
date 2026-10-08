create table public.atlas_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_date date not null,
  status text not null check (status in ('feito','adaptado','não feito')),
  km numeric check (km >= 0 and km <= 100),
  minutes numeric check (minutes > 0 and minutes <= 1440),
  effort integer check (effort between 0 and 10),
  pain integer check (pain between 0 and 10),
  recovery text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, workout_date)
);
alter table public.atlas_records enable row level security;
revoke all on public.atlas_records from anon;
grant select, insert, update, delete on public.atlas_records to authenticated;
create policy own_select on public.atlas_records for select to authenticated using ((select auth.uid()) = user_id);
create policy own_insert on public.atlas_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy own_update on public.atlas_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_delete on public.atlas_records for delete to authenticated using ((select auth.uid()) = user_id);
