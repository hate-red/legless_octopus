# Third-Party Notices

Проект создан для демонстрации на хакатоне Альфа-Банка. Ниже перечислены сторонние компоненты, моки и ограничения.

## 1. Демонстрационные данные и моки

### ЕГРЮЛ, ГИР БО, БКИ

Интеграции реализованы как **моки** в `backend/app/services/mock_data.py` и `backend/app/routers/mock.py`.

- Реальные запросы в ФНС, ГИР БО и бюро кредитных историй не выполняются.
- Названия компаний, ИНН, ОГРН, адреса, финансовые показатели и кредитные рейтинги вымышлены.
- Для трёх демо-ИНН данные фиксированы; для остальных значений используется детерминированная генерация на основе SHA-256.
- Моки не являются юридически значимыми и не могут использоваться для принятия реальных кредитных решений.

### Кредитные продукты и решения

Ставки, лимиты, скоринговая формула и правила Decision Engine — упрощённая хакатон-модель. Она не отражает реальную кредитную политику банка.

## 2. Локальный искусственный интеллект

### sentence-transformers

- Библиотека: `sentence-transformers` 2.7.0
- Лицензия: Apache License 2.0
- Репозиторий: https://github.com/UKPLab/sentence-transformers
- Использование: кодирование цели кредита и профиля ОКВЭД, косинусное сходство.

### Модель paraphrase-multilingual-MiniLM-L12-v2

- Источник: Hugging Face, `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- Карточка модели: https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
- Лицензия: Apache License 2.0
- Модель скачивается один раз на этапе сборки Docker-образа и далее используется локально на CPU.
- Внешние AI API (OpenAI, Anthropic, YandexGPT и т. п.) не вызываются.
- Данные заявок не отправляются в интернет при инференсе.

### PyTorch

- Лицензия: BSD-style (см. https://github.com/pytorch/pytorch/blob/main/LICENSE)
- В Docker устанавливается CPU-сборка `torch==2.3.1+cpu`.

## 3. Backend

| Компонент | Версия | Лицензия |
| --- | --- | --- |
| Python | 3.11 | PSF License |
| FastAPI | 0.111.1 | MIT |
| Uvicorn | 0.30.6 | BSD-3-Clause |
| SQLAlchemy | 2.0.34 | MIT |
| asyncpg | 0.29.0 | Apache-2.0 |
| Alembic | 1.13.2 | MIT |
| Pydantic | 2.8.2 | MIT |
| pydantic-settings | 2.4.0 | MIT |
| email-validator | 2.2.0 | CC0 1.0 |
| python-jose | 3.3.0 | MIT |
| passlib | 1.7.4 | BSD |
| bcrypt | 4.0.1 | Apache-2.0 |
| httpx | 0.27.0 | BSD-3-Clause |
| python-dotenv | 1.0.1 | BSD-3-Clause |
| transformers | 4.41.2 | Apache-2.0 |
| huggingface-hub | 0.23.4 | Apache-2.0 |
| NumPy | 1.26.4 | BSD-3-Clause |

## 4. Database

| Компонент | Версия | Лицензия |
| --- | --- | --- |
| PostgreSQL | 15 | PostgreSQL License |
| Docker Official Image `postgres:15-alpine` | 15 | Содержит компоненты под соответствующими лицензиями |

## 5. Frontend

| Компонент | Версия | Лицензия |
| --- | --- | --- |
| Node.js (build/runtime) | 20 | MIT |
| Next.js | 14.2.35 | MIT |
| React / React DOM | 18.3.1 | MIT |
| TanStack Query | 5.59.0 | MIT |
| react-hook-form | 7.53.0 | MIT |
| @hookform/resolvers | 3.9.0 | MIT |
| Zod | 3.23.8 | MIT |
| Tailwind CSS | 3.4.13 | MIT |
| shadcn/ui (исходные компоненты) | — | MIT |
| @radix-ui/react-slot | 1.0.2 | MIT |
| class-variance-authority | 0.7.0 | Apache-2.0 |
| next-themes | 0.3.0 | MIT |
| tailwindcss-animate | 1.0.7 | MIT |
| lucide-react | 0.451.0 | ISC |
| clsx | 2.1.1 | MIT |
| tailwind-merge | 2.5.4 | MIT |
| TypeScript | 5.6.3 | Apache-2.0 |

## 6. Docker

Docker-образы `python:3.11-slim`, `node:20-alpine` и `postgres:15-alpine` распространяются с лицензиями соответствующих компонентов. Перед публичным использованием проверьте актуальные лицензии базовых образов и обновите версии зависимостей.

## 7. Безопасность и приватность

- Проект демонстрационный, не предназначен для обработки реальных персональных данных или кредитных заявок.
- JWT-секрет и пароль БД по умолчанию предназначены только для локального запуска.
- Пароли демо-пользователей хранятся в виде bcrypt-хешей.
- Для production необходимы: HTTPS, менеджер секретов, ограничение доступа к БД, аудит, резервное копирование и соответствие требованиям регуляторов.

## 8. Товарные знаки

«Альфа-Банк», «Альфа» и связанные обозначения являются товарными знаками их правообладателей. Проект не является официальным продуктом банка и создан в рамках хакатона.
