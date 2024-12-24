import { login, logout, signup, resetPassword, checkConfirmationStatus } from './authorization.js';
import { fetchMatchingAirports, fetchAirportDetails, fetchCountryDetails } from './dataFetch.js';
import { checkSessionAndUpdateUI } from './sessionManager.js';
import { supabase } from './supabaseClient.js';
import { updateTravelStats, createTripCard, filterTrips } from './tripComponents.js';
import { MapManager } from './mapManager.js';

let currentMapManager = null;
let currentContinent = 'all';

// Move loadUserData outside DOMContentLoaded
export async function loadUserData(year = 'all', continent = 'all') {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: trips, error } = await supabase
      .from('trips')
      .select(`
        *,
        trip_legs(*)
      `)
      .eq('user_id', user.id)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching trips:', error.message);
      return;
    }

    if (trips && trips.length > 0) {
      // Update travel stats with both filters
      await updateTravelStats(trips, continent, year);
      
      // Update map if available
      if (currentMapManager) {
        const filteredTrips = await filterTrips(trips, year, continent);
        currentMapManager.updateAirports(filteredTrips);
      }
    }
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const authButton = document.getElementById('auth-button');
  const loginModal = document.getElementById('login-modal');
  const airportLookupSection = document.getElementById('airport-lookup');
  const iataInput = document.getElementById('iata');
  const resultsDiv = document.getElementById('results');
  const datalist = document.getElementById('airports-datalist');
  const statsContainer = document.getElementById('stats-container');
  const filterSection = document.querySelector('.filter-section');
  const yearDropdown = document.getElementById('year-dropdown');
  const countriesModal = document.getElementById('countries-modal');
  const continentsModal = document.getElementById('continents-modal');
  const countriesButton = document.getElementById('countries-button');
  const continentsButton = document.getElementById('continents-button');
  const closeButtons = document.querySelectorAll('.close-modal');

  // Auth UI Elements
  const authTabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const resetForm = document.getElementById('reset-form');
  const togglePasswordButtons = document.querySelectorAll('.toggle-password');
  const successOverlay = document.getElementById('success-overlay');

  // Function to show/hide authenticated content
  function toggleAuthenticatedContent(show) {
    statsContainer.style.display = show ? 'block' : 'none';
    filterSection.style.display = show ? 'flex' : 'none';
    
    // Ensure map resizes properly when container becomes visible
    if (show && currentMapManager) {
      setTimeout(() => {
        currentMapManager.map.resize();
      }, 100);
    }
  }

  // Set up modal interactions
  if (countriesButton) {
    countriesButton.onclick = () => {
      countriesModal.classList.add('active');
    };
  }

  if (continentsButton) {
    continentsButton.onclick = () => {
      continentsModal.classList.add('active');
    };
  }

  // Close modals when clicking close button or outside
  closeButtons.forEach(button => {
    button.onclick = () => {
      countriesModal?.classList.remove('active');
      continentsModal?.classList.remove('active');
    };
  });

  [countriesModal, continentsModal].forEach(modal => {
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      };
    }
  });

  // Update year click handlers
  document.querySelectorAll('.year-option').forEach(yearOption => {
    yearOption.addEventListener('click', async () => {
      const selectedYear = yearOption.dataset.year;
      
      // Update year selection UI
      document.querySelectorAll('.year-option').forEach(opt => opt.classList.remove('selected'));
      yearOption.classList.add('selected');

      // Update year dropdown text if it exists
      const yearText = document.getElementById('selected-year');
      if (yearText) {
        yearText.textContent = yearOption.textContent;
      }
      
      // Close year dropdown if it exists
      if (yearDropdown) {
        yearDropdown.classList.remove('active');
      }

      // Reset continent selection to 'all'
      currentContinent = 'all';

      // Update ALL continent items to show 'all' as active
      document.querySelectorAll('.continent-item').forEach(item => {
        const isMatch = item.dataset.continent === currentContinent;
        if (isMatch) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      // Reset the continents button text and style
      const continentsCard = document.querySelector('#continents-visited');
      if (continentsCard) {
        const continentsTitle = continentsCard.querySelector('h3');
        const counterContainer = continentsCard.querySelector('.counter-container');
        
        continentsTitle.textContent = 'Continents Explored';
        continentsTitle.classList.remove('continent-selected');
        counterContainer.style.display = 'flex';
      }

      // Update data with both year and continent filters
      await loadUserData(selectedYear, currentContinent);
    });
  });

  // Handle tab switching
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and forms
      authTabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding form
      tab.classList.add('active');
      const formId = `${tab.dataset.tab}-form`;
      document.getElementById(formId).classList.add('active');
      
      // Clear errors and success messages
      document.querySelectorAll('.error, .success').forEach(msg => msg.textContent = '');
      successOverlay.style.display = 'none';
    });
  });

  // Handle form navigation (forgot password and back buttons)
  document.querySelectorAll('[data-form]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
      const formId = `${button.dataset.form}-form`;
      document.getElementById(formId).classList.add('active');
      
      // Clear errors and success messages
      document.querySelectorAll('.error, .success').forEach(msg => msg.textContent = '');
      successOverlay.style.display = 'none';
    });
  });

  // Handle password visibility toggle
  togglePasswordButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const passwordInput = button.parentElement.querySelector('input');
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      button.querySelector('.eye-icon').style.opacity = type === 'text' ? '1' : '0.7';
    });
  });

  // Function to show login modal
  function showLoginModal() {
    loginModal.style.display = 'flex';
    loginModal.classList.add('active');
    document.getElementById('login-email')?.focus();
  }

  // Function to hide login modal
  function hideLoginModal() {
    loginModal.style.display = 'none';
    loginModal.classList.remove('active');
    successOverlay.style.display = 'none';
    // Reset forms
    loginForm.reset();
    signupForm.reset();
    resetForm.reset();
    // Clear errors and success messages
    document.querySelectorAll('.error, .success').forEach(msg => msg.textContent = '');
    // Show login form
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.getElementById('login-form').classList.add('active');
  }

  // Initialize UI based on session
  await checkSessionAndUpdateUI(authButton, loginModal, airportLookupSection);

  // Initialize map with your Mapbox token
  async function initializeMap() {
    try {
      const mapManager = new MapManager('pk.eyJ1IjoiZHNoeWFtMyIsImEiOiJjbTUxY2NkYmkxaDFpMmlyMGQzZzNsM2pnIn0.SH4J6QMqZ6N9Ep9H9fSnvw');
      currentMapManager = mapManager;
      await mapManager.initialize();
      await mapManager.updateAirports();
      return mapManager;
    } catch (error) {
      console.error('Error initializing map:', error);
      return null;
    }
  }

  // Check initial auth state
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    authButton.textContent = 'Sign Out';
    toggleAuthenticatedContent(true);
    const mapManager = await initializeMap();
    if (mapManager) {
      await loadUserData();
    }
  } else {
    authButton.textContent = 'Sign In';
    toggleAuthenticatedContent(false);
  }

  // Auth button click handler
  authButton.addEventListener('click', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.auth.signOut();
      authButton.textContent = 'Sign In';
      toggleAuthenticatedContent(false);
    } else {
      showLoginModal();
    }
  });

  // Auth state change listener
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
      authButton.textContent = 'Sign Out';
      toggleAuthenticatedContent(true);
      const mapManager = await initializeMap();
      if (mapManager) {
        await loadUserData();
      }
      hideLoginModal();
      // Initialize year filter and other UI elements
      await checkSessionAndUpdateUI(authButton, loginModal, airportLookupSection);
    } else if (event === 'SIGNED_OUT') {
      authButton.textContent = 'Sign In';
      toggleAuthenticatedContent(false);
      if (currentMapManager && currentMapManager.map) {
        currentMapManager.map.remove();
        currentMapManager = null;
      }
    }
  });

  // Handle login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const loginError = document.getElementById('login-error');

    loginError.textContent = '';
    const { user, error } = await login(email, password);
    
    if (error) {
      loginError.textContent = error;
      return;
    }

    // No need to manually hide modal or update UI here as it will be handled by the auth state change listener
  });

  // Handle signup form submission
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    const confirmPassword = document.getElementById('signup-confirm-password').value.trim();
    const signupError = document.getElementById('signup-error');

    signupError.textContent = '';

    // Validate passwords match
    if (password !== confirmPassword) {
      signupError.textContent = 'Passwords do not match';
      return;
    }

    const { user, error, message } = await signup(email, password);
    
    if (error) {
      signupError.textContent = error;
      return;
    }

    // Show success overlay
    successOverlay.style.display = 'block';
    const successContent = successOverlay.querySelector('.success-content');
    
    // Clear any existing status text
    const existingStatus = successContent.querySelector('.small-text');
    if (existingStatus) {
      existingStatus.remove();
    }

    // Add the message
    const statusText = document.createElement('p');
    statusText.className = 'small-text';
    statusText.textContent = message;
    successContent.appendChild(statusText);
  });

  // Handle password reset form submission
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value.trim();
    const resetError = document.getElementById('reset-error');
    const resetSuccess = document.getElementById('reset-success');

    resetError.textContent = '';
    resetSuccess.textContent = '';

    const { error, success } = await resetPassword(email);
    
    if (error) {
      resetError.textContent = error;
      return;
    }

    resetSuccess.textContent = 'Password reset instructions have been sent to your email.';
    resetForm.reset();

    // Automatically return to login form after 3 seconds
    setTimeout(() => {
      document.querySelector('[data-form="login"]').click();
    }, 3000);
  });

  // Close modal when clicking outside
  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) {
      hideLoginModal();
    }
  });

  // Handle Enter key in reset email input
  document.getElementById('reset-email').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      resetForm.dispatchEvent(new Event('submit'));
    }
  });

  // Handle airport search input
  iataInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    if (query.length < 2) {
      datalist.innerHTML = '';
      return;
    }

    const airports = await fetchMatchingAirports(query);
    datalist.innerHTML = airports
      .map((airport) => `<option value="${airport.iata} - ${airport.airport_name}"></option>`)
      .join('');
  });

  // Handle airport selection
  iataInput.addEventListener('change', async () => {
    const inputValue = iataInput.value.trim();
    const iataCode = inputValue.includes(' - ') ? inputValue.split(' - ')[0] : inputValue;

    if (!iataCode) {
      resultsDiv.innerHTML = `<p class="error">Please enter a valid IATA code or airport name.</p>`;
      return;
    }

    resultsDiv.innerHTML = '<p>Loading...</p>';

    const airportDetails = await fetchAirportDetails(iataCode);
    if (!airportDetails || airportDetails.error) {
      resultsDiv.innerHTML = `<p class="error">Airport not found. Please try another IATA code.</p>`;
      return;
    }

    const countryDetails = await fetchCountryDetails(airportDetails.country);
    if (!countryDetails || countryDetails.error) {
      resultsDiv.innerHTML = `<p class="error">Country details not found for "${airportDetails.country}".</p>`;
      return;
    }

    resultsDiv.innerHTML = `
      <h2>${airportDetails.airport_name}</h2>
      <p>Country: ${airportDetails.country}</p>
      <p>Latitude: ${airportDetails.latitude}</p>
      <p>Longitude: ${airportDetails.longitude}</p>
      <h3>Country Details</h3>
      <p>Region: ${countryDetails.region}</p>
      <img src="${countryDetails.flag_svg}" alt="${countryDetails.name} Flag">
    `;
  });
});
