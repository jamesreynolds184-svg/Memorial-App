// Routes page functionality with footpath routing

console.log('routes.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired in routes.js');
  const routeCards = document.querySelectorAll('.route-card');
  console.log('Found', routeCards.length, 'route cards');
  const mainView = document.getElementById('routes-main-view');
  const detailView = document.getElementById('route-detail-view');
  const backButton = document.getElementById('back-to-routes');
  const routeTitle = document.getElementById('route-title');
  const routeDescription = document.getElementById('route-description');
  const memorialList = document.getElementById('route-memorial-list');
  const routesGrid = document.getElementById('routes-grid');
  
  const CUSTOM_ROUTES_KEY = 'customRoutes';
  
  let map = null;
  let routeLayer = null;
  let markersLayer = null;
  let footpathGraph = { nodes: [], adj: new Map() };
  let footpathsLoaded = false;
  
  // Routing configuration
  const BRIDGE_MAX_METERS = 3;
  const BRIDGE_SECOND_PASS_MAX = 8;
  const HOP_MAX_METERS = 15;
  const HOP_PENALTY = 4.0;
  const HOP_MAX_ITER = 6;
  
  // Load all memorials data for matching
  let memorialsData = [];
  const dataPath = '../data/memorials.json';
  const footpathsPath = '../data/footpaths.geojson';
  
  console.log('Loading memorials data...');
  fetch(dataPath)
    .then(res => res.json())
    .then(data => {
      memorialsData = data;
      console.log('Memorials data loaded:', memorialsData.length, 'memorials');
      
      // Load and display custom routes
      loadCustomRoutes();
    })
    .catch(err => console.error('Error loading memorials data:', err));
  
  // Load custom routes from localStorage
  function loadCustomRoutes() {
    try {
      const routes = JSON.parse(localStorage.getItem(CUSTOM_ROUTES_KEY));
      if (Array.isArray(routes) && routes.length > 0) {
        console.log('Found', routes.length, 'custom routes');
        renderCustomRoutes(routes);
      }
    } catch (err) {
      console.error('Error loading custom routes:', err);
    }
  }
  
  // Render custom route cards
  function renderCustomRoutes(routes) {
    routes.forEach(route => {
      const card = document.createElement('div');
      card.className = 'route-card custom-route';
      card.dataset.routeId = route.id;
      card.style.borderColor = '#888';
      
      const title = document.createElement('h2');
      title.textContent = route.name;
      
      const info = document.createElement('p');
      info.textContent = `${route.memorials.length} memorials`;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-route-btn';
      deleteBtn.textContent = '×';
      deleteBtn.title = 'Delete route';
      deleteBtn.style.cssText = 'position: absolute; top: 10px; right: 10px; background: rgba(255,0,0,0.7); color: white; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 20px; line-height: 1;';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Delete route "${route.name}"?`)) {
          deleteCustomRoute(route.id);
        }
      };
      
      card.appendChild(deleteBtn);
      card.appendChild(title);
      card.appendChild(info);
      
      card.addEventListener('click', () => {
        loadCustomRoute(route);
      });
      
      routesGrid.appendChild(card);
    });
  }
  
  // Delete a custom route
  function deleteCustomRoute(routeId) {
    try {
      const routes = JSON.parse(localStorage.getItem(CUSTOM_ROUTES_KEY)) || [];
      const filtered = routes.filter(r => r.id !== routeId);
      localStorage.setItem(CUSTOM_ROUTES_KEY, JSON.stringify(filtered));
      
      // Remove the card from DOM
      const card = document.querySelector(`[data-route-id="${routeId}"]`);
      if (card) card.remove();
    } catch (err) {
      console.error('Error deleting route:', err);
    }
  }
  
  // Load a custom route
  function loadCustomRoute(route) {
    console.log('Loading custom route:', route.name);
    displayRoute(route.name, `Custom route with ${route.memorials.length} memorials`, route.memorials, true);
  }
  
  // Handle route card clicks
  routeCards.forEach(card => {
    card.addEventListener('click', () => {
      const routeName = card.dataset.route;
      console.log('Route card clicked:', routeName);
      if (routeName === 'pink') {
        loadPinkRoute();
      } else if (routeName === 'blue') {
        loadBlueRoute();
      } else if (routeName === 'orange') {
        loadOrangeRoute();
      } else if (routeName === 'purple') {
        loadPurpleRoute();
      } else {
        console.log(`${routeName} route - coming soon`);
        alert(`${routeName.charAt(0).toUpperCase() + routeName.slice(1)} Route coming soon!`);
      }
    });
  });
  
  // Back button
  if (backButton) {
    backButton.addEventListener('click', () => {
      detailView.style.display = 'none';
      mainView.style.display = 'block';
      if (map) {
        map.remove();
        map = null;
        footpathsLoaded = false;
      }
    });
  }
  
  // Load Pink Route
  function loadPinkRoute() {
    loadRouteWithPath('pink', 'Pink Route', 'Follow this scenic route through the arboretum');
  }
  
  // Load Blue Route
  function loadBlueRoute() {
    loadRouteWithPath('blue', 'Blue Route', 'Discover memorials along this peaceful path');
  }
  
  // Load Orange Route
  function loadOrangeRoute() {
    loadRouteWithPath('orange', 'Orange Route', 'Explore this historic trail through the arboretum');
  }
  
  // Load Purple Route
  function loadPurpleRoute() {
    loadRouteWithPath('purple', 'Purple Route', 'Journey through remembrance on this thoughtful route');
  }
  
  // Generic route loader with path
  function loadRouteWithPath(routeId, routeTitle, routeDescription) {
    console.log(`Loading ${routeTitle}...`);
    
    // Check if memorials data is loaded
    if (memorialsData.length === 0) {
      console.warn('Memorials data not loaded yet, waiting...');
      setTimeout(() => {
        if (memorialsData.length > 0) {
          loadRouteWithPath(routeId, routeTitle, routeDescription);
        } else {
          alert('Memorial data is still loading. Please wait a moment and try again.');
        }
      }, 500);
      return;
    }
    
    // Capitalize first letter for file names
    const routeName = routeId.charAt(0).toUpperCase() + routeId.slice(1) + '_Route';
    
    // Try to load both CSV and GeoJSON, but allow CSV to be optional
    const csvPromise = fetch(`../data/routes/${routeName}.csv`)
      .then(res => {
        if (!res.ok) return null;
        return res.text();
      })
      .catch(() => null);
    
    const geojsonPromise = fetch(`../data/routes/${routeName}.geojson`)
      .then(res => {
        if (!res.ok) throw new Error(`GeoJSON not found: ${routeName}.geojson`);
        return res.json();
      });
    
    Promise.all([csvPromise, geojsonPromise])
      .then(([csvText, geojsonData]) => {
        console.log(`${routeTitle} data loaded`);
        
        let memorialNames = [];
        if (csvText) {
          memorialNames = csvText.split('\n').filter(line => line.trim() && line.trim() !== 'Memorial Name');
          console.log('Parsed', memorialNames.length, 'memorial names');
        } else {
          console.log('No CSV file found - displaying path only');
        }
        
        displayRouteWithPath(routeTitle, routeDescription, memorialNames, geojsonData);
      })
      .catch(err => {
        console.error(`Error loading ${routeTitle}:`, err);
        alert(`Unable to load ${routeTitle} data. Make sure ${routeName}.geojson exists in the data/routes folder.\n\nError: ${err.message}`);
      });
  }
  
  // Display route details
  function displayRoute(title, description, memorialNames, showNumberedPins = false) {
    console.log('Displaying route:', title, 'with', memorialNames.length, 'memorials', 'numbered pins:', showNumberedPins);
    routeTitle.textContent = title;
    routeDescription.textContent = description;
    memorialList.innerHTML = '';
    
    // Find coordinates for all memorials
    const routeMemorials = [];
    memorialNames.forEach((name, index) => {
      const cleanName = name.trim();
      if (!cleanName) return;
      
      // Find matching memorial in data
      const memorial = memorialsData.find(m => 
        m.name && m.name.trim() === cleanName
      );
      
      if (memorial && memorial.location && memorial.location.lat && memorial.location.lng) {
        routeMemorials.push({
          name: cleanName,
          lat: memorial.location.lat,
          lng: memorial.location.lng,
          index: index + 1
        });
      } else {
        console.warn('Memorial not found or no location:', cleanName);
      }
      
      // Add to list
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = `memorial.html?name=${encodeURIComponent(cleanName)}&from=routes`;
      link.textContent = `${index + 1}. ${cleanName}`;
      link.className = 'route-memorial-link';
      
      // Add location status indicator
      if (memorial && memorial.location) {
        link.innerHTML += ' <span style="color: #4CAF50;">📍</span>';
      } else {
        link.innerHTML += ' <span style="color: #ff9800;">⚠️</span>';
      }
      
      li.appendChild(link);
      memorialList.appendChild(li);
    });
    
    console.log('Found', routeMemorials.length, 'memorials with coordinates');
    
    mainView.style.display = 'none';
    detailView.style.display = 'block';
    
    // Initialize map with route (delay to ensure DOM is ready)
    console.log('Initializing route map with', routeMemorials.length, 'memorials');
    
    if (map) {
      console.log('Removing existing map');
      map.remove();
    }
    
    if (routeMemorials.length === 0) {
      console.error('No memorials with coordinates found for this route');
      alert('No memorials with location data found. Cannot display route.');
      return;
    }
    
    // Create map
    const mapEl = document.getElementById('route-map');
    if (!mapEl) {
      console.error('Map element not found!');
      return;
    }
    
    console.log('Creating Leaflet map...');
    map = L.map(mapEl, {
      center: [52.727, -1.731],  // Default center (NMA location)
      zoom: 15,
      scrollWheelZoom: true,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true
    });
    console.log('Map created successfully');
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);
    
    // Invalidate size to fix gray screen issue when container was hidden
    setTimeout(() => {
      map.invalidateSize();
    }, 50);
    
    // Create marker layer
    markersLayer = L.layerGroup().addTo(map);
    
    // Add markers at each location
    routeMemorials.forEach((memorial) => {
      const latLng = [memorial.lat, memorial.lng];
      
      if (showNumberedPins) {
        // Create numbered marker with pin icon
        const markerIcon = L.divIcon({
          className: 'custom-numbered-marker',
          html: `<div class="marker-pin"><span class="marker-number">${memorial.index}</span></div>`,
          iconSize: [30, 42],
          iconAnchor: [15, 42],
          popupAnchor: [0, -42]
        });
        
        const marker = L.marker(latLng, { icon: markerIcon })
          .bindPopup(`<strong>${memorial.index}. ${escapeHtml(memorial.name)}</strong>`)
          .addTo(markersLayer);
      } else {
        // Create simple pink circle marker (for preset routes like Pink)
        const marker = L.circleMarker(latLng, {
          radius: 6,
          color: '#ffffff',
          weight: 2,
          fillColor: '#ff69b4',
          fillOpacity: 1
        })
          .bindPopup(`<strong>${escapeHtml(memorial.name)}</strong>`)
          .addTo(markersLayer);
      }
    });
    
    // Load footpaths and build route
    loadFootpaths(routeMemorials);
  }
  
  // Display route with custom geojson path and numbered pins
  function displayRouteWithPath(title, description, memorialNames, geojsonPath) {
    console.log('Displaying route with path:', title, 'with', memorialNames.length, 'memorials');
    routeTitle.textContent = title;
    routeDescription.textContent = description;
    memorialList.innerHTML = '';
    
    // Find coordinates for all memorials
    const routeMemorials = [];
    memorialNames.forEach((name, index) => {
      const cleanName = name.trim();
      if (!cleanName) return;
      
      // Find matching memorial in data
      const memorial = memorialsData.find(m => 
        m.name && m.name.trim() === cleanName
      );
      
      if (memorial) {
        const lat = memorial.lat || (memorial.location && memorial.location.lat);
        const lng = memorial.lng || (memorial.location && memorial.location.lng);
        
        if (lat && lng) {
          routeMemorials.push({
            name: cleanName,
            lat: lat,
            lng: lng,
            index: index + 1
          });
        }
      } else {
        console.warn('Memorial not found:', cleanName);
      }
      
      // Add to list
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = `memorial.html?name=${encodeURIComponent(cleanName)}&from=routes`;
      link.textContent = `${index + 1}. ${cleanName}`;
      link.className = 'route-memorial-link';
      
      // Add location status indicator
      if (memorial && (memorial.lat || memorial.location)) {
        link.innerHTML += ' <span style="color: #4CAF50;">📍</span>';
      } else {
        link.innerHTML += ' <span style="color: #ff9800;">⚠️</span>';
      }
      
      li.appendChild(link);
      memorialList.appendChild(li);
    });
    
    // If no memorials, show a message
    if (memorialNames.length === 0) {
      const li = document.createElement('li');
      li.style.color = '#888';
      li.style.fontStyle = 'italic';
      li.textContent = 'Memorial list not configured yet. Add memorial names to the CSV file to see them here.';
      memorialList.appendChild(li);
    }
    
    console.log('Found', routeMemorials.length, 'memorials with coordinates');
    
    mainView.style.display = 'none';
    detailView.style.display = 'block';
    
    // Initialize map
    if (map) {
      map.remove();
    }
    
    const mapEl = document.getElementById('route-map');
    if (!mapEl) {
      console.error('Map element not found!');
      return;
    }
    
    map = L.map(mapEl, {
      center: [52.727, -1.731],
      zoom: 15,
      scrollWheelZoom: true,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true
    });
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);
    
    setTimeout(() => {
      map.invalidateSize();
    }, 50);
    
    // Display the geojson path (no memorial pins)
    if (geojsonPath) {
      L.geoJSON(geojsonPath, {
        style: {
          color: '#ec4899',  // Pink color
          weight: 5,
          opacity: 0.8
        }
      }).addTo(map);
    }
    
    if (geojsonPath && geojsonPath.features) {
      const bounds = L.geoJSON(geojsonPath).getBounds();
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }
  
  // Load and process footpath data
  function loadFootpaths(memorials) {
    console.log('Loading footpaths...');
    fetch(footpathsPath)
      .then(res => {
        if (!res.ok) throw new Error('Footpaths load failed: ' + res.status);
        return res.json();
      })
      .then(gj => {
        console.log('Footpaths loaded, building graph...');
        buildFootpathGraph(gj);
        footpathsLoaded = true;
        console.log('Footpath graph ready with', footpathGraph.nodes.length, 'nodes');
        
        // Build route through all memorials
        buildRouteThroughMemorials(memorials);
      })
      .catch(err => {
        console.error('Error loading footpaths:', err);
        // Fallback to direct lines
        console.log('Falling back to direct route');
        drawDirectRoute(memorials);
      });
  }
  
  // Build footpath graph from GeoJSON
  function buildFootpathGraph(gj) {
    footpathGraph = { nodes: [], adj: new Map() };
    
    if (!gj || !Array.isArray(gj.features)) {
      console.warn('No features in footpaths');
      return;
    }
    
    const key = (lat, lng) => lat.toFixed(6) + ',' + lng.toFixed(6);
    const idx = new Map();
    
    function addNode(lat, lng) {
      const k = key(lat, lng);
      if (idx.has(k)) return idx.get(k);
      const id = footpathGraph.nodes.length;
      footpathGraph.nodes.push({ id, lat, lng });
      footpathGraph.adj.set(id, []);
      idx.set(k, id);
      return id;
    }
    
    function addEdge(a, b, w) {
      if (a === b) return;
      // Only add if not already present
      if (!footpathGraph.adj.get(a).some(e => e.to === b))
        footpathGraph.adj.get(a).push({ to: b, w });
      if (!footpathGraph.adj.get(b).some(e => e.to === a))
        footpathGraph.adj.get(b).push({ to: a, w });
    }
    
    let segmentCount = 0;
    
    // Build graph from GeoJSON LineStrings - NO bridging or shortcuts
    gj.features.forEach(f => {
      if (!f || !f.geometry) return;
      if (f.geometry.type === 'LineString') {
        const coords = f.geometry.coordinates || [];
        let prev = null;
        coords.forEach(c => {
          if (!Array.isArray(c) || c.length < 2) return;
          const lng = c[0], lat = c[1];
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const id = addNode(lat, lng);
          if (prev != null && prev !== id) {
            const a = footpathGraph.nodes[prev];
            const b = footpathGraph.nodes[id];
            const d = haversineMeters([a.lat, a.lng], [b.lat, b.lng]);
            addEdge(prev, id, d);
            segmentCount++;
          }
          prev = id;
        });
      }
    });
    
    console.log('Footpath graph built:', footpathGraph.nodes.length, 'nodes,', segmentCount, 'segments (paths only, no bridges)');
    
    // Add bridging connections between nearby nodes to improve connectivity
    bridgeNearbyNodes();
  }
  
  // Add edges between nearby footpath nodes to improve graph connectivity
  function bridgeNearbyNodes() {
    const BRIDGE_DISTANCE = 30; // meters - connect nodes within this distance
    let bridgeCount = 0;
    
    console.log('Adding bridges between nearby nodes...');
    
    // For efficiency, only check nodes that seem disconnected or have few connections
    for (let i = 0; i < footpathGraph.nodes.length; i++) {
      const nodeA = footpathGraph.nodes[i];
      const connections = footpathGraph.adj.get(i).length;
      
      // Skip well-connected nodes to save time
      if (connections > 4) continue;
      
      // Check nearby nodes
      for (let j = i + 1; j < footpathGraph.nodes.length; j++) {
        const nodeB = footpathGraph.nodes[j];
        const distance = haversineMeters([nodeA.lat, nodeA.lng], [nodeB.lat, nodeB.lng]);
        
        if (distance <= BRIDGE_DISTANCE) {
          // Check if they're already connected
          const alreadyConnected = footpathGraph.adj.get(i).some(e => e.to === j);
          
          if (!alreadyConnected) {
            footpathGraph.adj.get(i).push({ to: j, w: distance });
            footpathGraph.adj.get(j).push({ to: i, w: distance });
            bridgeCount++;
          }
        }
      }
    }
    
    console.log(`Added ${bridgeCount} bridge connections between nearby footpath nodes`);
  }
  
  // Build route through all memorials using footpath routing
  function buildRouteThroughMemorials(memorials) {
    if (!footpathsLoaded || memorials.length < 2) {
      console.log('Using direct route fallback');
      drawDirectRoute(memorials);
      return;
    }
    
    console.log('Building footpath route through', memorials.length, 'memorials');
    
    // Find the nearest footpath node for each memorial
    const footpathWaypoints = [];
    memorials.forEach(memorial => {
      const nearestNodeId = findNearestNode([memorial.lat, memorial.lng]);
      if (nearestNodeId !== -1) {
        const node = footpathGraph.nodes[nearestNodeId];
        footpathWaypoints.push({
          nodeId: nearestNodeId,
          lat: node.lat,
          lng: node.lng,
          memorialName: memorial.name
        });
        console.log(`Memorial "${memorial.name}" -> footpath node ${nearestNodeId}`);
      }
    });
    
    if (footpathWaypoints.length < 2) {
      console.warn('Not enough footpath waypoints found');
      drawDirectRoute(memorials);
      return;
    }
    
    const allRouteCoords = [];
    
    // Route between each consecutive pair of footpath waypoints
    for (let i = 0; i < footpathWaypoints.length - 1; i++) {
      const fromNodeId = footpathWaypoints[i].nodeId;
      const toNodeId = footpathWaypoints[i + 1].nodeId;
      
      console.log(`Routing from node ${fromNodeId} to node ${toNodeId}`);
      
      // Run Dijkstra to find path on footpath network
      const pathIds = dijkstraWithGraph(fromNodeId, toNodeId, footpathGraph.adj, footpathGraph.nodes.length);
      
      if (!pathIds || pathIds.length === 0) {
        console.warn(`No footpath route found from node ${fromNodeId} to ${toNodeId}, skipping this segment`);
        // DO NOT add direct connection - skip this segment entirely
        continue;
      }
      
      // Convert node IDs to coordinates
      const segmentCoords = pathIds.map(id => [footpathGraph.nodes[id].lat, footpathGraph.nodes[id].lng]);
      console.log(`Segment ${i}: ${segmentCoords.length} points on footpaths`);
      
      // Add segment to overall route (avoid duplicate points)
      if (allRouteCoords.length === 0) {
        allRouteCoords.push(...segmentCoords);
      } else {
        // Skip first point if it's the same as last point of previous segment
        const lastCoord = allRouteCoords[allRouteCoords.length - 1];
        const firstCoord = segmentCoords[0];
        if (lastCoord[0] === firstCoord[0] && lastCoord[1] === firstCoord[1]) {
          allRouteCoords.push(...segmentCoords.slice(1));
        } else {
          allRouteCoords.push(...segmentCoords);
        }
      }
    }
    
    console.log('Total route points (all on footpaths):', allRouteCoords.length);
    
    // Draw the complete route - stays strictly on footpaths
    if (allRouteCoords.length > 1) {
      routeLayer = L.polyline(allRouteCoords, {
        color: '#ff69b4',
        weight: 5,
        opacity: 0.8,
        smoothFactor: 1
      }).addTo(map);
      
      console.log('Route layer added to map (footpaths only)');
      
      // Fit map to show entire route
      setTimeout(() => {
        const bounds = routeLayer.getBounds();
        map.fitBounds(bounds, { padding: [30, 30] });
        console.log('Map bounds fitted');
      }, 100);
    } else {
      console.warn('Not enough route coordinates to draw route. Fitting to markers instead.');
      // Fit to markers if no route could be drawn
      if (markersLayer && markersLayer.getLayers().length > 0) {
        const group = L.featureGroup(markersLayer.getLayers());
        map.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }
  
  // Find nearest node in graph to a given point
  function findNearestNode(point) {
    let nearestId = -1;
    let nearestDist = Infinity;
    
    footpathGraph.nodes.forEach(node => {
      const dist = haversineMeters(point, [node.lat, node.lng]);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = node.id;
      }
    });
    
    // Log distance to help debug
    if (nearestId !== -1) {
      console.log(`Nearest node distance: ${nearestDist.toFixed(1)}m`);
    }
    
    return nearestId;
  }
  
  // Dijkstra's algorithm
  function dijkstraWithGraph(srcId, dstId, adj, N) {
    const dist = new Array(N).fill(Infinity);
    const prev = new Array(N).fill(-1);
    dist[srcId] = 0;
    const pq = [{ id: srcId, d: 0 }];
    
    while (pq.length) {
      pq.sort((a, b) => a.d - b.d);
      const { id, d } = pq.shift();
      if (d !== dist[id]) continue;
      if (id === dstId) break;
      
      for (const e of adj.get(id) || []) {
        const nd = d + e.w;
        if (nd < dist[e.to]) {
          dist[e.to] = nd;
          prev[e.to] = id;
          pq.push({ id: e.to, d: nd });
        }
      }
    }
    
    if (dist[dstId] === Infinity) return [];
    
    const path = [];
    for (let c = dstId; c !== -1; c = prev[c]) {
      path.push(c);
      if (c === srcId) break;
    }
    return path.reverse();
  }
  
  // Haversine distance in meters
  function haversineMeters(a, b) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const sLat1 = toRad(a[0]), sLat2 = toRad(b[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(sLat1) * Math.cos(sLat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  
  // Draw direct route as fallback
  function drawDirectRoute(memorials) {
    console.log('Drawing direct route for', memorials.length, 'memorials');
    const coords = memorials.map(m => [m.lat, m.lng]);
    
    if (coords.length > 1) {
      routeLayer = L.polyline(coords, {
        color: '#ff69b4',
        weight: 5,
        opacity: 0.8,
        smoothFactor: 1
      }).addTo(map);
      
      console.log('Direct route added to map');
      
      setTimeout(() => {
        const bounds = routeLayer.getBounds();
        map.fitBounds(bounds, { padding: [30, 30] });
        console.log('Map bounds fitted to direct route');
      }, 100);
    } else if (coords.length === 1) {
      map.setView(coords[0], 16);
      console.log('Single memorial, centered map');
    }
  }
  
  // Escape HTML helper
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
