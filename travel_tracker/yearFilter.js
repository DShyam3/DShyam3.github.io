export class YearFilter {
  constructor() {
    this.button = document.getElementById('year-filter');
    this.dropdown = document.getElementById('year-dropdown');
    this.selectedYearSpan = document.getElementById('selected-year');
    this.selectedYear = 'all';
    this.years = new Set();
    this.onYearChange = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Toggle dropdown
    this.button.addEventListener('click', () => {
      this.dropdown.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.button.contains(e.target) && !this.dropdown.contains(e.target)) {
        this.dropdown.classList.remove('active');
      }
    });
  }

  updateYears(trips) {
    this.years.clear();
    this.years.add('all');
    
    trips.forEach(trip => {
      const year = new Date(trip.start_date).getFullYear();
      this.years.add(year.toString());
    });

    this.renderDropdown();
  }

  renderDropdown() {
    const sortedYears = Array.from(this.years)
      .sort((a, b) => b === 'all' ? 1 : a === 'all' ? -1 : b - a);

    this.dropdown.innerHTML = sortedYears
      .map(year => `
        <div class="year-option ${year === this.selectedYear ? 'selected' : ''}" 
             data-year="${year}">
          ${year === 'all' ? 'All Years' : year}
        </div>
      `)
      .join('');

    // Update the selected year display
    this.selectedYearSpan.textContent = this.selectedYear === 'all' ? 'All Years' : this.selectedYear;

    // Add click handlers to options
    this.dropdown.querySelectorAll('.year-option').forEach(option => {
      option.addEventListener('click', () => this.selectYear(option.dataset.year));
    });
  }

  selectYear(year) {
    // Remove selected class from previous selection
    const previousSelected = this.dropdown.querySelector('.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }

    // Add selected class to new selection
    const newSelected = this.dropdown.querySelector(`[data-year="${year}"]`);
    if (newSelected) {
      newSelected.classList.add('selected');
    }

    this.selectedYear = year;
    this.selectedYearSpan.textContent = year === 'all' ? 'All Years' : year;
    this.dropdown.classList.remove('active');
    
    if (this.onYearChange) {
      this.onYearChange(year);
    }
  }
} 
