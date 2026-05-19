# Деплой perfectweb — пошаговая инструкция

## Схема работы

```
git push → GitHub Actions (билд) → rsync по SSH → VPS (PM2 рестарт) → сайт обновлён
```

---

## Шаг 1. Создать SSH-ключ для деплоя

На своём компьютере (не на сервере) открой терминал:

```bash
ssh-keygen -t ed25519 -C "deploy" -f ~/.ssh/perfectweb_deploy
```

Нажми Enter дважды (без пароля).

Появятся два файла:
- `~/.ssh/perfectweb_deploy` — **приватный** ключ (для GitHub)
- `~/.ssh/perfectweb_deploy.pub` — **публичный** ключ (для сервера)

Скопируй публичный ключ в буфер:

```bash
cat ~/.ssh/perfectweb_deploy.pub | pbcopy
```

---

## Шаг 2. Подключиться к серверу и настроить

Подключись к VPS по SSH (используй IP от хостера):

```bash
ssh root@ТВОЙ_IP_СЕРВЕРА
```

### 2.1 Добавить SSH-ключ деплоя на сервер

```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
```

Вставь скопированный публичный ключ (Cmd+V), сохрани (Ctrl+X → Y → Enter).

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### 2.2 Запустить скрипт настройки

Можно скопировать скрипт на сервер или выполнить команды вручную по порядку:

```bash
# Обновить систему
apt update && apt upgrade -y

# Установить Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Установить PM2 (менеджер процессов)
npm install -g pm2

# Установить Nginx (веб-сервер)
apt install -y nginx

# Создать директорию приложения
mkdir -p /var/www/perfectweb
mkdir -p /var/www/perfectweb/storage/media/assets
```

### 2.3 Настроить Nginx

```bash
nano /etc/nginx/sites-available/perfectweb
```

Вставь (замени `ТВОЙ_ДОМЕН` на свой домен или IP):

```nginx
server {
    listen 80;
    server_name ТВОЙ_ДОМЕН;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Сохрани (Ctrl+X → Y → Enter), затем:

```bash
# Включить конфиг
ln -sf /etc/nginx/sites-available/perfectweb /etc/nginx/sites-enabled/

# Убрать дефолтный сайт
rm -f /etc/nginx/sites-enabled/default

# Проверить и перезапустить
nginx -t
systemctl restart nginx
systemctl enable nginx
```

### 2.4 Настроить автозапуск PM2

```bash
pm2 startup systemd
```

PM2 выведет команду — скопируй и выполни её.

### 2.5 (Опционально) Настроить SSL

Если есть домен:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ТВОЙ_ДОМЕН
```

Следуй инструкциям, укажи email.

### 2.6 Проверить

```bash
node -v          # должно быть v22.x
pm2 -v           # должно показать версию
nginx -t         # должно быть "ok"
```

Всё, сервер готов. Выйди:

```bash
exit
```

---

## Шаг 3. Проверить SSH-подключение

На своём компьютере проверь, что ключ работает:

```bash
ssh -i ~/.ssh/perfectweb_deploy root@ТВОЙ_IP_СЕРВЕРА "echo OK"
```

Должно вывести `OK`. Если спросит про fingerprint — напиши `yes`.

---

## Шаг 4. Создать GitHub-репозиторий

Если репозиторий ещё не создан:

```bash
cd ~/Desktop/perfectweb
gh auth login          # авторизуйся в GitHub (если ещё не сделал)
gh repo create perfectweb --private --source=. --push
```

Если репозиторий уже есть — убедись что remote добавлен:

```bash
git remote -v
```

---

## Шаг 5. Добавить секреты в GitHub

Это самый важный шаг — GitHub Actions будет использовать эти данные для подключения к серверу.

### Вариант A: Через терминал (быстрее)

```bash
# Добавить IP сервера
gh secret set VPS_HOST --body "ТВОЙ_IP_СЕРВЕРА"

# Добавить пользователя
gh secret set VPS_USER --body "root"

# Добавить приватный SSH-ключ
gh secret set VPS_SSH_KEY < ~/.ssh/perfectweb_deploy

# Добавить логин/пароль CMS-админки
gh secret set CMS_USERNAME --body "admin"
gh secret set CMS_PASSWORD --body "СИЛЬНЫЙ_ПАРОЛЬ"

# Добавить секрет подписи сессии и опциональный API-токен
gh secret set CMS_SESSION_SECRET --body "СЛУЧАЙНЫЙ_ДЛИННЫЙ_СЕКРЕТ"
gh secret set CMS_TOKEN --body "ОПЦИОНАЛЬНЫЙ_API_ТОКЕН"
```

### Вариант B: Через браузер

1. Открой репозиторий на GitHub
2. Settings → Secrets and variables → Actions
3. New repository secret

Добавь секреты:

| Имя | Значение |
|-----|----------|
| `VPS_HOST` | IP-адрес сервера (например `185.123.45.67`) |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Содержимое файла `~/.ssh/perfectweb_deploy` (весь текст, включая `-----BEGIN...` и `-----END...`) |
| `CMS_USERNAME` | Логин для входа в `/admin` |
| `CMS_PASSWORD` | Сильный пароль для входа в `/admin` |
| `CMS_SESSION_SECRET` | Длинный случайный секрет подписи сессии |
| `CMS_TOKEN` | Опциональный Bearer-токен для CMS API |

Fallback-вход `admin` + `CMS_TOKEN` в production выключен по умолчанию. Включать его стоит только временно через `CMS_ALLOW_TOKEN_LOGIN=true`.

---

## Шаг 6. Первый деплой

```bash
cd ~/Desktop/perfectweb
git add .
git commit -m "Add deployment pipeline"
git push origin main
```

### Следить за деплоем

```bash
gh run watch
```

Или открой в браузере: репозиторий → Actions → последний запуск.

Первый деплой займёт 2-3 минуты. После успеха сайт будет доступен по IP или домену.

---

## Как это работает дальше

1. Вносишь изменения в код
2. `git push origin main`
3. GitHub Actions автоматически:
   - собирает билд
   - отправляет файлы на сервер
   - перезапускает приложение
4. Через ~2 минуты сайт обновлён

---

## Диагностика проблем

### На сервере

```bash
# Статус приложения
pm2 status

# Логи приложения
pm2 logs perfectweb

# Статус Nginx
systemctl status nginx

# Логи Nginx
tail -f /var/log/nginx/error.log
```

### В GitHub

```bash
# Логи последнего деплоя
gh run view --log-failed
```
