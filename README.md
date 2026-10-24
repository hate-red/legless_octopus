# Умный кредитный кабинет — Альфа-Банк

Хакатон-проект для малого и микробизнеса: клиент подаёт заявку, банк автоматически собирает данные из моков ЕГРЮЛ / ГИР БО / БКИ, локальная ИИ-модель проверяет цель кредита, скоринг рассчитывает баллы и DTI, а Decision Engine выносит решение — одобрение, встречное предложение, ручная проверка или отказ.

Проект запускается одной командой:

```bash
docker compose up --build
```

После запуска:

| Сервис | Адрес |
| --- | --- |
| Клиентский и банковский интерфейс | http://localhost:3000 |
| REST API | http://localhost:8000/api |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| PostgreSQL | `localhost:5432` (по умолчанию) |

> Первая сборка занимает больше обычного: в Docker-образ backend скачивается CPU-версия PyTorch и локальная модель `paraphrase-multilingual-MiniLM-L12-v2` (~500 МБ). Модель предзагружается на этапе сборки, поэтому во время демонстрации внешний интернет не нужен.

---

## Содержание

- [Что реализовано](#что-реализовано)
- [Архитектура](#архитектура)
- [Тестовые аккаунты](#тестовые-аккаунты)
- [Демо-сценарии](#демо-сценарии)
- [Сквозной процесс](#сквозной-процесс)
- [Скоринг, DTI и Decision Engine](#скоринг-dti-и-decision-engine)
- [ИИ-проверка цели](#ии-проверка-цели)
- [Моки интеграций](#моки-интеграций)
- [API](#api)
- [Структура проекта](#структура-проекта)
- [Переменные окружения](#переменные-окружения)
- [База данных и миграции](#база-данных-и-миграции)
- [Тесты](#тесты)
- [Локальная разработка без Docker](#локальная-разработка-без-docker)
- [Проверка API через curl](#проверка-api-через-curl)
- [Диагностика](#диагностика)
- [Ограничения демо](#ограничения-демо)

---

## Что реализовано

### Интерфейс
- Единая дизайн-система на компонентах **shadcn/ui** (Button, Card, Input, Textarea, Label, Badge, Alert, Skeleton, Separator).
- Рабочая ширина макета — **1280 px**, увеличенная базовая типографика (17 px) и крупные заголовки.
- Светлая и **тёмная тема** с переключателем в сайдбаре; выбор сохраняется через `next-themes`.
- Адаптивная оболочка: сайдбар на десктопе, компактная навигация на мобильных.
- Доступные состояния фокуса, контрастные семантические цвета и аккуратные состояния загрузки / пустых списков.

### Кредитные продукты
- Три категории: **«Без залога»**, **«С залогом»** и **«Кредитная линия»**.
- В карточке продукта и в параметрах заявки отображаются обеспечение, тип погашения и признак возобновляемой линии.
- Каталог хранится в БД (`products`) и отдаётся через `GET /api/products`.

### Клиент
- Вход по JWT, защищённые маршруты и роли `client` / `bank`.
- Самостоятельная регистрация отключена: доступ предоставляется по выданным демо-аккаунтам.
- Профиль компании: реквизиты, ОКВЭД, финансовые показатели и сводка по заявкам.
- Дашборд: карточка компании, статистика и список заявок.
- Трёхшаговый степпер новой заявки: продукт → сумма / срок / цель → подтверждение.
- Детальная страница заявки:
  - таймлайн всех статусов;
  - одобрение и подтверждение условий;
  - баннер встречного предложения с кнопками «Принять» / «Отказаться»;
  - причина отказа;
  - прозрачная детализация скоринга, ИИ-проверки, ГИР БО и БКИ;
  - подписание договора и статус «Средства выданы».

### Банк
- Очередь заявок с фильтрами по статусу, продукту и поиском по компании / ИНН / номеру.
- Карточка заявки со всеми блоками:
  - данные клиента и ЕГРЮЛ;
  - финансовая проверка: заявлено vs ГИР БО;
  - БКИ: рейтинг, просрочки, платежи, дисциплина, DTI;
  - ИИ-проверка: вердикт, комментарий, процент сходства;
  - скоринг: факторы, баллы, DTI;
  - история решений.
- Решения: «Одобрить», «Отклонить», «На доп. информацию» — только для заявок в `MANUAL_REVIEW`.

### Backend
- FastAPI + SQLAlchemy 2.0 async + asyncpg + Pydantic v2.
- Alembic-миграции и идемпотентный seed.
- Оркестратор с явной state machine и аудитом каждого перехода.
- Мок-интеграции ЕГРЮЛ, ГИР БО, БКИ.
- Локальный semantic search без внешних API.
- JWT-аутентификация, роли, CORS.

---

## Архитектура

```text
┌──────────────────────────────┐
│ Next.js 14 (App Router)      │
│ React Query · RHF · Tailwind │
│ shadcn/ui · next-themes      │
└──────────────┬───────────────┘
               │ REST / JWT
┌──────────────▼───────────────┐
│ FastAPI                      │
│                              │
│ Auth / Products              │
│ Client Applications          │
│ Bank Applications            │
│ Mock Integrations            │
│                              │
│ Orchestrator                 │
│  ├── Validation              │
│  ├── Enrichment (mocks)      │
│  ├── AI purpose check        │
│  ├── Scoring + DTI           │
│  └── Decision Engine         │
│                              │
│ sentence-transformers (CPU)  │
└──────────────┬───────────────┘
               │ asyncpg
┌──────────────▼───────────────┐
│ PostgreSQL 15                │
│ users, llc_companies,        │
│ individual_entrepreneurs,    │
│ okveds, products,            │
│ applications, checks,        │
│ scoring, outcomes, history   │
└──────────────────────────────┘
```

---

## Тестовые аккаунты

Пароль у всех аккаунтов: **`password123`**. Самостоятельная регистрация отключена — используйте выданные демо-аккаунты.

| Email | Роль | Компания / назначение | Основной сценарий |
| --- | --- | --- | --- |
| `client1@example.com` | client | ООО «Ромашка», ИНН `7701234567`, ОКВЭД 62.01, выручка 15 млн, прибыль 1.8 млн, возраст 36 мес., БКИ 750 | Заявка на 1 млн → **APPROVED**, скор 100 |
| `client2@example.com` | client | ИП Иванов, ИНН `770123456789`, ОКВЭД 47.11, выручка 5.4 млн, прибыль 500 тыс., возраст 18 мес., БКИ 650, платежи 150 тыс. | Заявка на 3 млн → **COUNTER_OFFER** на 1.5 млн |
| `client2@example.com` | client | Та же компания | Дополнительная заявка «Покупка серверов» → **MANUAL_REVIEW** (цель не соответствует розничному ОКВЭД) |
| `client3@example.com` | client | ООО «Риск», ИНН `770123456700`, выручка 800 тыс., прибыль −150 тыс., БКИ 480, 2 просрочки | Заявка на 500 тыс. → **REJECTED** по жёсткой блокировке |
| `bank@example.com` | bank | Кабинет кредитного менеджера | Ручная проверка и решения |

Дополнительная заявка client2 нужна, чтобы в демо был кейс, на котором банк может нажать «Одобрить / Отклонить / На доп. информацию». Основная заявка client2 при этом остаётся встречным предложением на 1.5 млн.

---

## Демо-сценарии

### 1. Автоодобрение (client1)

1. Войти как `client1@example.com`.
2. Открыть заявку **#1** по продукту «С залогом» на 1 000 000 ₽.
3. Убедиться в статусе **APPROVED**: скор 100, DTI 4.1%, ИИ-сходство 59.75%.
4. Нажать **«Подтвердить условия»** → статус `CONTRACT_SIGNING`.
5. Нажать **«Подписать договор»** → статус `DISBURSED`, деньги на счёте.

### 2. Встречное предложение (client2)

1. Войти как `client2@example.com`.
2. Открыть заявку **#2** по продукту «Без залога» на 3 000 000 ₽.
3. Увидеть баннер: «Банк готов одобрить кредит… на комфортную сумму **1 500 000 ₽**».
4. **«Принять предложение»** → сумма заявки становится 1.5 млн, статус `CONTRACT_SIGNING`.
5. Подписать договор → `DISBURSED`.
6. Альтернативно: **«Отказаться»** → `REJECTED` с причиной «Клиент отказался…».

### 3. Жёсткая блокировка (client3)

1. Войти как `client3@example.com`.
2. Открыть заявку **#3** по продукту «Без залога».
3. Увидеть **REJECTED** и причину: обнаружены просрочки (2). Скор 0, DTI 208%.

### 4. Ручная проверка банком (bank)

1. Войти как `bank@example.com`.
2. Открыть заявку **#4** по продукту «С залогом» от ИП Иванова со статусом **MANUAL_REVIEW** (ИИ не подтвердил цель «Покупка серверов» для розничной торговли).
3. Проверить блоки клиента, ГИР БО, БКИ, ИИ и скоринг.
4. Ввести сумму / срок / ставку и комментарий.
5. Нажать **«Одобрить заявку»** → клиент увидит одобрение и сможет подписать договор.
6. Либо **«Отклонить»** / **«Доп. информация»**.

### 5. Профиль компании

1. Войти под демо-аккаунтом клиента.
2. Открыть раздел **«Профиль»**.
3. В профиле видны реквизиты, ОКВЭД, финансовые показатели, статус просрочек и сводка по заявкам.
4. Из профиля можно сразу подать новую заявку.

Самостоятельная регистрация отключена: аккаунты и профили компаний создаются банком и загружаются из seed.

---

## Сквозной процесс

При `POST /api/applications/{id}/submit` оркестратор последовательно проходит:

| Шаг | Статус | Что происходит |
| --- | --- | --- |
| 1 | `VALIDATION` | Проверка суммы и срока по лимитам продукта. Ошибка → `REJECTED`. |
| 2 | `ENRICHMENT` | Параллельные запросы к мокам ЕГРЮЛ, ГИР БО, БКИ. Создаются `financial_verifications` и `bki_checks`. |
| 3 | `AI_PURPOSE_CHECK` | Локальная модель проверяет цель против ОКВЭД. Создаётся `ai_checks`. |
| 4 | `SCORING` | Расчёт баллов и DTI, создаётся `scoring_results`. |
| 5 | Решение | Hard overrides → score bands → `APPROVED` / `COUNTER_OFFER` / `MANUAL_REVIEW` / `REJECTED`. |
| 6 | `CONTRACT_SIGNING` | Клиент подтверждает условия или принимает встречное предложение. |
| 7 | `DISBURSED` | Демонстрационное подписание договора и выдача средств. |

Каждый переход записывается в `status_history` с комментарием и ролью автора (`client`, `bank`, `system`).

Полная диаграмма: [`docs/state_diagram.mmd`](docs/state_diagram.mmd).  
Модель данных: [`docs/data_model.md`](docs/data_model.md).

---

## Скоринг, DTI и Decision Engine

### База

Стартовое значение: **50 баллов**, итог всегда ограничивается диапазоном **0–100**. Максимум — 100 баллов; значение проверяется и на уровне API-схемы, и в интерфейсе (`X / 100`).

| Фактор | Условие | Баллы |
| --- | --- | --- |
| Выручка (ГИР БО) | > 10 млн ₽ | +20 |
| | 1–10 млн ₽ | +10 |
| | < 1 млн ₽ | −10 |
| Прибыль (ГИР БО) | > 0 | +10 |
| | < 0 | −20 |
| Возраст бизнеса | > 24 мес. | +10 |
| | < 12 мес. | −15 |
| Скор БКИ | > 700 | +15 |
| | < 500 | −20 |
| Просрочки | `overdue_count > 0` | −30 |
| DTI | < 30% | +15 |
| | > 50% | −25 |
| ИИ-проверка | цель соответствует ОКВЭД | +10 |
| | не соответствует | −20 |

Факторы сохраняются в `scoring_results.factors` (JSONB) с человекочитаемым описанием. Если итог выходит за 0–100, в таблицу добавляется строка-ограничитель.

### DTI

```text
new_payment = (amount / term_months) * 1.2
DTI = (bki.monthly_payments + new_payment) / (official_revenue / 12) * 100
```

`official_revenue` берётся из ГИР БО, а не из заявленных клиентом данных.

### Decision Engine

Сначала применяются жёсткие блокировки в указанном порядке:

1. `overdue_count > 0` → **REJECTED**.
2. `official_profit < 0` → **MANUAL_REVIEW**.
3. `is_purpose_valid == false` → **MANUAL_REVIEW**.

Если блокировок нет:

| Скор | Решение |
| --- | --- |
| ≥ 75 | **APPROVED** на запрошенную сумму |
| 50–74 | **COUNTER_OFFER** |
| 30–49 | **MANUAL_REVIEW** |
| < 30 | **REJECTED** |

### Комфортная сумма для встречного предложения

```text
monthly_revenue = official_revenue / 12
max_monthly_payment = monthly_revenue * 0.5 - bki.monthly_payments
comfortable_amount = max_monthly_payment * term_months / 1.2
```

Сумма округляется вниз до 10 000 ₽, чтобы DTI оставался ≤ 50%. Если она ниже минимальной суммы продукта — заявка получает **REJECTED** с причиной «Недостаточная кредитоспособность».

Для client2: `(5 400 000 / 12 × 0.5 − 150 000) × 24 / 1.2 = 1 500 000 ₽`.

---

## ИИ-проверка цели

Сервис: `backend/app/services/ai_service.py`.

- Модель: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.
- Инференс: локальный CPU, без внешних API.
- Стоп-темы: казино, криптовалюта/майнинг, оружие, наркотики, букмекерство, азартные игры, обналичивание.
- Косинусное сходство цели с профилем ОКВЭД.
- Порог: **0.5** (настраивается `AI_SIMILARITY_THRESHOLD`).
- Для устойчивости коротких формулировок («Покупка серверов» ↔ «Разработка ПО») сходство считается по названию ОКВЭД и короткому отраслевому профилю; берётся максимум. Это не меняет порог 0.5, но даёт модели бизнес-контекст.
- Если модель недоступна (например, лёгкий локальный запуск без PyTorch), используется детерминированный keyword-fallback; в комментарии это явно указывается.
- Модель предзагружается в Dockerfile на этапе сборки.

Результат сохраняется в `ai_checks`:
`is_purpose_valid`, `similarity_score`, `ai_comment`.

---

## Моки интеграций

Моки доступны без авторизации и возвращают детерминированные данные для трёх демо-ИНН. Для остальных ИНН значения генерируются стабильно на основе SHA-256.

| Endpoint | Данные |
| --- | --- |
| `GET /api/mock/egrul/{inn}` | `okved`, `okved_name`, `status`, `reg_date`, название, адрес |
| `GET /api/mock/girbo/{inn}` | `official_revenue`, `official_profit`, `tax_regime`, `period` |
| `GET /api/mock/bki/{inn}` | `bki_score`, `active_loans`, `monthly_payments`, `overdue_count`, `payment_discipline_pct` |

Оркестратор использует тот же источник данных через сервисный слой `integrations.py`. Это позволяет запускать seed без HTTP-запросов к самому себе и сохраняет полностью воспроизводимую демонстрацию.

---

## API

Все защищённые endpoints требуют заголовок:

```http
Authorization: Bearer <access_token>
```

### Auth

| Метод | Path | Доступ | Описание |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | public | JSON `{ "email", "password" }` → JWT + профиль |
| GET | `/api/auth/me` | auth | Текущий пользователь и компания |

### Client

| Метод | Path | Доступ | Описание |
| --- | --- | --- | --- |
| GET | `/api/applications` | client | Список своих заявок |
| POST | `/api/applications` | client | Создать черновик |
| GET | `/api/applications/{id}` | client | Полная карточка заявки |
| PUT | `/api/applications/{id}` | client | Изменить черновик |
| POST | `/api/applications/{id}/submit` | client | Запустить оркестратор |
| POST | `/api/applications/{id}/confirm-conditions` | client | `APPROVED` → `CONTRACT_SIGNING` |
| POST | `/api/applications/{id}/accept-counter-offer` | client | Принять сумму банка → `CONTRACT_SIGNING` |
| POST | `/api/applications/{id}/decline-counter-offer` | client | Отказаться → `REJECTED` |
| POST | `/api/applications/{id}/sign-contract` | client | `CONTRACT_SIGNING` → `DISBURSED` |
| GET | `/api/products` | auth | Каталог продуктов |

### Bank

| Метод | Path | Доступ | Описание |
| --- | --- | --- | --- |
| GET | `/api/bank/applications` | bank | Очередь заявок; фильтры `status`, `product_code`, `search` |
| GET | `/api/bank/applications/{id}` | bank | Полная карточка |
| POST | `/api/bank/applications/{id}/decision` | bank | Решение только для `MANUAL_REVIEW` |

Пример решения банка:

```json
{
  "decision": "APPROVED",
  "comment": "Документы проверены",
  "approved_amount": 900000,
  "approved_term_months": 24,
  "approved_rate": 19.5
}
```

`decision`: `APPROVED` | `REJECTED` | `MANUAL_REVIEW` (последнее означает «запросить доп. информацию» и сохраняет текущий статус).

### Detail

`GET /api/applications/{id}` и `GET /api/bank/applications/{id}` возвращают:

- заявку и продукт;
- клиента и компанию одного из двух типов: `legal_form: "IP"` или `"OOO"`;
- вложенный справочник ОКВЭД `okved: { id, code, name }`;
- `financial_verification`;
- `bki_check`;
- `ai_check`;
- `scoring_result` с факторами;
- вложенные объекты `decision` (`decision`, `decision_reason`) и `approval` (`approved_amount`, `approved_term_months`, `approved_rate`), если они уже сформированы;
- `status_history` как полный аудит статусов.

`counter_offer_amount` остаётся полем самой заявки. Для встречного предложения `approval.approved_amount` может быть `null`, пока клиент не примет предложение.

Пример фрагмента ответа:

```json
{
  "id": 2,
  "status": "COUNTER_OFFER",
  "counter_offer_amount": 1500000,
  "decision": {
    "decision": "COUNTER_OFFER",
    "decision_reason": "Банк готов одобрить кредит на комфортную сумму 1 500 000 ₽."
  },
  "approval": {
    "approved_amount": null,
    "approved_term_months": 24,
    "approved_rate": 20.9
  }
}
```

### Mock

`GET /api/mock/egrul/{inn}`, `/girbo/{inn}`, `/bki/{inn}` — публичные.

---

## Структура проекта

```text
.
├── backend/
│   ├── app/
│   │   ├── config.py
│   │   ├── constants.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   ├── seed.py
│   │   ├── wait_for_db.py
│   │   ├── routers/
│   │   │   ├── applications.py
│   │   │   ├── auth.py
│   │   │   ├── bank.py
│   │   │   ├── mock.py
│   │   │   └── products.py
│   │   └── services/
│   │       ├── ai_service.py
│   │       ├── application_outcomes.py
│   │       ├── application_queries.py
│   │       ├── companies.py
│   │       ├── decision_engine.py
│   │       ├── integrations.py
│   │       ├── mock_data.py
│   │       ├── okveds.py
│   │       ├── orchestrator.py
│   │       ├── scoring.py
│   │       └── state_machine.py
│   ├── tests/
│   │   ├── test_company_outcomes.py
│   │   └── test_decision_engine.py
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       ├── 0001_initial.py
│   │       ├── 0002_product_categories.py
│   │       ├── 0003_company_forms_outcomes.py
│   │       └── 0004_okved_reference.py
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── applications/[id]/page.tsx
│   │   ├── applications/new/page.tsx
│   │   ├── bank/applications/[id]/page.tsx
│   │   ├── bank/applications/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── login/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── globals.css
│   │   ├── icon.svg
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/
│   │   │   ├── alert.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── textarea.tsx
│   │   ├── app-shell.tsx
│   │   ├── scoring.tsx
│   │   ├── status-badge.tsx
│   │   ├── theme-toggle.tsx
│   │   ├── timeline.tsx
│   │   └── ui.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.tsx
│   │   ├── cn.ts
│   │   ├── format.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   ├── public/
│   ├── components.json
│   ├── Dockerfile
│   ├── next.config.mjs
│   ├── package.json
│   ├── postcss.config.mjs
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── docs/
│   ├── data_model.md
│   └── state_diagram.mmd
├── docker-compose.yml
├── README.md
├── THIRD_PARTY_NOTICES.md
└── .env.example
```

---

## Переменные окружения

Docker Compose уже содержит безопасные значения по умолчанию. Для переопределения создайте `.env` в корне (см. `.env.example`).

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `POSTGRES_DB` | `alfa_credit` | Имя БД |
| `POSTGRES_USER` | `alfa` | Пользователь БД |
| `POSTGRES_PASSWORD` | `alfa_secret` | Пароль БД |
| `POSTGRES_PORT` | `5432` | Порт Postgres на хосте |
| `BACKEND_PORT` | `8000` | Порт API |
| `FRONTEND_PORT` | `3000` | Порт UI |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api` | API для браузера (вшивается при сборке фронтенда) |
| `JWT_SECRET` | демо-значение | Подпись JWT; заменить в production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Время жизни токена |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Разрешённые origin |
| `AI_ENABLED` | `true` | Включить sentence-transformers |
| `AI_SIMILARITY_THRESHOLD` | `0.5` | Порог ИИ-проверки |
| `AI_MODEL_NAME` | `paraphrase-multilingual-MiniLM-L12-v2` | Модель |

Backend также читает `backend/.env` — см. `backend/.env.example`.

---

## База данных и миграции

- PostgreSQL 15 в Docker.
- Схема создаётся Alembic-миграцией `0001_initial`, категории продуктов и их параметры — миграцией `0002_product_categories`. Продукты переименовываются на месте, поэтому `product_id` существующих заявок сохраняются.
- Миграция `0003_company_forms_outcomes` заменяет `companies` двумя независимыми таблицами `llc_companies` и `individual_entrepreneurs`, а также переносит `decision` / `decision_reason` в `application_decisions`, а `approved_*` — в `application_approvals`. `counter_offer_amount` остаётся в `applications`. ID заявок, статусы и существующие данные сохраняются; downgrade собирает `companies` и плоские поля обратно.
- Миграция `0004_okved_reference` выносит `okved` / `okved_name` в справочник `okveds` (`id`, `code`, `name`), добавляет `okved_id` с `NOT NULL` и `ON DELETE RESTRICT` в обе таблицы компаний и удаляет старые поля. Справочник содержит шесть кодов ОКВЭД; существующие профили получают ссылки без потери данных.
- При старте контейнера `entrypoint.sh`:
  1. ждёт доступности БД;
  2. выполняет `alembic upgrade head`;
  3. запускает идемпотентный seed;
  4. стартует Uvicorn.
- Seed пропускается, если в таблице `users` уже есть записи.

Пересоздать демо-данные:

```bash
docker compose down -v
docker compose up --build
```

---

## Тесты

Регрессия Decision Engine запускается внутри backend-контейнера:

```bash
docker compose exec backend python -m unittest discover -s tests -v
```

Проверяются два сценария:

- `overdue_count = 1` при скоре 100 → **REJECTED** (жёсткая блокировка сильнее скоринга);
- `overdue_count = 0` при скоре 100 → **APPROVED** (контрольный сценарий без просрочек).

---

## Локальная разработка без Docker

Понадобится PostgreSQL 15+ и Python 3.11.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL=postgresql+asyncpg://alfa:alfa_secret@localhost:5432/alfa_credit
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Если не устанавливать PyTorch / sentence-transformers, приложение продолжит работать в эвристическом fallback-режиме. Для полной демонстрации установите зависимости из `requirements.txt`.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Открыть http://localhost:3000.

### Сборка фронтенда

```bash
npm run build
npm start
```

---

## Проверка API через curl

```bash
# Логин
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"client1@example.com","password":"password123"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

# Мои заявки
curl -s http://localhost:8000/api/applications \
  -H "Authorization: Bearer $TOKEN"

# Детали
curl -s http://localhost:8000/api/applications/1 \
  -H "Authorization: Bearer $TOKEN"

# Моки
curl -s http://localhost:8000/api/mock/egrul/7701234567
curl -s http://localhost:8000/api/mock/girbo/7701234567
curl -s http://localhost:8000/api/mock/bki/7701234567
```

---

## Диагностика

**`docker compose up` долго собирается.**  
Ожидаемо: PyTorch CPU + модель. Последующие запуски используют кэш слоёв Docker.

**Backend unhealthy.**  
Проверьте логи:

```bash
docker compose logs -f backend
```

Чаще всего это ожидание БД или ошибка миграции. Убедитесь, что порт 5432 не занят.

**Порт 3000/8000 занят.**

```bash
FRONTEND_PORT=3100 BACKEND_PORT=8100 docker compose up --build
```

При смене `BACKEND_PORT` также задайте `NEXT_PUBLIC_API_URL=http://localhost:8100/api` — значение вшивается на этапе сборки фронтенда.

**Фронтенд не видит API.**  
`NEXT_PUBLIC_API_URL` должен быть доступен из браузера пользователя, а не только из контейнера. Для локального запуска это `http://localhost:8000/api`. После изменения пересоберите frontend.

**Модель не загрузилась.**  
Проверьте `docker compose logs backend | grep -i модель`. Приложение продолжит работать с fallback и явно укажет это в комментарии ИИ-проверки.

---

## Ограничения демо

- Все компании, ИНН и ОГРН вымышлены.
- ЕГРЮЛ, ГИР БО и БКИ — моки, а не реальные интеграции.
- Подписание договора и выдача средств имитируются сменой статуса.
- Пароли хранятся как bcrypt-хеши, JWT подписывается секретом из окружения. Для production нужны HTTPS, ротация секретов, ограничение CORS и полноценный аудит.
- В проекте нет реального кредитного договора, графика платежей и бухгалтерских проводок.

---

## Лицензии и сторонние компоненты

См. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
