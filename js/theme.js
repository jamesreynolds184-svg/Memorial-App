// Theme management with auto-detection and manual toggle
(function() {
  'use strict';

  const THEME_KEY = 'nma-theme-preference';
  
  // Get the user's saved theme preference or detect system preference
  function getInitialTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      return saved; // 'light', 'dark', or 'auto'
    }
    return 'auto';
  }

  // Apply theme to document
  function applyTheme(theme) {
    const root = document.documentElement;
    
    if (theme === 'auto') {
      // Remove data-theme to let CSS media query handle it
      root.removeAttribute('data-theme');
    } else {
      // Set explicit theme
      root.setAttribute('data-theme', theme);
    }
  }

  // Get effective theme (what's actually showing)
  function getEffectiveTheme() {
    const root = document.documentElement;
    const dataTheme = root.getAttribute('data-theme');
    
    if (dataTheme) {
      return dataTheme;
    }
    
    // If no explicit theme, check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  // Initialize theme on page load
  function initTheme() {
    const theme = getInitialTheme();
    applyTheme(theme);
    
    // Update toggle UI if it exists
    updateToggleUI(theme);
  }

  // Update the toggle switch to match current theme
  function updateToggleUI(theme) {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    
    const effectiveTheme = getEffectiveTheme();
    toggle.checked = (effectiveTheme === 'dark');
  }

  // Handle toggle switch changes
  function handleToggleChange(e) {
    const isDark = e.target.checked;
    const newTheme = isDark ? 'dark' : 'light';
    
    // Save preference
    localStorage.setItem(THEME_KEY, newTheme);
    
    // Apply theme
    applyTheme(newTheme);
  }

  // Listen for system theme changes (when in auto mode)
  function watchSystemTheme() {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', (e) => {
          const currentPreference = localStorage.getItem(THEME_KEY);
          if (currentPreference === 'auto' || !currentPreference) {
            updateToggleUI('auto');
          }
        });
      }
      // Older browsers
      else if (mediaQuery.addListener) {
        mediaQuery.addListener((e) => {
          const currentPreference = localStorage.getItem(THEME_KEY);
          if (currentPreference === 'auto' || !currentPreference) {
            updateToggleUI('auto');
          }
        });
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initTheme();
      
      // Attach toggle handler
      const toggle = document.getElementById('theme-toggle');
      if (toggle) {
        toggle.addEventListener('change', handleToggleChange);
      }
      
      // Watch for system theme changes
      watchSystemTheme();
    });
  } else {
    initTheme();
    
    // Attach toggle handler
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('change', handleToggleChange);
    }
    
    // Watch for system theme changes
    watchSystemTheme();
  }

  // Apply theme immediately (before DOMContentLoaded) to prevent flash
  initTheme();
})();
