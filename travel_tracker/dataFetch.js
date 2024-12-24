import { supabase } from './supabaseClient.js';

/**
 * Fetch matching airports based on the input query.
 * @param {string} query - Input query for filtering airports.
 * @returns {Promise<Array|Object>} - Array of matching airports or error object.
 */
export async function fetchMatchingAirports(query) {
  try {
    const { data, error } = await supabase
      .from('airports')
      .select('iata, airport_name')
      .or(`iata.ilike.%${query}%,airport_name.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error fetching matching airports:', error.message);
      return [];
    }

    return data;
  } catch (err) {
    console.error('Unexpected error fetching airports:', err.message);
    return [];
  }
}

/**
 * Fetch airport details by IATA code.
 * @param {string} iataCode - IATA code of the airport.
 * @returns {Promise<Object>} - Airport details or error object.
 */
export async function fetchAirportDetails(iataCode) {
  try {
    const { data, error } = await supabase
      .from('airports')
      .select('airport_name, country, latitude, longitude')
      .eq('iata', iataCode)
      .single();

    if (error || !data) {
      console.error('Error fetching airport details:', error.message);
      return { error: 'Airport not found. Please try another IATA code.' };
    }

    return data;
  } catch (err) {
    console.error('Unexpected error fetching airport details:', err.message);
    return { error: 'Error fetching airport details. Please try again.' };
  }
}

/**
 * Fetch country details by name.
 * @param {string} countryName - Name of the country.
 * @returns {Promise<Object>} - Country details or error object.
 */
export async function fetchCountryDetails(countryName) {
  try {
    const trimmedCountryName = countryName.trim();

    // First try with the regular name
    const { data: nameData, error: nameError } = await supabase
      .from('countries')
      .select('name, region, flag_svg, official_name')
      .eq('name', trimmedCountryName)
      .single();

    // If found by name, return it
    if (!nameError && nameData) {
      return nameData;
    }

    // If not found by name, try with official name
    const { data: officialData, error: officialError } = await supabase
      .from('countries')
      .select('name, region, flag_svg, official_name')
      .eq('official_name', trimmedCountryName)
      .single();

    // If found by official name, return it
    if (!officialError && officialData) {
      return officialData;
    }

    // If neither search worked, log error and return error object
    console.error(`Error fetching country details for "${countryName}": Country not found by name or official name`);
    return { error: `Country details not found for "${countryName}".` };

  } catch (err) {
    console.error('Unexpected error fetching country details:', err.message);
    return { error: 'Error fetching country details. Please try again.' };
  }
}

/**
 * Fetch user's trips and their associated legs
 * @param {string} userId - The ID of the logged-in user
 * @returns {Promise<Array>} - Array of trips with their legs
 */
export async function fetchUserTrips(userId) {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select(`
        *,
        trip_legs(*)
      `)
      .eq('user_id', userId)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching trips:', error.message);
      return [];
    }

    return data;
  } catch (err) {
    console.error('Unexpected error fetching trips:', err.message);
    return [];
  }
}

/**
 * Fetch country information based on airport code
 * @param {string} airportCode - The airport IATA code
 * @returns {Promise<Object>} - Country information including flag
 */
export async function fetchAirportCountryInfo(airportCode) {
  try {
    // First get the country from the airports table
    const { data: airportData, error: airportError } = await supabase
      .from('airports')
      .select('country')
      .eq('iata', airportCode)
      .single();

    if (airportError || !airportData) {
      console.error('Error fetching airport country:', airportError?.message);
      return null;
    }

    // Try to find the country by name or official name
    const { data: countryData, error: countryError } = await supabase
      .from('countries')
      .select('name, region, flag_svg, official_name')
      .or(`name.ilike."${airportData.country}",official_name.ilike."${airportData.country}"`)
      .single();

    if (!countryError && countryData) {
      return countryData;
    }

    // If no match found
    console.error('Error fetching country details:', `Country not found by name or official name for "${airportData.country}"`);
    return null;

  } catch (err) {
    console.error('Unexpected error fetching country info:', err);
    return null;
  }
}
