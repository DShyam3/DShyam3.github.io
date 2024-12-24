import { supabase } from './supabaseClient.js';
import { showElement, hideElement, updateButtonText } from './uiUtils.js';
import { fetchUserTrips } from './dataFetch.js';
import { createTripCard } from './tripComponents.js';
import { updateTravelStats } from './tripComponents.js';
import { YearFilter } from './yearFilter.js';

const yearFilter = new YearFilter();

export async function checkSessionAndUpdateUI(authButton, loginModal, airportLookupSection) {
  const { data: session } = await supabase.auth.getSession();
  const tripsSection = document.getElementById('trips-section');
  const statsSection = document.querySelector('.stats-section');
  const filterSection = document.querySelector('.filter-section');
  const statsContainer = document.getElementById('stats-container');
  
  if (session && session.session) {
    console.log('User is logged in:', session.session.user);
    if (authButton) updateButtonText(authButton, 'Sign Out');
    if (loginModal) loginModal.style.display = 'none';
    if (airportLookupSection) showElement(airportLookupSection);
    if (tripsSection) showElement(tripsSection);
    if (statsSection) showElement(statsSection);
    if (filterSection) showElement(filterSection);
    if (statsContainer) showElement(statsContainer);
    
    // Load and display trips only for the logged-in user
    const trips = await fetchUserTrips(session.session.user.id);
    const tripsContainer = document.getElementById('trips-container');
    if (tripsContainer) {
      tripsContainer.innerHTML = '';
      
      // Initialize year filter
      yearFilter.updateYears(trips);
      yearFilter.onYearChange = (year) => {
        updateDisplayForYear(trips, year);
      };

      // Initial display with all years
      updateDisplayForYear(trips, 'all');
    }
  } else {
    console.log('No user session found.');
    if (authButton) updateButtonText(authButton, 'Sign In');
    if (loginModal) loginModal.style.display = 'none';
    if (airportLookupSection) hideElement(airportLookupSection);
    if (tripsSection) hideElement(tripsSection);
    if (statsSection) hideElement(statsSection);
    if (filterSection) hideElement(filterSection);
    if (statsContainer) hideElement(statsContainer);
    
    // Reset stats
    const countriesCounter = document.querySelector('#countries-visited .counter');
    const countriesTotalCounter = document.querySelector('#countries-visited .total-counter');
    const continentsCounter = document.querySelector('#continents-visited .counter');
    const continentsTotalCounter = document.querySelector('#continents-visited .total-counter');
    const flagsGrid = document.querySelector('.flags-grid');
    const continentsList = document.querySelector('.continents-list');

    if (countriesCounter) countriesCounter.textContent = '0';
    if (countriesTotalCounter) countriesTotalCounter.textContent = '/ 0';
    if (continentsCounter) continentsCounter.textContent = '0';
    if (continentsTotalCounter) continentsTotalCounter.textContent = '/ 0';
    if (flagsGrid) flagsGrid.innerHTML = '';
    if (continentsList) continentsList.innerHTML = '';
  }
}

function updateDisplayForYear(trips, year) {
  const filteredTrips = year === 'all' 
    ? trips 
    : trips.filter(trip => new Date(trip.start_date).getFullYear().toString() === year);

  const tripsContainer = document.getElementById('trips-container');
  tripsContainer.innerHTML = '';
  
  Promise.all(filteredTrips.map(trip => createTripCard(trip)))
    .then(tripCards => {
      tripCards.forEach(card => tripsContainer.appendChild(card));
      updateTravelStats(filteredTrips);
    });
}
