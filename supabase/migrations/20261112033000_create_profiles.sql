-- GhostLinks profiles.
-- Run in the Supabase SQL editor, or with the Supabase CLI, before opening the editor.
-- The anon key may read published pages. Only the signed-in user can write their row.
-- Do not put a service-role key in the browser. Authorization uses auth.uid(), never user_metadata.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.reserved_usernames()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'admin', 'api', 'ghostflix', 'ghostgames', 'ghostfacezen', 'www',
    'editor', 'create', 'index', 'demo', 'login', 'signin', 'signup',
    'auth', 'callback', 'assets', 'css', 'js', 'fonts', 'supabase',
    'config', 'ghostlinks', 'ghostapps', 'support', 'help', 'about',
    'static', 'app', 'dashboard', 'settings', 'account', 'favicon',
    'public', 'user', 'users', 'null', 'undefined', '404', 'redirect', 'tests'
  ];
$$;

revoke all on function private.reserved_usernames() from public;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  bio text not null default '',
  avatar_url text,
  theme text not null default 'nebula',
  background text not null default 'aurora',
  accent_color text not null default '#8f6cff',
  font text not null default 'unbounded',
  links jsonb not null default '[]'::jsonb,
  youtube_tracks jsonb not null default '[]'::jsonb,
  enter_screen boolean not null default true,
  discord_user_id text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z][a-z0-9_]{2,19}$'),
  constraint profiles_username_unique unique (username),
  constraint profiles_accent_format check (accent_color ~ '^#[0-9a-f]{6}$'),
  constraint profiles_theme_known check (theme in ('nebula', 'void', 'frost', 'rose', 'ember', 'mint')),
  constraint profiles_background_known check (background in ('aurora', 'stars', 'rain', 'grid', 'embers', 'still')),
  constraint profiles_font_known check (font in ('unbounded', 'syne', 'outfit', 'grotesk', 'fraunces', 'system')),
  constraint profiles_links_array check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 10),
  constraint profiles_tracks_array check (jsonb_typeof(youtube_tracks) = 'array' and jsonb_array_length(youtube_tracks) <= 5),
  constraint profiles_name_length check (char_length(display_name) between 1 and 40),
  constraint profiles_bio_length check (char_length(bio) <= 280)
);

comment on table public.profiles is 'Public GhostLinks pages. One row per signed-in user.';

create or replace function private.guard_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  elem jsonb;
  url text;
  platform text;
  label text;
  clean_links jsonb := '[]'::jsonb;
  clean_tracks jsonb := '[]'::jsonb;
  track_id text;
  track_title text;
  track_artist text;
begin
  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception 'The profile id cannot change';
  end if;

  if auth.uid() is not null and new.id is distinct from auth.uid() then
    raise exception 'You can only edit your own page';
  end if;

  new.username := lower(btrim(new.username));
  if new.username !~ '^[a-z][a-z0-9_]{2,19}$' then
    raise exception 'invalid username';
  end if;
  if new.username = any (private.reserved_usernames()) then
    raise exception 'username is reserved';
  end if;

  new.display_name := btrim(new.display_name);
  if char_length(new.display_name) < 1 or char_length(new.display_name) > 40 then
    raise exception 'display name must be 1 to 40 characters';
  end if;

  new.bio := btrim(coalesce(new.bio, ''));
  if char_length(new.bio) > 280 then
    raise exception 'bio is too long';
  end if;

  new.accent_color := lower(btrim(new.accent_color));
  if new.theme not in ('nebula', 'void', 'frost', 'rose', 'ember', 'mint') then
    raise exception 'unknown theme';
  end if;
  if new.background not in ('aurora', 'stars', 'rain', 'grid', 'embers', 'still') then
    raise exception 'unknown background';
  end if;
  if new.font not in ('unbounded', 'syne', 'outfit', 'grotesk', 'fraunces', 'system') then
    raise exception 'unknown font';
  end if;

  if new.avatar_url is null or btrim(new.avatar_url) = '' then
    new.avatar_url := null;
  else
    if char_length(new.avatar_url) > 380000 then
      raise exception 'avatar is too large';
    end if;
    if new.avatar_url ~ '^https://[^/]*@' then
      raise exception 'avatar URL cannot include a password';
    end if;
    if new.avatar_url !~ '^https://[^[:space:]]+$'
       and new.avatar_url !~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$' then
      raise exception 'avatar must be an https URL or a small image';
    end if;
  end if;

  if jsonb_typeof(new.links) is distinct from 'array' or jsonb_array_length(new.links) > 10 then
    raise exception 'invalid links';
  end if;
  for elem in select item from jsonb_array_elements(new.links) as t(item)
  loop
    url := elem->>'url';
    if url is null or url !~ '^https://[^[:space:]]{1,480}$' or url ~ '^https://[^/]*@' then
      raise exception 'each link must be an https URL';
    end if;
    platform := coalesce(elem->>'platform', 'custom');
    if platform not in ('discord', 'youtube', 'tiktok', 'x', 'instagram', 'twitch', 'github', 'spotify', 'custom') then
      platform := 'custom';
    end if;
    label := left(btrim(coalesce(elem->>'label', '')), 32);
    clean_links := clean_links || jsonb_build_array(jsonb_build_object(
      'url', url,
      'platform', platform,
      'label', label
    ));
  end loop;
  new.links := clean_links;

  if jsonb_typeof(new.youtube_tracks) is distinct from 'array' or jsonb_array_length(new.youtube_tracks) > 5 then
    raise exception 'invalid tracks';
  end if;
  for elem in select item from jsonb_array_elements(new.youtube_tracks) as t(item)
  loop
    track_id := elem->>'id';
    if track_id is null or track_id !~ '^[A-Za-z0-9_-]{11}$' then
      raise exception 'each track needs an 11 character YouTube id';
    end if;
    track_title := left(btrim(coalesce(elem->>'title', '')), 80);
    track_artist := left(btrim(coalesce(elem->>'artist', '')), 80);
    clean_tracks := clean_tracks || jsonb_build_array(jsonb_build_object(
      'id', track_id,
      'title', track_title,
      'artist', track_artist
    ));
  end loop;
  new.youtube_tracks := clean_tracks;

  select i.provider_id into new.discord_user_id
  from auth.identities as i
  where i.user_id = new.id and i.provider = 'discord'
  limit 1;

  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.guard_profile() from public, anon, authenticated;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function private.guard_profile();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update, delete on public.profiles to authenticated;

create policy profiles_select_published
  on public.profiles
  for select
  to anon, authenticated
  using (published = true or id = (select auth.uid()));

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_delete_own
  on public.profiles
  for delete
  to authenticated
  using (id = (select auth.uid()));

-- Returns true only when the name is free. Security definer so unpublished
-- rows still count as taken, without exposing those rows.
create or replace function private.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    candidate is not null
    and lower(btrim(candidate)) ~ '^[a-z][a-z0-9_]{2,19}$'
    and not (lower(btrim(candidate)) = any (private.reserved_usernames()))
    and not exists (
      select 1
      from public.profiles as p
      where p.username = lower(btrim(candidate))
    );
$$;

revoke all on function private.username_available(text) from public;
grant execute on function private.username_available(text) to anon, authenticated;

create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.username_available(candidate);
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
