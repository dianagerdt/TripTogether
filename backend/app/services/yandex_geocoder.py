import requests
from typing import Optional, Dict, Any
from app.config import settings


class YandexGeocoder:
    """Сервис для геокодирования адресов через Яндекс Геокодер API"""
    
    BASE_URL = "https://geocode-maps.yandex.ru/1.x/"
    
    def __init__(self):
        if not settings.yandex_api_key:
            raise ValueError("Yandex API key is not configured")
        self.api_key = settings.yandex_api_key
    
    def geocode(self, address: str) -> Optional[Dict[str, Any]]:
        """
        Получить координаты из адреса.
        
        Args:
            address: Адрес в формате "страна, город, место" или "город, место"
            
        Returns:
            Dict с ключами:
            - latitude: float
            - longitude: float
            - place_id: str (опционально)
            - formatted_address: str
            Или None, если адрес не найден
        """
        try:
            params = {
                "apikey": self.api_key,
                "geocode": address,
                "format": "json",
                "results": 1,
                "lang": "ru_RU"
            }
            
            response = requests.get(self.BASE_URL, params=params, timeout=5)
            response.raise_for_status()
            
            data = response.json()
            
            # Проверка наличия результатов
            feature_members = data.get("response", {}).get("GeoObjectCollection", {}).get("featureMember", [])
            if not feature_members:
                return None
            
            feature = feature_members[0]["GeoObject"]
            
            # Получение координат (формат: "долгота широта")
            pos = feature["Point"]["pos"].split()
            longitude = float(pos[0])
            latitude = float(pos[1])
            
            # Получение метаданных
            meta = feature.get("metaDataProperty", {}).get("GeocoderMetaData", {})
            formatted_address = meta.get("text", address)
            precision = meta.get("precision", "unknown")
            
            # Получение Place ID (если есть)
            place_id = None
            if "Address" in meta:
                place_id = meta["Address"].get("postal_code")  # Используем как идентификатор
            
            return {
                "latitude": latitude,
                "longitude": longitude,
                "place_id": place_id,
                "formatted_address": formatted_address,
                "precision": precision
            }
            
        except requests.exceptions.RequestException as e:
            # Логируем ошибку, но не падаем
            print(f"Yandex Geocoder error: {str(e)}")
            return None
        except (KeyError, ValueError, IndexError) as e:
            # Ошибка парсинга ответа
            print(f"Yandex Geocoder parsing error: {str(e)}")
            return None
    
    def geocode_preference(self, country: str, city: str, location: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Геокодирование пожелания (специальный метод для PlacePreference).
        
        Args:
            country: Страна
            city: Город
            location: Конкретное место (опционально)
            
        Returns:
            Dict с координатами или None
        """
        # Формируем адрес
        if location:
            address = f"{location}, {city}, {country}"
        else:
            address = f"{city}, {country}"
        
        return self.geocode(address)
    
    def reverse_geocode(self, latitude: float, longitude: float) -> Optional[str]:
        """
        Обратное геокодирование: получение адреса из координат.
        
        Args:
            latitude: Широта
            longitude: Долгота
            
        Returns:
            Форматированный адрес или None
        """
        try:
            params = {
                "apikey": self.api_key,
                "geocode": f"{longitude},{latitude}",
                "format": "json",
                "results": 1,
                "lang": "ru_RU",
                "kind": "house"  # Более точный результат
            }
            
            response = requests.get(self.BASE_URL, params=params, timeout=5)
            response.raise_for_status()
            
            data = response.json()
            feature_members = data.get("response", {}).get("GeoObjectCollection", {}).get("featureMember", [])
            
            if not feature_members:
                return None
            
            feature = feature_members[0]["GeoObject"]
            meta = feature.get("metaDataProperty", {}).get("GeocoderMetaData", {})
            return meta.get("text")
            
        except Exception as e:
            print(f"Yandex Reverse Geocoder error: {str(e)}")
            return None
