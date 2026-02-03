"""
End-to-end тестирование основного флоу приложения
Тестирует: регистрация -> создание поездки -> добавление пожеланий -> геокодирование -> генерация маршрутов -> голосование
"""
import requests
import time
from typing import Dict, Any

BASE_URL = "http://localhost:8000/api"

def test_e2e_flow():
    """Тестирование полного флоу приложения"""
    print("=" * 60)
    print("🧪 E2E Тестирование TripTogether")
    print("=" * 60)
    
    # Шаг 1: Регистрация
    print("\n1️⃣ Регистрация пользователя...")
    ts = int(time.time())
    register_data = {
        "email": f"test_{ts}@example.com",
        "password": "testpass123",
        "username": f"TestUser_{ts}"
    }
    register_response = requests.post(f"{BASE_URL}/auth/register", json=register_data)
    assert register_response.status_code == 201, f"Ошибка регистрации: {register_response.text}"
    tokens = register_response.json()
    access_token = tokens["access_token"]
    print("✅ Регистрация успешна")
    
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Шаг 2: Создание поездки
    print("\n2️⃣ Создание поездки по России...")
    trip_data = {
        "title": "Путешествие по России",
        "description": "Посещение Москвы, Санкт-Петербурга и Казани",
        "start_date": "2026-03-15",
        "end_date": "2026-03-25"
    }
    trip_response = requests.post(f"{BASE_URL}/trips", json=trip_data, headers=headers)
    assert trip_response.status_code == 201, f"Ошибка создания поездки: {trip_response.text}"
    trip = trip_response.json()
    trip_id = trip["id"]
    assert isinstance(trip_id, int), "Ответ создания поездки должен содержать id для редиректа"
    print(f"✅ Поездка создана (ID: {trip_id})")
    
    # Шаг 3: Добавление пожеланий
    print("\n3️⃣ Добавление пожеланий...")
    preferences_data = [
        {"country": "Россия", "city": "Москва", "location": "Красная площадь", "place_type": "viewpoint", "priority": 5, "comment": "Главная площадь страны"},
        {"country": "Россия", "city": "Москва", "location": "Третьяковская галерея", "place_type": "museum", "priority": 4},
        {"country": "Россия", "city": "Санкт-Петербург", "location": "Эрмитаж", "place_type": "museum", "priority": 5},
        {"country": "Россия", "city": "Санкт-Петербург", "location": "Петергоф", "place_type": "viewpoint", "priority": 5},
        {"country": "Россия", "city": "Казань", "location": "Казанский Кремль", "place_type": "viewpoint", "priority": 4},
    ]
    
    preference_ids = []
    for pref_data in preferences_data:
        pref_response = requests.post(
            f"{BASE_URL}/trips/{trip_id}/preferences",
            json=pref_data,
            headers=headers
        )
        assert pref_response.status_code == 201, f"Ошибка добавления пожелания: {pref_response.text}"
        preference = pref_response.json()
        preference_ids.append(preference["id"])
        print(f"  ✅ Добавлено: {pref_data['location']}, {pref_data['city']}")
    
    # Шаг 4: Проверка геокодирования
    print("\n4️⃣ Проверка геокодирования...")
    time.sleep(2)  # Даем время на автоматическое геокодирование
    
    prefs_response = requests.get(f"{BASE_URL}/trips/{trip_id}/preferences", headers=headers)
    assert prefs_response.status_code == 200
    preferences = prefs_response.json()
    
    with_coords = [p for p in preferences if p.get("latitude") and p.get("longitude")]
    without_coords = [p for p in preferences if not p.get("latitude") or not p.get("longitude")]
    
    print(f"  📍 Пожеланий с координатами: {len(with_coords)}/{len(preferences)}")
    if without_coords:
        print(f"  ⚠️ Пожеланий без координат: {len(without_coords)}")
        # Попробуем геокодировать одно вручную
        if without_coords:
            geocode_response = requests.post(
                f"{BASE_URL}/trips/{trip_id}/preferences/{without_coords[0]['id']}/geocode",
                headers=headers
            )
            if geocode_response.status_code == 200:
                print(f"  ✅ Ручное геокодирование успешно")
            else:
                print(f"  ⚠️ Ошибка геокодирования: {geocode_response.text}")
    
    # Шаг 5: Генерация маршрутов
    print("\n5️⃣ Генерация AI-маршрутов...")
    generate_response = requests.post(
        f"{BASE_URL}/trips/{trip_id}/routes/generate",
        headers=headers
    )
    
    if generate_response.status_code == 200:
        print("  ✅ Генерация запущена")
        # Ждем завершения генерации
        max_wait = 60
        waited = 0
        while waited < max_wait:
            time.sleep(2)
            trip_response = requests.get(f"{BASE_URL}/trips/{trip_id}", headers=headers)
            trip = trip_response.json()
            if trip["generation_status"] == "COMPLETED":
                print("  ✅ Генерация завершена")
                break
            elif trip["generation_status"] == "FAILED":
                print(f"  ❌ Генерация провалилась")
                break
            waited += 2
        
        # Получаем маршруты
        routes_response = requests.get(f"{BASE_URL}/trips/{trip_id}/routes", headers=headers)
        if routes_response.status_code == 200:
            routes = routes_response.json()
            print(f"  📍 Сгенерировано маршрутов: {len(routes)}")
            for route in routes:
                print(f"    - {route['title']}")
    else:
        print(f"  ⚠️ Ошибка генерации: {generate_response.text}")
    
    # Шаг 6: Голосование (если есть маршруты)
    print("\n6️⃣ Голосование...")
    routes_response = requests.get(f"{BASE_URL}/trips/{trip_id}/routes", headers=headers)
    if routes_response.status_code == 200:
        routes = routes_response.json()
        if routes:
            # Голосуем за первый маршрут
            vote_response = requests.post(
                f"{BASE_URL}/trips/{trip_id}/votes",
                json={"route_option_id": routes[0]["id"]},
                headers=headers
            )
            if vote_response.status_code == 200:
                print(f"  ✅ Голосование за маршрут '{routes[0]['title']}' успешно")
            else:
                print(f"  ⚠️ Ошибка голосования: {vote_response.text}")
        else:
            print("  ⚠️ Нет маршрутов для голосования")
    
    # Шаг 7: Проверка данных поездки
    print("\n7️⃣ Финальная проверка данных...")
    trip_response = requests.get(f"{BASE_URL}/trips/{trip_id}", headers=headers)
    trip = trip_response.json()
    print(f"  📊 Поездка: {trip['title']}")
    print(f"  👥 Участников: {len(trip.get('participants', []))}")
    print(f"  📍 Пожеланий: {len(preferences)}")
    print(f"  🗺️ Маршрутов: {len(routes) if routes_response.status_code == 200 else 0}")
    
    print("\n" + "=" * 60)
    print("✅ E2E тестирование завершено!")
    print("=" * 60)
    
    return {
        "trip_id": trip_id,
        "preferences_count": len(preferences),
        "routes_count": len(routes) if routes_response.status_code == 200 else 0
    }

if __name__ == "__main__":
    try:
        result = test_e2e_flow()
        print(f"\n📈 Результаты: {result}")
    except Exception as e:
        print(f"\n❌ Ошибка тестирования: {str(e)}")
        import traceback
        traceback.print_exc()
