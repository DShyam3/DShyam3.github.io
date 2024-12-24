import { login, logout, checkUser } from './authorization.js';
import { fetchMatchingAirports, fetchAirportDetails, fetchCountryDetails } from './dataFetch.js';
import { showElement, hideElement, updateButtonText, displayError, clearError } from './uiUtils.js';

export async function handleAuthButtonClick(authButton, loginModal, airportLookupSection) {
  const isLoggedIn = authButton.textContent === 'Sign Out';

  if (isLoggedIn) {
    await logout();
    console.log('User logged out.');
    hideElement(airportLookupSection);
    updateButtonText(authButton, 'Sign In');
  } else {
    showElement(loginModal);
  }
}

export async function handleLoginSubmit(emailInput, passwordInput, loginError, loginModal, authButton, airportLookupSection) {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  clearError(loginError);
  const { user, error } = await login(email, password);
  if (error) {
    displayError(loginError, error);
    return;
  }

  console.log('Logged in successfully:', user);
  hideElement(loginModal);
  showElement(airportLookupSection);
  updateButtonText(authButton, 'Sign Out');
}

export async function handleIataInputChange(iataInput, datalist) {
  const query = iataInput.value.trim();
  if (query.length < 2) {
    datalist.innerHTML = '';
    return;
  }

  const airports = await fetchMatchingAirports(query);
  datalist.innerHTML = airports
    .map((airport) => `<option value="${airport.iata} - ${airport.airport_name}"></option>`)
    .join('');
}

export async function handleIataInputSelect(iataInput, resultsDiv) {
  const inputValue = iataInput.value.trim();
  const iataCode = inputValue.includes(' - ') ? inputValue.split(' - ')[0] : inputValue;

  if (!iataCode) {
    displayError(resultsDiv, 'Please enter a valid IATA code or airport name.');
    return;
  }

  resultsDiv.innerHTML = '<p>Loading...</p>';

  const airportDetails = await fetchAirportDetails(iataCode);
  if (!airportDetails || airportDetails.error) {
    displayError(resultsDiv, 'Airport not found. Please try another IATA code.');
    return;
  }

  const countryDetails = await fetchCountryDetails(airportDetails.country);
  if (!countryDetails || countryDetails.error) {
    displayError(resultsDiv, `Country details not found for "${airportDetails.country}".`);
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
}
