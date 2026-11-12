# GhostLinks

Free, ad-free animated bio pages by GhostApps. Someone claims a username, picks a look, and shares `ghostapps.org/<username>`.

The visual language follows the GhostFaceZen bio (dark card, accent `#8f6cff`, click-to-enter ghost, music player). That repository is not part of this project and is not modified.

No ads. No analytics. Fonts are self-hosted. The only third-party request on a published page is the YouTube player, and only when the page has tracks.

## Try the demo

No Supabase project is required. `config.js` ships with empty placeholders, and empty means demo mode: the editor saves in this browser, and `?u=demo` is a built-in page.

```bash
npm test
npm run preview
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

- Landing page explains GhostLinks and links to six theme examples.
- [Editor](http://127.0.0.1:8080/editor.html) edits a starter page with a live preview beside the form (stacked on a narrow window).
- [Demo page](http://127.0.0.1:8080/?u=demo) plays the click-to-enter animation. The ghost flies off and stays gone.
- Pretty paths work with this preview server the same way they do on GitHub Pages: [http://127.0.0.1:8080/demo](http://127.0.0.1:8080/demo) redirects to `/?u=demo`.

`python3 -m http.server 8080` also serves the site. Use `/?u=username` there. Python does not serve `404.html` for unknown paths; GitHub Pages does.

## Supabase and Discord

GhostLinks shares the existing GhostApps Supabase project. It does not create a new project, and it does not touch the shared `profiles` table. `config.js` already has the project URL and the publishable key. That key is public by design. Never put a service-role key in this repo.

Clear both `config.js` values to fall back to demo mode. `?u=demo` stays available either way.

1. In the SQL editor, run `supabase/migrations/20261112050000_ghostlinks_profiles.sql`, then `supabase/migrations/20261112061000_profile_settings.sql`, then `supabase/migrations/20261112070000_ghostlinks_settings_guard.sql`. The first creates `ghostlinks_` objects. The second adds `settings`. The third teaches the guard which splash styles and effects are allowed. Re-running them is safe.
2. Authentication → URL configuration. Leave the existing Site URL alone if GhostGames or GhostFlix already use it. Add these redirect URLs:
   - `https://ghostfacemodz.github.io/ghostlinks/editor.html`
   - `https://ghostfacemodz.github.io/ghostlinks/`
   - `http://127.0.0.1:8080/editor.html`
   - `http://localhost:8080/editor.html`
3. Discord’s OAuth callback stays the Supabase one (`https://rswtambjckwmlagydsvf.supabase.co/auth/v1/callback`). The provider itself is configured in the Supabase dashboard, not in this repo.

Sign-in returns to `editor.html` under the current site root: `/ghostlinks/editor.html` on the GitHub project site, or `/editor.html` on a custom domain. Each Discord user gets one row in `ghostlinks_profiles`. They can edit only that row. Anyone can read a published page.

The site is published from `GhsotFace` at `https://ghostfacemodz.github.io/ghostlinks/`. `404.html` sends `/ghostlinks/<username>` to `/?u=<username>`.

Reserved names include `admin`, `api`, `ghostflix`, `ghostgames`, `ghostfacezen`, and `www`, plus routes the site needs (`editor`, `demo`, `assets`, and the rest of the list in the migration). They are stored in `ghostlinks_reserved_usernames`.

Open Graph tags on the shell are a fallback. Per-person images need a server later; crawlers do not run the page script. The visible page title and description do update in the browser.

View counts are stored in this browser only (`visits on this device`). They are not a global counter.

## What a page can contain

- Username, display name, bio, avatar (https URL or a small image kept on the row)
- Up to 10 links. Discord, YouTube, TikTok, X, Instagram, Twitch, GitHub, and Spotify pick an icon from the URL. Anything else uses a generic icon.
- Six themes, six backgrounds, an accent colour, and six fonts
- Click-to-enter on or off, with 13 splash styles
- Stackable page effects (snow, fireflies, glow, a gradient name, and the rest), saved in the profile `settings` object
- Up to five YouTube or YouTube Music tracks

Backgrounds are CSS and a small canvas. Phones use fewer particles, skip the expensive blur, and draw at 30fps. Reduced motion and the Motion button turn the animation off. The splash ghost uses the same `.splash-ghost.flown` lock as the GhostFaceZen page so it cannot snap back onto the card after it leaves.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Landing, and the public page when `?u=` is set |
| `editor.html` | Editor |
| `404.html` | GitHub Pages pretty-path redirect |
| `config.js` | Public Supabase URL and anon key |
| `js/` | Editor, renderer, player, demo/Supabase store |
| `css/` | Landing, editor, and profile |
| `supabase/migrations/` | Profiles table, RLS, username check |
| `tests/` | `npm test`, and `npm run preview` |

Fonts under `fonts/` are SIL Open Font License. See `fonts/licenses/`.
