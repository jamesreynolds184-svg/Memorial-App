// Conflicts by Year functionality

let conflictsData = [];
let memorialsData = [];
let isLoading = false;

// Parse CSV data
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(',');
    
    if (values.length > 0 && values[0]) {
      const year = values[0].trim();
      const conflicts = [];
      
      // Get conflicts from columns 1-4
      for (let j = 1; j < values.length && j < 5; j++) {
        const conflict = values[j] ? values[j].trim() : '';
        if (conflict) {
          conflicts.push(conflict);
        }
      }
      
      data.push({
        year: parseInt(year),
        conflicts: conflicts
      });
    }
  }
  
  return data;
}

// Load conflicts data from CSV
async function loadConflictsData() {
  try {
    const response = await fetch('../data/Conflicts.csv');
    const text = await response.text();
    conflictsData = parseCSV(text);
    console.log(`Loaded ${conflictsData.length} years of conflict data`);
  } catch (error) {
    console.error('Error loading conflicts data:', error);
  }
}

// Load memorials data from JSON
async function loadMemorialsData() {
  try {
    const response = await fetch('../data/afm-memorials.json');
    memorialsData = await response.json();
    console.log(`Loaded ${memorialsData.length} memorial entries`);
  } catch (error) {
    console.error('Error loading memorials data:', error);
  }
}

// Populate year dropdown
function populateYearDropdown() {
  const select = document.getElementById('year-select');
  
  if (!select) return;
  
  // Clear existing options except the first one
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  // Add all years from conflicts data
  conflictsData.forEach(item => {
    const option = document.createElement('option');
    option.value = item.year;
    option.textContent = item.year;
    select.appendChild(option);
  });
}

// Display conflicts for selected year
function displayConflicts(year) {
  const conflictList = document.getElementById('conflict-list');
  const selectedYearSpan = document.getElementById('selected-year');
  const section = document.getElementById('conflicts-section');
  
  if (!conflictList || !selectedYearSpan || !section) return;
  
  // Find conflicts for the selected year
  const yearData = conflictsData.find(item => item.year === parseInt(year));
  
  selectedYearSpan.textContent = year;
  conflictList.innerHTML = '';
  
  if (yearData && yearData.conflicts.length > 0) {
    yearData.conflicts.forEach(conflict => {
      const li = document.createElement('li');
      li.textContent = conflict;
      conflictList.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.className = 'no-conflicts';
    li.textContent = 'No recorded conflicts for this year.';
    conflictList.appendChild(li);
  }
  
  section.style.display = 'block';
}

// Display panels with memorials from selected year
function displayPanels(year) {
  const panelsGrid = document.getElementById('panels-grid');
  const panelYearSpan = document.getElementById('panel-year');
  const memorialCountSpan = document.getElementById('memorial-count');
  const panelCountSpan = document.getElementById('panel-count');
  const panelRangeDiv = document.getElementById('panel-range');
  const section = document.getElementById('panels-section');
  
  if (!panelsGrid || !panelYearSpan || !memorialCountSpan || !section) return;
  
  // Filter memorials by year
  const yearInt = parseInt(year);
  const memorialsForYear = memorialsData.filter(m => m.date === yearInt);
  
  panelYearSpan.textContent = year;
  memorialCountSpan.textContent = memorialsForYear.length;
  
  // Group by panel number
  const panelGroups = {};
  memorialsForYear.forEach(memorial => {
    const panel = memorial.panel;
    if (!panelGroups[panel]) {
      panelGroups[panel] = [];
    }
    panelGroups[panel].push(memorial);
  });
  
  // Update panel count
  if (panelCountSpan) {
    panelCountSpan.textContent = Object.keys(panelGroups).length;
  }
  
  // Clear existing panels
  panelsGrid.innerHTML = '';
  
  if (Object.keys(panelGroups).length > 0) {
    // Sort panel numbers and display
    const sortedPanels = Object.keys(panelGroups).sort((a, b) => parseInt(a) - parseInt(b));
    
    // Display panel range
    if (panelRangeDiv) {
      const minPanel = sortedPanels[0];
      const maxPanel = sortedPanels[sortedPanels.length - 1];
      if (sortedPanels.length === 1) {
        panelRangeDiv.innerHTML = `<strong>Panel ${minPanel}</strong>`;
      } else {
        panelRangeDiv.innerHTML = `<strong>Panels ${minPanel} - ${maxPanel}</strong>`;
      }
    }
    
    sortedPanels.forEach(panel => {
      const panelItem = document.createElement('div');
      panelItem.className = 'panel-item';
      panelItem.innerHTML = `
        <span class="panel-number">Panel ${panel}</span>
        <span class="panel-count">${panelGroups[panel].length} names</span>
      `;
      
      // Add click handler to navigate to AFM list page filtered by panel and year
      panelItem.addEventListener('click', () => {
        // Navigate to afm-list filtered by this panel and year
        window.location.href = `afm-list.html?panel=${panel}&year=${year}`;
      });
      
      panelsGrid.appendChild(panelItem);
    });
  } else {
    const noData = document.createElement('div');
    noData.className = 'no-panels';
    noData.textContent = 'No Armed Forces Memorial entries found for this year.';
    panelsGrid.appendChild(noData);
    
    // Clear panel range
    if (panelRangeDiv) {
      panelRangeDiv.innerHTML = '';
    }
  }
  
  section.style.display = 'block';
}

// Handle year selection
function handleYearChange(event) {
  const year = event.target.value;
  
  if (!year) {
    // Hide sections if no year selected
    document.getElementById('conflicts-section').style.display = 'none';
    document.getElementById('panels-section').style.display = 'none';
    return;
  }
  
  displayConflicts(year);
  displayPanels(year);
}

// Initialize the page
async function init() {
  const loadingDiv = document.getElementById('loading');
  const yearSelect = document.getElementById('year-select');
  
  if (isLoading) return;
  isLoading = true;
  
  if (loadingDiv) loadingDiv.style.display = 'block';
  
  try {
    // Load both datasets
    await Promise.all([
      loadConflictsData(),
      loadMemorialsData()
    ]);
    
    // Populate dropdown
    populateYearDropdown();
    
    // Add event listener
    if (yearSelect) {
      yearSelect.addEventListener('change', handleYearChange);
    }
    
    // Check if there's a year in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlYear = urlParams.get('year');
    if (urlYear && yearSelect) {
      yearSelect.value = urlYear;
      handleYearChange({ target: yearSelect });
    }
    
  } catch (error) {
    console.error('Error initializing conflicts by year page:', error);
  } finally {
    if (loadingDiv) loadingDiv.style.display = 'none';
    isLoading = false;
  }
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
