# kerizov.design
## Stack

**Base**
- Astro 5 (SSR, Node adapter)
- TypeScript
- SCSS / CSS custom properties

**Fonts and Visuals**
- Alumni Sans (headings), JetBrains Mono
- GSAP + ScrollTrigger (scroll animations)
- CSS 3D transforms, perspective (card carousels)
- Canvas API (procedural pixel avatars)

**Backend**
- Node.js (Astro SSR)
- File-based CMs
- Closed admin panel
- JSONL storage for reviews and requests
- API endpoints with rate-limiting

**Infrastructure**
- VPS (Ubuntu) + PM2
- Nginx reverse proxy + Let's Encrypt SSL
- GitHub Actions CI/CD (build → rsync → PM2 restart)
