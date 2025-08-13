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