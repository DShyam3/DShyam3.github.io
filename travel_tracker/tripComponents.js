import { formatDistance, format } from 'https://cdn.skypack.dev/date-fns';
import { fetchAirportCountryInfo } from './dataFetch.js';
import { supabase } from './supabaseClient.js';

// Add airport info cache
const airportCache = new Map();

// Add function to get airport info with caching
async function getAirportInfo(airportCode) {
  if (!airportCode) return null;
  
  // Check cache first
  if (airportCache.has(airportCode)) {
    return airportCache.get(airportCode);
  }

  // First get the country info
  const countryInfo = await fetchAirportCountryInfo(airportCode);

  // Then get the airport coordinates from Supabase
  const { data: airportData, error } = await supabase
    .from('airports')
    .select('latitude, longitude')
    .eq('iata', airportCode)
    .single();

  if (error) {
    console.error('Error fetching airport coordinates:', error.message);
    return countryInfo;
  }

  // Combine the country info with the coordinates
  const airportInfo = {
    ...countryInfo,
    latitude: airportData?.latitude,
    longitude: airportData?.longitude
  };

  // Cache the combined info
  if (airportInfo) {
    airportCache.set(airportCode, airportInfo);
  }

  return airportInfo;
}

// Add this function to get total countries for a continent
async function getTotalCountriesForContinent(continent) {
  // Special case for Antarctica
  if (continent === 'Antarctica') {
    return 1;
  }

  const { data, error } = await supabase
    .from('countries')
    .select('*')
    .eq('region', continent)
    .eq('independent', true);

  if (error) {
    console.error('Error fetching countries for continent:', error.message);
    return 0;
  }

  return data.length;
}

// Add this function to get total countries
async function getTotalCountries() {
  const { data, error } = await supabase
    .from('countries')
    .select('*')
    .eq('independent', true);

  if (error) {
    console.error('Error fetching total countries:', error.message);
    return 0;
  }

  return data.length;
}

// Add this function to get total continents
async function getTotalContinents() {
  const { data, error } = await supabase
    .from('countries')
    .select('region')
    .eq('independent', true);

  if (error) {
    console.error('Error fetching total continents:', error.message);
    return 0;
  }

  const uniqueRegions = new Set(data.map(country => country.region));
  return uniqueRegions.size + 1; // Add 1 for Antarctica
}

// Add this function to get all continents
async function getAllContinents() {
  const { data, error } = await supabase
    .from('countries')
    .select('region')
    .eq('independent', true);

  if (error) {
    console.error('Error fetching continents:', error.message);
    return [];
  }

  return [...new Set(data.map(country => country.region)), 'Antarctica'].sort();
}

// Add function to create trip card
export async function createTripCard(trip) {
  const tripCard = document.createElement('div');
  tripCard.className = 'trip-card';
  
  // Calculate trip duration based on leg dates
  let firstLegDate = null;
  let lastLegDate = null;
  
  if (trip.trip_legs && trip.trip_legs.length > 0) {
    trip.trip_legs.forEach(leg => {
      const legStartDate = new Date(leg.leg_start_date);
      const legEndDate = new Date(leg.leg_end_date);
      
      if (!firstLegDate || legStartDate < firstLegDate) {
        firstLegDate = legStartDate;
      }
      if (!lastLegDate || legEndDate > lastLegDate) {
        lastLegDate = legEndDate;
      }
    });
  }
  
  // If no legs, fall back to trip dates
  if (!firstLegDate || !lastLegDate) {
    firstLegDate = new Date(trip.start_date);
    lastLegDate = trip.end_date ? new Date(trip.end_date) : firstLegDate;
  }
  
  // Ensure at least one day duration by adding a day if same-day trip
  if (firstLegDate.getTime() === lastLegDate.getTime()) {
    lastLegDate = new Date(lastLegDate.getTime() + 24 * 60 * 60 * 1000);
  }
  
  const duration = formatDistance(firstLegDate, lastLegDate);

  const tripHeader = document.createElement('div');
  tripHeader.className = 'trip-header';
  
  const dateDisplay = document.createElement('div');
  dateDisplay.className = 'date-pill';
  
  let showFullDates = false;
  
  const updateDateDisplay = () => {
    if (showFullDates) {
      const startDate = format(firstLegDate, 'MMM d, yyyy');
      const endDate = format(lastLegDate, 'MMM d, yyyy');
      dateDisplay.innerHTML = `
        <span class="duration-icon">📅</span>
        <span class="duration-time">${startDate} → ${endDate}</span>
      `;
    } else {
      dateDisplay.innerHTML = `
        <span class="duration-icon">⌛</span>
        <span class="duration-time">Duration: ${duration}</span>
      `;
    }
  };
  
  dateDisplay.addEventListener('click', () => {
    showFullDates = !showFullDates;
    updateDateDisplay();
  });
  
  updateDateDisplay();

  tripCard.innerHTML = `
    <h3>${trip.trip_name}</h3>
  `;
  
  tripHeader.appendChild(dateDisplay);
  tripCard.appendChild(tripHeader);

  if (trip.trip_legs && trip.trip_legs.length > 0) {
    const legsContainer = document.createElement('div');
    legsContainer.className = 'trip-legs';
    
    const legPromises = trip.trip_legs.map(async (leg, index) => {
      const legElement = document.createElement('div');
      legElement.className = 'trip-leg';
      
      if (leg.transport_mode?.toLowerCase() === 'flight') {
        const [fromCountry, toCountry] = await Promise.all([
          getAirportInfo(leg.from_airport),
          getAirportInfo(leg.to_airport)
        ]);

        legElement.innerHTML = `
          <div class="journey-details">
            <div class="airport-info">
              <span class="airport-code">${leg.from_airport}</span>
              <span class="country-name">${fromCountry?.name || 'Unknown'}</span>
            </div>
            <div class="journey-line">
              <span class="arrow">→</span>
            </div>
            <div class="airport-info">
              <span class="airport-code">${leg.to_airport}</span>
              <span class="country-name">${toCountry?.name || 'Unknown'}</span>
            </div>
          </div>
          <div class="transport-mode">
            <span class="transport-icon">✈️</span>
          </div>
        `;
      } else {
        legElement.innerHTML = `
          <div class="journey-details">
            <span class="country-name">${leg.transport_mode || 'Transport'}</span>
          </div>
          <div class="transport-mode">
            <span class="transport-icon">🚗</span>
          </div>
        `;
      }
      
      return legElement;
    });
    
    const legElements = await Promise.all(legPromises);
    legElements.forEach(element => legsContainer.appendChild(element));
    
    tripCard.appendChild(legsContainer);
  }

  return tripCard;
}

// Add this function to process trip legs
async function processTripsForContinents(trips, year = 'all', continent = 'all') {
  const visitedContinents = new Set();
  const uniqueCountries = new Map(); // Now stores country info and visit count
  const continentCountries = new Map();
  
  for (const trip of trips) {
    // Track unique countries for this trip
    const tripCountries = new Set();
    
    for (const leg of (trip.trip_legs || [])) {
      if (leg.transport_mode?.toLowerCase() === 'flight') {
        const legYear = new Date(leg.leg_start_date).getFullYear().toString();
        // Skip legs that don't match the year filter
        if (year !== 'all' && legYear !== year) {
          continue;
        }

        const [fromCountry, toCountry] = await Promise.all([
          getAirportInfo(leg.from_airport),
          getAirportInfo(leg.to_airport)
        ]);

        if (fromCountry) {
          // Only process if it matches the continent filter
          if (continent === 'all' || fromCountry.region === continent) {
            visitedContinents.add(fromCountry.region);
            // Only add country if it hasn't been seen in this trip
            if (!tripCountries.has(fromCountry.name)) {
              tripCountries.add(fromCountry.name);
              if (!uniqueCountries.has(fromCountry.name)) {
                uniqueCountries.set(fromCountry.name, { ...fromCountry, visitCount: 1 });
              } else {
                const countryInfo = uniqueCountries.get(fromCountry.name);
                uniqueCountries.set(fromCountry.name, { ...countryInfo, visitCount: (countryInfo.visitCount || 0) + 1 });
              }
            }
            if (!continentCountries.has(fromCountry.region)) {
              continentCountries.set(fromCountry.region, new Set());
            }
            continentCountries.get(fromCountry.region).add(fromCountry.name);
          }
        }

        if (toCountry) {
          // Only process if it matches the continent filter
          if (continent === 'all' || toCountry.region === continent) {
            visitedContinents.add(toCountry.region);
            // Only add country if it hasn't been seen in this trip
            if (!tripCountries.has(toCountry.name)) {
              tripCountries.add(toCountry.name);
              if (!uniqueCountries.has(toCountry.name)) {
                uniqueCountries.set(toCountry.name, { ...toCountry, visitCount: 1 });
              } else {
                const countryInfo = uniqueCountries.get(toCountry.name);
                uniqueCountries.set(toCountry.name, { ...countryInfo, visitCount: (countryInfo.visitCount || 0) + 1 });
              }
            }
            if (!continentCountries.has(toCountry.region)) {
              continentCountries.set(toCountry.region, new Set());
            }
            continentCountries.get(toCountry.region).add(toCountry.name);
          }
        }
      }
    }
  }
  
  return { visitedContinents, uniqueCountries, continentCountries };
}

// Update filterTrips to handle cross-year trips
export async function filterTrips(trips, year, continent) {
  const filteredTrips = [];
  
  for (const trip of trips) {
    let hasMatchingLegs = false;
    let continentMatch = false;
    let tripLegs = [];
    
    for (const leg of (trip.trip_legs || [])) {
      if (leg.transport_mode?.toLowerCase() === 'flight') {
        const legYear = new Date(leg.leg_start_date).getFullYear().toString();
        
        // Check if leg matches year filter
        const matchesYear = year === 'all' || legYear === year;
        
        // Check if leg matches continent filter
        let matchesContinent = continent === 'all';
        if (!matchesContinent) {
          const [fromCountry, toCountry] = await Promise.all([
            getAirportInfo(leg.from_airport),
            getAirportInfo(leg.to_airport)
          ]);
          
          matchesContinent = (fromCountry && fromCountry.region === continent) ||
                           (toCountry && toCountry.region === continent);
          if (matchesContinent) {
            continentMatch = true;
          }
        }

        // Include leg if it matches both filters
        if (matchesYear && (continent === 'all' || matchesContinent)) {
          hasMatchingLegs = true;
          tripLegs.push(leg);
        }
      }
    }

    // Include trip if it has any matching legs
    if (hasMatchingLegs && (continent === 'all' || continentMatch)) {
      filteredTrips.push({
        ...trip,
        trip_legs: tripLegs, // Only include matching legs
        yearFilter: year,
        isPartialYear: true
      });
    }
  }

  return filteredTrips;
}

// Add Haversine formula calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const φ1 = lat1 * Math.PI/180; // Convert to radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in miles
}

export async function updateTravelStats(trips, selectedContinent = 'all', selectedYear = 'all') {
  // First get visited continents for the selected year
  const { visitedContinents: yearVisitedContinents } = await processTripsForContinents(trips, selectedYear, 'all');

  // Then filter trips by year and continent
  const filteredTrips = await filterTrips(trips, selectedYear, selectedContinent);

  // Process filtered trips to get current stats with both filters
  const { visitedContinents: currentVisitedContinents, uniqueCountries, continentCountries } = 
    await processTripsForContinents(filteredTrips, selectedYear, selectedContinent);

  // Get total counts and all continents
  const [totalCountries, totalContinents, allContinents] = await Promise.all([
    getTotalCountries(),
    getTotalContinents(),
    getAllContinents()
  ]);

  // Update countries counter based on selected continent
  const countriesVisitedElement = document.querySelector('#countries-visited .counter');
  const totalCountriesElement = document.querySelector('#countries-visited .total-counter');
  
  if (selectedContinent === 'all') {
    countriesVisitedElement.textContent = uniqueCountries.size;
    totalCountriesElement.textContent = `/ ${totalCountries}`;
  } else {
    const continentCountriesCount = continentCountries.get(selectedContinent)?.size || 0;
    const totalContinentCountries = await getTotalCountriesForContinent(selectedContinent);
    countriesVisitedElement.textContent = continentCountriesCount;
    totalCountriesElement.textContent = `/ ${totalContinentCountries}`;
  }

  // Update continents counter - use current visited continents for the counter
  document.querySelector('#continents-visited .counter').textContent = currentVisitedContinents.size;
  document.querySelector('#continents-visited .total-counter').textContent = `/ ${totalContinents}`;

  // Update the continent card content
  const continentsCard = document.querySelector('#continents-visited');
  if (continentsCard) {
    const continentsTitle = continentsCard.querySelector('h3');
    const counterContainer = continentsCard.querySelector('.counter-container');
    
    if (selectedContinent === 'all') {
      continentsTitle.textContent = 'Continents Explored';
      continentsTitle.classList.remove('continent-selected');
      counterContainer.style.display = 'flex';
    } else {
      continentsTitle.textContent = selectedContinent;
      continentsTitle.classList.add('continent-selected');
      counterContainer.style.display = 'none';
    }
  }

  // Calculate travel summary stats
  let totalFlights = 0;
  let totalDurationDays = 0;
  let totalMiles = 0;

  for (const trip of filteredTrips) {
    let firstLegDate = null;
    let lastLegDate = null;

    if (trip.trip_legs) {
      for (const leg of trip.trip_legs) {
        const legStartDate = new Date(leg.leg_start_date);
        const legEndDate = new Date(leg.leg_end_date);

        if (!firstLegDate || legStartDate < firstLegDate) {
          firstLegDate = legStartDate;
        }
        if (!lastLegDate || legEndDate > lastLegDate) {
          lastLegDate = legEndDate;
        }

        if (leg.transport_mode?.toLowerCase() === 'flight') {
          totalFlights++;

          const [fromAirport, toAirport] = await Promise.all([
            getAirportInfo(leg.from_airport),
            getAirportInfo(leg.to_airport)
          ]);

          if (fromAirport?.latitude && fromAirport?.longitude && 
              toAirport?.latitude && toAirport?.longitude) {
            const distance = calculateDistance(
              fromAirport.latitude,
              fromAirport.longitude,
              toAirport.latitude,
              toAirport.longitude
            );
            totalMiles += distance;
          }
        }
      }
    }

    if (!firstLegDate || !lastLegDate) {
      firstLegDate = new Date(trip.start_date);
      lastLegDate = trip.end_date ? new Date(trip.end_date) : firstLegDate;
    }

    if (firstLegDate.getTime() === lastLegDate.getTime()) {
      lastLegDate = new Date(lastLegDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const tripDuration = Math.ceil((lastLegDate - firstLegDate) / (1000 * 60 * 60 * 24));
    totalDurationDays += tripDuration;
  }

  // Update summary values
  document.getElementById('total-trips').textContent = filteredTrips.length;
  document.getElementById('total-duration').textContent = `${totalDurationDays} days`;
  document.getElementById('total-flights').textContent = totalFlights;
  document.getElementById('total-miles').textContent = `${Math.round(totalMiles).toLocaleString()} miles`;

  // Update continents list
  const continentsList = document.querySelector('.continents-list');
  if (continentsList) {
    continentsList.innerHTML = `
      <div class="continent-item ${selectedContinent === 'all' ? 'active' : ''}" data-continent="all">
        <div class="continent-info">
          <span class="continent-name">All Continents</span>
        </div>
      </div>
    `;

    // Add all continents - use yearVisitedContinents for the indicators
    for (const continent of allContinents) {
      const isVisited = yearVisitedContinents.has(continent);
      
      const item = document.createElement('div');
      item.className = `continent-item ${selectedContinent === continent ? 'active' : ''}`;
      item.dataset.continent = continent;
      item.innerHTML = `
        <div class="continent-info">
          <span class="continent-name">${continent}</span>
          ${isVisited ? '<span class="visited-indicator"></span>' : ''}
        </div>
      `;
      continentsList.appendChild(item);
    }

    // Re-attach click handlers to all continent items
    document.querySelectorAll('.continent-item').forEach(item => {
      const clickHandler = async () => {
        const newSelectedContinent = item.dataset.continent;
        const currentYear = document.querySelector('.year-option.selected')?.dataset.year || 'all';
        
        // Update all continent items with the same data-continent value
        document.querySelectorAll(`.continent-item[data-continent="${newSelectedContinent}"]`).forEach(opt => {
          opt.classList.add('active');
        });
        document.querySelectorAll(`.continent-item:not([data-continent="${newSelectedContinent}"])`).forEach(opt => {
          opt.classList.remove('active');
        });

        // Update the continent card content
        const continentsCard = document.querySelector('#continents-visited');
        if (continentsCard) {
          const continentsTitle = continentsCard.querySelector('h3');
          const counterContainer = continentsCard.querySelector('.counter-container');
          
          if (newSelectedContinent === 'all') {
            continentsTitle.textContent = 'Continents Explored';
            continentsTitle.classList.remove('continent-selected');
            counterContainer.style.display = 'flex';
          } else {
            continentsTitle.textContent = newSelectedContinent;
            continentsTitle.classList.add('continent-selected');
            counterContainer.style.display = 'none';
          }
        }

        // Close the continents modal
        const continentsModal = document.getElementById('continents-modal');
        if (continentsModal) {
          continentsModal.classList.remove('active');
        }

        // Update stats with new filters
        await updateTravelStats(trips, newSelectedContinent, currentYear);
      };

      // Remove any existing click handler
      const existingHandler = item._clickHandler;
      if (existingHandler) {
        item.removeEventListener('click', existingHandler);
      }

      // Add new click handler
      item._clickHandler = clickHandler;
      item.addEventListener('click', clickHandler);
    });
  }

  // Update flags grid based on selected continent
  const flagsGrid = document.querySelector('.flags-grid');
  flagsGrid.innerHTML = '';
  
  uniqueCountries.forEach((countryInfo, countryName) => {
    if (selectedContinent === 'all' || countryInfo.region === selectedContinent) {
      const flagContainer = document.createElement('div');
      flagContainer.className = 'flag-container';

      const flagWrapper = document.createElement('div');
      flagWrapper.className = 'flag-wrapper';
      
      const flag = document.createElement('img');
      flag.className = 'country-flag';
      flag.src = countryInfo.flag_svg;
      flag.alt = `${countryName} flag`;
      
      const countryNameElement = document.createElement('div');
      countryNameElement.className = 'country-name';
      countryNameElement.textContent = countryName;
      countryNameElement.dataset.visits = `${countryInfo.visitCount || 0} visits`;
      
      flag.onerror = () => {
        console.log(`Failed to load flag for ${countryName}`);
        flagWrapper.textContent = countryName.slice(0, 2).toUpperCase();
        flagWrapper.style.background = '#334155';
        flagWrapper.style.display = 'flex';
        flagWrapper.style.alignItems = 'center';
        flagWrapper.style.justifyContent = 'center';
        flagWrapper.style.color = '#94a3b8';
      };
      
      flagWrapper.appendChild(flag);
      flagContainer.appendChild(flagWrapper);
      flagContainer.appendChild(countryNameElement);
      flagsGrid.appendChild(flagContainer);
    }
  });

  // Update trips display
  const tripsContainer = document.getElementById('trips-container');
  if (tripsContainer) {
    tripsContainer.innerHTML = '';
    Promise.all(filteredTrips.map(trip => createTripCard(trip)))
      .then(tripCards => {
        tripCards.forEach(card => tripsContainer.appendChild(card));
      });
  }
}

function updateCountriesGrid(countries) {
  const flagsGrid = document.querySelector('.flags-grid');
  flagsGrid.innerHTML = '';

  countries.forEach(country => {
    const flagContainer = document.createElement('div');
    flagContainer.className = 'flag-container';

    const flagWrapper = document.createElement('div');
    flagWrapper.className = 'flag-wrapper';

    const flag = document.createElement('img');
    flag.className = 'country-flag';
    flag.src = `https://flagcdn.com/${country.toLowerCase()}.svg`;
    flag.alt = `${country} flag`;

    const countryName = document.createElement('div');
    countryName.className = 'country-name';
    countryName.textContent = getCountryName(country);

    flagWrapper.appendChild(flag);
    flagContainer.appendChild(flagWrapper);
    flagContainer.appendChild(countryName);
    flagsGrid.appendChild(flagContainer);
  });
}

// Helper function to get full country name from code
function getCountryName(code) {
  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
  try {
    return regionNames.of(code);
  } catch (e) {
    return code; // Fallback to code if name not found
  }
}
