(() => {
  const listEl = document.getElementById('afm-list');
  const nameSearchEl = document.getElementById('name-search');
  const serviceFilterEl = document.getElementById('service-filter');
  const yearFilterEl = document.getElementById('year-filter');
  const panelFilterEl = document.getElementById('panel-filter');
  const resetFiltersEl = document.getElementById('reset-filters');
  const applyFiltersEl = document.getElementById('apply-filters');
  const openFiltersEl = document.getElementById('open-filters');
  const closeFilterModalEl = document.getElementById('close-filter-modal');
  const filterModalEl = document.getElementById('filter-modal');
  const resultCountEl = document.getElementById('result-count');
  const totalCountEl = document.getElementById('total-count');
  const paginationControlsEl = document.getElementById('pagination-controls');
  const prevPanelEl = document.getElementById('prev-panel');
  const nextPanelEl = document.getElementById('next-panel');
  const panelIndicatorEl = document.getElementById('panel-indicator');

  if (!listEl || !nameSearchEl || !serviceFilterEl || !yearFilterEl || !panelFilterEl) {
    console.error('Required elements missing on AFM list page.');
    return;
  }

  // Dynamic data path
  const dataPath = location.pathname.includes('/pages/')
    ? '../data/afm-memorials.json'
    : 'data/afm-memorials.json';

  let allEntries = [];
  let filteredEntries = [];
  let availablePanels = [];
  let currentPanelIndex = 0;
  let isFiltering = false; // Track if user is filtering/searching

  // Current filter values
  let filters = {
    name: '',
    service: '',
    year: '',
    panel: ''
  };

  // Modal controls
  function openFilterModal() {
    filterModalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeFilterModal() {
    filterModalEl.classList.remove('active');
    document.body.style.overflow = '';
  }

  openFiltersEl.addEventListener('click', openFilterModal);
  closeFilterModalEl.addEventListener('click', closeFilterModal);
  filterModalEl.addEventListener('click', (e) => {
    if (e.target === filterModalEl) {
      closeFilterModal();
    }
  });

  function populateYearFilter() {
    const years = new Set();
    allEntries.forEach(entry => {
      if (entry.date) {
        years.add(entry.date);
      }
    });
    
    const sortedYears = Array.from(years).sort((a, b) => a - b);
    yearFilterEl.innerHTML = '<option value="">All Years</option>';
    sortedYears.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearFilterEl.appendChild(option);
    });
  }

  function populatePanelFilter() {
    const panels = new Set();
    allEntries.forEach(entry => {
      if (entry.panel) {
        panels.add(entry.panel);
      }
    });
    
    availablePanels = Array.from(panels).sort((a, b) => a - b);
    
    panelFilterEl.innerHTML = '<option value="">All Panels</option>';
    availablePanels.forEach(panel => {
      const option = document.createElement('option');
      option.value = panel;
      option.textContent = `Panel ${panel}`;
      panelFilterEl.appendChild(option);
    });
  }

  function checkIfFiltering() {
    // Check if user has any active search or filters
    isFiltering = !!(filters.name || filters.service || filters.year || filters.panel);
    
    // Show/hide pagination based on filtering state
    if (isFiltering) {
      paginationControlsEl.classList.add('hidden');
    } else {
      paginationControlsEl.classList.remove('hidden');
    }
  }

  function updatePaginationControls() {
    if (availablePanels.length === 0) return;
    
    const currentPanel = availablePanels[currentPanelIndex];
    panelIndicatorEl.textContent = `Panel ${currentPanel}`;
    
    // Enable/disable buttons based on position
    prevPanelEl.disabled = currentPanelIndex === 0;
    nextPanelEl.disabled = currentPanelIndex === availablePanels.length - 1;
  }

  function goToPreviousPanel() {
    if (currentPanelIndex > 0) {
      currentPanelIndex--;
      updatePaginationControls();
      applyFilters();
    }
  }

  function goToNextPanel() {
    if (currentPanelIndex < availablePanels.length - 1) {
      currentPanelIndex++;
      updatePaginationControls();
      applyFilters();
    }
  }

  function applyFilters() {
    checkIfFiltering();
    
    if (isFiltering) {
      // Filtering mode: show all matching results
      filteredEntries = allEntries.filter(entry => {
        // Name filter
        if (filters.name) {
          const nameMatch = entry.name && entry.name.toLowerCase().includes(filters.name.toLowerCase());
          if (!nameMatch) return false;
        }

        // Service filter
        if (filters.service) {
          if (entry.service !== filters.service) return false;
        }

        // Year filter
        if (filters.year) {
          if (entry.date != filters.year) return false;
        }

        // Panel filter
        if (filters.panel) {
          if (entry.panel != filters.panel) return false;
        }

        return true;
      });
    } else {
      // Pagination mode: show only current panel
      const currentPanel = availablePanels[currentPanelIndex];
      filteredEntries = allEntries.filter(entry => entry.panel === currentPanel);
      updatePaginationControls();
    }

    render();
  }

  function render() {
    listEl.innerHTML = '';
    
    // Update stats
    resultCountEl.textContent = filteredEntries.length;
    
    if (isFiltering) {
      totalCountEl.textContent = allEntries.length;
    } else {
      // In pagination mode, show total for current panel
      totalCountEl.textContent = filteredEntries.length;
    }

    if (!filteredEntries.length) {
      listEl.innerHTML = '<li class="empty">No names match your filters.</li>';
      return;
    }

    for (const entry of filteredEntries) {
      const li = document.createElement('li');
      li.className = 'memorial-row';
      
      const a = document.createElement('a');
      a.className = 'mem-link';
      
      // Build query string with all entry data
      const params = new URLSearchParams({
        name: entry.name || '',
        service: entry.service || '',
        date: entry.date || '',
        panel: entry.panel || '',
        panel_Loc: entry.panel_Loc || ''
      });
      
      a.href = `afm-detail.html?${params.toString()}`;
      a.textContent = entry.name;
      
      li.appendChild(a);
      listEl.appendChild(li);
    }
  }

  // Event listeners
  let searchTimeout;
  nameSearchEl.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filters.name = nameSearchEl.value.trim();
      applyFilters();
    }, 150);
  });

  // Apply filters button
  applyFiltersEl.addEventListener('click', () => {
    filters.service = serviceFilterEl.value;
    filters.year = yearFilterEl.value;
    filters.panel = panelFilterEl.value;
    applyFilters();
    closeFilterModal();
  });

  // Reset filters button
  resetFiltersEl.addEventListener('click', () => {
    filters = {
      name: '',
      service: '',
      year: '',
      panel: ''
    };
    nameSearchEl.value = '';
    serviceFilterEl.value = '';
    yearFilterEl.value = '';
    panelFilterEl.value = '';
    applyFilters();
    closeFilterModal();
  });

  // Pagination event listeners
  prevPanelEl.addEventListener('click', goToPreviousPanel);
  nextPanelEl.addEventListener('click', goToNextPanel);

  // Load data
  fetch(dataPath)
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      allEntries = (Array.isArray(data) ? data : []).filter(e => e && e.name);
      // Sort by panel number, then by panel_number (position on panel)
      allEntries.sort((a, b) => {
        // First sort by panel
        if (a.panel !== b.panel) {
          return a.panel - b.panel;
        }
        // Then sort by panel_number (position order)
        return (a.panel_number || 0) - (b.panel_number || 0);
      });
      
      // Populate filter dropdowns
      populateYearFilter();
      populatePanelFilter();
      
      // Check for URL parameters (e.g., from Conflicts by Year page)
      const urlParams = new URLSearchParams(window.location.search);
      const urlPanel = urlParams.get('panel');
      const urlYear = urlParams.get('year');
      
      if (urlPanel) {
        filters.panel = urlPanel;
        panelFilterEl.value = urlPanel;
      }
      
      if (urlYear) {
        filters.year = urlYear;
        yearFilterEl.value = urlYear;
      }
      
      // Initialize pagination to first panel
      currentPanelIndex = 0;
      checkIfFiltering();
      updatePaginationControls();
      
      // Apply initial filters (will show first panel or filtered results)
      applyFilters();
    })
    .catch(err => {
      console.error('Failed to load AFM data', err);
      listEl.innerHTML = '<li class="empty">Failed to load Armed Forces Memorial data.</li>';
    });
})();
