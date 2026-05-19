#!/usr/bin/env bash
set -euo pipefail

# ─── Настройка чистого Ubuntu/Debian VPS для perfectweb ───
# Запускать от root: bash setup-server.sh example.com

DOMAIN="${1:?Укажи домен: bash setup-server.sh example.com}"
APP_DIR="/var/www/perfectweb"
APP_PORT=3000

echo ">>> Обновляем систему"
apt update && apt upgrade -y

echo ">>> Устанавливаем Node.js 22"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

echo ">>> Устанавливаем PM2"
npm install -g pm2

echo ">>> Устанавливаем Nginx"
apt install -y nginx

echo ">>> Создаём директорию приложения"
mkdir -p "$APP_DIR"

echo ">>> Настраиваем Nginx"
cat > /etc/nginx/sites-available/perfectweb <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/perfectweb /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo ">>> Настраиваем PM2 автозапуск"
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo ">>> Устанавливаем SSL (Let's Encrypt)"
apt install -y certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$2"

echo ""
echo "=== Сервер готов ==="
echo "Домен:     ${DOMAIN}"
echo "Директория: ${APP_DIR}"
echo "Порт:      ${APP_PORT}"
echo ""
echo "Осталось добавить GitHub Secrets:"
echo "  VPS_HOST     — IP или домен сервера"
echo "  VPS_USER     — root (или другой пользователь)"
echo "  VPS_SSH_KEY  — приватный SSH-ключ"
