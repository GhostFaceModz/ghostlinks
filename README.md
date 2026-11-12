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

## Publish with Supabase and GitHub Pages

Both have free plans. The anon key is public by design. Never put the service-role key, secret key, or database password in `config.js` or anywhere else in this repo. If a service-role key is pasted in, the editor refuses to start.

1. Create a Supabase project.
2. In the SQL editor, run `supabase/migrations/20261112033000_create_profiles.sql`.
3. Authentication → URL configuration:
   - Site URL: `https://ghostapps.org` (or your Pages URL while testing).
   - Add redirect URLs: `https://ghostapps.org/editor.html`, `http://127.0.0.1:8080/editor.html`, and the GitHub Pages editor URL if you use one.
4. Authentication → Providers → Discord. Create a Discord application, and set its OAuth2 redirect to the Supabase callback shown in that panel (`https://<project-ref>.supabase.co/auth/v1/callback`). Enable the provider with the Discord client id and secret. Those secrets stay in the Supabase dashboard.
5. Copy the project URL and the **anon** (or publishable) key into `config.js`:

```js
window.GHOSTLINKS_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_KEY"
};
```

6. GitHub → Settings → Pages → Deploy from a branch → root of the branch. `.nojekyll` is already in the repo so asset folders are published as-is.
7. For `ghostapps.org/<username>`, point the domain at this Pages site when you are ready. `404.html` sends `/username` to `/?u=username`. On a `*.github.io` project site (`/ghostlinks/username`) the first path segment is kept.

Sign-in returns to `editor.html`. Each Discord user gets one row in `profiles`. They can insert and update only that row. Anyone can read a published page. Unpublished pages are visible to the owner only. Usernames are unique and lowercase.

Reserved names include `admin`, `api`, `ghostflix`, `ghostgames`, `ghostfacezen`, and `www`, plus routes the site needs (`editor`, `demo`, `assets`, and the rest of the list in the migration).

Open Graph tags on the shell are a fallback. Per-person images need a server later; crawlers do not run the page script. The visible page title and description do update in the browser.

View counts are stored in this browser only (`visits on this device`). They are not a global counter.

## What a page can contain

- Username, display name, bio, avatar (https URL or a small image kept on the row)
- Up to 10 links. Discord, YouTube, TikTok, X, Instagram, Twitch, GitHub, and Spotify pick an icon from the URL. Anything else uses a generic icon.
- Six themes, six backgrounds, an accent colour, and six fonts
- Click-to-enter on or off
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
