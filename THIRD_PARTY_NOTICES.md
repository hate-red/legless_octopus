## 1. Демонстрационные данные и моки

### ЕГРЮЛ, ГИР БО, БКИ  

- Интеграции реализованы как **моки** в `backend/app/services/mock_data.py` и `backend/app/routers/mock.py`. 
- Реальные запросы в ФНС, ГИР БО и бюро кредитных историй не выполняются.
- Названия компаний, ИНН, ОГРН, адреса, финансовые показатели и кредитные рейтинги вымышлены.

### Кредитные продукты и решения 

Ставки, лимиты, скоринговая формула и правила Decision Engine — упрощённая модель. Она не отражает реальную кредитную политику банка.

## 2. Локальный ИИ

### Llama.cpp

- Библиотека: `llama-cpp-python`
- Использование: Подключение локальной LLM к проекту

## Gemma4

- Локальная модель gemma4-e4b c квантизацией q4_0-it
- Использование: Анализ цели финансирования на совпадение ОКВЭДу компании

## 3. Backend

- Python
- FastAPI
- Uvicorn
- SQLAlchemy
- Alembic
- Pydantic
- Jose
- Bcrypt
- Llama.cpp
- Huggingface

## 4. База данных

PostgreSQL 15

## 5. Frontend

- TypeScript
- Node.js
- Next.js
- React
- TanStack Query
- Zod
- Tailwind  

## 6. Docker 

- `python:3.11-slim`
- `node:20-alpine`
- `postgres:15-alpine` 
