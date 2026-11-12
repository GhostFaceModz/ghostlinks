-- View counts for published GhostLinks pages.
-- One row per username. recent stores viewer keys seen in the last 6 hours
-- so a refresh does not add another view. Does not touch the shared profiles table.

create table if not exists public.ghostlinks_views (
  username text primary key,
  view_count bigint not null default 0,
  recent jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint ghostlinks_views_username_format check (username ~ '^[a-z][a-z0-9_]{2,19}$'),
  constraint ghostlinks_views_count_nonneg check (view_count >= 0),
  constraint ghostlinks_views_recent_object check (jsonb_typeof(recent) = 'object')
);

alter table public.ghostlinks_views enable row level security;
alter table public.ghostlinks_views force row level security;

revoke all on public.ghostlinks_views from public, anon, authenticated;

create or replace function public.ghostlinks_record_view(page_name text, viewer_key text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := lower(btrim(coalesce(page_name, '')));
  clean_key text := btrim(coalesce(viewer_key, ''));
  row public.ghostlinks_views%rowtype;
  pruned jsonb := '{}'::jsonb;
  pair record;
  stamp text;
begin
  if clean_name !~ '^[a-z][a-z0-9_]{2,19}$' then
    return 0;
  end if;
  if clean_key !~ '^[A-Za-z0-9_-]{16,64}$' then
    return 0;
  end if;
  if not exists (
    select 1
    from public.ghostlinks_profiles as page
    where page.username = clean_name and page.published = true
  ) then
    return 0;
  end if;

  insert into public.ghostlinks_views (username, view_count, recent)
  values (clean_name, 0, '{}'::jsonb)
  on conflict (username) do nothing;

  select * into row
  from public.ghostlinks_views
  where username = clean_name
  for update;

  for pair in select key, value from jsonb_each_text(row.recent)
  loop
    if pair.value ~ '^[0-9]+$' and to_timestamp(pair.value::bigint) > now() - interval '6 hours' then
      pruned := pruned || jsonb_build_object(pair.key, pair.value);
    end if;
  end loop;

  if not (pruned ? clean_key) then
    row.view_count := row.view_count + 1;
    stamp := floor(extract(epoch from now()))::text;
    pruned := pruned || jsonb_build_object(clean_key, stamp);
  end if;

  update public.ghostlinks_views
  set view_count = row.view_count,
      recent = pruned,
      updated_at = now()
  where username = clean_name;

  return row.view_count;
end;
$$;

revoke all on function public.ghostlinks_record_view(text, text) from public;
grant execute on function public.ghostlinks_record_view(text, text) to anon, authenticated;
