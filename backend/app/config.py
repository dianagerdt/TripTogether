from pydantic_settings import BaseSettings
from pydantic import model_validator
from functools import lru_cache

_DEFAULT_JWT_SECRET = "your-super-secret-key-change-in-production"


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:postgres@db:5432/triptogether"
    
    # JWT
    jwt_secret: str = _DEFAULT_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    
    # DeepSeek API (compatible with OpenAI API)
    deepseek_api_key: str = ""  # Set via DEEPSEEK_API_KEY environment variable
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    
    # Yandex Maps API
    yandex_api_key: str = ""  # Set via YANDEX_API_KEY environment variable
    
    # App
    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"
    
    # Limits
    max_generation_count: int = 10
    max_participants_per_trip: int = 10
    max_preferences_per_trip: int = 50
    
    @model_validator(mode="after")
    def require_secret_in_production(self):
        if self.app_env == "production" and self.jwt_secret == _DEFAULT_JWT_SECRET:
            raise ValueError(
                "В production необходимо задать JWT_SECRET в переменных окружения. "
                "Не используйте значение по умолчанию."
            )
        return self

    class Config:
        env_file = ".env"
        case_sensitive = False
        env_prefix = ""  # No prefix, read directly from environment


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
