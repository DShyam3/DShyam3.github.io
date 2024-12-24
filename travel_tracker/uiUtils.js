export function showElement(element) {
  if (element) {
    element.style.display = 'block';
  }
}

export function hideElement(element) {
  if (element) {
    element.style.display = 'none';
  }
}

export function updateButtonText(button, text) {
  if (button) {
    button.textContent = text;
  }
}

export function displayError(element, message) {
  if (element) {
    element.textContent = message;
  }
}

export function clearError(element) {
  if (element) {
    element.textContent = '';
  }
}
  