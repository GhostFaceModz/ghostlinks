-- Presentation choices for GhostLinks (splash style + effect list).
-- Adds a settings object only to a GhostLinks-shaped table.
-- The shared profiles table is left alone unless it already has youtube_tracks,
-- which is how this app's own table is recognised.

do $$
begin
  if to_regclass('public.ghostlinks_profiles') is not null then
    execute 'alter table public.ghostlinks_profiles add column if not exists settings jsonb not null default ''{}''::jsonb';
  elsif to_regclass('public.profiles') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'youtube_tracks'
    ) then
    execute 'alter table public.profiles add column if not exists settings jsonb not null default ''{}''::jsonb';
  end if;
end $$;
