# kerizov.design
## Стек

**Основа**
- Astro 5 (SSR, Node-адаптер)
- TypeScript
- SCSS / CSS custom properties (тёмная/светлая тема через `data-theme`)

**Шрифты и визуал**
- Alumni Sans (заголовки), JetBrains Mono (код/терминальный UI)
- GSAP + ScrollTrigger (анимации при скролле)
- CSS 3D-трансформации, перспектива (карусели карточек)
- Canvas API (процедурные пиксельные аватары)

**Бэк**
- Node.js (Astro SSR)
- Файловая CMS (`storage/site-content.json`)
- Закрытая админка `/admin` через логин/пароль и httpOnly-сессию
- JSONL-хранилище для отзывов и заявок
- API-эндпоинты с rate-limiting (`/api/reviews.json`, `/api/contact.json`, `/api/cms/*`)

**Инфраструктура**
- VPS (Ubuntu) + PM2
- Nginx reverse proxy + Let's Encrypt SSL
- GitHub Actions CI/CD (сборка → rsync → PM2 restart)

## Архитектура

```
src/
├── components/sections/   # Astro-компоненты (Hero, Portfolio, Reviews и др.)
├── data/                  # Типы контента и санитайзеры
├── layouts/               # MainLayout (тема, шрифты, мета)
├── pages/                 # Роуты: index, admin, API-эндпоинты
├── scripts/               # Клиентский админ-интерфейс
└── styles/                # Глобальные стили, переменные темы

storage/                   # Рантайм-данные (не в git)
├── site-content.json      # Контент CMS
├── reviews.jsonl          # Отзывы пользователей (с модерацией)
├── contact-submissions.jsonl
└── media/                 # Загруженные изображения

public/                    # Статика (favicon, логотипы)
