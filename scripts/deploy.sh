#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="/opt/swapper-bot"
REPO_URL="https://github.com/advortsov/swapper-bot.git"
COMPOSE_FILE="docker-compose.prod.yml"

SSH_HOST="${1:-${DEPLOY_SSH_HOST:-}}"
SSH_USER="${2:-${DEPLOY_SSH_USER:-root}}"
SSH_PORT="${3:-${DEPLOY_SSH_PORT:-22}}"

if [[ -z "${SSH_HOST}" ]]; then
  echo "Использование: $0 <host> [user] [port]"
  echo "Или задай DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_SSH_PORT"
  exit 1
fi

SSH_CMD="ssh -o StrictHostKeyChecking=accept-new -p ${SSH_PORT} ${SSH_USER}@${SSH_HOST}"

echo "==> Деплой на ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"

$SSH_CMD bash -s <<REMOTE_SCRIPT
set -euo pipefail

if [[ ! -d "${DEPLOY_DIR}" ]]; then
  echo "==> Клонирование репозитория..."
  git clone "${REPO_URL}" "${DEPLOY_DIR}"
fi

cd "${DEPLOY_DIR}"
echo "==> Обновление репозитория..."
git fetch origin main
git checkout main
git pull --ff-only origin main

if [[ ! -f .env ]]; then
  cp .env.prod.example .env
  echo "==> Создан .env из шаблона. Заполни секреты в ${DEPLOY_DIR}/.env и запусти деплой снова."
  exit 1
fi

echo "==> Перезапуск контейнера приложения..."
docker compose -f "${COMPOSE_FILE}" up --build -d --force-recreate app

echo "==> Ожидание запуска (15 сек)..."
sleep 15

echo "==> Логи приложения:"
docker compose -f "${COMPOSE_FILE}" logs app --tail=40

echo "==> Health check:"
curl -sf http://127.0.0.1:3002/health
echo
echo "==> Деплой завершен"
REMOTE_SCRIPT
