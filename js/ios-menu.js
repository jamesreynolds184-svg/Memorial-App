(function() {
  // Detect iOS (including iPadOS)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  // Also check if running as standalone (installed as PWA)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;

  if (!isIOS) return;

  // Add iOS mode class to body
  document.body.classList.add('ios-mode');

  // Note: Bottom padding is handled by CSS (body.ios-mode)

  // Create bottom menu bar
  const bottomMenu = document.createElement('div');
  bottomMenu.className = 'ios-bottom-menu show';
  bottomMenu.innerHTML = `
    <button id="ios-menu-btn" aria-label="Open menu">
      <span class="icon">☰</span>
      <span class="label">Menu</span>
    </button>
    <button id="ios-search-btn" aria-label="Search">
      <span class="icon">🔍</span>
      <span class="label">Search</span>
    </button>
  `;

  // Insert at end of body
  document.body.appendChild(bottomMenu);

  // Hook up menu button
  const menuBtn = document.getElementById('ios-menu-btn');
  const burgerBtn = document.getElementById('burger-menu');
  if (menuBtn && burgerBtn) {
    menuBtn.addEventListener('click', () => {
      burgerBtn.click();
    });
  }

  // Hook up search button
  const searchBtn = document.getElementById('ios-search-btn');
  const globalSearchBtn = document.getElementById('global-search-btn');
  if (searchBtn && globalSearchBtn) {
    searchBtn.addEventListener('click', () => {
      globalSearchBtn.click();
    });
  }
})();