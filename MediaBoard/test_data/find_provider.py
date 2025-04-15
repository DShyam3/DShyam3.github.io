import requests
import time
import re
from tqdm import tqdm

def extract_year_from_name(item_name):
    """Extract the year from the item name if it exists in parentheses."""
    match = re.search(r"\((\d{4})\)", item_name)
    if match:
        year = int(match.group(1))
        clean_name = re.sub(r"\(\d{4}\)", "", item_name).strip()
        return clean_name, year
    return item_name, None

def get_tvshow_id(api_key, show_name, year=None):
    """Get TMDB TV show ID using show name and optional year."""
    search_url = "https://api.themoviedb.org/3/search/tv"
    params = {
        'api_key': api_key,
        'query': show_name,
        'page': 1
    }
    
    if year:
        params['first_air_date_year'] = year
    
    response = requests.get(search_url, params=params)
    results = response.json().get('results', [])
    
    if results:
        return results[0]['id']  # Return first matching result's ID
    return None

def get_movie_id(api_key, movie_name, year=None):
    """Get TMDB Movie ID using movie name and optional year."""
    search_url = "https://api.themoviedb.org/3/search/movie"
    params = {
        'api_key': api_key,
        'query': movie_name,
        'page': 1
    }

    if year:
        params['year'] = year

    response = requests.get(search_url, params=params)
    results = response.json().get('results', [])

    if results:
        return results[0]['id']  # Return first matching result's ID
    return None


def get_providers(api_key, item_id, is_movie=False):
    """Get streaming and free providers for a TV show or movie using its TMDB ID."""
    if is_movie:
        providers_url = f"https://api.themoviedb.org/3/movie/{item_id}/watch/providers"
    else:
        providers_url = f"https://api.themoviedb.org/3/tv/{item_id}/watch/providers"
    
    params = {'api_key': api_key}
    response = requests.get(providers_url, params=params)
    results = response.json().get('results', {})
    
    # Get UK providers
    uk_providers = results.get('GB', {})
    
    # Get both flatrate (streaming) and free providers
    streaming_providers = uk_providers.get('flatrate', [])
    free_providers = uk_providers.get('free', [])
    
    return streaming_providers, free_providers

def process_items(api_key, input_file, output_file, is_movie=False):
    """Process TV shows or movies and save results to the output file."""
    # Preferred platforms
    PREFERRED_STREAMING = ['Netflix', 'Amazon Prime Video', 'Disney Plus', 'Apple TV Plus']
    PREFERRED_FREE = ['BBC iPlayer', 'ITVX']
    
    # Read item names from the input file
    with open(input_file, 'r') as f:
        items = [line.strip() for line in f.readlines() if line.strip()]

    # Dictionary to group items by platform
    platform_items = {
        'Netflix': [],
        'Amazon Prime Video': [],
        'Disney Plus': [],
        'Apple TV Plus': [],
        'BBC iPlayer': [],
        'ITVX': [],
        'Watch Online': [],
        'Not Found': []
    }
    
    # Start timing
    start_time = time.time()
    
    # Process items with a progress bar
    for item_name in tqdm(items, desc="Processing Items", unit="item"):
        # Extract the year from the item name if it exists
        clean_name, year = extract_year_from_name(item_name)
        
        if is_movie:
            item_id = get_movie_id(api_key, clean_name, year)
            # print("Movie")
        else:
            item_id = get_tvshow_id(api_key, clean_name, year)
        
        if not item_id:
            platform_items['Not Found'].append(item_name)
            continue
            
        streaming_providers, free_providers = get_providers(api_key, item_id, is_movie)
        
        # Check free providers first
        found_platform = None
        for provider in free_providers:
            if provider['provider_name'] in PREFERRED_FREE:
                found_platform = provider['provider_name']
                break
        
        # If no free provider, check streaming providers
        if not found_platform:
            for provider in streaming_providers:
                if provider['provider_name'] in PREFERRED_STREAMING:
                    found_platform = provider['provider_name']
                    break
        
        # Assign to platform or "Watch Online"
        if found_platform:
            platform_items[found_platform].append(item_name)
        else:
            platform_items['Watch Online'].append(item_name)
    
    # End timing
    end_time = time.time()
    elapsed_time = end_time - start_time
    
    # Write results to the output file
    with open(output_file, 'w') as f:
        for platform, items_list in platform_items.items():
            if items_list:
                f.write(f"{platform}:\n")
                for item in items_list:
                    f.write(f"- {item}\n")
                f.write("\n")  # Add a newline between platforms
    
    # Print timing results
    print(f"\nProcessing completed in {elapsed_time:.2f} seconds.")
    print(f"Results saved to {output_file}")

def main():
    API_KEY = '784d3314cee165d07cc55d1ac2f027ee'
    
    # Input and output files
    tv_input_file = '/Users/dhyanshyam/Projects/DShyam3.github.io/MediaBoard/test_data/tv_show.txt'
    tv_output_file = '/Users/dhyanshyam/Projects/DShyam3.github.io/MediaBoard/test_data/tv_show_providers.txt'
    
    movie_input_file = '/Users/dhyanshyam/Projects/DShyam3.github.io/MediaBoard/test_data/movies.txt'
    movie_output_file = '/Users/dhyanshyam/Projects/DShyam3.github.io/MediaBoard/test_data/movie_providers.txt'
    
    # Toggle to choose between TV shows and movies
    choice = input("Do you want to process TV shows or movies? (Enter 'tv' or 'movie'): ").strip().lower()
    
    if choice == 'tv':
        process_items(API_KEY, tv_input_file, tv_output_file, is_movie=False)
    elif choice == 'movie':
        process_items(API_KEY, movie_input_file, movie_output_file, is_movie=True)
    else:
        print("Invalid choice. Please enter 'tv' or 'movie'.")

if __name__ == '__main__':
    main()
