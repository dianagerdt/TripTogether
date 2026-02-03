from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth
from app.routers import trips
from app.routers import preferences
from app.routers import routes
from app.routers import votes
from app.routers import reactions
from app.routers import suggestions
from app.routers import checklist

app = FastAPI(
    title="TripTogether API",
    description="API для сервиса группового планирования путешествий",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "TripTogether API", "status": "ok"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# Auth routes
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# Trips routes
app.include_router(trips.router, prefix="/api/trips", tags=["Trips"])

# Preferences routes
app.include_router(preferences.router, prefix="/api/trips", tags=["Preferences"])

# Routes (LLM generation)
app.include_router(routes.router, prefix="/api/trips", tags=["Routes"])

# Voting
app.include_router(votes.router, prefix="/api/trips", tags=["Voting"])

# Reactions
app.include_router(reactions.router, prefix="/api/preferences", tags=["Reactions"])

# AI place suggestions
app.include_router(suggestions.router, prefix="/api", tags=["Suggestions"])

# Packing checklist (after routes generated)
app.include_router(checklist.router, prefix="/api/trips", tags=["Checklist"])
