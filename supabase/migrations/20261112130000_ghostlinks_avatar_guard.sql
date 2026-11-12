-- Avatar choice on a GhostLinks page. settings.avatar is an id or empty.
-- Replaces ghostlinks_internal.ghostlinks_guard_profile. Does not touch the shared profiles table.
-- Apply after 20261112120000. Keeps splash, effects, splash_image, logo_image, avatar_frame, background, and background_media.
-- New settings keys are dropped unless they are listed in the jsonb_build_object below.

create or replace function ghostlinks_internal.ghostlinks_guard_profile()
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
  clean_effects jsonb := '[]'::jsonb;
  track_id text;
  track_title text;
  track_artist text;
  splash text;
  effect_id text;
  splash_image text;
  logo_image text;
  avatar_frame text;
  background text;
  background_media text;
  avatar text;
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
  if exists (
    select 1
    from public.ghostlinks_reserved_usernames as reserved
    where reserved.name = new.username
  ) then
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

  if new.settings is null or jsonb_typeof(new.settings) is distinct from 'object' then
    new.settings := '{}'::jsonb;
  end if;
  splash := coalesce(new.settings->>'splash', 'ghost');
  if splash not in (
    'ghost', 'glitch', 'neon', 'smoke', 'burst', 'typewriter', 'vhs',
    'matrix', 'dissolve', 'portal', 'floatin', 'shatter', 'fade'
  ) then
    raise exception 'unknown splash style';
  end if;
  if new.settings ? 'effects' and jsonb_typeof(new.settings->'effects') is distinct from 'array' then
    raise exception 'effects must be an array';
  end if;
  if coalesce(jsonb_array_length(new.settings->'effects'), 0) > 10 then
    raise exception 'too many effects';
  end if;
  if new.settings ? 'effects' then
    for elem in select item from jsonb_array_elements(new.settings->'effects') as t(item)
    loop
      if jsonb_typeof(elem) is distinct from 'string' then
        raise exception 'invalid effect';
      end if;
      effect_id := elem #>> '{}';
      if effect_id not in (
        'snow', 'rain', 'stars', 'fireflies', 'ghosts', 'sakura', 'bubbles',
        'smoke', 'aurora', 'trail', 'sparkle', 'tilt', 'glow', 'typewriter',
        'rainbow', 'glitch', 'parallax', 'visualiser'
      ) then
        raise exception 'unknown effect';
      end if;
      if not clean_effects @> jsonb_build_array(effect_id) then
        clean_effects := clean_effects || jsonb_build_array(effect_id);
      end if;
    end loop;
  end if;
  splash_image := coalesce(new.settings->>'splash_image', '');
  if splash_image <> ''
     and splash_image !~ '^assets/splash/splash-(0[1-9]|[12][0-9]|3[0-2])\.webp$'
     and splash_image !~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$'
  then
    raise exception 'invalid splash image';
  end if;
  if char_length(splash_image) > 180000 then
    raise exception 'splash image is too large';
  end if;
  logo_image := coalesce(new.settings->>'logo_image', '');
  if logo_image <> ''
     and logo_image !~ '^assets/brand/ghosts/ghost-[a-z0-9_-]{1,40}\.png$'
     and logo_image !~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$'
  then
    raise exception 'invalid logo image';
  end if;
  if char_length(logo_image) > 180000 then
    raise exception 'logo image is too large';
  end if;
  avatar_frame := lower(coalesce(new.settings->>'avatar_frame', ''));
  if avatar_frame <> '' and avatar_frame !~ '^[a-z0-9][a-z0-9_-]{0,31}$' then
    raise exception 'invalid avatar frame';
  end if;
  background := coalesce(new.settings->>'background', 'aurora');
  if background not in (
    'aurora', 'mesh', 'starfield', 'matrix', 'fog', 'bokeh', 'synthwave',
    'caustics', 'constellation', 'lava', 'snow', 'rain', 'mist', 'plasma', 'custom'
  ) then
    raise exception 'unknown background';
  end if;
  background_media := coalesce(new.settings->>'background_media', '');
  if background_media <> ''
     and background_media !~ '^data:(image/gif|video/webm|video/mp4);base64,[A-Za-z0-9+/=]+$'
  then
    raise exception 'invalid background media';
  end if;
  if char_length(background_media) > 180000 then
    raise exception 'background media is too large';
  end if;
  if background = 'custom' and background_media = '' then
    background := 'aurora';
  end if;
  avatar := lower(coalesce(new.settings->>'avatar', ''));
  if avatar <> '' and avatar !~ '^[a-z0-9][a-z0-9_-]{0,40}$' then
    raise exception 'invalid avatar';
  end if;
  new.settings := jsonb_build_object(
    'splash', splash,
    'effects', clean_effects,
    'splash_image', splash_image,
    'logo_image', logo_image,
    'avatar_frame', avatar_frame,
    'background', background,
    'background_media', background_media,
    'avatar', avatar
  );

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

revoke all on function ghostlinks_internal.ghostlinks_guard_profile() from public, anon, authenticated;
