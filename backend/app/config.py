from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:postgres@db:5432/triptogether"
    
    # JWT
    jwt_secret: str = "your-super-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    
    # OpenAI
    openai_api_key: str = ""
    
    # App
    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"
    
    # Limits
    max_generation_count: int = 3
    max_participants_per_trip: int = 10
    max_preferences_per_trip: int = 50
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
