(function(){
  const dbg = document.getElementById('tour-map-debug');
  function log(tag,data){ console.log('[TourMap]',tag,data||''); if(dbg) dbg.textContent += tag+' '+JSON.stringify(data||{})+'\n'; }

  const mapEl = document.getElementById('tour-map');
  if(!mapEl){ console.error('Missing #tour-map'); return; }

  // 1. Basic map (prove tiles load)
  const map = L.map('tour-map', { preferCanvas:true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'© OpenStreetMap'
  }).addTo(map);

  // 2. Load tour (optional; still show map even if missing)
  let tourRaw = sessionStorage.getItem('plannedTour');
  let tour=null;
  if (tourRaw){
    try { tour = JSON.parse(tourRaw); } catch(e){ log('tourParseFail', e.message); }
  } else {
    log('noTourInSession');
  }

  // 3. Load ALL footpaths plainly first
  fetch('../data/footpaths.geojson')
    .then(r=>{
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    })
    .then(gj=>{
      log('footpathsLoaded',{featureCount:(gj.features||[]).length});

      if(!gj.features || !gj.features.length){
        log('footpathsEmpty');
      }

      // Validate & filter only LineStrings with >=2 coords
      const clean = {
        type:'FeatureCollection',
        features:(gj.features||[]).filter(f =>
          f && f.geometry && f.geometry.type==='LineString' &&
          Array.isArray(f.geometry.coordinates) &&
          f.geometry.coordinates.length >= 2
        )
      };
      log('footpathsUsable',{usable:clean.features.length});

      const allLayer = L.geoJSON(clean,{
        style:()=>({ color:'#2d6a4f', weight:5, opacity:0.55 })
      }).addTo(map);

      // Optional: outline effect (draw thin dark on top)
      L.geoJSON(clean,{
        style:()=>({ color:'#0b3823', weight:2, opacity:0.9 })
      }).addTo(map);

      // Fit to network
      if (clean.features.length){
        const b = allLayer.getBounds();
        if (b.isValid()) map.fitBounds(b.pad(0.08));
      }

      // Keep markers only (new helper)
      if (tour && tour.order && tour.nodes){
        addTourMarkers(tour);
        buildGraphRoute(gj, tour); // network route only
      } else {
        log('noTourRoute');
      }
    })
    .catch(e=>{
      log('footpathsError', e.message);
      // Fallback center
      map.setView([52.7285,-1.7295],16);
    });

  // filepath: c:\Users\james\Documents\NMA APP\memorials-app\js\tour-map.js
  // --- Add (near top) helper refs if not present ---
  let offPathGroup = null;

  // Replace existing addTourMarkers with this (adds circle markers + labels)
  function addTourMarkers(t){
    if (!window.L) return;
    t.order.forEach((idx,i)=>{
      const n = t.nodes[idx];
      if(!n) return;
      const marker = L.circleMarker([n.lat,n.lng], {
        radius:6,
        color:'#ff8800',
        weight:2,
        fillColor:'#fff',
        fillOpacity:1
      }).addTo(map);
      marker.bindTooltip(`${i+1}. ${escapeHtml(n.name)}`, {
        permanent:true,
        direction:'top',
        offset:[0,-10],
        className:'memorial-label'
      }).openTooltip();
    });
    log('markersPlotted',{count:t.order.length});
  }

  // Replace existing buildGraphRoute function entirely with this:
  function buildGraphRoute(geojson, t){
    if (!window.footpathGraph){ log('noGraphBuilder'); return; }
    offPathGroup = L.layerGroup().addTo(map); // holds dashed stubs

    footpathGraph.buildFootpathGraph('../data/footpaths.geojson')
      .then(g=>{
        log('graphReady',{
          nodes:g.nodes.length,
          segs:g.segs.length,
          tol:g.debug.tolerance,
          addedLinks:g.debug.addedLinks,
          bridges:g.debug.componentBridges,
          finalComps:g.debug.finalComponents
        });

        const fullRoute = []; // final polyline points ON or ALONG network (excluding off-path stubs)
        const netColor = '#ff8800';

        for (let leg=0; leg < t.order.length-1; leg++){
          const A = t.nodes[t.order[leg]];
          const B = t.nodes[t.order[leg+1]];
          if(!A || !B) continue;

          const sa = g.snapPoint(A.lat, A.lng);
          const sb = g.snapPoint(B.lat, B.lng);

          // If first point of entire route, start at memorial A
          if (leg === 0) {
            pushIfNew(fullRoute, [A.lat, A.lng]);
          }

          // Off-path stub from memorial A to projection (if projection exists & > threshold)
          if (sa && sa.distance > 0.5){
            addOffPathStub([A.lat,A.lng],[sa.lat,sa.lng], 'A->path', leg);
            pushIfNew(fullRoute, [sa.lat, sa.lng]);
          } else if (sa) {
            // Projection is basically at memorial; ensure projection in route
            pushIfNew(fullRoute, [sa.lat, sa.lng]);
          }

          let addedNetwork = false;

          if (sa && sb) {
            // Try all endpoint combos to find network path
            const segAEnds = [
              { id:sa.seg.a, extra: sa.t * sa.seg.w, aLat:sa.seg.alat, aLng:sa.seg.alng },
              { id:sa.seg.b, extra:(1-sa.t)*sa.seg.w, aLat:sa.seg.blat, aLng:sa.seg.blng }
            ];
            const segBEnds = [
              { id:sb.seg.a, extra: sb.t * sb.seg.w, bLat:sb.seg.alat, bLng:sb.seg.alng },
              { id:sb.seg.b, extra:(1-sb.t)*sb.seg.w, bLat:sb.seg.blat, bLng:sb.seg.blng }
            ];
            let best=null;
              for(const ea of segAEnds){
                for(const eb of segBEnds){
                  const sp = g.shortestPath(ea.id, eb.id);
                  if(!sp) continue;
                  const total = sa.distance + ea.extra + sp.distance + eb.extra + sb.distance;
                  if(!best || total < best.total){
                    best = { ea, eb, sp, total };
                  }
                }
              }

            if (best){
              // Add partial segment from projection to chosen start endpoint
              // (straight line – acceptable because underlying segment is straight between nodes)
              const startEndLat = (best.ea.id === sa.seg.a) ? sa.seg.alat : sa.seg.blat;
              const startEndLng = (best.ea.id === sa.seg.a) ? sa.seg.alng : sa.seg.blng;
              pushIfNew(fullRoute, [startEndLat,startEndLng]);

              // Interior network nodes
              if (best.sp.path.length > 2){
                for(let k=1;k<best.sp.path.length-1;k++){
                  const nd = g.nodes[best.sp.path[k]];
                  pushIfNew(fullRoute, [nd.lat, nd.lng]);
                }
              }

              // Chosen end endpoint
              const endEndLat = (best.eb.id === sb.seg.a) ? sb.seg.alat : sb.seg.blat;
              const endEndLng = (best.eb.id === sb.seg.a) ? sb.seg.alng : sb.seg.blng;
              pushIfNew(fullRoute, [endEndLat,endEndLng]);

              // Projection near B
              pushIfNew(fullRoute, [sb.lat, sb.lng]);

              addedNetwork = true;
              log('legNet', {leg, from:A.name, to:B.name, total:best.total.toFixed(1)});
            } else {
              log('legNoPath', {leg, from:A.name, to:B.name});
            }
          }

          // Off-path stub from path projection (or memorial A if no snap) to memorial B
          if (sb){
            if (sb.distance > 0.5){
              addOffPathStub([sb.lat,sb.lng],[B.lat,B.lng],'path->B', leg);
            } else {
              // Direct point basically same; fall through
            }
            pushIfNew(fullRoute, [B.lat,B.lng]);
          } else {
            // No snap for B: draw straight stub from last fullRoute point to B
            const last = fullRoute[fullRoute.length-1];
            if (!pointsEqual(last, [B.lat,B.lng])){
              addOffPathStub(last,[B.lat,B.lng],'directNoSnap', leg);
              pushIfNew(fullRoute,[B.lat,B.lng]);
            }
          }
        }

        // Draw network polyline (excluding off-path dashed stubs)
        if (fullRoute.length > 1){
          L.polyline(fullRoute, { color: netColor, weight:6, opacity:0.9 }).addTo(map);
          // Fit bounds only once (avoid jumping if already centered earlier)
          if (!map._fitted){
            map.fitBounds(L.latLngBounds(fullRoute).pad(0.15));
            map._fitted = true;
          }
          log('graphRoutePlotted',{points:fullRoute.length});
        } else {
          log('graphRouteEmpty');
        }
      })
      .catch(e=>{
        log('graphBuildError', e.message);
      });

    function addOffPathStub(a,b,label,leg){
      // Draw dashed grey stub from a -> b
      L.polyline([a,b], {
        color:'#555',
        weight:3,
        opacity:0.7,
        dashArray:'6,6'
      }).addTo(offPathGroup);
      log('stub',{leg,label, len: havLL(a,b).toFixed(1)});
    }

    function pushIfNew(arr, pt){
      const last = arr[arr.length-1];
      if (!last || !pointsEqual(last, pt)) arr.push(pt);
    }
    function pointsEqual(a,b){
      return a && b && Math.abs(a[0]-b[0])<1e-9 && Math.abs(a[1]-b[1])<1e-9;
    }
    function havLL(A,B){
      const R=6371000,toRad=x=>x*Math.PI/180;
      const dLat=toRad(B[0]-A[0]), dLng=toRad(B[1]-A[1]);
      const sa=Math.sin(dLat/2), sb=Math.sin(dLng/2);
      const h=sa*sa+Math.cos(A[0]*toRad)*Math.cos(B[0]*toRad)*sb*sb;
      return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
    }
  }

  // Helpers
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
})();