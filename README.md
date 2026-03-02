# swapper-bot

Базовый каркас NestJS для DEX Aggregator Telegram Bot.

## Требования

- Node.js 24+
- npm 11+
- Docker + Docker Compose

## Быстрый старт

1. Установить зависимости:

```bash
npm install
```

2. Поднять PostgreSQL:

```bash
docker compose up -d postgres
```

3. Создать `.env` из примера:

```bash
cp .env.example .env
```

4. Запустить приложение:

```bash
npm run start:dev
```

Проверка живости:

```bash
curl http://localhost:3000/health
```

Примеры команд в Telegram:

```text
/price 10 ETH to USDC
/price 10 ETH to USDC on arbitrum
/price 100 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 to USDT on ethereum
/price 1 SOL to USDC on solana
/swap 0.1 ETH to USDC
/swap 0.1 ETH to USDC on base
/swap 100 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 to USDT on ethereum
/swap 1 SOL to USDC on solana
/connect
/connect on solana
/disconnect
/favorites
/history
```

`/price` возвращает лучший курс по `net`, число опрошенных провайдеров и по каждому провайдеру показывает `gross`, комиссию бота и итоговый `net`.
Поддерживаемые сети: `ethereum` (по умолчанию), `arbitrum`, `base`, `optimism`, `solana`.
Для `solana` поддержаны `/price` и `/swap` через WalletConnect.
Если вместо символа указывается адрес токена, сеть через `on <chain>` обязательна.

`/swap` сначала создаёт server-side intent, затем показывает кнопки выбора агрегатора с opaque callback token. После выбора бот готовит swap-session только для выбранного провайдера и повторно показывает `gross / fee / net` и срок актуальности quote.

`/connect` и `/disconnect` позволяют явно управлять подключением кошелька. Активные WalletConnect-сессии кешируются в `node-cache` внутри живого процесса, поэтому после успешного `/connect` следующий `/swap` может использовать уже подключённый кошелёк без нового pairing flow.

`/favorites` показывает сохранённые пары, а алерты по курсу работают как одноразовый порог `best net >= target`.

`/history` показывает последние 10 успешных свопов пользователя из audit trail.

## Проверки качества

```bash
npm run precommit
```

Отдельные команды:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Fee configuration

Комиссии по умолчанию выключены. Чтобы включить monetization:

- `0x`: задать `ZEROX_FEE_RECIPIENT`, `ZEROX_FEE_BPS`, при необходимости `ZEROX_FEE_TOKEN_MODE`.
- `ParaSwap`: задать `PARASWAP_PARTNER_ADDRESS`, `PARASWAP_FEE_BPS`, `PARASWAP_API_VERSION=6.2`.
- `Jupiter`: задать `JUPITER_PLATFORM_FEE_BPS` и заранее созданные `JUPITER_FEE_ACCOUNT_<SYMBOL>`.
- `Odos`: на текущем этапе оставить `ODOS_MONETIZATION_MODE=disabled` или `tracking_only`.
- Приложение валидирует эти связки на старте и падает fail-fast, если fee включён без обязательных реквизитов.

## Production (VPS + shared PostgreSQL)

Для прода используется `docker-compose.prod.yml` и существующий PostgreSQL на VPS.

1. На VPS в общей БД создать отдельную схему и пользователей для `swapper-bot`.
2. В `/opt/swapper-bot/.env` использовать строку подключения с `search_path=swapper_bot,public`.
3. Запуск/обновление:

```bash
./scripts/deploy.sh 91.200.148.16 root 22
```

Пример `DATABASE_URL`:

```text
postgresql://swapper_bot_app:***@127.0.0.1:5432/whale_alert_bot?options=-csearch_path%3Dswapper_bot%2Cpublic
```

## GitLab CI/CD

В репозитории добавлен `.gitlab-ci.yml`:

- `test`: `lint`, `typecheck`, `test`, `build`.
- `deploy`: деплой по SSH через `scripts/deploy.sh` (только ветка `main`).

Нужные CI/CD переменные в GitLab:

- `DEPLOY_HOST` (например `91.200.148.16`)
- `DEPLOY_USER` (например `root`)
- `DEPLOY_SSH_PORT` (обычно `22`)
- `DEPLOY_SSH_PRIVATE_KEY` (приватный ключ для SSH)
