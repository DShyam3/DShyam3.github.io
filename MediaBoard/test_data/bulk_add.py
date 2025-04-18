# import requests
# import time
# import re
# from tqdm import tqdm

# # Supabase and TMDB credentials
# SUPABASE_URL = "https://yvtiybyuifkiwyrnjebe.supabase.co"
# SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dGl5Ynl1aWZraXd5cm5qZWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxMDI2MDAsImV4cCI6MjA1MzY3ODYwMH0.HDfXGowPGlrthUD87x2uNsprx_xySFiGojFcgabLtxQ"

# # TMDB API Key
# TMDB_API_KEY = "784d3314cee165d07cc55d1ac2f027ee"

# # Preferred platforms
# PREFERRED_STREAMING = ['Netflix', 'Amazon Prime Video', 'Disney Plus', 'Apple TV Plus']
# PREFERRED_FREE = ['BBC iPlayer', 'ITVX']

# HEADERS = {
#     "Content-Type": "application/json",
#     "apikey": SUPABASE_API_KEY,
#     "Authorization": f"Bearer {SUPABASE_API_KEY}"
# }

# def extract_year_from_name(item_name):
#     """Extracts the year from the item name if in parentheses."""
#     match = re.search(r"\((\d{4})\)", item_name)
#     if match:
#         year = int(match.group(1))
#         clean_name = re.sub(r"\(\d{4}\)", "", item_name).strip()
#         return clean_name, year
#     return item_name, None

# def get_tmdb_id(api_key, name, year=None, is_movie=False):
#     """Fetches TMDB ID using a search query."""
#     search_url = "https://api.themoviedb.org/3/search/movie" if is_movie else "https://api.themoviedb.org/3/search/tv"
#     params = {"api_key": api_key, "query": name, "page": 1}
#     if year:
#         params["year" if is_movie else "first_air_date_year"] = year

#     response = requests.get(search_url, params=params).json()
#     results = response.get("results", [])
    
#     if results:
#         return results[0]  # Return first match
#     return None

# def get_providers(api_key, item_id, is_movie=False):
#     """Fetches streaming providers from TMDB and returns preferred platform."""
#     url = f"https://api.themoviedb.org/3/movie/{item_id}/watch/providers" if is_movie else f"https://api.themoviedb.org/3/tv/{item_id}/watch/providers"
    
#     response = requests.get(url, params={"api_key": api_key}).json()
#     uk_providers = response.get("results", {}).get("GB", {})
    
#     streaming = uk_providers.get("flatrate", [])
#     free = uk_providers.get("free", [])
    
#     # Check free providers first
#     for provider in free:
#         if provider['provider_name'] in PREFERRED_FREE:
#             return provider['provider_name']
    
#     # Then check streaming providers
#     for provider in streaming:
#         if provider['provider_name'] in PREFERRED_STREAMING:
#             return provider['provider_name']
    
#     # If no preferred provider found
#     return "Online"

# def insert_into_supabase(endpoint, data):
#     """Inserts data into Supabase."""
#     url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
#     try:
        
#         # Add prefer header to get back the inserted row
#         headers = HEADERS.copy()
#         headers['Prefer'] = 'return=representation'
        
#         response = requests.post(url, headers=headers, json=data)
        
#         if response.status_code in [200, 201]:
#             try:
#                 response_data = response.json()
#                 return response_data
#             except ValueError:
#                 return [{"id": None}]  # Return a dummy response to allow the script to continue
#         else:
#             print(f"Failed to insert into {endpoint}: {response.text}")
#             return None
            
#     except Exception as e:
#         print(f"Exception while inserting into {endpoint}: {str(e)}")
#         return None

# def check_exists_in_supabase(endpoint, title):
#     """Checks if an item already exists in Supabase by title."""
#     url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
#     params = {
#         "title": f"eq.{title}",
#         "select": "id,title"
#     }
    
#     try:
#         response = requests.get(url, headers=HEADERS, params=params)
#         if response.status_code == 200:
#             existing_items = response.json()
#             return len(existing_items) > 0, existing_items[0]["id"] if existing_items else None
#     except Exception as e:
#         print(f"Error checking existence in {endpoint}: {str(e)}")
    
#     return False, None

# def process_tv_shows(api_key, input_file):
#     """Processes TV shows and inserts them into Supabase."""
#     try:
#         with open(input_file, "r") as f:
#             tv_shows = [line.strip() for line in f.readlines() if line.strip()]
        
        
#         for show in tqdm(tv_shows, desc="Processing TV Shows"):
#             try:
#                 clean_name, year = extract_year_from_name(show)
                
#                 show_data = get_tmdb_id(api_key, clean_name, year, is_movie=False)
                
#                 if not show_data:
#                     print(f"TV Show not found: {clean_name}")
#                     continue
                
#                 # Check if show already exists
#                 exists, existing_id = check_exists_in_supabase("tv_shows", show_data["name"])
#                 if exists:
#                     print(f"TV Show '{show_data['name']}' already exists in database with ID: {existing_id}")
#                     continue
                
#                 show_id = show_data["id"]
                
#                 # Get detailed show info for genres
#                 show_details_url = f"https://api.themoviedb.org/3/tv/{show_id}?api_key={api_key}"
#                 show_details = requests.get(show_details_url).json()
                
#                 # Get platform using preferred providers logic
#                 platform = get_providers(api_key, show_id, is_movie=False)
                
#                 # Insert TV show
#                 tv_show_entry = {
#                     "title": show_data["name"],
#                     "platform": platform,
#                     "genre": ", ".join([g["name"] for g in show_details.get("genres", [])]),
#                     "status": show_details.get("status", "Unknown"),
#                     "poster": f"https://image.tmdb.org/t/p/w500{show_data['poster_path']}" if show_data.get("poster_path") else None,
#                     "overview": show_data.get("overview", "No overview available")
#                 }
                
#                 inserted_show = insert_into_supabase("tv_shows", tv_show_entry)
#                 if not inserted_show:
#                     print(f"Failed to insert show: {clean_name}")
#                     continue
                    
#                 supabase_show_id = inserted_show[0]["id"] if inserted_show else None
                
#                 # Fetch seasons and episodes
#                 seasons_data = show_details.get("seasons", [])

#                 for season in seasons_data:
#                     try:
#                         release_year = None
#                         if season.get("air_date"):
#                             try:
#                                 release_year = int(season["air_date"][:4])
#                             except ValueError:
#                                 print(f"Invalid release year for season {season['season_number']}")
                        
#                         season_entry = {
#                             "tv_show_id": supabase_show_id,
#                             "season_number": season["season_number"],
#                             "release_year": release_year,
#                             "watched": False
#                         }
                        
#                         inserted_season = insert_into_supabase("tv_show_seasons", season_entry)
#                         if not inserted_season:
#                             print(f"Failed to insert season {season['season_number']}")
#                             continue
                            
#                         supabase_season_id = inserted_season[0]["id"] if inserted_season else None

#                         # Fetch episodes for each season
#                         episodes_url = f"https://api.themoviedb.org/3/tv/{show_id}/season/{season['season_number']}?api_key={api_key}"
#                         episodes_response = requests.get(episodes_url)
#                         if episodes_response.status_code != 200:
#                             print(f"Failed to fetch episodes: {episodes_response.text}")
#                             continue
                            
#                         episodes = episodes_response.json().get("episodes", [])

#                         for episode in episodes:
#                             try:
#                                 release_date = None
#                                 if episode.get("air_date"):
#                                     try:
#                                         release_date = episode["air_date"]  # Already in YYYY-MM-DD format
#                                     except ValueError:
#                                         print(f"Invalid release date for episode {episode['episode_number']}")
                                
#                                 episode_entry = {
#                                     "season_id": supabase_season_id,
#                                     "episode_number": episode["episode_number"],
#                                     "release_date": release_date,
#                                     "watched": False
#                                 }
#                                 insert_into_supabase("tv_show_episodes", episode_entry)
#                             except Exception as e:
#                                 print(f"Error processing episode {episode['episode_number']}: {str(e)}")
                                
#                     except Exception as e:
#                         print(f"Error processing season {season['season_number']}: {str(e)}")
                        
#             except Exception as e:
#                 print(f"Error processing show {show}: {str(e)}")
                
#     except Exception as e:
#         print(f"Error processing TV shows: {str(e)}")

# def process_movies(api_key, input_file):
#     """Processes movies and inserts them into Supabase."""
#     try:
#         with open(input_file, "r") as f:
#             movies = [line.strip() for line in f.readlines() if line.strip()]
            

#         for movie in tqdm(movies, desc="Processing Movies"):
#             try:
#                 clean_name, year = extract_year_from_name(movie)
                
#                 movie_data = get_tmdb_id(api_key, clean_name, year, is_movie=True)

#                 if not movie_data:
#                     print(f"Movie not found: {clean_name}")
#                     continue
                
#                 # Check if movie already exists
#                 exists, existing_id = check_exists_in_supabase("movies", movie_data["title"])
#                 if exists:
#                     print(f"Movie '{movie_data['title']}' already exists in database with ID: {existing_id}")
#                     continue
                
#                 movie_id = movie_data["id"]
                
#                 # Get detailed movie info for genres
#                 movie_details_url = f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={api_key}"
#                 movie_details = requests.get(movie_details_url).json()
                
#                 # Get platform using preferred providers logic
#                 platform = get_providers(api_key, movie_id, is_movie=True)

#                 release_year = None
#                 if movie_details.get("release_date"):
#                     try:
#                         release_year = int(movie_details["release_date"][:4])
#                     except ValueError:
#                         print(f"Invalid release year for movie {clean_name}")

#                 # Insert movie
#                 movie_entry = {
#                     "title": movie_data["title"],
#                     "platform": platform,
#                     "genre": ", ".join([g["name"] for g in movie_details.get("genres", [])]),
#                     "release_year": release_year,
#                     "poster": f"https://image.tmdb.org/t/p/w500{movie_data['poster_path']}" if movie_data.get("poster_path") else None,
#                     "overview": movie_data.get("overview", "No overview available")
#                 }
                
#                 if not insert_into_supabase("movies", movie_entry):
#                     print(f"Failed to insert movie: {clean_name}")
                    
#             except Exception as e:
#                 print(f"Error processing movie {movie}: {str(e)}")
                
#     except Exception as e:
#         print(f"Error processing movies: {str(e)}")

# def main():
#     tv_input_file = "/Users/dhyanshyam/Projects/DShyam3.github.io/MediaBoard/test_data/tv_show.txt"
#     movie_input_file = "/Users/dhyanshyam/Projects/DShyam3.github.io/MediaBoard/test_data/movies.txt"

#     choice = input("Process 'tv' shows or 'movie'? ").strip().lower()

#     if choice == "tv":
#         process_tv_shows(TMDB_API_KEY, tv_input_file)
#     elif choice == "movie":
#         process_movies(TMDB_API_KEY, movie_input_file)
#     else:
#         print("Invalid choice. Please enter 'tv' or 'movie'.")

# if __name__ == "__main__":
#     main()

# import requests
# import re
# from tqdm import tqdm

# # Supabase and TMDB credentials
# SUPABASE_URL = "https://yvtiybyuifkiwyrnjebe.supabase.co"
# SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dGl5Ynl1aWZraXd5cm5qZWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxMDI2MDAsImV4cCI6MjA1MzY3ODYwMH0.HDfXGowPGlrthUD87x2uNsprx_xySFiGojFcgabLtxQ"
# TMDB_API_KEY = "784d3314cee165d07cc55d1ac2f027ee"

# HEADERS = {
#     "Content-Type": "application/json",
#     "apikey": SUPABASE_API_KEY,
#     "Authorization": f"Bearer {SUPABASE_API_KEY}"
# }

# def extract_year_from_name(item_name):
#     """Extracts the year from the item name if in parentheses."""
#     match = re.search(r"\((\d{4})\)", item_name)
#     if match:
#         year = int(match.group(1))
#         clean_name = re.sub(r"\(\d{4}\)", "", item_name).strip()
#         return clean_name, year
#     return item_name, None

# def get_tmdb_id(api_key, name, year=None, is_movie=False):
#     """Fetches TMDB ID and release date using a search query."""
#     search_url = "https://api.themoviedb.org/3/search/movie" if is_movie else "https://api.themoviedb.org/3/search/tv"
#     params = {"api_key": api_key, "query": name, "page": 1}
#     if year:
#         params["year" if is_movie else "first_air_date_year"] = year

#     response = requests.get(search_url, params=params).json()
#     results = response.get("results", [])
    
#     if results:
#         return results[0]  # Return first match
#     return None

# def update_supabase_release_date(endpoint, title, release_date):
#     """Updates the release date in Supabase for an existing entry."""
#     url = f"{SUPABASE_URL}/rest/v1/{endpoint}"  
#     data = {"release_date": release_date}
#     headers = HEADERS.copy()
#     headers['Prefer'] = 'return=representation'
    
#     response = requests.patch(url, headers=headers, json=data, params={"title": f"eq.{title}"})
    
#     if response.status_code in [200, 204]:
#         print(f"Updated release date for {title}")
#     else:
#         print(f"Failed to update {endpoint}: {response.text}")

# def process_items(api_key, input_file, is_movie):
#     """Processes TV shows or movies and updates their release dates in Supabase."""
#     try:
#         with open(input_file, "r") as f:
#             items = [line.strip() for line in f.readlines() if line.strip()]
        
#         for item in tqdm(items, desc=f"Processing {'Movies' if is_movie else 'TV Shows'}"):
#             try:
#                 clean_name, year = extract_year_from_name(item)
#                 item_data = get_tmdb_id(api_key, clean_name, year, is_movie)
                
#                 if not item_data:
#                     print(f"Not found: {clean_name}")
#                     continue
                
#                 release_date = item_data.get("release_date" if is_movie else "first_air_date", None)
#                 if release_date:
#                     update_supabase_release_date("movies" if is_movie else "tv_shows", item_data["title"] if is_movie else item_data["name"], release_date)
#             except Exception as e:
#                 print(f"Error processing {item}: {str(e)}")
#     except Exception as e:
#         print(f"Error processing input file: {str(e)}")

# def main():
#     tv_input_file = '/Users/dhyanshyam/Projects/DShyam3.github.io/MediaBoard/test_data/tv_show.txt'
#     movie_input_file = '/Users/dhyanshyam/Projects/DShyam3.github.io/MediaBoard/test_data/movies.txt'
#     choice = input("Process 'tv' shows or 'movie'? ").strip().lower()
    
#     if choice == "tv":
#         process_items(TMDB_API_KEY, tv_input_file, is_movie=False)
#     elif choice == "movie":
#         process_items(TMDB_API_KEY, movie_input_file, is_movie=True)
#     else:
#         print("Invalid choice. Please enter 'tv' or 'movie'.")

# if __name__ == "__main__":
#     main()
import requests
import re
from tqdm import tqdm

# Supabase and TMDB credentials
SUPABASE_URL = "https://yvtiybyuifkiwyrnjebe.supabase.co"
SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dGl5Ynl1aWZraXd5cm5qZWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxMDI2MDAsImV4cCI6MjA1MzY3ODYwMH0.HDfXGowPGlrthUD87x2uNsprx_xySFiGojFcgabLtxQ"
TMDB_API_KEY = "784d3314cee165d07cc55d1ac2f027ee"

HEADERS = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_API_KEY,
    "Authorization": f"Bearer {SUPABASE_API_KEY}"
}

def extract_year_from_name(item_name):
    """Extracts the year from the item name if in parentheses."""
    match = re.search(r"\((\d{4})\)", item_name)
    if match:
        year = int(match.group(1))
        clean_name = re.sub(r"\(\d{4}\)", "", item_name).strip()
        return clean_name, year
    return item_name, None

def get_tmdb_id(api_key, name, year=None):
    """Fetches TMDB ID and release date using a search query."""
    search_url = "https://api.themoviedb.org/3/search/tv"
    params = {"api_key": api_key, "query": name, "page": 1}
    if year:
        params["first_air_date_year"] = year

    response = requests.get(search_url, params=params).json()
    results = response.get("results", [])
    
    if results:
        return results[0]  # Return first match
    return None

def get_tv_show_id_from_supabase(title):
    """Fetches the TV show ID from Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/tv_shows"
    params = {"title": f"eq.{title}", "select": "id"}
    response = requests.get(url, headers=HEADERS, params=params)
    if response.status_code == 200 and response.json():
        return response.json()[0]["id"]
    return None

def update_supabase_release_date(endpoint, filters, release_date):
    """Updates the release date in Supabase for an existing entry."""
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    data = {"release_date": release_date}
    headers = HEADERS.copy()
    headers['Prefer'] = 'return=representation'
    
    response = requests.patch(url, headers=headers, json=data, params=filters)
    
    if response.status_code in [200, 204]:
        print(f"Updated release date in {endpoint}")
    else:
        print(f"Failed to update {endpoint}: {response.text}")

def update_tv_show_seasons(api_key, show_id, supabase_tv_show_id):
    """Fetches and updates season release dates for a TV show."""
    url = f"https://api.themoviedb.org/3/tv/{show_id}?api_key={api_key}"
    response = requests.get(url).json()
    
    if "seasons" in response:
        for season in response["seasons"]:
            season_number = season["season_number"]
            release_date = season.get("air_date", None)
            if release_date:
                update_supabase_release_date("tv_show_seasons", {"tv_show_id": f"eq.{supabase_tv_show_id}", "season_number": f"eq.{season_number}"}, release_date)

def process_tv_shows(api_key, input_file):
    """Processes TV shows and updates their release dates in Supabase."""
    try:
        with open(input_file, "r") as f:
            tv_shows = [line.strip() for line in f.readlines() if line.strip()]
        
        for show in tqdm(tv_shows, desc="Processing TV Shows"):
            try:
                clean_name, year = extract_year_from_name(show)
                show_data = get_tmdb_id(api_key, clean_name, year)
                
                if not show_data:
                    print(f"Not found: {clean_name}")
                    continue
                
                supabase_tv_show_id = get_tv_show_id_from_supabase(show_data["name"])
                if not supabase_tv_show_id:
                    print(f"TV show not found in Supabase: {show_data['name']}")
                    continue
                
                release_date = show_data.get("first_air_date", None)
                if release_date:
                    update_supabase_release_date("tv_shows", {"id": f"eq.{supabase_tv_show_id}"}, release_date)
                
                update_tv_show_seasons(api_key, show_data["id"], supabase_tv_show_id)
            except Exception as e:
                print(f"Error processing {show}: {str(e)}")
    except Exception as e:
        print(f"Error processing input file: {str(e)}")

def main():
    tv_input_file = '/Users/dhyanshyam/Projects/DShyam3.github.io/MediaBoard/test_data/tv_show.txt'
    process_tv_shows(TMDB_API_KEY, tv_input_file)

if __name__ == "__main__":
    main()
