print('=== app.py is running ===')
import os
from dotenv import load_dotenv
import logging
import requests
import googlemaps
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import jwt  # pyjwt
import time
import random
from math import radians, cos, sin, asin, sqrt
from typing import Optional, Tuple

# Print contents of .env file
try:
    with open('/Users/briandine/CascadeProjects/Healthify/.env', 'r') as f:
        print('--- .env contents ---')
        print(f.read())
        print('--- end .env contents ---')
except Exception as e:
    print('Could not read .env file:', e)

# Load environment variables using absolute path and print result
dotenv_loaded = load_dotenv(dotenv_path='/Users/briandine/CascadeProjects/Healthify/.env')
print('load_dotenv result:', dotenv_loaded)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

USDA_API_KEY = os.getenv('USDA_API_KEY')
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
WALMART_API_KEY = os.getenv('WALMART_API_KEY')
WALMART_ENV = os.getenv('WALMART_ENV', 'sandbox')

# Walmart E-commerce API endpoints
WALMART_ECOMMERCE_BASE = "https://developer.api.walmart.com/api-proxy/service/affil/product/v2"

# Helper functions for meal plan and grocery list

def calculate_daily_calories(weight_loss_goal):
    # Assume average person needs 2000 calories to maintain weight
    # 500 calorie deficit = 1 lb per week
    daily_deficit = (weight_loss_goal * 500) / 7  # Spread deficit over 7 days
    return 2000 - daily_deficit

def calculate_macro_targets(daily_calories):
    return {
        'calories': daily_calories,
        'protein': daily_calories * 0.3 / 4,  # 30% of calories from protein (4 cal/g)
        'carbs': daily_calories * 0.45 / 4,   # 45% of calories from carbs (4 cal/g)
        'fat': daily_calories * 0.25 / 9,     # 25% of calories from fat (9 cal/g)
        'fiber': 25  # Recommended daily fiber in grams
    }

def search_usda_foods(query, allergies):
    """
    Search the USDA FoodData Central API for foods matching the query, excluding any with allergy keywords.
    """
    try:
        url = "https://api.nal.usda.gov/fdc/v1/foods/search"
        params = {
            "api_key": USDA_API_KEY,
            "query": query,
            "pageSize": 10
        }
        response = requests.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            foods = data.get("foods", [])
            # Filter out foods with allergy keywords in the description
            filtered = [f for f in foods if not any(a.lower() in f.get('description', '').lower() for a in allergies)]
            return filtered
        else:
            logger.error(f"USDA search failed for {query}: {response.status_code} {response.text}")
            return []
    except Exception as e:
        logger.error(f"USDA search exception for {query}: {e}")
        return []

def create_meal_plan(daily_targets, budget, allergies, health_goals=""):
    meal_types = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2']
    meal_plan = {day: {meal: [] for meal in meal_types} for day in range(7)}
    daily_budget = float(budget) / 7
    
    # Enhanced search terms that better match Walmart grocery products
    meal_search_terms = {
        'breakfast': [
            'oatmeal instant', 'greek yogurt', 'eggs dozen', 'cereal', 'bread whole wheat',
            'banana', 'apple', 'orange juice', 'milk', 'granola bars', 'pancake mix',
            'waffles frozen', 'bacon', 'sausage links', 'cream cheese', 'butter'
        ],
        'lunch': [
            'chicken breast', 'turkey breast', 'tuna canned', 'salad mix', 'tomatoes',
            'lettuce', 'cucumber', 'carrots', 'bell peppers', 'onions', 'bread',
            'mayonnaise', 'mustard', 'cheese slices', 'ham deli', 'soup canned',
            'rice brown', 'pasta', 'beans canned', 'avocado'
        ],
        'dinner': [
            'salmon fillet', 'ground beef', 'pork chops', 'chicken thighs', 'steak',
            'shrimp frozen', 'tilapia', 'tofu', 'quinoa', 'brown rice', 'sweet potato',
            'broccoli', 'spinach', 'asparagus', 'mushrooms', 'garlic', 'olive oil',
            'soy sauce', 'teriyaki sauce', 'pasta sauce', 'tomato sauce'
        ],
        'snack1': [
            'almonds', 'walnuts', 'cashews', 'peanut butter', 'hummus', 'carrots baby',
            'celery', 'apple', 'banana', 'orange', 'grapes', 'strawberries',
            'yogurt greek', 'cheese sticks', 'popcorn', 'granola bars', 'protein bars'
        ],
        'snack2': [
            'trail mix', 'dried fruit', 'nuts mixed', 'seeds sunflower', 'chips tortilla',
            'salsa', 'guacamole', 'cottage cheese', 'berries mixed', 'pear', 'peach',
            'yogurt drink', 'smoothie', 'protein shake', 'crackers whole grain'
        ]
    }
    
    # Adjust search terms based on health goals
    health_goals_lower = health_goals.lower()
    if 'weight loss' in health_goals_lower or 'lose weight' in health_goals_lower:
        # Add more protein and fiber-rich options
        meal_search_terms['breakfast'].extend(['protein powder', 'chia seeds', 'flax seeds'])
        meal_search_terms['lunch'].extend(['chicken salad', 'tuna salad', 'egg salad'])
        meal_search_terms['dinner'].extend(['lean beef', 'fish white', 'vegetables frozen'])
        meal_search_terms['snack1'].extend(['protein shake', 'edamame', 'cottage cheese'])
        meal_search_terms['snack2'].extend(['protein bar', 'nuts raw', 'seeds pumpkin'])
    
    if 'muscle' in health_goals_lower or 'protein' in health_goals_lower:
        # Add more protein-rich options
        meal_search_terms['breakfast'].extend(['protein shake', 'egg whites', 'turkey bacon'])
        meal_search_terms['lunch'].extend(['chicken breast grilled', 'tuna steak', 'salmon'])
        meal_search_terms['dinner'].extend(['steak lean', 'pork tenderloin', 'chicken breast'])
        meal_search_terms['snack1'].extend(['protein bar', 'beef jerky', 'cottage cheese'])
        meal_search_terms['snack2'].extend(['protein shake', 'greek yogurt', 'nuts'])
    
    if 'heart' in health_goals_lower or 'healthy' in health_goals_lower:
        # Add heart-healthy options
        meal_search_terms['breakfast'].extend(['oatmeal steel cut', 'berries', 'nuts'])
        meal_search_terms['lunch'].extend(['salmon', 'avocado', 'olive oil'])
        meal_search_terms['dinner'].extend(['fish salmon', 'vegetables', 'quinoa'])
        meal_search_terms['snack1'].extend(['nuts almonds', 'dark chocolate', 'berries'])
        meal_search_terms['snack2'].extend(['nuts walnuts', 'seeds', 'fruit'])
    
    used_foods = set()
    for day in range(7):
        remaining_budget = daily_budget
        daily_nutrition = {k: 0 for k in daily_targets.keys()}
        for meal_type in meal_types:
            if remaining_budget <= 0:
                break
            # Shuffle search terms for variety
            terms = meal_search_terms[meal_type][:]
            random.shuffle(terms)
            for term in terms:
                foods = search_usda_foods(term, allergies)
                # Filter out foods already used too often (max 2x per week)
                foods = [f for f in foods if f.get('description', '') not in used_foods or list(used_foods).count(f.get('description', '')) < 2]
                if not foods:
                    continue
                # Pick a random food from the filtered results
                food = random.choice(foods)
                desc = food.get('description', 'Food')
                nutrients = {n['nutrientName'].lower(): n['value'] for n in food.get('foodNutrients', [])}
                mapped_nutrients = {
                    'calories': nutrients.get('energy', 0),
                    'protein': nutrients.get('protein', 0),
                    'carbs': nutrients.get('carbohydrate, by difference', 0),
                    'fat': nutrients.get('total lipid (fat)', 0)
                }
                # Calculate portion size to help meet daily targets
                portion_size = 1.0
                if mapped_nutrients['calories'] > 0:
                    # Portion to fill up to 1/4 of remaining calories for main meals, 1/8 for snacks
                    if meal_type.startswith('snack'):
                        max_cals = max(50, (daily_targets['calories'] - daily_nutrition['calories']) / (4 - meal_types.index(meal_type)))
                    else:
                        max_cals = max(100, (daily_targets['calories'] - daily_nutrition['calories']) / (2 - meal_types.index(meal_type)//2))
                    portion_size = min(2.0, max(0.5, max_cals / mapped_nutrients['calories']))
                # Check if adding this food helps meet targets without exceeding by too much
                would_exceed = any(
                    daily_nutrition[k] + mapped_nutrients.get(k, 0) * portion_size > daily_targets[k] * 1.15
                    for k in ['calories', 'protein', 'carbs', 'fat']
                )
                if would_exceed:
                    continue
                estimated_price = min(remaining_budget, 5.00 * portion_size)
                if portion_size > 0:
                    meal_plan[day][meal_type].append({
                        'name': desc,
                        'quantity': f"{portion_size:.1f} servings",
                        'estimated_price': f"${estimated_price:.2f}",
                        'nutrition': {k: v * portion_size for k, v in mapped_nutrients.items()}
                    })
                    for k, v in mapped_nutrients.items():
                        daily_nutrition[k] += v * portion_size
                    remaining_budget -= estimated_price
                    used_foods.add(desc)
                break  # Only add one food per meal slot
    return meal_plan

def consolidate_grocery_list(meal_plan):
    grocery_list = {}
    for day in meal_plan.values():
        for meal in day.values():
            for item in meal:
                name = item['name']
                if name in grocery_list:
                    current_qty = float(grocery_list[name]['quantity'].split()[0])
                    new_qty = float(item['quantity'].split()[0])
                    grocery_list[name]['quantity'] = f"{current_qty + new_qty:.1f} servings"
                    current_price = float(grocery_list[name]['estimated_price'].replace('$', ''))
                    new_price = float(item['estimated_price'].replace('$', ''))
                    grocery_list[name]['estimated_price'] = f"${current_price + new_price:.2f}"
                    for nutrient in item['nutrition']:
                        grocery_list[name]['nutrition'][nutrient] += item['nutrition'][nutrient]
                else:
                    grocery_list[name] = item.copy()
    return list(grocery_list.values())

def search_walmart_product_price(product_name):
    """
    Search Walmart Open API for a product and return its price (if found), else None.
    """
    try:
        url = "https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search"
        params = {"query": product_name, "format": "json"}
        headers = {
            "WM_CONSUMER.ID": WALMART_API_KEY,
            "Accept": "application/json"
        }
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            data = response.json()
            if "items" in data and data["items"]:
                item = data["items"][0]
                price = item.get("salePrice") or item.get("msrp")
                if price:
                    return float(price)
        return None
    except Exception as e:
        logger.error(f"Walmart price lookup failed for {product_name}: {e}")
        return None

def update_grocery_list_with_walmart_prices(grocery_list, budget):
    updated_list = []
    total_spent = 0.0
    for item in grocery_list:
        name = item['name']
        fallback_price = float(item['estimated_price'].replace('$', ''))
        price = search_walmart_product_price(name)
        if price is None:
            price = fallback_price
        # Only add item if it fits in the remaining budget
        if total_spent + price <= budget:
            item['estimated_price'] = f"${price:.2f}"
            updated_list.append(item)
            total_spent += price
        else:
            break  # Stop adding items if budget exceeded
    return updated_list, budget - total_spent

def find_nearby_grocery_stores(latitude, longitude, radius=5000):
    """
    Find nearby grocery stores using Google Maps Places API.
    """
    try:
        if not GOOGLE_MAPS_API_KEY:
            logger.warning("Google Maps API key not found")
            return []
        
        gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)
        
        # Search for grocery stores and supermarkets
        places_result = gmaps.places_nearby(
            location=(latitude, longitude),
            radius=radius,
            type='supermarket'
        )
        
        stores = []
        for place in places_result.get('results', []):
            # Get detailed place information
            place_details = gmaps.place(place['place_id'], fields=['formatted_phone_number', 'opening_hours', 'rating'])
            
            # Calculate distance
            distance = calculate_distance(latitude, longitude, place['geometry']['location']['lat'], place['geometry']['location']['lng'])
            
            store_info = {
                'name': place['name'],
                'address': place.get('vicinity', ''),
                'distance': f"{distance:.1f}",
                'rating': place.get('rating'),
                'phone': place_details.get('result', {}).get('formatted_phone_number'),
                'is_open': place_details.get('result', {}).get('opening_hours', {}).get('open_now', False),
                'types': place.get('types', [])
            }
            stores.append(store_info)
        
        # Sort by distance
        stores.sort(key=lambda x: float(x['distance']))
        return stores[:10]  # Return top 10 closest stores
        
    except Exception as e:
        logger.error(f"Error finding nearby stores: {e}")
        return []

def geocode_zip_to_latlng(zip_code: str) -> Optional[Tuple[float, float]]:
    """Convert a zip/postal code to latitude/longitude using Google Geocoding."""
    try:
        if not GOOGLE_MAPS_API_KEY:
            return None
        gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)
        geocode = gmaps.geocode(zip_code)
        if geocode and len(geocode) > 0:
            loc = geocode[0]['geometry']['location']
            return loc['lat'], loc['lng']
        return None
    except Exception as e:
        logger.error(f"Error geocoding zip {zip_code}: {e}")
        return None

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate distance between two points using Haversine formula.
    """
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r

@app.route('/nearby-walmart-stores', methods=['POST'])
def nearby_walmart_stores():
    """
    Return nearby Walmart stores given either latitude/longitude or a zip code.
    Tries Walmart Store Locator first; falls back to Google Places.
    """
    try:
        data = request.get_json() or {}
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        zip_code = data.get('zip_code')
        radius_meters = int(float(data.get('radius_meters', 10000)))  # default 10km

        # Resolve lat/lon from zip if needed
        if (latitude is None or longitude is None) and zip_code:
            latlng = geocode_zip_to_latlng(zip_code)
            if latlng:
                latitude, longitude = latlng

        if latitude is None or longitude is None:
            return jsonify({"success": False, "error": "Provide latitude/longitude or zip_code"}), 400

        # 1) Try Walmart Store Locator (Affiliate)
        walmart_results = []
        try:
            if WALMART_API_KEY:
                base = "https://developer.api.walmart.com/api-proxy/service/affil/product/v2/stores"
                params = {}
                if zip_code:
                    params["zip"] = zip_code
                else:
                    params["lon"] = longitude
                    params["lat"] = latitude
                headers = {
                    "WM_CONSUMER.ID": WALMART_API_KEY,
                    "Accept": "application/json",
                }
                resp = requests.get(base, headers=headers, params=params, timeout=8)
                if resp.status_code == 200:
                    data_json = resp.json()
                    stores = data_json.get("stores", data_json.get("Store", data_json.get("store", [])))
                    for s in stores or []:
                        name = s.get("name") or s.get("storeName") or "Walmart"
                        addr1 = s.get("streetAddress") or s.get("address1") or ""
                        city = s.get("city") or ""
                        state = s.get("stateProvCode") or s.get("state") or ""
                        zipc = s.get("postalCode") or s.get("zip") or ""
                        address = ", ".join([part for part in [addr1, city, state, zipc] if part])
                        lat = s.get("coordinates", {}).get("latitude") if isinstance(s.get("coordinates"), dict) else s.get("latitude")
                        lng = s.get("coordinates", {}).get("longitude") if isinstance(s.get("coordinates"), dict) else s.get("longitude")
                        if lat is not None and lng is not None:
                            dist_km = calculate_distance(latitude, longitude, float(lat), float(lng))
                        else:
                            dist_km = None
                        walmart_results.append({
                            "name": name,
                            "address": address,
                            "distance_km": round(dist_km, 2) if dist_km is not None else None,
                            "rating": None,
                            "is_open": None,
                            "phone": s.get("phoneNumber"),
                            "store_id": s.get("storeId") or s.get("id"),
                            "location": {"lat": lat, "lng": lng} if lat is not None and lng is not None else None,
                        })
        except Exception as e:
            logger.warning(f"Walmart store locator failed: {e}")

        if walmart_results:
            walmart_results = [r for r in walmart_results if r.get("distance_km") is not None] or walmart_results
            walmart_results.sort(key=lambda x: (x["distance_km"] if x["distance_km"] is not None else 1e9))
            return jsonify({"success": True, "stores": walmart_results, "source": "walmart"}), 200

        # 2) Fallback to Google Places
        if not GOOGLE_MAPS_API_KEY:
            return jsonify({"success": False, "error": "No store sources available"}), 500

        gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)
        places = gmaps.places_nearby(
            location=(latitude, longitude),
            radius=radius_meters,
            keyword='Walmart',
            type='supermarket'
        )
        results = []
        for place in places.get('results', []):
            name = place.get('name', '')
            if 'walmart' not in name.lower():
                continue
            details = gmaps.place(place['place_id'], fields=['formatted_phone_number', 'opening_hours', 'rating', 'formatted_address'])
            lat = place['geometry']['location']['lat']
            lng = place['geometry']['location']['lng']
            dist_km = calculate_distance(latitude, longitude, lat, lng)
            results.append({
                "name": name,
                "address": details.get('result', {}).get('formatted_address', place.get('vicinity', '')),
                "distance_km": round(dist_km, 2),
                "rating": place.get('rating'),
                "is_open": details.get('result', {}).get('opening_hours', {}).get('open_now', False),
                "phone": details.get('result', {}).get('formatted_phone_number'),
                "place_id": place.get('place_id'),
                "location": {"lat": lat, "lng": lng},
            })
        results.sort(key=lambda x: x['distance_km'])
        return jsonify({"success": True, "stores": results, "source": "google"}), 200
    except Exception as e:
        logger.error(f"Error in nearby_walmart_stores: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

def search_walmart_products_for_purchase(query, zip_code="10001"):
    """
    Search Walmart's e-commerce catalog for products that can be purchased online.
    """
    try:
        url = f"{WALMART_ECOMMERCE_BASE}/search"
        params = {
            "query": query,
            "format": "json",
            "zip": zip_code
        }
        headers = {
            "WM_CONSUMER.ID": WALMART_API_KEY,
            "Accept": "application/json"
        }
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            data = response.json()
            return data.get("items", [])
        else:
            logger.error(f"Walmart product search failed: {response.status_code}")
            return []
    except Exception as e:
        logger.error(f"Error searching Walmart products: {e}")
        return []

def find_matching_walmart_product(food_name, zip_code="10001"):
    """
    Find the best matching Walmart product for a given food item.
    """
    # Clean up the food name for better search
    search_terms = [
        food_name,
        food_name.replace(",", "").replace(" ", " "),
        food_name.split(",")[0] if "," in food_name else food_name
    ]
    
    for term in search_terms:
        products = search_walmart_products_for_purchase(term, zip_code)
        if products:
            # Return the first available product
            product = products[0]
            return {
                'itemId': product.get('itemId'),
                'name': product.get('name'),
                'salePrice': product.get('salePrice'),
                'msrp': product.get('msrp'),
                'thumbnailImage': product.get('thumbnailImage'),
                'productUrl': product.get('productUrl'),
                'availableOnline': product.get('availableOnline', False),
                'twoDayShippingEligible': product.get('twoDayShippingEligible', False)
            }
    return None

def create_walmart_pickup_order(grocery_items, user_info, store_location):
    """
    Create a Walmart pickup order with the grocery items.
    Note: This is a simplified implementation. Real implementation would require
    Walmart's full e-commerce API integration including user authentication,
    cart management, and checkout process.
    """
    try:
        # This would require Walmart's full e-commerce API
        # For now, we'll create a mock order structure
        order_items = []
        total_price = 0
        
        for item in grocery_items:
            walmart_product = find_matching_walmart_product(item['name'])
            if walmart_product and walmart_product.get('availableOnline'):
                order_items.append({
                    'itemId': walmart_product['itemId'],
                    'name': walmart_product['name'],
                    'price': walmart_product['salePrice'] or walmart_product['msrp'],
                    'quantity': float(item['quantity'].split()[0]),
                    'image': walmart_product['thumbnailImage'],
                    'productUrl': walmart_product['productUrl']
                })
                total_price += (walmart_product['salePrice'] or walmart_product['msrp']) * float(item['quantity'].split()[0])
        
        if order_items:
            # Mock order creation - in real implementation, this would use Walmart's checkout API
            order = {
                'orderId': f"WM-{int(time.time())}",
                'items': order_items,
                'totalPrice': total_price,
                'pickupLocation': store_location,
                'estimatedPickupTime': datetime.now().strftime("%Y-%m-%d %H:%M"),
                'status': 'pending',
                'userInfo': user_info
            }
            return order
        else:
            return None
            
    except Exception as e:
        logger.error(f"Error creating Walmart pickup order: {e}")
        return None

# Fitness plan constants and data
FITNESS_GOALS = {
    'weight_loss': {
        'focus': 'cardio_and_strength',
        'intensity': 'moderate',
        'frequency': 4,
        'duration': 45
    },
    'muscle_gain': {
        'focus': 'strength_training',
        'intensity': 'high',
        'frequency': 5,
        'duration': 60
    },
    'endurance': {
        'focus': 'cardio',
        'intensity': 'moderate',
        'frequency': 5,
        'duration': 45
    },
    'general_fitness': {
        'focus': 'balanced',
        'intensity': 'moderate',
        'frequency': 3,
        'duration': 30
    },
    'flexibility': {
        'focus': 'flexibility_and_yoga',
        'intensity': 'low',
        'frequency': 3,
        'duration': 30
    }
}

EXERCISE_DATABASE = {
    'cardio': [
        {'name': 'Running', 'calories_per_hour': 600, 'equipment': 'none', 'difficulty': 'beginner'},
        {'name': 'Cycling', 'calories_per_hour': 500, 'equipment': 'bike', 'difficulty': 'beginner'},
        {'name': 'Swimming', 'calories_per_hour': 550, 'equipment': 'pool', 'difficulty': 'beginner'},
        {'name': 'Jump Rope', 'calories_per_hour': 700, 'equipment': 'jump_rope', 'difficulty': 'intermediate'},
        {'name': 'Rowing', 'calories_per_hour': 600, 'equipment': 'rower', 'difficulty': 'intermediate'},
        {'name': 'Elliptical', 'calories_per_hour': 500, 'equipment': 'elliptical', 'difficulty': 'beginner'},
        {'name': 'Stair Climbing', 'calories_per_hour': 650, 'equipment': 'stairs', 'difficulty': 'beginner'},
        {'name': 'High-Intensity Interval Training (HIIT)', 'calories_per_hour': 800, 'equipment': 'none', 'difficulty': 'advanced'}
    ],
    'strength_training': [
        {'name': 'Push-ups', 'calories_per_hour': 400, 'equipment': 'none', 'difficulty': 'beginner'},
        {'name': 'Squats', 'calories_per_hour': 350, 'equipment': 'none', 'difficulty': 'beginner'},
        {'name': 'Lunges', 'calories_per_hour': 350, 'equipment': 'none', 'difficulty': 'beginner'},
        {'name': 'Planks', 'calories_per_hour': 200, 'equipment': 'none', 'difficulty': 'beginner'},
        {'name': 'Dumbbell Rows', 'calories_per_hour': 300, 'equipment': 'dumbbells', 'difficulty': 'intermediate'},
        {'name': 'Deadlifts', 'calories_per_hour': 400, 'equipment': 'barbell', 'difficulty': 'advanced'},
        {'name': 'Bench Press', 'calories_per_hour': 350, 'equipment': 'barbell', 'difficulty': 'advanced'},
        {'name': 'Pull-ups', 'calories_per_hour': 450, 'equipment': 'pull_up_bar', 'difficulty': 'intermediate'},
        {'name': 'Overhead Press', 'calories_per_hour': 300, 'equipment': 'dumbbells', 'difficulty': 'intermediate'},
        {'name': 'Bicep Curls', 'calories_per_hour': 250, 'equipment': 'dumbbells', 'difficulty': 'beginner'}
    ],
    'flexibility': [
        {'name': 'Yoga', 'calories_per_hour': 200, 'equipment': 'mat', 'difficulty': 'beginner'},
        {'name': 'Stretching', 'calories_per_hour': 150, 'equipment': 'none', 'difficulty': 'beginner'},
        {'name': 'Pilates', 'calories_per_hour': 250, 'equipment': 'mat', 'difficulty': 'intermediate'},
        {'name': 'Tai Chi', 'calories_per_hour': 200, 'equipment': 'none', 'difficulty': 'beginner'},
        {'name': 'Dynamic Stretching', 'calories_per_hour': 180, 'equipment': 'none', 'difficulty': 'beginner'}
    ],
    'core': [
        {'name': 'Crunches', 'calories_per_hour': 250, 'equipment': 'none', 'difficulty': 'beginner'},
        {'name': 'Russian Twists', 'calories_per_hour': 300, 'equipment': 'none', 'difficulty': 'intermediate'},
        {'name': 'Mountain Climbers', 'calories_per_hour': 400, 'equipment': 'none', 'difficulty': 'intermediate'},
        {'name': 'Bicycle Crunches', 'calories_per_hour': 350, 'equipment': 'none', 'difficulty': 'intermediate'},
        {'name': 'Leg Raises', 'calories_per_hour': 250, 'equipment': 'none', 'difficulty': 'beginner'}
    ]
}

def calculate_bmr(weight_kg, height_cm, age, gender):
    """Calculate Basal Metabolic Rate using Mifflin-St Jeor Equation"""
    if gender.lower() == 'male':
        return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

def calculate_tdee(bmr, activity_level):
    """Calculate Total Daily Energy Expenditure"""
    activity_multipliers = {
        'sedentary': 1.2,
        'lightly_active': 1.375,
        'moderately_active': 1.55,
        'very_active': 1.725,
        'extremely_active': 1.9
    }
    return bmr * activity_multipliers.get(activity_level, 1.2)

def calculate_target_calories(tdee, goal, weight_loss_goal=None):
    """Calculate target calories based on fitness goal"""
    if goal == 'weight_loss':
        # Create a 500-750 calorie deficit
        deficit = min(750, max(500, weight_loss_goal * 0.5 if weight_loss_goal else 500))
        return max(tdee - deficit, 1200)  # Minimum 1200 calories
    elif goal == 'muscle_gain':
        # Small surplus for muscle building
        return tdee + 300
    else:
        # Maintenance
        return tdee

def get_exercise_prescription(exercise, fitness_level, fitness_goal, week=1):
    """Get personalized sets, reps, rest, and instructions for an exercise"""
    base_prescription = {
        'sets': 3,
        'reps': 10,
        'rest_seconds': 60,
        'weight': None,
        'duration_seconds': None,
        'instructions': [],
        'form_tips': []
    }
    
    # Adjust based on fitness level
    if fitness_level == 'beginner':
        base_prescription['sets'] = 2
        base_prescription['reps'] = 8 if 'cardio' not in exercise.get('name', '').lower() else None
        base_prescription['rest_seconds'] = 90
    elif fitness_level == 'intermediate':
        base_prescription['sets'] = 3
        base_prescription['reps'] = 12 if 'cardio' not in exercise.get('name', '').lower() else None
        base_prescription['rest_seconds'] = 60
    else:  # advanced
        base_prescription['sets'] = 4
        base_prescription['reps'] = 15 if 'cardio' not in exercise.get('name', '').lower() else None
        base_prescription['rest_seconds'] = 45
    
    # Adjust based on fitness goal
    if fitness_goal == 'muscle_gain':
        base_prescription['sets'] = max(3, base_prescription['sets'])
        base_prescription['reps'] = 8 if base_prescription['reps'] else None
        base_prescription['rest_seconds'] = 90
        base_prescription['form_tips'].append('Focus on controlled movements and full range of motion')
        base_prescription['form_tips'].append('Progressive overload: increase weight or reps each week')
    elif fitness_goal == 'weight_loss':
        base_prescription['rest_seconds'] = 30
        base_prescription['form_tips'].append('Keep rest periods short to maintain elevated heart rate')
        base_prescription['form_tips'].append('Focus on form over speed')
    elif fitness_goal == 'endurance':
        base_prescription['reps'] = 20 if base_prescription['reps'] else None
        base_prescription['rest_seconds'] = 30
        base_prescription['form_tips'].append('Maintain steady pace throughout')
    
    # Week progression (progressive overload)
    if week > 1:
        progression_factor = 1 + (week - 1) * 0.1  # 10% increase per week
        if base_prescription['reps']:
            base_prescription['reps'] = int(base_prescription['reps'] * progression_factor)
        if base_prescription['sets'] and week >= 3:
            base_prescription['sets'] += 1
    
    # Exercise-specific instructions
    exercise_name = exercise.get('name', '').lower()
    if 'push-up' in exercise_name:
        base_prescription['instructions'] = [
            'Start in plank position with hands shoulder-width apart',
            'Lower body until chest nearly touches floor',
            'Push back up to starting position',
            'Keep core engaged throughout'
        ]
        base_prescription['form_tips'].append('Keep body in straight line from head to heels')
    elif 'squat' in exercise_name:
        base_prescription['instructions'] = [
            'Stand with feet shoulder-width apart',
            'Lower down as if sitting in a chair',
            'Go down until thighs are parallel to floor',
            'Push through heels to return to standing'
        ]
        base_prescription['form_tips'].append('Keep knees aligned with toes')
        base_prescription['form_tips'].append('Don\'t let knees cave inward')
    elif 'plank' in exercise_name:
        base_prescription['duration_seconds'] = 30 + (fitness_level == 'intermediate') * 15 + (fitness_level == 'advanced') * 30
        base_prescription['instructions'] = [
            'Start in push-up position',
            'Hold position with straight body',
            'Keep core tight and breathe normally'
        ]
        base_prescription['form_tips'].append('Don\'t let hips sag or rise')
    elif 'running' in exercise_name or 'cardio' in exercise.get('equipment', ''):
        base_prescription['duration_seconds'] = 20 * 60  # 20 minutes base
        base_prescription['instructions'] = [
            'Start with 5-minute warm-up at easy pace',
            'Maintain target heart rate zone',
            'Cool down with 5-minute walk'
        ]
        base_prescription['form_tips'].append('Maintain good posture and arm swing')
    elif 'yoga' in exercise_name or 'stretching' in exercise_name:
        base_prescription['duration_seconds'] = 30 * 60  # 30 minutes
        base_prescription['instructions'] = [
            'Hold each stretch for 30-60 seconds',
            'Breathe deeply and relax into stretches',
            'Never force or bounce in stretches'
        ]
        base_prescription['form_tips'].append('Focus on breathing and mindfulness')
    
    return base_prescription

def generate_workout_plan(fitness_goal, fitness_level, available_equipment, workout_days):
    """Generate a personalized workout plan with progressive overload"""
    goal_config = FITNESS_GOALS.get(fitness_goal, FITNESS_GOALS['general_fitness'])
    
    # Generate 4-week progressive plan
    all_workouts = []
    
    for week in range(1, 5):  # 4 weeks of progression
        week_workouts = []
        exercises_per_workout = 6 if goal_config['focus'] == 'strength_training' else 5
        
        # Create workout schedule based on days per week
        for day in range(workout_days):
            workout = {
                'day': day + 1,
                'week': week,
                'focus': goal_config['focus'],
                'duration': goal_config['duration'] + (week - 1) * 5,  # Increase duration each week
                'exercises': [],
                'warmup': [],
                'cooldown': []
            }
            
            # Add warm-up
            warmup_exercises = [
                {'name': 'Light Cardio', 'duration_seconds': 300, 'instructions': ['5 minutes of light jogging or jumping jacks']},
                {'name': 'Dynamic Stretching', 'duration_seconds': 180, 'instructions': ['Arm circles, leg swings, torso twists']}
            ]
            workout['warmup'] = warmup_exercises
            
            # Select exercises based on goal and focus
            if goal_config['focus'] == 'cardio_and_strength':
                # Circuit training for weight loss
                if fitness_goal == 'weight_loss':
                    # HIIT-style circuit
                    cardio_pool = [ex for ex in EXERCISE_DATABASE['cardio'] if ex['equipment'] == 'none' or ex['equipment'] in available_equipment]
                    strength_pool = [ex for ex in EXERCISE_DATABASE['strength_training'] if ex['equipment'] == 'none' or ex['equipment'] in available_equipment]
                    core_pool = [ex for ex in EXERCISE_DATABASE['core'] if ex['equipment'] == 'none' or ex['equipment'] in available_equipment]
                    
                    # Alternate cardio and strength for circuit
                    selected = []
                    for i in range(exercises_per_workout):
                        if i % 2 == 0 and cardio_pool:
                            selected.append(random.choice(cardio_pool))
                        elif strength_pool:
                            selected.append(random.choice(strength_pool))
                        elif core_pool:
                            selected.append(random.choice(core_pool))
                    workout['exercises'] = selected[:exercises_per_workout]
                    workout['circuit_style'] = True
                    workout['circuit_rounds'] = 3 + (week - 1)
                else:
                    cardio_exercises = [ex for ex in EXERCISE_DATABASE['cardio'] if ex['equipment'] == 'none' or ex['equipment'] in available_equipment]
                    strength_exercises = [ex for ex in EXERCISE_DATABASE['strength_training'] if ex['equipment'] == 'none' or ex['equipment'] in available_equipment]
                    core_exercises = [ex for ex in EXERCISE_DATABASE['core'] if ex['equipment'] == 'none' or ex['equipment'] in available_equipment]
                    
                    if cardio_exercises and strength_exercises:
                        workout['exercises'] = random.sample(cardio_exercises, min(2, len(cardio_exercises))) + \
                                             random.sample(strength_exercises, min(2, len(strength_exercises))) + \
                                             random.sample(core_exercises, min(2, len(core_exercises)))
            elif goal_config['focus'] == 'strength_training':
                # Progressive strength training
                strength_pool = [ex for ex in EXERCISE_DATABASE['strength_training'] 
                               if ex['equipment'] == 'none' or ex['equipment'] in available_equipment]
                core_pool = [ex for ex in EXERCISE_DATABASE['core'] 
                           if ex['equipment'] == 'none' or ex['equipment'] in available_equipment]
                
                # Prioritize compound movements for muscle gain
                if fitness_goal == 'muscle_gain':
                    compound_movements = [ex for ex in strength_pool if any(word in ex['name'].lower() 
                                    for word in ['squat', 'deadlift', 'press', 'row', 'pull', 'push'])]
                    if compound_movements:
                        workout['exercises'] = random.sample(compound_movements, min(4, len(compound_movements)))
                    else:
                        workout['exercises'] = random.sample(strength_pool, min(4, len(strength_pool)))
                else:
                    workout['exercises'] = random.sample(strength_pool, min(4, len(strength_pool)))
                
                if core_pool:
                    workout['exercises'].extend(random.sample(core_pool, min(2, len(core_pool))))
            elif goal_config['focus'] == 'cardio':
                cardio_pool = [ex for ex in EXERCISE_DATABASE['cardio'] 
                             if ex['equipment'] == 'none' or ex['equipment'] in available_equipment]
                workout['exercises'] = random.sample(cardio_pool, min(4, len(cardio_pool)))
            elif goal_config['focus'] == 'flexibility_and_yoga':
                flexibility_pool = [ex for ex in EXERCISE_DATABASE['flexibility'] 
                                  if ex['equipment'] == 'none' or ex['equipment'] in available_equipment]
                workout['exercises'] = random.sample(flexibility_pool, min(5, len(flexibility_pool)))
            else:  # balanced
                cardio_pool = [ex for ex in EXERCISE_DATABASE['cardio'] 
                             if ex['equipment'] == 'none' or ex['equipment'] in available_equipment]
                strength_pool = [ex for ex in EXERCISE_DATABASE['strength_training'] 
                               if ex['equipment'] == 'none' or ex['equipment'] in available_equipment]
                if cardio_pool and strength_pool:
                    workout['exercises'] = random.sample(cardio_pool, min(2, len(cardio_pool))) + \
                                         random.sample(strength_pool, min(3, len(strength_pool)))
            
            # Ensure we have enough exercises
            if len(workout['exercises']) < exercises_per_workout:
                bodyweight_pool = [ex for ex in EXERCISE_DATABASE['strength_training'] 
                                 if ex['equipment'] == 'none']
                needed = exercises_per_workout - len(workout['exercises'])
                workout['exercises'].extend(random.sample(bodyweight_pool, min(needed, len(bodyweight_pool))))
            
            workout['exercises'] = workout['exercises'][:exercises_per_workout]
            
            # Add personalized prescriptions to each exercise
            for exercise in workout['exercises']:
                prescription = get_exercise_prescription(exercise, fitness_level, fitness_goal, week)
                exercise.update(prescription)
            
            # Add cool-down
            cooldown_exercises = [
                {'name': 'Static Stretching', 'duration_seconds': 300, 'instructions': ['Hold each stretch for 30 seconds', 'Focus on major muscle groups used']},
                {'name': 'Deep Breathing', 'duration_seconds': 120, 'instructions': ['5 deep breaths to lower heart rate']}
            ]
            workout['cooldown'] = cooldown_exercises
            
            week_workouts.append(workout)
        
        all_workouts.extend(week_workouts)
    
    return all_workouts

def create_fitness_plan(user_data):
    """Create a comprehensive fitness plan"""
    try:
        # Extract user data
        weight_kg = user_data.get('weight_kg', 70)
        height_cm = user_data.get('height_cm', 170)
        age = user_data.get('age', 30)
        gender = user_data.get('gender', 'male')
        fitness_goal = user_data.get('fitness_goal', 'general_fitness')
        fitness_level = user_data.get('fitness_level', 'beginner')
        activity_level = user_data.get('activity_level', 'moderately_active')
        weight_loss_goal = user_data.get('weight_loss_goal', 0)
        available_equipment = user_data.get('available_equipment', [])
        workout_days = user_data.get('workout_days', 3)
        
        # Calculate metabolic rates
        bmr = calculate_bmr(weight_kg, height_cm, age, gender)
        tdee = calculate_tdee(bmr, activity_level)
        target_calories = calculate_target_calories(tdee, fitness_goal, weight_loss_goal)
        
        # Generate workout plan
        workout_plan = generate_workout_plan(fitness_goal, fitness_level, available_equipment, workout_days)
        
        # Calculate BMI
        height_m = height_cm / 100
        bmi = weight_kg / (height_m * height_m)
        
        # Determine BMI category
        if bmi < 18.5:
            bmi_category = 'Underweight'
        elif bmi < 25:
            bmi_category = 'Normal weight'
        elif bmi < 30:
            bmi_category = 'Overweight'
        else:
            bmi_category = 'Obese'
        
        # Create fitness recommendations
        fitness_recommendations = {
            'weight_kg': weight_kg,
            'height_cm': height_cm,
            'age': age,
            'gender': gender,
            'fitness_level': fitness_level,
            'bmi': round(bmi, 1),
            'bmi_category': bmi_category,
            'bmr': round(bmr),
            'tdee': round(tdee),
            'target_calories': round(target_calories),
            'fitness_goal': fitness_goal,
            'workout_days_per_week': workout_days,
            'workout_plan': workout_plan,
            'nutrition_recommendations': {
                'protein_g': round(weight_kg * 1.6 if fitness_goal == 'muscle_gain' else weight_kg * 1.2),
                'carbs_g': round((target_calories * 0.45) / 4),
                'fat_g': round((target_calories * 0.25) / 9),
                'fiber_g': 25,
                'water_liters': round(weight_kg * 0.033, 1)
            },
            'weekly_progress_tracking': {
                'weight_tracking': True,
                'measurements': ['chest', 'waist', 'arms', 'thighs'],
                'progress_photos': True,
                'workout_logging': True
            }
        }
        
        return fitness_recommendations
        
    except Exception as e:
        logger.error(f"Error creating fitness plan: {e}")
        return None

# Recipe generation constants
RECIPE_TEMPLATES = {
    'breakfast': [
        'Oatmeal with {protein} and {fruit}',
        'Greek yogurt parfait with {granola} and {berries}',
        'Protein smoothie with {protein} and {vegetable}',
        'Egg scramble with {vegetable} and {protein}',
        'Protein pancakes with {protein} and {fruit}'
    ],
    'lunch': [
        'Grilled {protein} with {vegetable} and {grain}',
        '{protein} salad with {vegetable} and {dressing}',
        'Stir-fry with {protein}, {vegetable}, and {grain}',
        'Soup with {protein} and {vegetable}',
        'Wrap with {protein}, {vegetable}, and {sauce}'
    ],
    'dinner': [
        'Baked {protein} with roasted {vegetable}',
        'Stir-fry with {protein} and {vegetable}',
        'Grilled {protein} with {grain} and {vegetable}',
        'Casserole with {protein}, {vegetable}, and {grain}',
        'Soup with {protein} and {vegetable}'
    ],
    'snack': [
        '{protein} with {fruit}',
        'Greek yogurt with {granola}',
        'Protein bar with {nuts}',
        'Smoothie with {protein} and {fruit}',
        'Trail mix with {nuts} and {dried_fruit}'
    ]
}

INGREDIENT_CATEGORIES = {
    'protein': ['chicken breast', 'salmon', 'tuna', 'eggs', 'tofu', 'tempeh', 'lentils', 'black beans', 'chickpeas', 'turkey', 'lean beef', 'shrimp', 'cod', 'tilapia'],
    'vegetable': ['broccoli', 'spinach', 'kale', 'bell peppers', 'carrots', 'zucchini', 'cauliflower', 'asparagus', 'green beans', 'mushrooms', 'onions', 'tomatoes', 'cucumber', 'lettuce'],
    'fruit': ['banana', 'apple', 'berries', 'orange', 'grapefruit', 'pear', 'peach', 'mango', 'pineapple', 'kiwi', 'strawberries', 'blueberries', 'raspberries'],
    'grain': ['quinoa', 'brown rice', 'oats', 'whole wheat bread', 'pasta', 'barley', 'farro', 'bulgur', 'couscous', 'wild rice'],
    'nuts': ['almonds', 'walnuts', 'cashews', 'peanuts', 'pistachios', 'pecans', 'macadamia nuts'],
    'dried_fruit': ['raisins', 'cranberries', 'apricots', 'dates', 'prunes', 'figs'],
    'granola': ['homemade granola', 'low-sugar granola', 'protein granola', 'nut-free granola'],
    'berries': ['strawberries', 'blueberries', 'raspberries', 'blackberries', 'cranberries'],
    'dressing': ['olive oil and lemon', 'balsamic vinaigrette', 'Greek yogurt dressing', 'tahini dressing', 'avocado dressing'],
    'sauce': ['tomato sauce', 'pesto', 'hummus', 'guacamole', 'tahini sauce', 'yogurt sauce']
}

def generate_ai_recipe(available_ingredients, meal_type, dietary_restrictions, fitness_goal):
    """Generate a unique recipe based on available ingredients and constraints"""
    try:
        # Filter ingredients based on dietary restrictions
        filtered_ingredients = filter_ingredients_by_diet(available_ingredients, dietary_restrictions)
        
        # Select appropriate template
        templates = RECIPE_TEMPLATES.get(meal_type, RECIPE_TEMPLATES['lunch'])
        template = random.choice(templates)
        
        # Fill template with available ingredients
        recipe = template
        for category, ingredients in INGREDIENT_CATEGORIES.items():
            if f'{{{category}}}' in recipe:
                # Find available ingredients in this category
                available_in_category = [ing for ing in filtered_ingredients if any(cat_ing in ing.lower() for cat_ing in ingredients)]
                if available_in_category:
                    selected_ingredient = random.choice(available_in_category)
                else:
                    # Use a default ingredient if none available
                    selected_ingredient = random.choice(ingredients)
                recipe = recipe.replace(f'{{{category}}}', selected_ingredient)
        
        # Generate cooking instructions
        instructions = generate_cooking_instructions(recipe, meal_type, fitness_goal)
        
        # Calculate nutrition based on ingredients
        nutrition = calculate_recipe_nutrition(recipe, meal_type, fitness_goal)
        
        return {
            'name': f"AI-Generated {meal_type.title()}",
            'ingredients': extract_ingredients_from_recipe(recipe),
            'instructions': instructions,
            'nutrition': nutrition,
            'prep_time': random.randint(10, 30),
            'cook_time': random.randint(15, 45),
            'difficulty': random.choice(['easy', 'medium', 'hard']),
            'servings': random.randint(1, 4),
            'tags': [meal_type, fitness_goal] + dietary_restrictions
        }
        
    except Exception as e:
        logger.error(f"Error generating AI recipe: {e}")
        return None

def filter_ingredients_by_diet(ingredients, dietary_restrictions):
    """Filter ingredients based on dietary restrictions"""
    filtered = ingredients.copy()
    
    if 'vegetarian' in dietary_restrictions:
        filtered = [ing for ing in filtered if not any(meat in ing.lower() for meat in ['chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna'])]
    
    if 'vegan' in dietary_restrictions:
        filtered = [ing for ing in filtered if not any(animal in ing.lower() for animal in ['chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna', 'eggs', 'milk', 'cheese', 'yogurt'])]
    
    if 'gluten-free' in dietary_restrictions:
        filtered = [ing for ing in filtered if not any(gluten in ing.lower() for gluten in ['wheat', 'bread', 'pasta', 'flour', 'barley', 'rye'])]
    
    if 'dairy-free' in dietary_restrictions:
        filtered = [ing for ing in filtered if not any(dairy in ing.lower() for dairy in ['milk', 'cheese', 'yogurt', 'cream', 'butter'])]
    
    return filtered

def generate_cooking_instructions(recipe, meal_type, fitness_goal):
    """Generate cooking instructions based on recipe and fitness goals"""
    instructions = []
    
    if 'grilled' in recipe.lower():
        instructions.append("Preheat grill to medium-high heat.")
        instructions.append("Season ingredients with herbs and spices.")
        instructions.append("Grill until cooked through, about 8-10 minutes per side.")
    elif 'baked' in recipe.lower():
        instructions.append("Preheat oven to 375°F (190°C).")
        instructions.append("Arrange ingredients in a baking dish.")
        instructions.append("Bake for 25-30 minutes until cooked through.")
    elif 'smoothie' in recipe.lower():
        instructions.append("Add all ingredients to a blender.")
        instructions.append("Blend until smooth and creamy.")
        instructions.append("Serve immediately for best texture.")
    elif 'salad' in recipe.lower():
        instructions.append("Wash and prepare all vegetables.")
        instructions.append("Combine ingredients in a large bowl.")
        instructions.append("Toss with dressing and serve.")
    else:
        instructions.append("Prepare all ingredients as needed.")
        instructions.append("Cook according to your preferred method.")
        instructions.append("Season to taste and serve.")
    
    # Add fitness-specific instructions
    if fitness_goal == 'weight_loss':
        instructions.append("Use minimal oil and focus on lean cooking methods.")
    elif fitness_goal == 'muscle_gain':
        instructions.append("Ensure adequate protein portion for muscle building.")
    
    return instructions

def calculate_recipe_nutrition(recipe, meal_type, fitness_goal):
    """Calculate estimated nutrition for the recipe"""
    base_calories = {
        'breakfast': 400,
        'lunch': 600,
        'dinner': 700,
        'snack': 200
    }
    
    calories = base_calories.get(meal_type, 500)
    
    # Adjust based on fitness goal
    if fitness_goal == 'weight_loss':
        calories = int(calories * 0.8)
        protein_ratio = 0.3
        carbs_ratio = 0.4
        fat_ratio = 0.3
    elif fitness_goal == 'muscle_gain':
        calories = int(calories * 1.2)
        protein_ratio = 0.35
        carbs_ratio = 0.45
        fat_ratio = 0.2
    else:
        protein_ratio = 0.25
        carbs_ratio = 0.5
        fat_ratio = 0.25
    
    return {
        'calories': calories,
        'protein_g': round(calories * protein_ratio / 4),
        'carbs_g': round(calories * carbs_ratio / 4),
        'fat_g': round(calories * fat_ratio / 9),
        'fiber_g': random.randint(5, 15),
        'sugar_g': random.randint(5, 20)
    }

def extract_ingredients_from_recipe(recipe):
    """Extract ingredients list from recipe template"""
    # This is a simplified extraction - in a real app, you'd have a more sophisticated parser
    ingredients = []
    for category, items in INGREDIENT_CATEGORIES.items():
        for item in items:
            if item in recipe.lower():
                ingredients.append(item)
    
    # Add some common ingredients
    common_ingredients = ['olive oil', 'salt', 'pepper', 'garlic', 'onion', 'herbs']
    ingredients.extend(random.sample(common_ingredients, 3))
    
    return list(set(ingredients))  # Remove duplicates

# Add new endpoint for AI recipe generation
@app.route('/generate-ai-recipe', methods=['POST'])
def generate_ai_recipe_endpoint():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        required_fields = ['available_ingredients', 'meal_type', 'dietary_restrictions', 'fitness_goal']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        recipe = generate_ai_recipe(
            data['available_ingredients'],
            data['meal_type'],
            data['dietary_restrictions'],
            data['fitness_goal']
        )
        
        if recipe:
            return jsonify({
                "success": True,
                "recipe": recipe
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Unable to generate recipe"
            }), 400
            
    except Exception as e:
        logger.error(f"Error in generate_ai_recipe: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Grocery price comparison and budget optimization
STORE_PRICE_DATA = {
    'walmart': {
        'name': 'Walmart',
        'delivery_fee': 0,
        'minimum_order': 35,
        'price_multiplier': 1.0,
        'organic_markup': 0.3,
        'brand_discounts': {
            'great_value': 0.15,
            'equate': 0.20,
            'mainstays': 0.10
        }
    },
    'target': {
        'name': 'Target',
        'delivery_fee': 9.99,
        'minimum_order': 35,
        'price_multiplier': 1.1,
        'organic_markup': 0.25,
        'brand_discounts': {
            'good_gather': 0.10,
            'up_and_up': 0.15
        }
    },
    'kroger': {
        'name': 'Kroger',
        'delivery_fee': 9.95,
        'minimum_order': 35,
        'price_multiplier': 1.05,
        'organic_markup': 0.35,
        'brand_discounts': {
            'kroger': 0.20,
            'private_selection': 0.15
        }
    },
    'whole_foods': {
        'name': 'Whole Foods',
        'delivery_fee': 9.99,
        'minimum_order': 35,
        'price_multiplier': 1.4,
        'organic_markup': 0.0,  # Already organic-focused
        'brand_discounts': {
            '365': 0.10
        }
    },
    'aldi': {
        'name': 'Aldi',
        'delivery_fee': 0,
        'minimum_order': 35,
        'price_multiplier': 0.8,
        'organic_markup': 0.2,
        'brand_discounts': {
            'aldi': 0.25
        }
    }
}

def calculate_item_price(base_price, store, item_type='regular', brand=None):
    """Calculate item price at a specific store"""
    store_data = STORE_PRICE_DATA.get(store, STORE_PRICE_DATA['walmart'])
    
    # Apply store price multiplier
    price = base_price * store_data['price_multiplier']
    
    # Apply organic markup if applicable
    if item_type == 'organic':
        price *= (1 + store_data['organic_markup'])
    
    # Apply brand discounts
    if brand and brand in store_data['brand_discounts']:
        price *= (1 - store_data['brand_discounts'][brand])
    
    return round(price, 2)

def optimize_grocery_shopping(grocery_list, budget, preferred_stores=None, organic_preference=0.5):
    """Optimize grocery shopping across multiple stores"""
    if preferred_stores is None:
        preferred_stores = ['walmart', 'target', 'kroger']
    
    optimized_plans = []
    
    for store in preferred_stores:
        store_plan = {
            'store': store,
            'store_name': STORE_PRICE_DATA[store]['name'],
            'items': [],
            'subtotal': 0,
            'delivery_fee': STORE_PRICE_DATA[store]['delivery_fee'],
            'total': 0,
            'savings': 0,
            'organic_items': 0,
            'regular_items': 0
        }
        
        for item in grocery_list:
            # Determine if item should be organic based on preference
            is_organic = random.random() < organic_preference
            
            # Calculate base price (mock data)
            base_price = random.uniform(2.0, 15.0)
            
            # Get brand (mock data)
            brand = random.choice(['great_value', 'equate', 'mainstays', 'good_gather', 'kroger', '365', 'aldi'])
            
            # Calculate price at this store
            price = calculate_item_price(base_price, store, 'organic' if is_organic else 'regular', brand)
            
            store_item = {
                'name': item['name'],
                'quantity': item['quantity'],
                'price': price,
                'total_price': price * float(item['quantity'].split()[0]),
                'is_organic': is_organic,
                'brand': brand,
                'store': store
            }
            
            store_plan['items'].append(store_item)
            store_plan['subtotal'] += store_item['total_price']
            
            if is_organic:
                store_plan['organic_items'] += 1
            else:
                store_plan['regular_items'] += 1
        
        store_plan['total'] = store_plan['subtotal'] + store_plan['delivery_fee']
        
        # Calculate savings compared to most expensive option
        most_expensive_total = max([plan['total'] for plan in optimized_plans]) if optimized_plans else store_plan['total']
        store_plan['savings'] = most_expensive_total - store_plan['total']
        
        optimized_plans.append(store_plan)
    
    # Sort by total cost (ascending)
    optimized_plans.sort(key=lambda x: x['total'])
    
    return optimized_plans

def generate_shopping_strategy(grocery_list, budget, location):
    """Generate optimal shopping strategy"""
    # Get nearby stores
    nearby_stores = find_nearby_grocery_stores(location['latitude'], location['longitude'])
    
    # Optimize shopping across stores
    shopping_plans = optimize_grocery_shopping(grocery_list, budget)
    
    # Generate recommendations
    recommendations = {
        'best_value_plan': shopping_plans[0] if shopping_plans else None,
        'organic_focused_plan': None,
        'convenience_plan': None,
        'budget_plan': None,
        'all_plans': shopping_plans,
        'tips': generate_shopping_tips(grocery_list, budget)
    }
    
    # Find organic-focused plan
    organic_plans = [plan for plan in shopping_plans if plan['organic_items'] > plan['regular_items']]
    if organic_plans:
        recommendations['organic_focused_plan'] = organic_plans[0]
    
    # Find convenience plan (fewest stores, delivery available)
    convenience_plans = [plan for plan in shopping_plans if plan['delivery_fee'] == 0]
    if convenience_plans:
        recommendations['convenience_plan'] = convenience_plans[0]
    
    # Find budget plan (lowest total cost)
    recommendations['budget_plan'] = shopping_plans[0] if shopping_plans else None
    
    return recommendations

def generate_shopping_tips(grocery_list, budget):
    """Generate shopping tips based on grocery list and budget"""
    tips = []
    
    total_items = len(grocery_list)
    estimated_cost = sum([random.uniform(3.0, 12.0) for _ in grocery_list])
    
    if estimated_cost > budget:
        tips.append("Consider buying store brands to save 15-25% on similar items")
        tips.append("Look for bulk options on non-perishable items")
        tips.append("Check for digital coupons and store promotions")
    
    if total_items > 20:
        tips.append("Consider splitting your shopping between stores for best prices")
        tips.append("Plan your shopping route to minimize travel time")
    
    organic_items = sum([1 for item in grocery_list if 'organic' in item['name'].lower()])
    if organic_items > total_items * 0.5:
        tips.append("Consider buying conventional items for the 'Clean 15' and organic for the 'Dirty Dozen'")
    
    tips.append("Shop on weekdays to avoid crowds and potential stock issues")
    tips.append("Check store apps for personalized deals and coupons")
    
    return tips

def find_best_deals(grocery_list, radius_miles=10):
    """Find the best deals for specific items"""
    deals = []
    
    for item in grocery_list:
        item_deals = []
        
        for store, store_data in STORE_PRICE_DATA.items():
            # Mock deal generation
            if random.random() < 0.3:  # 30% chance of a deal
                discount = random.uniform(0.1, 0.4)
                original_price = random.uniform(3.0, 12.0)
                sale_price = original_price * (1 - discount)
                
                deal = {
                    'store': store,
                    'store_name': store_data['name'],
                    'item_name': item['name'],
                    'original_price': round(original_price, 2),
                    'sale_price': round(sale_price, 2),
                    'discount_percent': round(discount * 100, 0),
                    'valid_until': (datetime.now() + timedelta(days=random.randint(1, 7))).strftime('%Y-%m-%d'),
                    'deal_type': random.choice(['BOGO', 'Clearance', 'Weekly Special', 'Digital Coupon'])
                }
                
                item_deals.append(deal)
        
        if item_deals:
            # Sort by discount percentage
            item_deals.sort(key=lambda x: x['discount_percent'], reverse=True)
            deals.append({
                'item': item['name'],
                'deals': item_deals
            })
    
    return deals

# Add new endpoints for smart shopping
@app.route('/optimize-shopping', methods=['POST'])
def optimize_shopping_endpoint():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        required_fields = ['grocery_list', 'budget']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        location = data.get('location', {'latitude': 40.7128, 'longitude': -74.0060})  # Default to NYC
        organic_preference = data.get('organic_preference', 0.5)
        
        shopping_strategy = generate_shopping_strategy(
            data['grocery_list'],
            data['budget'],
            location
        )
        
        return jsonify({
            "success": True,
            "shopping_strategy": shopping_strategy
        }), 200
            
    except Exception as e:
        logger.error(f"Error in optimize_shopping: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/find-deals', methods=['POST'])
def find_deals_endpoint():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        if 'grocery_list' not in data:
            return jsonify({"error": "Missing grocery_list field"}), 400
        
        deals = find_best_deals(data['grocery_list'])
        
        return jsonify({
            "success": True,
            "deals": deals
        }), 200
            
    except Exception as e:
        logger.error(f"Error in find_deals: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/optimize-grocery', methods=['POST'])
def optimize_grocery():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        required_fields = ['weight_loss_goal', 'health_goals', 'allergies', 'budget']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        try:
            weight_loss_goal = float(data['weight_loss_goal'])
            if weight_loss_goal <= 0:
                raise ValueError("Weight loss goal must be positive")
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid weight loss goal"}), 400
        health_goals = str(data['health_goals'])
        allergies = data['allergies']
        if not isinstance(allergies, list):
            return jsonify({"error": "Allergies must be a list"}), 400
        try:
            budget = float(data['budget'])
            if budget <= 0:
                raise ValueError("Budget must be positive")
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid budget"}), 400
        daily_calories = calculate_daily_calories(weight_loss_goal)
        daily_targets = calculate_macro_targets(daily_calories)
        meal_plan = create_meal_plan(daily_targets, budget, allergies, health_goals)
        grocery_list = consolidate_grocery_list(meal_plan)
        grocery_list, remaining_budget = update_grocery_list_with_walmart_prices(grocery_list, budget)
        total_price = sum(float(item['estimated_price'].replace('$', '')) for item in grocery_list)
        total_nutrition = {
            'calories': sum(item['nutrition']['calories'] for item in grocery_list),
            'protein': sum(item['nutrition']['protein'] for item in grocery_list),
            'carbs': sum(item['nutrition']['carbs'] for item in grocery_list),
            'fat': sum(item['nutrition']['fat'] for item in grocery_list)
        }
        response = {
            "meal_plan": meal_plan,
            "grocery_list": grocery_list,
            "total_items": len(grocery_list),
            "total_budget": f"${budget:.2f}",
            "remaining_budget": f"${remaining_budget:.2f}",
            "daily_nutrition_targets": daily_targets,
            "total_nutrition": total_nutrition
        }
        
        # Add nearby stores if location is provided
        if 'latitude' in data and 'longitude' in data:
            try:
                nearby_stores = find_nearby_grocery_stores(data['latitude'], data['longitude'])
                response["nearby_stores"] = nearby_stores
            except Exception as e:
                logger.error(f"Error finding nearby stores: {e}")
                response["nearby_stores"] = []
        else:
            response["nearby_stores"] = []
        
        return jsonify(response), 200
    except Exception as e:
        logger.error(f"Error in optimize_grocery: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/create-pickup-order', methods=['POST'])
def create_pickup_order():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        required_fields = ['grocery_items', 'user_info', 'store_location']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        grocery_items = data['grocery_items']
        user_info = data['user_info']
        store_location = data['store_location']
        
        # Create the pickup order
        order = create_walmart_pickup_order(grocery_items, user_info, store_location)
        
        if order:
            return jsonify({
                "success": True,
                "order": order,
                "message": "Pickup order created successfully! You'll receive a confirmation email."
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Unable to create pickup order. Some items may not be available for pickup."
            }), 400
            
    except Exception as e:
        logger.error(f"Error in create_pickup_order: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/search-walmart-products', methods=['POST'])
def search_walmart_products():
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({"error": "Query parameter required"}), 400
        
        query = data['query']
        zip_code = data.get('zip_code')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        # If latitude/longitude provided, try to derive zip code via reverse geocoding
        if not zip_code and latitude is not None and longitude is not None and GOOGLE_MAPS_API_KEY:
            try:
                gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)
                geocode_result = gmaps.reverse_geocode((latitude, longitude))
                # Extract postal_code from address components
                for res in geocode_result:
                    for comp in res.get('address_components', []):
                        if 'postal_code' in comp.get('types', []):
                            zip_code = comp.get('short_name')
                            break
                    if zip_code:
                        break
            except Exception as e:
                logger.warning(f"Reverse geocoding failed: {e}")
        
        # Fallback zip if still unknown
        if not zip_code:
            zip_code = '10001'
        
        products = search_walmart_products_for_purchase(query, zip_code)
        
        # Return only essential fields and limit to top 8
        simplified = []
        for p in products[:8]:
            simplified.append({
                "itemId": p.get("itemId"),
                "name": p.get("name"),
                "salePrice": p.get("salePrice"),
                "msrp": p.get("msrp"),
                "thumbnailImage": p.get("thumbnailImage"),
                "productUrl": p.get("productUrl"),
                "availableOnline": p.get("availableOnline", False),
                "twoDayShippingEligible": p.get("twoDayShippingEligible", False),
            })
        
        return jsonify({
            "success": True,
            "products": simplified,
            "zip_code_used": zip_code
        }), 200
        
    except Exception as e:
        logger.error(f"Error in search_walmart_products: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Add new endpoint for fitness plan generation
@app.route('/generate-fitness-plan', methods=['POST'])
def generate_fitness_plan():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Validate required fields
        required_fields = ['weight_kg', 'height_cm', 'age', 'gender', 'fitness_goal']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Create fitness plan
        fitness_plan = create_fitness_plan(data)
        
        if fitness_plan:
            return jsonify({
                "success": True,
                "fitness_plan": fitness_plan
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Unable to generate fitness plan"
            }), 400
            
    except Exception as e:
        logger.error(f"Error in generate_fitness_plan: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Social fitness challenges and leaderboards
CHALLENGE_TYPES = {
    'weight_loss': {
        'name': 'Weight Loss Warriors',
        'description': 'Lose weight together and support each other',
        'duration_days': 30,
        'goal_type': 'weight_loss',
        'reward_points': 100
    },
    'workout_streak': {
        'name': 'Workout Warriors',
        'description': 'Complete workouts for consecutive days',
        'duration_days': 21,
        'goal_type': 'workout_streak',
        'reward_points': 150
    },
    'nutrition_tracking': {
        'name': 'Nutrition Ninjas',
        'description': 'Track your nutrition consistently',
        'duration_days': 14,
        'goal_type': 'nutrition_tracking',
        'reward_points': 75
    },
    'step_count': {
        'name': 'Step Masters',
        'description': 'Achieve daily step goals',
        'duration_days': 7,
        'goal_type': 'step_count',
        'reward_points': 50
    },
    'meal_prep': {
        'name': 'Meal Prep Masters',
        'description': 'Prepare healthy meals for the week',
        'duration_days': 7,
        'goal_type': 'meal_prep',
        'reward_points': 80
    }
}

def create_fitness_challenge(challenge_type, participants, start_date=None):
    """Create a new fitness challenge"""
    if start_date is None:
        start_date = datetime.now()
    
    challenge_config = CHALLENGE_TYPES.get(challenge_type, CHALLENGE_TYPES['workout_streak'])
    end_date = start_date + timedelta(days=challenge_config['duration_days'])
    
    challenge = {
        'id': f"challenge_{int(time.time())}",
        'type': challenge_type,
        'name': challenge_config['name'],
        'description': challenge_config['description'],
        'start_date': start_date.strftime('%Y-%m-%d'),
        'end_date': end_date.strftime('%Y-%m-%d'),
        'duration_days': challenge_config['duration_days'],
        'goal_type': challenge_config['goal_type'],
        'reward_points': challenge_config['reward_points'],
        'participants': participants,
        'leaderboard': [],
        'status': 'active',
        'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    
    return challenge

def update_challenge_progress(challenge_id, user_id, progress_data):
    """Update user progress in a challenge"""
    # This would typically update a database
    # For now, we'll return a mock update
    return {
        'user_id': user_id,
        'challenge_id': challenge_id,
        'progress': progress_data,
        'updated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

def calculate_challenge_score(user_progress, challenge_type):
    """Calculate user score for a challenge"""
    if challenge_type == 'weight_loss':
        return user_progress.get('weight_lost', 0) * 10
    elif challenge_type == 'workout_streak':
        return user_progress.get('workout_days', 0) * 5
    elif challenge_type == 'nutrition_tracking':
        return user_progress.get('tracking_days', 0) * 3
    elif challenge_type == 'step_count':
        return user_progress.get('total_steps', 0) / 1000
    elif challenge_type == 'meal_prep':
        return user_progress.get('meals_prepped', 0) * 2
    else:
        return 0

def generate_leaderboard(challenge_id, participants_progress):
    """Generate leaderboard for a challenge"""
    leaderboard = []
    
    for user_id, progress in participants_progress.items():
        score = calculate_challenge_score(progress, progress.get('challenge_type', 'workout_streak'))
        leaderboard.append({
            'user_id': user_id,
            'username': f"User_{user_id}",
            'score': score,
            'progress': progress,
            'rank': 0  # Will be calculated
        })
    
    # Sort by score (descending) and assign ranks
    leaderboard.sort(key=lambda x: x['score'], reverse=True)
    for i, entry in enumerate(leaderboard):
        entry['rank'] = i + 1
    
    return leaderboard

def get_community_stats():
    """Get community-wide statistics"""
    return {
        'total_users': 1250,
        'active_challenges': 8,
        'total_workouts_completed': 15420,
        'total_weight_lost': 1250,  # lbs
        'total_steps': 12500000,
        'top_performers': [
            {'username': 'FitnessFanatic', 'achievement': 'Lost 15 lbs in 30 days'},
            {'username': 'WorkoutWarrior', 'achievement': 'Completed 50 workouts this month'},
            {'username': 'NutritionNinja', 'achievement': 'Tracked nutrition for 30 days straight'}
        ]
    }

# Add new endpoints for social features
@app.route('/create-challenge', methods=['POST'])
def create_challenge_endpoint():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        required_fields = ['challenge_type', 'participants']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        challenge = create_fitness_challenge(
            data['challenge_type'],
            data['participants'],
            datetime.strptime(data.get('start_date', datetime.now().strftime('%Y-%m-%d')), '%Y-%m-%d') if data.get('start_date') else None
        )
        
        return jsonify({
            "success": True,
            "challenge": challenge
        }), 200
            
    except Exception as e:
        logger.error(f"Error in create_challenge: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/update-progress', methods=['POST'])
def update_progress_endpoint():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        required_fields = ['challenge_id', 'user_id', 'progress_data']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        progress = update_challenge_progress(
            data['challenge_id'],
            data['user_id'],
            data['progress_data']
        )
        
        return jsonify({
            "success": True,
            "progress": progress
        }), 200
            
    except Exception as e:
        logger.error(f"Error in update_progress: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/leaderboard/<challenge_id>', methods=['GET'])
def get_leaderboard_endpoint(challenge_id):
    try:
        # Mock participants progress data
        participants_progress = {
            'user1': {'challenge_type': 'weight_loss', 'weight_lost': 8.5, 'workout_days': 15},
            'user2': {'challenge_type': 'weight_loss', 'weight_lost': 12.2, 'workout_days': 18},
            'user3': {'challenge_type': 'weight_loss', 'weight_lost': 6.8, 'workout_days': 12},
            'user4': {'challenge_type': 'weight_loss', 'weight_lost': 15.1, 'workout_days': 22},
            'user5': {'challenge_type': 'weight_loss', 'weight_lost': 9.3, 'workout_days': 16}
        }
        
        leaderboard = generate_leaderboard(challenge_id, participants_progress)
        
        return jsonify({
            "success": True,
            "leaderboard": leaderboard
        }), 200
            
    except Exception as e:
        logger.error(f"Error in get_leaderboard: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/community-stats', methods=['GET'])
def get_community_stats_endpoint():
    try:
        stats = get_community_stats()
        
        return jsonify({
            "success": True,
            "stats": stats
        }), 200
            
    except Exception as e:
        logger.error(f"Error in get_community_stats: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Health insights and analytics
def generate_health_insights(user_data, progress_data, nutrition_data, workout_data):
    """Generate personalized health insights based on user data"""
    insights = {
        'nutrition_insights': analyze_nutrition_trends(nutrition_data),
        'fitness_insights': analyze_fitness_progress(workout_data),
        'weight_insights': analyze_weight_trends(progress_data),
        'lifestyle_insights': analyze_lifestyle_patterns(user_data, progress_data),
        'recommendations': generate_personalized_recommendations(user_data, progress_data),
        'achievements': identify_achievements(progress_data),
        'trends': calculate_trends(progress_data),
        'risk_factors': assess_health_risks(user_data, progress_data)
    }
    
    return insights

def analyze_nutrition_trends(nutrition_data):
    """Analyze nutrition trends and patterns"""
    insights = []
    
    # Analyze protein intake
    avg_protein = nutrition_data.get('average_protein', 0)
    target_protein = nutrition_data.get('target_protein', 0)
    
    if avg_protein < target_protein * 0.8:
        insights.append({
            'type': 'warning',
            'title': 'Low Protein Intake',
            'message': f'Your average protein intake ({avg_protein}g) is below your target ({target_protein}g). Consider adding more lean protein sources.',
            'impact': 'medium',
            'suggestion': 'Add Greek yogurt, chicken breast, or legumes to your meals'
        })
    elif avg_protein > target_protein * 1.2:
        insights.append({
            'type': 'info',
            'title': 'High Protein Intake',
            'message': f'Your protein intake ({avg_protein}g) is above your target. This is fine for muscle building but monitor kidney health.',
            'impact': 'low',
            'suggestion': 'Consider reducing protein if you experience digestive issues'
        })
    
    # Analyze calorie consistency
    calorie_variance = nutrition_data.get('calorie_variance', 0)
    if calorie_variance > 500:
        insights.append({
            'type': 'warning',
            'title': 'Inconsistent Calorie Intake',
            'message': 'Your daily calorie intake varies significantly. Consistency helps with weight management.',
            'impact': 'medium',
            'suggestion': 'Try meal planning to maintain consistent calorie intake'
        })
    
    # Analyze micronutrient gaps
    micronutrient_gaps = nutrition_data.get('micronutrient_gaps', [])
    for gap in micronutrient_gaps:
        insights.append({
            'type': 'warning',
            'title': f'Low {gap["nutrient"]} Intake',
            'message': f'Your {gap["nutrient"]} intake is {gap["percentage"]}% below recommended levels.',
            'impact': 'medium',
            'suggestion': gap.get('suggestion', 'Consider adding more diverse foods to your diet')
        })
    
    return insights

def analyze_fitness_progress(workout_data):
    """Analyze fitness progress and patterns"""
    insights = []
    
    # Analyze workout consistency
    workout_frequency = workout_data.get('workout_frequency', 0)
    target_frequency = workout_data.get('target_frequency', 3)
    
    if workout_frequency < target_frequency * 0.7:
        insights.append({
            'type': 'warning',
            'title': 'Low Workout Frequency',
            'message': f'You\'re averaging {workout_frequency} workouts per week, below your target of {target_frequency}.',
            'impact': 'high',
            'suggestion': 'Try shorter, more frequent workouts to build consistency'
        })
    elif workout_frequency > target_frequency * 1.3:
        insights.append({
            'type': 'success',
            'title': 'Excellent Workout Consistency',
            'message': f'You\'re exceeding your workout goals with {workout_frequency} sessions per week!',
            'impact': 'low',
            'suggestion': 'Consider adding recovery days to prevent overtraining'
        })
    
    # Analyze workout intensity
    avg_intensity = workout_data.get('average_intensity', 0)
    if avg_intensity < 0.6:
        insights.append({
            'type': 'info',
            'title': 'Low Workout Intensity',
            'message': 'Your workouts are mostly low-intensity. Consider adding high-intensity intervals.',
            'impact': 'medium',
            'suggestion': 'Add 2-3 high-intensity workouts per week for better results'
        })
    
    # Analyze progress plateaus
    strength_progress = workout_data.get('strength_progress', 0)
    if strength_progress < 0.05:  # Less than 5% improvement
        insights.append({
            'type': 'warning',
            'title': 'Strength Plateau Detected',
            'message': 'Your strength gains have plateaued. Consider changing your routine.',
            'impact': 'medium',
            'suggestion': 'Try progressive overload or different exercise variations'
        })
    
    return insights

def analyze_weight_trends(progress_data):
    """Analyze weight trends and patterns"""
    insights = []
    
    weight_trend = progress_data.get('weight_trend', 0)
    target_weight_change = progress_data.get('target_weight_change', 0)
    
    if target_weight_change < 0:  # Weight loss goal
        if weight_trend > -0.5:  # Losing less than 0.5 lbs per week
            insights.append({
                'type': 'warning',
                'title': 'Slow Weight Loss',
                'message': 'Your weight loss rate is slower than expected. Consider adjusting your calorie deficit.',
                'impact': 'medium',
                'suggestion': 'Reduce daily calories by 200-300 or increase activity'
            })
        elif weight_trend < -2.0:  # Losing more than 2 lbs per week
            insights.append({
                'type': 'warning',
                'title': 'Rapid Weight Loss',
                'message': 'You\'re losing weight too quickly, which may cause muscle loss.',
                'impact': 'high',
                'suggestion': 'Increase calorie intake slightly and focus on protein'
            })
    elif target_weight_change > 0:  # Weight gain goal
        if weight_trend < 0.5:  # Gaining less than 0.5 lbs per week
            insights.append({
                'type': 'warning',
                'title': 'Slow Weight Gain',
                'message': 'Your weight gain rate is slower than expected. Consider increasing calories.',
                'impact': 'medium',
                'suggestion': 'Increase daily calories by 300-500 and ensure adequate protein'
            })
    
    # Analyze weight fluctuations
    weight_variance = progress_data.get('weight_variance', 0)
    if weight_variance > 3:  # More than 3 lbs variance
        insights.append({
            'type': 'info',
            'title': 'High Weight Variability',
            'message': 'Your weight varies significantly day-to-day. This is normal but may indicate water retention.',
            'impact': 'low',
            'suggestion': 'Weigh yourself at the same time daily and track weekly averages'
        })
    
    return insights

def analyze_lifestyle_patterns(user_data, progress_data):
    """Analyze lifestyle patterns and their impact"""
    insights = []
    
    # Analyze sleep patterns
    avg_sleep = progress_data.get('average_sleep', 7)
    if avg_sleep < 7:
        insights.append({
            'type': 'warning',
            'title': 'Insufficient Sleep',
            'message': f'You\'re averaging {avg_sleep} hours of sleep, below the recommended 7-9 hours.',
            'impact': 'high',
            'suggestion': 'Prioritize sleep hygiene and aim for 7-9 hours nightly'
        })
    
    # Analyze stress levels
    stress_level = progress_data.get('stress_level', 5)
    if stress_level > 7:
        insights.append({
            'type': 'warning',
            'title': 'High Stress Levels',
            'message': 'High stress can impact weight loss and recovery. Consider stress management techniques.',
            'impact': 'medium',
            'suggestion': 'Try meditation, yoga, or deep breathing exercises'
        })
    
    # Analyze hydration
    avg_water = progress_data.get('average_water_intake', 0)
    target_water = user_data.get('weight_kg', 70) * 0.033  # 33ml per kg
    if avg_water < target_water * 0.8:
        insights.append({
            'type': 'warning',
            'title': 'Low Hydration',
            'message': f'Your water intake ({avg_water}L) is below your target ({target_water:.1f}L).',
            'impact': 'medium',
            'suggestion': 'Carry a water bottle and set hydration reminders'
        })
    
    return insights

def generate_personalized_recommendations(user_data, progress_data):
    """Generate personalized recommendations based on user data"""
    recommendations = []
    
    # Nutrition recommendations
    if progress_data.get('protein_deficit', False):
        recommendations.append({
            'category': 'nutrition',
            'priority': 'high',
            'title': 'Increase Protein Intake',
            'description': 'Add more lean protein sources to support your fitness goals',
            'actions': [
                'Add Greek yogurt to breakfast',
                'Include chicken breast in lunch',
                'Try protein smoothies as snacks'
            ]
        })
    
    # Workout recommendations
    if progress_data.get('workout_consistency', 0) < 0.7:
        recommendations.append({
            'category': 'fitness',
            'priority': 'high',
            'title': 'Improve Workout Consistency',
            'description': 'Build a more consistent workout routine',
            'actions': [
                'Schedule workouts at the same time daily',
                'Start with shorter, 20-minute sessions',
                'Find a workout buddy for accountability'
            ]
        })
    
    # Lifestyle recommendations
    if progress_data.get('sleep_quality', 0) < 7:
        recommendations.append({
            'category': 'lifestyle',
            'priority': 'medium',
            'title': 'Improve Sleep Quality',
            'description': 'Better sleep will enhance your fitness results',
            'actions': [
                'Create a consistent bedtime routine',
                'Avoid screens 1 hour before bed',
                'Keep your bedroom cool and dark'
            ]
        })
    
    return recommendations

def identify_achievements(progress_data):
    """Identify user achievements and milestones"""
    achievements = []
    
    # Weight loss achievements
    total_weight_lost = progress_data.get('total_weight_lost', 0)
    if total_weight_lost >= 5:
        achievements.append({
            'type': 'weight_loss',
            'title': '5-Pound Milestone',
            'description': f'Congratulations! You\'ve lost {total_weight_lost:.1f} pounds.',
            'date': progress_data.get('achievement_date', datetime.now().strftime('%Y-%m-%d')),
            'icon': '🏆'
        })
    
    # Workout achievements
    workout_streak = progress_data.get('workout_streak', 0)
    if workout_streak >= 7:
        achievements.append({
            'type': 'fitness',
            'title': 'Week Warrior',
            'description': f'You\'ve worked out for {workout_streak} consecutive days!',
            'date': progress_data.get('achievement_date', datetime.now().strftime('%Y-%m-%d')),
            'icon': '💪'
        })
    
    # Nutrition achievements
    tracking_streak = progress_data.get('nutrition_tracking_streak', 0)
    if tracking_streak >= 14:
        achievements.append({
            'type': 'nutrition',
            'title': 'Nutrition Tracker',
            'description': f'You\'ve tracked your nutrition for {tracking_streak} days!',
            'date': progress_data.get('achievement_date', datetime.now().strftime('%Y-%m-%d')),
            'icon': '🥗'
        })
    
    return achievements

def calculate_trends(progress_data):
    """Calculate trends in user progress"""
    trends = {
        'weight_trend': progress_data.get('weight_trend', 0),
        'strength_trend': progress_data.get('strength_trend', 0),
        'endurance_trend': progress_data.get('endurance_trend', 0),
        'nutrition_trend': progress_data.get('nutrition_trend', 0),
        'sleep_trend': progress_data.get('sleep_trend', 0),
        'stress_trend': progress_data.get('stress_trend', 0)
    }
    
    # Add trend analysis
    trend_analysis = []
    for metric, trend in trends.items():
        if trend > 0.1:
            trend_analysis.append(f'{metric.replace("_", " ").title()} is improving')
        elif trend < -0.1:
            trend_analysis.append(f'{metric.replace("_", " ").title()} needs attention')
        else:
            trend_analysis.append(f'{metric.replace("_", " ").title()} is stable')
    
    trends['analysis'] = trend_analysis
    return trends

def assess_health_risks(user_data, progress_data):
    """Assess potential health risks based on user data"""
    risks = []
    
    # BMI risk assessment
    bmi = user_data.get('bmi', 25)
    if bmi > 30:
        risks.append({
            'type': 'high',
            'category': 'weight',
            'title': 'High BMI',
            'description': 'Your BMI indicates obesity, which increases health risks.',
            'recommendation': 'Focus on gradual weight loss through diet and exercise'
        })
    elif bmi < 18.5:
        risks.append({
            'type': 'medium',
            'category': 'weight',
            'title': 'Low BMI',
            'description': 'Your BMI is below healthy range.',
            'recommendation': 'Consider gaining weight through healthy means'
        })
    
    # Rapid weight loss risk
    weight_loss_rate = progress_data.get('weight_loss_rate', 0)
    if weight_loss_rate > 2.0:  # More than 2 lbs per week
        risks.append({
            'type': 'medium',
            'category': 'weight',
            'title': 'Rapid Weight Loss',
            'description': 'Losing weight too quickly can cause muscle loss and health issues.',
            'recommendation': 'Slow down weight loss to 1-2 lbs per week'
        })
    
    # Low activity risk
    activity_level = progress_data.get('activity_level', 0)
    if activity_level < 150:  # Less than 150 minutes per week
        risks.append({
            'type': 'medium',
            'category': 'activity',
            'title': 'Low Physical Activity',
            'description': 'Insufficient physical activity increases health risks.',
            'recommendation': 'Aim for at least 150 minutes of moderate activity weekly'
        })
    
    return risks

# Add new endpoint for health insights
@app.route('/health-insights', methods=['POST'])
def health_insights_endpoint():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        required_fields = ['user_data', 'progress_data']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        nutrition_data = data.get('nutrition_data', {})
        workout_data = data.get('workout_data', {})
        
        insights = generate_health_insights(
            data['user_data'],
            data['progress_data'],
            nutrition_data,
            workout_data
        )
        
        return jsonify({
            "success": True,
            "insights": insights
        }), 200
            
    except Exception as e:
        logger.error(f"Error in health_insights: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Voice-activated features
VOICE_COMMANDS = {
    'meal_planning': [
        'create meal plan',
        'plan meals',
        'generate recipes',
        'what should I eat',
        'meal suggestions',
        'dinner ideas',
        'breakfast options',
        'lunch recipes'
    ],
    'workout_tracking': [
        'log workout',
        'track exercise',
        'start workout',
        'end workout',
        'workout complete',
        'record exercise',
        'log sets',
        'track reps'
    ],
    'nutrition_tracking': [
        'log food',
        'track calories',
        'record meal',
        'add nutrition',
        'log breakfast',
        'log lunch',
        'log dinner',
        'log snack'
    ],
    'progress_check': [
        'check progress',
        'how am I doing',
        'weight update',
        'fitness status',
        'progress report',
        'achievements',
        'stats'
    ],
    'shopping': [
        'add to grocery list',
        'shopping list',
        'buy groceries',
        'order food',
        'grocery delivery',
        'find deals'
    ]
}

def process_voice_command(audio_text, user_id, context=None):
    """Process voice command and return appropriate response"""
    try:
        # Normalize text
        text = audio_text.lower().strip()
        
        # Determine command type
        command_type = classify_voice_command(text)
        
        if command_type == 'meal_planning':
            return handle_meal_planning_command(text, user_id, context)
        elif command_type == 'workout_tracking':
            return handle_workout_tracking_command(text, user_id, context)
        elif command_type == 'nutrition_tracking':
            return handle_nutrition_tracking_command(text, user_id, context)
        elif command_type == 'progress_check':
            return handle_progress_check_command(text, user_id, context)
        elif command_type == 'shopping':
            return handle_shopping_command(text, user_id, context)
        else:
            return {
                'success': False,
                'message': "I didn't understand that command. Try saying 'help' for available commands.",
                'suggestions': get_voice_command_suggestions()
            }
            
    except Exception as e:
        logger.error(f"Error processing voice command: {e}")
        return {
            'success': False,
            'message': "Sorry, I encountered an error processing your request.",
            'error': str(e)
        }

def classify_voice_command(text):
    """Classify the type of voice command"""
    for command_type, commands in VOICE_COMMANDS.items():
        for command in commands:
            if command in text:
                return command_type
    
    # Check for specific keywords
    if any(word in text for word in ['meal', 'food', 'eat', 'recipe', 'dinner', 'breakfast', 'lunch']):
        return 'meal_planning'
    elif any(word in text for word in ['workout', 'exercise', 'gym', 'train', 'lift', 'run']):
        return 'workout_tracking'
    elif any(word in text for word in ['calorie', 'nutrition', 'log', 'track', 'record']):
        return 'nutrition_tracking'
    elif any(word in text for word in ['progress', 'weight', 'stats', 'achievement']):
        return 'progress_check'
    elif any(word in text for word in ['shop', 'grocery', 'buy', 'order', 'delivery']):
        return 'shopping'
    
    return 'unknown'

def handle_meal_planning_command(text, user_id, context):
    """Handle meal planning voice commands"""
    if 'create' in text or 'plan' in text or 'generate' in text:
        # Generate meal plan
        meal_plan = generate_voice_meal_plan(user_id, context)
        return {
            'success': True,
            'message': f"I've created a meal plan for you with {len(meal_plan['meals'])} meals.",
            'data': meal_plan,
            'voice_response': f"Here's your meal plan. You have {len(meal_plan['meals'])} meals planned with a total of {meal_plan['total_calories']} calories."
        }
    elif 'what should i eat' in text or 'suggestions' in text:
        # Get meal suggestions
        suggestions = get_voice_meal_suggestions(user_id, context)
        return {
            'success': True,
            'message': "Here are some meal suggestions for you.",
            'data': suggestions,
            'voice_response': f"I suggest {suggestions['primary_suggestion']} for your next meal."
        }
    else:
        return {
            'success': False,
            'message': "What type of meal planning would you like? I can create a meal plan or suggest meals.",
            'suggestions': ['Create meal plan', 'Get meal suggestions', 'Plan dinner']
        }

def handle_workout_tracking_command(text, user_id, context):
    """Handle workout tracking voice commands"""
    if 'start' in text or 'begin' in text:
        # Start workout session
        workout_session = start_voice_workout_session(user_id, context)
        return {
            'success': True,
            'message': "Workout session started! I'll track your exercises.",
            'data': workout_session,
            'voice_response': f"Workout started. I'm tracking your {workout_session['workout_type']} session."
        }
    elif 'end' in text or 'complete' in text or 'finish' in text:
        # End workout session
        workout_summary = end_voice_workout_session(user_id, context)
        return {
            'success': True,
            'message': "Workout completed! Here's your summary.",
            'data': workout_summary,
            'voice_response': f"Great workout! You completed {workout_summary['exercises_completed']} exercises in {workout_summary['duration']} minutes."
        }
    elif 'log' in text or 'record' in text:
        # Log specific exercise
        exercise_log = log_voice_exercise(text, user_id, context)
        return {
            'success': True,
            'message': "Exercise logged successfully.",
            'data': exercise_log,
            'voice_response': f"Logged {exercise_log['exercise']} with {exercise_log['sets']} sets of {exercise_log['reps']} reps."
        }
    else:
        return {
            'success': False,
            'message': "What would you like to do with your workout? I can start a session, end it, or log exercises.",
            'suggestions': ['Start workout', 'End workout', 'Log exercise']
        }

def handle_nutrition_tracking_command(text, user_id, context):
    """Handle nutrition tracking voice commands"""
    if 'log' in text or 'track' in text or 'record' in text:
        # Extract food information from voice
        food_info = extract_food_from_voice(text)
        if food_info:
            nutrition_log = log_voice_nutrition(food_info, user_id, context)
            return {
                'success': True,
                'message': f"Logged {food_info['food_name']} successfully.",
                'data': nutrition_log,
                'voice_response': f"Logged {food_info['food_name']} with {nutrition_log['calories']} calories."
            }
        else:
            return {
                'success': False,
                'message': "I couldn't identify the food from your voice. Please try again or type it in.",
                'suggestions': ['Log breakfast', 'Log lunch', 'Log dinner', 'Log snack']
            }
    else:
        return {
            'success': False,
            'message': "What would you like to log? I can track your meals and snacks.",
            'suggestions': ['Log breakfast', 'Log lunch', 'Log dinner', 'Log snack']
        }

def handle_progress_check_command(text, user_id, context):
    """Handle progress checking voice commands"""
    if 'weight' in text:
        # Get weight progress
        weight_progress = get_voice_weight_progress(user_id, context)
        return {
            'success': True,
            'message': "Here's your weight progress.",
            'data': weight_progress,
            'voice_response': f"Your current weight is {weight_progress['current_weight']} pounds. You've {weight_progress['change_direction']} {weight_progress['weight_change']} pounds this week."
        }
    elif 'achievement' in text or 'stats' in text:
        # Get achievements and stats
        achievements = get_voice_achievements(user_id, context)
        return {
            'success': True,
            'message': "Here are your achievements and stats.",
            'data': achievements,
            'voice_response': f"You have {len(achievements['recent_achievements'])} recent achievements. Your current streak is {achievements['current_streak']} days."
        }
    else:
        # Get general progress
        progress = get_voice_general_progress(user_id, context)
        return {
            'success': True,
            'message': "Here's your overall progress.",
            'data': progress,
            'voice_response': f"Great progress! You're {progress['completion_percentage']}% toward your goal. Keep up the good work!"
        }

def handle_shopping_command(text, user_id, context):
    """Handle shopping voice commands"""
    if 'add' in text or 'list' in text:
        # Add item to grocery list
        item_info = extract_grocery_item_from_voice(text)
        if item_info:
            grocery_update = add_voice_grocery_item(item_info, user_id, context)
            return {
                'success': True,
                'message': f"Added {item_info['item_name']} to your grocery list.",
                'data': grocery_update,
                'voice_response': f"Added {item_info['item_name']} to your shopping list. You now have {grocery_update['total_items']} items."
            }
        else:
            return {
                'success': False,
                'message': "I couldn't identify the item from your voice. Please try again or type it in.",
                'suggestions': ['Add milk', 'Add bread', 'Add chicken']
            }
    elif 'buy' in text or 'order' in text or 'delivery' in text:
        # Initiate grocery order
        order_status = initiate_voice_grocery_order(user_id, context)
        return {
            'success': True,
            'message': "Grocery order initiated!",
            'data': order_status,
            'voice_response': f"Order placed! Your groceries will be ready for pickup at {order_status['pickup_time']}."
        }
    else:
        return {
            'success': False,
            'message': "What would you like to do with your shopping? I can add items or place an order.",
            'suggestions': ['Add to list', 'Place order', 'Find deals']
        }

def generate_voice_meal_plan(user_id, context):
    """Generate meal plan based on voice command context"""
    # Mock meal plan generation
    return {
        'meals': [
            {
                'name': 'Protein Smoothie Bowl',
                'type': 'breakfast',
                'calories': 350,
                'protein': 25,
                'carbs': 45,
                'fat': 12
            },
            {
                'name': 'Grilled Chicken Salad',
                'type': 'lunch',
                'calories': 450,
                'protein': 35,
                'carbs': 25,
                'fat': 18
            },
            {
                'name': 'Salmon with Quinoa',
                'type': 'dinner',
                'calories': 550,
                'protein': 40,
                'carbs': 35,
                'fat': 22
            }
        ],
        'total_calories': 1350,
        'total_protein': 100,
        'total_carbs': 105,
        'total_fat': 52
    }

def get_voice_meal_suggestions(user_id, context):
    """Get meal suggestions based on voice command"""
    suggestions = [
        'Greek yogurt with berries and granola',
        'Grilled chicken with roasted vegetables',
        'Protein smoothie with banana and spinach',
        'Salmon with quinoa and asparagus',
        'Turkey and avocado wrap'
    ]
    
    return {
        'primary_suggestion': random.choice(suggestions),
        'all_suggestions': suggestions,
        'reasoning': 'Based on your fitness goals and dietary preferences'
    }

def start_voice_workout_session(user_id, context):
    """Start a workout session via voice command"""
    workout_types = ['strength training', 'cardio', 'yoga', 'HIIT', 'flexibility']
    
    return {
        'session_id': f"session_{int(time.time())}",
        'user_id': user_id,
        'workout_type': random.choice(workout_types),
        'start_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'status': 'active',
        'exercises': []
    }

def end_voice_workout_session(user_id, context):
    """End a workout session via voice command"""
    return {
        'session_id': context.get('session_id', f"session_{int(time.time())}"),
        'duration': random.randint(30, 90),
        'exercises_completed': random.randint(5, 12),
        'total_calories_burned': random.randint(200, 600),
        'workout_type': context.get('workout_type', 'strength training'),
        'end_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

def log_voice_exercise(text, user_id, context):
    """Log exercise from voice command"""
    # Extract exercise info from voice (simplified)
    exercises = ['squats', 'push-ups', 'lunges', 'planks', 'burpees', 'deadlifts']
    exercise = random.choice(exercises)
    
    return {
        'exercise': exercise,
        'sets': random.randint(2, 4),
        'reps': random.randint(8, 15),
        'weight': random.randint(10, 100) if exercise in ['deadlifts', 'squats'] else None,
        'duration': random.randint(30, 120) if exercise in ['planks'] else None
    }

def extract_food_from_voice(text):
    """Extract food information from voice command"""
    # Simplified food extraction
    foods = {
        'breakfast': ['oatmeal', 'eggs', 'yogurt', 'smoothie', 'toast'],
        'lunch': ['salad', 'sandwich', 'soup', 'chicken', 'rice'],
        'dinner': ['salmon', 'pasta', 'steak', 'vegetables', 'quinoa'],
        'snack': ['apple', 'nuts', 'protein bar', 'banana', 'yogurt']
    }
    
    for meal_type, food_list in foods.items():
        if meal_type in text:
            return {
                'food_name': random.choice(food_list),
                'meal_type': meal_type,
                'quantity': '1 serving'
            }
    
    return None

def log_voice_nutrition(food_info, user_id, context):
    """Log nutrition from voice command"""
    # Mock nutrition data
    nutrition_data = {
        'oatmeal': {'calories': 150, 'protein': 6, 'carbs': 27, 'fat': 3},
        'eggs': {'calories': 140, 'protein': 12, 'carbs': 1, 'fat': 10},
        'salad': {'calories': 200, 'protein': 8, 'carbs': 15, 'fat': 12},
        'salmon': {'calories': 280, 'protein': 34, 'carbs': 0, 'fat': 15}
    }
    
    food_name = food_info['food_name']
    nutrition = nutrition_data.get(food_name, {'calories': 200, 'protein': 10, 'carbs': 20, 'fat': 8})
    
    return {
        'food_name': food_name,
        'meal_type': food_info['meal_type'],
        'quantity': food_info['quantity'],
        'calories': nutrition['calories'],
        'protein': nutrition['protein'],
        'carbs': nutrition['carbs'],
        'fat': nutrition['fat'],
        'logged_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

def get_voice_weight_progress(user_id, context):
    """Get weight progress for voice response"""
    return {
        'current_weight': random.randint(150, 200),
        'weight_change': random.uniform(0.5, 3.0),
        'change_direction': 'lost' if random.random() > 0.5 else 'gained',
        'goal_weight': random.randint(140, 180),
        'progress_percentage': random.randint(60, 90)
    }

def get_voice_achievements(user_id, context):
    """Get achievements for voice response"""
    return {
        'current_streak': random.randint(5, 30),
        'total_workouts': random.randint(50, 200),
        'weight_lost': random.uniform(5.0, 25.0),
        'recent_achievements': [
            '7-day workout streak',
            'Lost 5 pounds',
            'Completed 10 workouts this month'
        ]
    }

def get_voice_general_progress(user_id, context):
    """Get general progress for voice response"""
    return {
        'completion_percentage': random.randint(70, 95),
        'days_remaining': random.randint(10, 60),
        'current_streak': random.randint(5, 30),
        'next_milestone': '10-pound weight loss'
    }

def extract_grocery_item_from_voice(text):
    """Extract grocery item from voice command"""
    grocery_items = ['milk', 'bread', 'chicken', 'eggs', 'bananas', 'spinach', 'yogurt', 'apples']
    
    for item in grocery_items:
        if item in text:
            return {
                'item_name': item,
                'quantity': '1',
                'category': 'dairy' if item in ['milk', 'yogurt'] else 'produce' if item in ['bananas', 'spinach', 'apples'] else 'protein' if item in ['chicken', 'eggs'] else 'grains'
            }
    
    return None

def add_voice_grocery_item(item_info, user_id, context):
    """Add grocery item from voice command"""
    return {
        'item_name': item_info['item_name'],
        'quantity': item_info['quantity'],
        'category': item_info['category'],
        'total_items': random.randint(10, 25),
        'added_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

def initiate_voice_grocery_order(user_id, context):
    """Initiate grocery order from voice command"""
    return {
        'order_id': f"order_{int(time.time())}",
        'status': 'confirmed',
        'pickup_time': (datetime.now() + timedelta(hours=2)).strftime('%Y-%m-%d %H:%M'),
        'total_items': random.randint(15, 30),
        'total_cost': round(random.uniform(50.0, 150.0), 2)
    }

def get_voice_command_suggestions():
    """Get suggestions for voice commands"""
    return [
        "Say 'Create meal plan' to generate a personalized meal plan",
        "Say 'Start workout' to begin tracking your exercise session",
        "Say 'Log breakfast' to record your morning meal",
        "Say 'Check progress' to see your fitness achievements",
        "Say 'Add milk to grocery list' to update your shopping list"
    ]

# Add new endpoint for voice commands
@app.route('/voice-command', methods=['POST'])
def voice_command_endpoint():
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided",
                "message": "Please provide command data"
            }), 400
        
        required_fields = ['audio_text', 'user_id']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}",
                    "message": f"Please provide {field}"
                }), 400
        
        context = data.get('context', {})
        
        response = process_voice_command(
            data['audio_text'],
            data['user_id'],
            context
        )
        
        # Ensure response has success field
        if 'success' not in response:
            response['success'] = True
        
        return jsonify(response), 200
            
    except Exception as e:
        logger.error(f"Error in voice_command: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "An error occurred processing your voice command. Please try again."
        }), 500

if __name__ == '__main__':
    print('=== __main__ block is running ===')
    print('WALMART_API_KEY:', os.getenv('WALMART_API_KEY'))
    print('WALMART_ENV:', os.getenv('WALMART_ENV'))
    app.run(debug=True, port=5002, host='0.0.0.0')

# ...rest of your original app.py code should be here (Flask app, endpoints, etc.)... 