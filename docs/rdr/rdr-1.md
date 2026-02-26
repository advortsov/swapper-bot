# DEX Aggregator Telegram Bot — Requirements & Design Document (RDR)

**Версия:** 2.1 (финальная)
**Статус:** Утверждено
**Дата:** 2026-02-27

---

## 1. Введение

### 1.1. Цель проекта
Разработать Telegram-бота, который предоставляет пользователям лучшие курсы обмена криптовалют на базе децентрализованных бирж (DEX) и позволяет совершать обмены непосредственно через интерфейс Telegram, используя WalletConnect. Система должна быть модульной и легко расширяемой для подключения новых блокчейнов и агрегаторов ликвидности.

### 1.2. Ключевые принципы
- **Модульность** – каждый блокчейн и агрегатор реализуется как отдельный модуль NestJS.
- **Прозрачность** – все ошибки и исключения транслируются пользователю без сокрытия (на первых этапах).
- **Некастодиальность** – приватные ключи не хранятся, подпись транзакций осуществляется через WalletConnect.
- **Масштабируемость** – архитектура позволяет горизонтальное расширение и добавление новых сетей/агрегаторов без рефакторинга ядра.

---

## 2. Технологический стек

| Компонент           | Технология                            |
|---------------------|---------------------------------------|
| Язык                | TypeScript                            |
| Фреймворк           | NestJS (модульный, DI)                |
| Telegram Bot        | Telegraf                              |
| База данных         | PostgreSQL + Kysely (type-safe SQL)   |
| Миграции            | Postgrator                            |
| Кэш                 | node-cache (in-memory)                |
| HTTP клиент         | встроенный fetch (Node.js 18+)        |
| Блокчейн (EVM)      | viem (лёгкий, современный)            |
| Блокчейн (Solana)   | @solana/web3.js                       |
| WalletConnect       | @walletconnect/web3wallet (v2)        |
| Метрики             | prom-client (эндпоинт /metrics)       |
| Логирование         | NestJS Logger (plain text)            |
| Конфигурация        | dotenv + NestJS ConfigModule          |
| Тестирование        | Vitest + MSW (моки HTTP)              |

---

## 3. Этапы развития проекта

### **Этап 1. MVP (Ethereum + 0x, информация о курсе)**
- Поддержка только сети Ethereum (EVM).
- Единственный источник ликвидности – 0x API.
- Telegram-команды:
  - `/start` – приветствие.
  - `/price <amount> <from> to <to>` – получение лучшего курса.
- Ответ содержит: количество получаемого токена, имя агрегатора, оценку газа в USD.
- Кэширование курсов (node-cache, TTL 30 сек).
- Хранение пользователей и истории запросов в PostgreSQL.
- Метрики Prometheus (количество запросов, ошибки, latency).
- Справочник популярных токенов Ethereum (символ → адрес, decimals) загружается при старте (seed).

### **Этап 2. Добавление агрегаторов (1inch, ParaSwap)**
- Подключение дополнительных агрегаторов (1inch, позже ParaSwap) через отдельные модули.
- Модификация `PriceService`: опрос всех агрегаторов, поддерживающих сеть, выбор лучшего курса (максимальный `toAmount`).
- Отображение в ответе нескольких вариантов (опционально).

### **Этап 3. Интеграция WalletConnect (исполнение свопов)**
- Добавление команды `/swap` с тем же синтаксисом (`/swap <amount> <from> to <to> [on <chain>]`).
- Реализация модуля `WalletConnectModule`:
  - Генерация одноразовой сессии (deep link) с использованием `@walletconnect/web3wallet`.
  - Получение адреса пользователя после подключения кошелька.
  - Запрос у агрегатора точных данных транзакции (`buildSwapTransaction`) с подстановкой `fromAddress`.
  - Отправка запроса на подпись (`eth_sendTransaction`) через активную сессию.
  - Отслеживание результата (tx hash или ошибка) и уведомление пользователя.
- Параметры: `slippage` (из ENV), таймаут на подключение (из ENV), ссылки на блокчейн-эксплореры.
- Апрув токенов пока не реализуется (предполагается, что либо токен нативный, либо апрув уже есть, либо используется Permit2 – отложено на будущее).

### **Этап 4. Поддержка других EVM-сетей (Arbitrum, Base, Optimism)**
- Создание модулей для каждой сети (`ArbitrumModule`, `BaseModule` и т.д.), реализующих интерфейс `Chain`.
- Расширение справочника токенов с учётом поля `chain` (один и тот же символ может иметь разные адреса в разных сетях).
- Модификация команд: опциональный параметр `on <chain>` (по умолчанию Ethereum).
- Адаптация агрегаторов под новые сети (0x и 1inch поддерживают большинство L2).

### **Этап 5. Поддержка Solana (не-EVM)**
- Добавление модуля `SolanaChain` (использование `@solana/web3.js`).
- Добавление агрегатора Jupiter (`JupiterAggregator`) – основной агрегатор Solana.
- Расширение справочника токенов для Solana.
- Адаптация `WalletConnectService` для работы с Solana (другая цепочка, другой формат транзакций) – возможно, потребуется отдельный модуль или условная логика.

### **Этап 6. Улучшение UX (постоянные сессии, избранное, уведомления)**
- Переход от одноразовых deep link к постоянным сессиям WalletConnect (пользователь подключает кошелёк один раз, сессия сохраняется в Redis).
- Команда `/connect` для первичного подключения.
- Команда `/disconnect` для отключения.
- Возможность сохранять избранные пары и получать уведомления при достижении целевого курса (фоновые задачи).

### **Этап 7. Продвинутые функции**
- Поддержка лимитных ордеров.
- Интеграция с CoinGecko для поиска произвольных токенов по символу.
- Отображение истории обменов в личном кабинете.
- PWA-версия (минимальный веб-интерфейс) для удобства подписи на десктопе.

---

## 4. Архитектура системы

### 4.1. Модульная структура (NestJS)

```
src/
├── main.ts
├── app.module.ts
├── telegram/
│   ├── telegram.module.ts
│   ├── telegram.bot.ts                # инициализация Telegraf
│   ├── telegram.update-handler.ts      # обработчики команд
│   └── dto/
├── price/
│   ├── price.module.ts
│   ├── price.service.ts                # получение лучшего курса (с кэшем)
│   ├── price.cache.ts                  # обёртка над node-cache
│   └── interfaces/
├── aggregators/
│   ├── aggregators.module.ts            # корневой модуль
│   ├── interfaces/
│   │   └── aggregator.interface.ts     # IAggregator
│   ├── base/
│   │   └── base.aggregator.ts           # общая логика (ретраи, таймауты)
│   ├── zero-x/
│   │   ├── zero-x.module.ts
│   │   ├── zero-x.aggregator.ts
│   │   └── zero-x.config.ts
│   ├── one-inch/
│   │   ├── one-inch.module.ts
│   │   ├── one-inch.aggregator.ts
│   │   └── one-inch.config.ts
│   └── jupiter/                          # для Solana
│       ├── jupiter.module.ts
│       ├── jupiter.aggregator.ts
│       └── jupiter.config.ts
├── chains/
│   ├── chains.module.ts                  # корневой модуль блокчейнов
│   ├── interfaces/
│   │   └── chain.interface.ts            # IChain
│   ├── base/
│   │   └── base.chain.ts
│   ├── ethereum/
│   │   ├── ethereum.module.ts
│   │   ├── ethereum.chain.ts
│   │   └── ethereum.config.ts
│   ├── arbitrum/
│   │   ├── arbitrum.module.ts
│   │   ├── arbitrum.chain.ts
│   │   └── arbitrum.config.ts
│   ├── base-chain/                         # сеть Base
│   │   ├── base-chain.module.ts
│   │   ├── base-chain.chain.ts
│   │   └── base-chain.config.ts
│   └── solana/
│       ├── solana.module.ts
│       ├── solana.chain.ts
│       └── solana.config.ts
├── swap/
│   ├── swap.module.ts
│   ├── swap.service.ts                    # координация /swap
│   └── interfaces/
├── wallet-connect/
│   ├── wallet-connect.module.ts
│   ├── wallet-connect.service.ts           # управление сессиями, отправка tx
│   ├── wallet-connect.session-store.ts     # временное хранение сессий (in-memory)
│   └── interfaces/
├── tokens/
│   ├── tokens.module.ts
│   ├── tokens.service.ts
│   ├── tokens.repository.ts                # Kysely запросы
│   └── seed/                                # скрипт начальной загрузки токенов
├── database/
│   ├── database.module.ts
│   ├── database.service.ts                  # Kysely instance + миграции
│   └── migrations/                           # SQL файлы миграций
├── metrics/
│   ├── metrics.module.ts
│   ├── metrics.service.ts                    # счётчики Prometheus
│   └── metrics.controller.ts                  # эндпоинт /metrics
└── common/
    ├── logger/
    ├── exceptions/
    │   └── business.exception.ts               # исключения для пользователя
    └── utils/
```

### 4.2. Ключевые интерфейсы

#### `IAggregator`
```typescript
interface IAggregator {
  readonly name: string;
  readonly supportedChains: ChainType[];
  getQuote(params: QuoteRequest): Promise<QuoteResponse>;
  buildSwapTransaction(params: SwapRequest): Promise<SwapTransaction>;
  healthCheck(): Promise<boolean>;
}
```

#### `IChain`
```typescript
interface IChain {
  readonly chainId: number | string;  // для EVM число, для Solana строка
  readonly name: string;
  getGasPrice(): Promise<bigint>;
  getTokenDecimals(tokenAddress: string): Promise<number>;
  validateAddress(address: string): boolean;
  buildExplorerUrl(txHash: string): string;
}
```

### 4.3. Потоки данных

#### **Команда `/price`**
1. Telegram → `TelegramUpdateHandler.parseCommand()`.
2. `PriceService.getBestQuote(chain, fromToken, toToken, amount)`.
3. Проверка кэша.
4. Если кэш пуст: `AggregatorFactory.getAggregatorsForChain(chain)` → параллельный опрос всех агрегаторов.
5. Выбор лучшего курса (max `toAmount`).
6. Сохранение в кэш, логирование запроса в БД.
7. Формирование ответа пользователю.

#### **Команда `/swap` (с WalletConnect)**
1. Telegram → `TelegramUpdateHandler.handleSwap()`.
2. Парсинг команды, валидация токенов.
3. `WalletConnectService.createSession(userId, swapParams)`:
  - Создание пары (pairing) через `web3wallet.core.pairing.create()`.
  - Сохранение в `SessionStore` (topic → userId, fromToken, toToken, amount, chain).
  - Возврат URI.
4. Отправка пользователю сообщения с URI и инструкцией.
5. Ожидание событий:
  - **session_approval**: получение адреса пользователя, вызов `Aggregator.buildSwapTransaction` с `fromAddress`, отправка запроса на подпись (`eth_sendTransaction`).
  - **session_rejection**: уведомление об отказе.
  - Таймаут (из ENV): уведомление о timeout.
6. После получения txHash → уведомление пользователя со ссылкой на эксплорер.
7. Очистка сессии.

---

## 5. База данных (PostgreSQL)

### Таблица `users`
| Колонка       | Тип         | Описание                     |
|---------------|-------------|------------------------------|
| id            | BIGINT      | Telegram user ID (primary)   |
| username      | TEXT        | Telegram username            |
| first_seen    | TIMESTAMPTZ | Дата первого обращения       |
| last_active   | TIMESTAMPTZ | Последняя активность         |
| settings      | JSONB       | Настройки (кошелёк и т.п.)   |

### Таблица `tokens`
| Колонка       | Тип         | Описание                     |
|---------------|-------------|------------------------------|
| address       | TEXT        | Адрес контракта (primary)    |
| symbol        | TEXT        | Символ токена (UNIQUE)       |
| decimals      | INTEGER     | Количество знаков            |
| name          | TEXT        | Полное название              |
| chain         | TEXT        | Цепочка ('ethereum', etc.)   |
| updated_at    | TIMESTAMPTZ |                              |

### Таблица `requests`
| Колонка       | Тип         | Описание                     |
|---------------|-------------|------------------------------|
| id            | UUID        | PRIMARY KEY                  |
| user_id       | BIGINT      | REFERENCES users(id)         |
| command       | TEXT        | Полный текст команды          |
| from_token    | TEXT        | Символ исходного токена      |
| to_token      | TEXT        | Символ целевого токена        |
| amount        | NUMERIC     | Сумма                        |
| result        | JSONB       | Ответ агрегатора (полный)    |
| error         | BOOLEAN     | Флаг ошибки                  |
| error_message | TEXT        | Текст ошибки                 |
| created_at    | TIMESTAMPTZ |                              |

Миграции выполняются через **Postgrator** (SQL-файлы в `src/database/migrations`).

---

## 6. Конфигурация (ENV)

```bash
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dex_bot

# Telegram
TELEGRAM_BOT_TOKEN=...

# 0x API
ZERO_X_API_KEY=...
AFFILIATE_ADDRESS=0x...

# 1inch (добавится позже)
ONE_INCH_API_KEY=...

# Jupiter (для Solana)
JUPITER_BASE_URL=https://quote-api.jup.ag/v6

# WalletConnect
WC_PROJECT_ID=...               # Project ID из WalletConnect Cloud
SWAP_SLIPPAGE=0.5                # проскальзывание в %
SWAP_TIMEOUT_SECONDS=300          # таймаут ожидания подключения

# Explorer URLs (шаблоны)
EXPLORER_URL_ETHEREUM=https://etherscan.io/tx/
EXPLORER_URL_ARBITRUM=https://arbiscan.io/tx/
EXPLORER_URL_BASE=https://basescan.org/tx/
EXPLORER_URL_SOLANA=https://solscan.io/tx/

# RPC endpoints (опционально, для получения газа и decimals)
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/...
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/...
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Cache TTL (seconds)
CACHE_TTL_PRICE=30

# Metrics
METRICS_ENABLED=true
```

---

## 7. Метрики и логирование

### 7.1. Prometheus метрики (эндпоинт `/metrics`)
- `price_requests_total` – общее количество запросов `/price` (labels: status=success/error).
- `swap_requests_total` – количество попыток `/swap` (labels: status=initiated/success/error).
- `http_requests_total` – запросы к внешним API (0x, 1inch, Jupiter) – method, status_code.
- `http_request_duration_seconds` – гистограмма времени ответа внешних API.
- `errors_total` – ошибки по типам (rate_limit, timeout, invalid_pair, etc.).

### 7.2. Логирование
- Используется встроенный `Logger` NestJS.
- Логи в plain text, без JSON.
- Логируются: входящие команды (user_id, текст), ответы (успех/ошибка), критические ошибки (с exception stack).
- Уровни: `log`, `debug` (в разработке), `error`.

---

## 8. Обработка ошибок

- Все исключения, возникающие при обращении к внешним API или внутренней логике, перехватываются.
- Для ошибок, понятных пользователю (например, «Недостаточно ликвидности», «Токен не поддерживается»), используется `BusinessException` с сообщением, которое отправляется в Telegram.
- Непредвиденные ошибки (ошибки БД, таймауты сервера) логируются и отправляют пользователю общее сообщение «Внутренняя ошибка, повторите позже» (на данном этапе – показываем текст исключения напрямую, согласно договорённости).
- В MVP все исключения пробрасываются пользователю без цензуры для упрощения отладки.

---

## 9. Roadmap реализации

### Фаза 0 (подготовка)
- [ ] Настройка NestJS проекта, установка зависимостей.
- [ ] Docker-compose для PostgreSQL.
- [ ] Конфигурация окружения.

### Фаза 1 (MVP: Ethereum + 0x, `/price`)
- [ ] Модуль `Database`: миграции, Kysely, репозитории.
- [ ] Seed токенов Ethereum (10-15 популярных).
- [ ] Модуль `EthereumChain` (viem).
- [ ] Модуль `ZeroXAggregator` (интеграция с 0x API, getQuote).
- [ ] `PriceService` с кэшированием.
- [ ] `TelegramModule`: команда `/price`, парсинг, ответ.
- [ ] `MetricsModule`: базовые метрики.
- [ ] Тестирование, деплой MVP.

### Фаза 2 (добавление агрегаторов)
- [ ] Модуль `OneInchAggregator`.
- [ ] Модификация `AggregatorFactory` для работы с несколькими агрегаторами.
- [ ] `PriceService` – параллельный опрос, выбор лучшего курса.

### Фаза 3 (WalletConnect, команда `/swap`)
- [ ] Регистрация в WalletConnect Cloud, получение Project ID.
- [ ] Модуль `WalletConnectModule` (создание сессий, обработка событий).
- [ ] Интеграция `Aggregator.buildSwapTransaction` (0x, 1inch).
- [ ] Команда `/swap` с передачей параметров, ожиданием подписи.
- [ ] Отправка результата (tx hash, ссылка на эксплорер).

### Фаза 4 (добавление EVM-сетей)
- [ ] Модули `ArbitrumChain`, `BaseChain`, `OptimismChain`.
- [ ] Расширение `tokens` – добавление поля `chain`.
- [ ] Поддержка параметра `on <chain>` в командах.

### Фаза 5 (Solana)
- [ ] Модуль `SolanaChain`.
- [ ] Модуль `JupiterAggregator`.
- [ ] Адаптация `WalletConnect` для Solana (возможно, через отдельный модуль).
- [ ] Поддержка сети Solana в командах.

### Фаза 6 (улучшения UX)
- [ ] Постоянные сессии WalletConnect (Redis).
- [ ] Команды `/connect`, `/disconnect`.
- [ ] Избранное и уведомления о курсе.

### Фаза 7 (продвинутые функции)
- [ ] Возможность ввода адреса токена (поиск через CoinGecko).
- [ ] Поддержка лимитных ордеров.
- [ ] Отображение истории обменов.
- [ ] PWA-версия.

---

## 10. Заключение

Данный документ фиксирует все ключевые решения по архитектуре и функциональности DEX Aggregator Telegram Bot. Проект реализуется итеративно, начиная с минимально жизнеспособного продукта (Ethereum + 0x, информация о курсе) и постепенно наращивая функционал до полноценного мультичейн-агрегатора с поддержкой свопов через WalletConnect. Модульная структура на базе NestJS обеспечивает лёгкое расширение и тестирование.
