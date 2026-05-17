// Simplified restored logic for saved page

(() => {
  const SAVED_KEY = 'savedMemorials';
  const CUSTOM_ROUTES_KEY = 'customRoutes';
  const listEl = document.getElementById('memorial-list');
  const searchEl = document.getElementById('search');
  const buildRouteBtn = document.getElementById('build-route-btn');
  const routeModal = document.getElementById('route-builder-modal');
  const routeInfo = document.getElementById('route-info');
  const routeNameInput = document.getElementById('route-name');
  const createRouteBtn = document.getElementById('create-route-btn');
  const cancelRouteBtn = document.getElementById('cancel-route-btn');

  if (!listEl || !searchEl) {
    console.error('Required elements #memorial-list or #search missing on this page.');
    return;
  }

  // Dynamic data path (works in / and /pages/)
  const dataPath = location.pathname.includes('/pages/')
    ? '../data/memorials.json'
    : 'data/memorials.json';

  let all = [];
  let saved = new Set(loadSaved());

  function loadSaved() {
    try {
      const arr = JSON.parse(localStorage.getItem(SAVED_KEY));
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  
  function saveSaved() {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
  }

  function render(filter = '') {
    const q = filter.trim().toLowerCase();
    // Only show saved memorials
    const items = all.filter(m => {
      if (!m || !m.name) return false;
      if (!saved.has(m.name)) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q);
    });

    listEl.innerHTML = '';
    if (!items.length) {
      listEl.innerHTML = '<li class="empty">No saved memorials found. Save memorials from the "All Memorials" page.</li>';
      return;
    }

    for (const m of items) {
      const li = document.createElement('li');
      li.className = 'memorial-row';
      const a = document.createElement('a');
      a.className = 'mem-link';
      a.href = `memorial.html?name=${encodeURIComponent(m.name)}&from=saved`;
      a.textContent = m.name;
      const btn = document.createElement('button');
      btn.className = 'save-btn saved'; // Always saved in this view
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Unsave memorial');
      btn.dataset.name = m.name;
      btn.textContent = '★';
      li.appendChild(a);
      li.appendChild(btn);
      listEl.appendChild(li);
    }
  }

  // Unsave using event delegation
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.save-btn');
    if (!btn) return;
    const name = btn.dataset.name;
    if (!name) return;

    saved.delete(name);
    saveSaved();
    
    // Remove the item from view immediately
    const li = btn.closest('li');
    if (li) li.remove();
    
    // If no items left, refresh the view
    if (!listEl.children.length) {
      render(searchEl.value);
    }
  });

  // Live search
  let t;
  searchEl.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => render(searchEl.value), 120);
  });

  // Load data
  fetch(dataPath)
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      all = (Array.isArray(data) ? data : []).filter(m => m && m.name);
      all.sort((a, b) => a.name.localeCompare(b.name));
      render('');
    })
    .catch(err => {
      console.error('Failed to load memorials.json', err);
      listEl.innerHTML = '<li class="empty">Failed to load memorials.</li>';
    });

  // Route Building Functions
  function haversineMeters(coord1, coord2) {
    const [lat1, lng1] = coord1;
    const [lat2, lng2] = coord2;
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dphi = (lat2 - lat1) * Math.PI / 180;
    const dlambda = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dphi/2) * Math.sin(dphi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(dlambda/2) * Math.sin(dlambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function optimizeRoute(memorials) {
    if (memorials.length <= 1) return memorials;
    
    // Step 1: Greedy nearest-neighbor for initial route
    const unvisited = [...memorials];
    const route = [unvisited.shift()]; // Start with first
    
    while (unvisited.length > 0) {
      const current = route[route.length - 1];
      let nearestIdx = 0;
      let nearestDist = Infinity;
      
      for (let i = 0; i < unvisited.length; i++) {
        const dist = haversineMeters(
          [current.lat, current.lng],
          [unvisited[i].lat, unvisited[i].lng]
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }
      
      route.push(unvisited.splice(nearestIdx, 1)[0]);
    }
    
    // Step 2: 2-opt improvement to eliminate crossings and backtracking
    let improved = true;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops
    
    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;
      
      for (let i = 0; i < route.length - 2; i++) {
        for (let j = i + 2; j < route.length - 1; j++) {
          // Calculate current distance for edges (i to i+1) and (j to j+1)
          const currentDist = 
            haversineMeters([route[i].lat, route[i].lng], [route[i+1].lat, route[i+1].lng]) +
            haversineMeters([route[j].lat, route[j].lng], [route[j+1].lat, route[j+1].lng]);
          
          // Calculate distance if we reverse the section between i+1 and j
          // New edges would be (i to j) and (i+1 to j+1)
          const newDist = 
            haversineMeters([route[i].lat, route[i].lng], [route[j].lat, route[j].lng]) +
            haversineMeters([route[i+1].lat, route[i+1].lng], [route[j+1].lat, route[j+1].lng]);
          
          // If swapping improves the route by at least 1 meter, do it
          if (newDist < currentDist - 1) {
            // Reverse the section between i+1 and j (inclusive)
            const section = route.slice(i + 1, j + 1).reverse();
            route.splice(i + 1, j - i, ...section);
            improved = true;
          }
        }
      }
    }
    
    console.log(`Route optimized in ${iterations} iterations`);
    return route;
  }

  function saveCustomRoute(routeName, memorialNames) {
    const routes = loadCustomRoutes();
    routes.push({
      id: Date.now().toString(),
      name: routeName,
      memorials: memorialNames,
      created: new Date().toISOString()
    });
    localStorage.setItem(CUSTOM_ROUTES_KEY, JSON.stringify(routes));
  }

  function loadCustomRoutes() {
    try {
      const routes = JSON.parse(localStorage.getItem(CUSTOM_ROUTES_KEY));
      return Array.isArray(routes) ? routes : [];
    } catch {
      return [];
    }
  }

  // Build Route Button Handler
  if (buildRouteBtn) {
    buildRouteBtn.addEventListener('click', () => {
      // Get saved memorials with coordinates
      const savedMemorials = all.filter(m => 
        saved.has(m.name) && m.lat !== undefined && m.lng !== undefined
      );
      
      if (savedMemorials.length < 2) {
        alert('You need at least 2 saved memorials with locations to build a route.');
        return;
      }
      
      // Optimize route order
      const optimized = optimizeRoute(savedMemorials);
      
      // Show modal
      routeInfo.textContent = `Route will include ${optimized.length} memorials, optimized for walking distance.`;
      routeNameInput.value = `My Route ${new Date().toLocaleDateString()}`;
      routeModal.style.display = 'flex';
      routeNameInput.focus();
      routeNameInput.select();
    });
  }

  // Create Route Button Handler
  if (createRouteBtn) {
    createRouteBtn.addEventListener('click', () => {
      const routeName = routeNameInput.value.trim();
      if (!routeName) {
        alert('Please enter a route name.');
        return;
      }
      
      // Get saved memorials with coordinates
      const savedMemorials = all.filter(m => 
        saved.has(m.name) && m.lat !== undefined && m.lng !== undefined
      );
      
      // Optimize route order
      const optimized = optimizeRoute(savedMemorials);
      const memorialNames = optimized.map(m => m.name);
      
      // Save custom route
      saveCustomRoute(routeName, memorialNames);
      
      // Close modal
      routeModal.style.display = 'none';
      
      // Redirect to routes page
      window.location.href = 'routes.html';
    });
  }

  // Cancel Button Handler
  if (cancelRouteBtn) {
    cancelRouteBtn.addEventListener('click', () => {
      routeModal.style.display = 'none';
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && routeModal.style.display === 'flex') {
      routeModal.style.display = 'none';
    }
  });
})();