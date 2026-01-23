# TripTogether MVP 🗺️

**Сервис для группового планирования путешествий с друзьями**

Помогает группе друзей собрать пожелания по местам для посещения, сгенерировать AI-маршруты и выбрать лучший путём голосования.

## 🚀 Быстрый старт

### Требования
- Docker & Docker Compose
- OpenAI API Key (для генерации маршрутов)

### Запуск

1. **Клонировать репозиторий**
```bash
git clone <repo-url>
cd TripTogether
```

2. **Создать .env файл**
```bash
cp .env.example .env
# Отредактировать .env - добавить OPENAI_API_KEY
```

3. **Запустить**
```bash
docker-compose up -d
```

4. **Готово!**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## 📋 Функциональность

### Аутентификация
- ✅ Регистрация и вход по email
- ✅ JWT токены (access + refresh)

### Поездки
- ✅ Создание поездки с датами
- ✅ Приглашение друзей по коду
- ✅ Просмотр участников

### Пожелания
- ✅ Добавление мест с приоритетом (1-5)
- ✅ Типы мест (музей, парк, еда, и т.д.)
- ✅ Комментарии к пожеланиям
- ✅ Просмотр пожеланий всех участников

### AI Маршруты
- ✅ Генерация 2-3 вариантов маршрутов через OpenAI
- ✅ Лимит генераций (3 раза на поездку)
- ✅ Объяснение выбора маршрута

### Голосование
- ✅ Голосование за несколько вариантов
- ✅ Просмотр результатов в реальном времени

## 🛠 Технологии

| Компонент | Технология |
|-----------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, React Query |
| Backend | FastAPI, Python 3.11, SQLAlchemy, Pydantic |
| Database | PostgreSQL 15 |
| AI | OpenAI GPT-4o-mini |
| Auth | JWT (access + refresh tokens) |
| Infrastructure | Docker, Docker Compose |

## 📁 Структура проекта

```
TripTogether/
├── docker-compose.yml
├── .env.example
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/          # Миграции БД
│   └── app/
│       ├── main.py       # FastAPI app
│       ├── config.py     # Настройки
│       ├── database.py   # SQLAlchemy
│       ├── models/       # ORM модели
│       ├── schemas/      # Pydantic схемы
│       ├── routers/      # API эндпоинты
│       ├── services/     # Бизнес-логика (LLM)
│       ├── prompts/      # Системные промпты
│       └── utils/        # Хелперы (JWT, deps)
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── app/          # Next.js pages
        ├── components/   # React компоненты
        ├── contexts/     # AuthContext
        ├── lib/          # API клиенты
        └── types/        # TypeScript типы
```

## 🔧 Разработка

### Backend
```bash
# Зайти в контейнер
docker exec -it triptogether-backend bash

# Создать миграцию
alembic revision --autogenerate -m "description"

# Применить миграции
alembic upgrade head
```

### Frontend
```bash
# Логи
docker logs -f triptogether-frontend
```

### Полезные команды
```bash
# Перезапуск сервисов
docker-compose restart

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down

# Полная очистка
docker-compose down -v
```

## 📝 API Эндпоинты

### Auth
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `POST /api/auth/refresh` - Обновление токенов
- `GET /api/auth/me` - Текущий пользователь

### Trips
- `GET /api/trips` - Список поездок
- `POST /api/trips` - Создать поездку
- `GET /api/trips/{id}` - Детали поездки
- `POST /api/trips/join` - Присоединиться по коду
- `POST /api/trips/{id}/leave` - Покинуть поездку

### Preferences
- `GET /api/trips/{id}/preferences` - Список пожеланий
- `POST /api/trips/{id}/preferences` - Добавить пожелание
- `DELETE /api/trips/{id}/preferences/{pref_id}` - Удалить

### Routes
- `GET /api/trips/{id}/routes` - Список маршрутов
- `POST /api/trips/{id}/generate-routes` - Генерация AI

### Voting
- `POST /api/trips/{id}/votes` - Проголосовать
- `DELETE /api/trips/{id}/votes/{route_id}` - Отменить голос
- `GET /api/trips/{id}/my-votes` - Мои голоса
- `GET /api/trips/{id}/voting-results` - Результаты

## ⚙️ Конфигурация (.env)

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@db:5432/triptogether

# JWT
JWT_SECRET=your-super-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# OpenAI (обязательно для генерации маршрутов)
OPENAI_API_KEY=sk-your-key-here

# App
FRONTEND_URL=http://localhost:3000
```

## 📄 Лицензия

MIT

---

Made with ❤️ for travelers
