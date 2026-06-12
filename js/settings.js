// Settings Page Functionality
(function() {
  'use strict';

  const THEME_KEY = 'nma-theme-preference';
  const TEXT_SIZE_KEY = 'nma-text-size';
  const SAVED_KEY = 'savedMemorials';

  // Theme Management
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    // Set current theme
    const currentTheme = localStorage.getItem(THEME_KEY) || 'auto';
    themeSelect.value = currentTheme;

    // Listen for changes
    themeSelect.addEventListener('change', (e) => {
      const theme = e.target.value;
      localStorage.setItem(THEME_KEY, theme);
      
      // Apply theme immediately
      applyTheme(theme);
    });
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    
    if (theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }

  // Text Size Management
  const MIN_SIZE = 80;
  const MAX_SIZE = 150;
  const STEP = 10;

  const decreaseBtn = document.getElementById('decrease-text-btn');
  const increaseBtn = document.getElementById('increase-text-btn');
  const resetBtn = document.getElementById('reset-text-btn');
  const currentSizeSpan = document.getElementById('current-text-size');

  function getTextSize() {
    const saved = localStorage.getItem(TEXT_SIZE_KEY);
    return saved ? parseInt(saved, 10) : 100;
  }

  function setTextSize(size) {
    const clamped = Math.max(MIN_SIZE, Math.min(MAX_SIZE, size));
    localStorage.setItem(TEXT_SIZE_KEY, clamped.toString());
    applyTextSize(clamped);
    updateTextSizeDisplay(clamped);
  }

  function applyTextSize(size) {
    document.documentElement.style.fontSize = `${size}%`;
  }

  function updateTextSizeDisplay(size) {
    if (currentSizeSpan) {
      currentSizeSpan.textContent = `${size}%`;
    }
    
    // Enable/disable buttons
    if (decreaseBtn) {
      decreaseBtn.disabled = size <= MIN_SIZE;
    }
    if (increaseBtn) {
      increaseBtn.disabled = size >= MAX_SIZE;
    }
  }

  // Initialize text size
  const currentSize = getTextSize();
  applyTextSize(currentSize);
  updateTextSizeDisplay(currentSize);

  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', () => {
      const current = getTextSize();
      setTextSize(current - STEP);
    });
  }

  if (increaseBtn) {
    increaseBtn.addEventListener('click', () => {
      const current = getTextSize();
      setTextSize(current + STEP);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      setTextSize(100);
    });
  }

  // Clear Saved Memorials
  const clearSavedBtn = document.getElementById('clear-saved-btn');
  if (clearSavedBtn) {
    clearSavedBtn.addEventListener('click', () => {
      // Count saved memorials
      let count = 0;
      try {
        const saved = JSON.parse(localStorage.getItem(SAVED_KEY));
        count = Array.isArray(saved) ? saved.length : 0;
      } catch {
        count = 0;
      }

      if (count === 0) {
        alert('You have no saved memorials to clear.');
        return;
      }

      const confirmed = confirm(
        `Are you sure you want to delete all ${count} saved memorial${count !== 1 ? 's' : ''}?\n\nThis action cannot be undone.`
      );

      if (confirmed) {
        localStorage.removeItem(SAVED_KEY);
        alert('All saved memorials have been cleared.');
      }
    });
  }

  // Apply text size on page load for all pages
  const savedTextSize = getTextSize();
  if (savedTextSize !== 100) {
    applyTextSize(savedTextSize);
  }
})();

// Global text size application for all pages
(function() {
  'use strict';
  
  const TEXT_SIZE_KEY = 'nma-text-size';
  
  function getTextSize() {
    const saved = localStorage.getItem(TEXT_SIZE_KEY);
    return saved ? parseInt(saved, 10) : 100;
  }
  
  function applyTextSize(size) {
    document.documentElement.style.fontSize = `${size}%`;
  }
  
  // Apply saved text size on page load
  const savedSize = getTextSize();
  if (savedSize !== 100) {
    applyTextSize(savedSize);
  }
})();
