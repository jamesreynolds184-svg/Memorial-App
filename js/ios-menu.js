(function() {
  // Detect iOS (including iPadOS)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  // Detect Android
  const isAndroid = /Android/.test(navigator.userAgent);
  
  // Check if running on mobile device (iOS or Android)
  const isMobile = isIOS || isAndroid;
  
  // Also check if running as standalone (installed as PWA)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;

  if (!isMobile) return;

  // Add mobile mode class to body
  document.body.classList.add('mobile-mode');

  // Note: Bottom padding is handled by CSS (body.ios-mode)

  // Create bottom menu bar
  const bottomMenu = document.createElement('div');
  bottomMenu.className = 'mobile-bottom-menu show';
  bottomMenu.innerHTML = `
    <button id="mobile-menu-btn" aria-label="Open menu">
      <span class="icon">☰</span>
      <span class="label">Menu</span>
    </button>
    <button id="mobile-search-btn" aria-label="Search">
      <span class="icon">🔍</span>
      <span class="label">Search</span>
    </button>
  `;

  // Insert at end of body
  document.body.appendChild(bottomMenu);

  // Hook up menu button
  const menuBtn = document.getElementById('mobile-menu-btn');
  const burgerBtn = document.getElementById('burger-menu');
  if (menuBtn && burgerBtn) {
    menuBtn.addEventListener('click', () => {
      burgerBtn.click();
    });
  }

  // Hook up search button
  const searchBtn = document.getElementById('mobile-search-btn');
  const globalSearchBtn = document.getElementById('global-search-btn');
  if (searchBtn && globalSearchBtn) {
    searchBtn.addEventListener('click', () => {
      globalSearchBtn.click();
    });
  }
})();