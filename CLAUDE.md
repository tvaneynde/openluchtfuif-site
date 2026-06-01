# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
npm run lint      # ESLint
npm run deploy    # Build + publish to GitHub Pages (gh-pages -d dist)
```

## Architecture

Single-page React app deployed to GitHub Pages at `https://tvaneynde.github.io/openluchtfuif-site/`.

**Routing:** `src/main.jsx` wraps everything in a `HashRouter`. Two routes exist:
- `/` → `App.jsx` (main landing page)
- `/archief` → `src/pages/Archive.jsx` (photo archive with masonry grid + lightbox)

**Structure:** `src/App.jsx` composes all sections in a fixed scroll order. Each section is a standalone component in `src/components/`. There is no state management library — all state is local React hooks.

**Actual section order in App.jsx:** Hero → Lineup → Tickets → Partners → photo strip + marquee → Info → FAQ → Edities → About → Footer

**Scroll behavior:** `App.jsx` has a `useActiveSection` hook that watches scroll position and passes the active section ID to `<Nav>`. A separate `IntersectionObserver` in `App.jsx` triggers `.scroll-reveal` animations globally by adding the `.in` class when elements enter the viewport.

**Styling:** All styles live in `src/index.css` — no CSS modules, no Tailwind. CSS custom properties on `:root` define the full design token set (colors, fonts). The design aesthetic is "groovy 70s spray-paint risograph."

**Assets:** Static assets (images, fonts) live in `public/assets/` and are referenced via `import.meta.env.BASE_URL` (e.g. `` `${import.meta.env.BASE_URL}/assets/hero-dancers.png` ``). This is required because Vite is configured with `base: "/openluchtfuif-site"`.

**Fonts:** Custom display font `Rugrats` loaded via `@font-face` from `public/assets/fonts/Rugrats.otf`. Body font is `Space Grotesk` (loaded from Google Fonts in `index.html`).

**Design tokens (CSS vars):**
- Colors: `--purple-deep`, `--purple`, `--purple-soft`, `--purple-mauve`, `--orange`, `--orange-bright`, `--cream`, `--cream-dim`, `--ink`
- Fonts: `--display` (Rugrats), `--body` (Space Grotesk), `--mono` (JetBrains Mono)

Each section uses a `.section-head` pattern with a `.section-num` (mono label) and `.section-title` (display font heading).

## Supabase

Remote images (gallery photos, artist photos, partner logos) are served from Supabase Storage. The helper in `src/utils/supabase.js` exports:
- `supabase` — authenticated client
- `imgUrl(path)` — builds a public URL into the `images` bucket, e.g. `imgUrl('archive/photo.jpg')`, `imgUrl('artists/thurbo.jpg')`

Required env vars (create a `.env.local`):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```
