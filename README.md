# kerizov.design

Персональный лендинг-портфолио с премиальной стеклянной эстетикой и терминальным UI.

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

**Бэкенд**
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
```

## Локальный запуск

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Продакшен

```bash
pnpm build
HOST=0.0.0.0 PORT=3000 pnpm start
```

## Переменные окружения

- `CMS_USERNAME` — логин для входа в `/admin`
- `CMS_PASSWORD` — пароль для входа в `/admin`
- `CMS_SESSION_SECRET` — секрет подписи админ-сессии
- `CMS_ALLOW_TOKEN_LOGIN` — разрешает fallback-вход `admin` + `CMS_TOKEN`; в production по умолчанию выключен
- `CMS_TOKEN` — опциональный Bearer-токен для CMS API и совместимости
- `HOST` — адрес привязки сервера
- `PORT` — порт сервера
