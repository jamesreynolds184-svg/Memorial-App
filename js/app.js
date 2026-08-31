(function(){
  const btn = document.getElementById('burger-menu');
  const nav = document.getElementById('menu-items');
  const overlay = document.getElementById('menu-overlay');
  if(!btn || !nav) return;

  function open(){
    nav.classList.add('open');
    overlay && overlay.classList.add('show');
    document.body.classList.add('nav-open');
    btn.setAttribute('aria-expanded','true');
  }
  function close(){
    nav.classList.remove('open');
    overlay && overlay.classList.remove('show');
    document.body.classList.remove('nav-open');
    btn.setAttribute('aria-expanded','false');
  }
  function toggle(){
    nav.classList.contains('open') ? close() : open();
  }
  btn.addEventListener('click', toggle);
  overlay && overlay.addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });
})();

// Dropdown menu functionality
(function(){
  const dropdownToggles = document.querySelectorAll('.menu-dropdown-toggle');
  
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const content = toggle.nextElementSibling;
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      
      // Close all other dropdowns
      dropdownToggles.forEach(otherToggle => {
        if (otherToggle !== toggle) {
          otherToggle.setAttribute('aria-expanded', 'false');
          const otherContent = otherToggle.nextElementSibling;
          if (otherContent) {
            otherContent.classList.remove('open');
          }
        }
      });
      
      // Toggle current dropdown
      if (isExpanded) {
        toggle.setAttribute('aria-expanded', 'false');
        content.classList.remove('open');
      } else {
        toggle.setAttribute('aria-expanded', 'true');
        content.classList.add('open');
      }
    });
  });
})();

// Apply saved text size on all pages
(function() {
  const TEXT_SIZE_KEY = 'nma-text-size';
  const saved = localStorage.getItem(TEXT_SIZE_KEY);
  if (saved) {
    const size = parseInt(saved, 10);
    if (size >= 80 && size <= 150) {
      document.documentElement.style.fontSize = `${size}%`;
    }
  }
})();