# kerizov.design

Personal portfolio landing page with premium glass-card aesthetics and terminal-inspired UI.

## Stack

**Core**
- Astro 5 (SSR, Node adapter)
- TypeScript
- SCSS / CSS custom properties (dark/light theming via `data-theme`)

**Fonts & visuals**
- Alumni Sans (headings), JetBrains Mono (code/terminal UI)
- GSAP + ScrollTrigger (scroll-driven reveals)
- CSS 3D transforms, perspective (card carousels)
- Canvas API (procedural pixel avatars)

**Backend**
- Node.js runtime (Astro SSR)
- File-based CMS (`storage/site-content.json`)
- JSONL storage for reviews and contact submissions
- Rate-limited API endpoints (`/api/reviews.json`, `/api/contact.json`, `/api/cms/*`)

**Infrastructure**
- VPS (Ubuntu) + PM2 process manager
- Nginx reverse proxy + Let's Encrypt SSL
- GitHub Actions CI/CD (build → rsync → PM2 restart)

## Architecture

```
src/
├── components/sections/   # Astro components (Hero, Portfolio, Reviews, etc.)
├── data/                  # Content types & sanitizers
├── layouts/               # MainLayout (theme, fonts, meta)
├── pages/                 # Routes: index, admin, API endpoints
├── scripts/               # Client-side admin app
└── styles/                # Global CSS, theme variables

storage/                   # Runtime data (not in git)
├── site-content.json      # CMS content
├── reviews.jsonl          # User reviews (moderated)
├── contact-submissions.jsonl
└── media/                 # Uploaded images

public/                    # Static assets (favicon, logos)
```

## Running locally

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Production

```bash
pnpm build
HOST=0.0.0.0 PORT=3000 pnpm start
```

## Environment variables

- `CMS_TOKEN` — admin API auth token
- `HOST` — server bind address
- `PORT` — server port
