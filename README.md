# perfectweb

Серверный проект на Astro 5 + Node adapter + CMS API.

## Требования

- Node.js `>= 22.12.0`
- pnpm

## Локальный запуск

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Production build

```bash
pnpm install --frozen-lockfile
pnpm build
HOST=0.0.0.0 PORT=3000 pnpm start
```

Альтернативный скрипт:

```bash
pnpm start:prod
```

## ENV переменные

Скопируйте `.env.example` в `.env` и укажите:

- `CMS_TOKEN` — токен доступа к CMS API (обязательно)
- `HOST` — хост для Node-сервера (обычно `0.0.0.0`)
- `PORT` — порт приложения (обычно `3000`)

## Что пушится в GitHub

В репозиторий должны попадать исходники и deploy-конфиги:

- `src/`
- `public/`
- `deploy/`
- `package.json`
- `pnpm-lock.yaml`
- `astro.config.mjs`
- `ecosystem.config.cjs`
- `.env.example`

Не нужно пушить:

- `node_modules/`
- `dist/`
- `.astro/`
- `.env`

## Важное по CMS/медиа

Контент и загруженные изображения хранятся в папке `storage/`:

- `storage/site-content.json`
- `storage/media/...`

Для продакшена эта папка должна:

- быть доступна на запись процессу Node
- сохраняться между перезапусками/релизами

Сама папка `storage/` не хранится в Git целиком. Это намеренно: там runtime-данные.
Если нужен первый запуск с текущим локальным контентом и изображениями, `storage/` нужно перенести на сервер отдельно.

## Деплой на VPS (рекомендуемый)

1. Залить проект на GitHub.
2. На VPS клонировать репозиторий в рабочую директорию, например `/var/www/perfectweb`.
3. Создать `.env` с `CMS_TOKEN`.
4. Установить зависимости: `pnpm install --frozen-lockfile`.
5. Собрать: `pnpm build`.
6. Подготовить `storage/`:

```bash
mkdir -p storage
```

Если нужен текущий локальный CMS-контент и медиа, перенести их отдельно:

```bash
rsync -av storage/ user@server:/var/www/perfectweb/storage/
```

7. Запустить через PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

8. Проксировать домен через Nginx на `127.0.0.1:3000`.

Готовый шаблон конфига: `deploy/nginx/perfectweb.conf`.
Health endpoint для мониторинга: `/api/health.json`.

## Обновление релиза на VPS

После первого деплоя обычное обновление выглядит так:

```bash
git pull
pnpm install --frozen-lockfile
pnpm build
pm2 restart perfectweb
```

Важно: не удаляйте `storage/` между релизами, иначе потеряете контент CMS, медиа и заявки.

## Альтернатива PM2: systemd

Шаблон юнита: `deploy/systemd/perfectweb.service`.

Перед запуском обязательно поправьте:

- `WorkingDirectory`
- `ExecStart`
- `CMS_TOKEN`
- `User`/`Group`

## Полезные команды

- `pnpm dev` — dev-сервер
- `pnpm build` — production-сборка
- `pnpm start` — запуск собранного проекта
- `pnpm start:prod` — запуск с дефолтными `HOST/PORT`
