from fastapi import APIRouter, Depends, HTTPException, Query
from app.services.llm_service import suggest_places
from app.utils.deps import get_current_user
from app.models import User

router = APIRouter()


@router.get("/suggestions/places")
async def get_place_suggestions(
    country: str = Query(..., min_length=1),
    city: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
):
    """Get AI suggestions for places to visit in a given country and city."""
    try:
        suggestions = await suggest_places(country=country, city=city)
        return {"suggestions": suggestions}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        err = str(e).lower()
        if "rate limit" in err or "429" in err:
            raise HTTPException(status_code=429, detail="Превышен лимит запросов. Попробуйте позже.")
        if "api key" in err or "invalid" in err:
            raise HTTPException(status_code=503, detail="Сервис подсказок временно недоступен.")
        raise HTTPException(status_code=500, detail="Не удалось получить подсказки.")
