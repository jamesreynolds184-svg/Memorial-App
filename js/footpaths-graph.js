// IMPROVED: adds endpoint tolerance linking (+/- ~1–2 m) so small gaps between path segments are bridged.
// Also better snapping: chooses the nearer of the two segment endpoints when routing.
// Keep this whole file (replace previous) or merge the changed parts.

(function(){
  const R = 6371000;
  const toRad = x=>x*Math.PI/180;

  // Allow tolerance override via query (?tol=3) else default 2 m
  const urlTol = Number(new URL(location.href, location.origin).searchParams.get('tol'));
  const ENDPOINT_LINK_TOLERANCE_M = (urlTol>0 && urlTol<20)? urlTol : 2.0;

  function havDist(a,b){
    const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng);
    const sa=Math.sin(dLat/2), sb=Math.sin(dLng/2);
    const h=sa*sa+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*sb*sb;
    return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  }

  async function buildFootpathGraph(url){
    const gj = await fetch(url).then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); });

    const nodes=[], edges=new Map(), segs=[], nodeIndex=new Map();
    let nextId=0;
    const coordKey=(lat,lng)=>lat.toFixed(7)+','+lng.toFixed(7);
    function addNode(lat,lng){
      const k=coordKey(lat,lng);
      if (nodeIndex.has(k)) return nodeIndex.get(k);
      const id=nextId++; nodeIndex.set(k,id); nodes.push({id,lat,lng}); edges.set(id,[]);
      return id;
    }
    function addEdge(a,b,w){
      if(a===b) return;
      const A=edges.get(a), B=edges.get(b);
      if(!A||!B) return;
      if(!A.some(e=>e.to===b)) A.push({to:b,w});
      if(!B.some(e=>e.to===a)) B.push({to:a,w});
    }

    (gj.features||[]).forEach((f,i)=>{
      if(!f.geometry||f.geometry.type!=='LineString') return;
      const fid=(f.properties&& (f.properties.id||f.properties.name))||('seg'+(i+1));
      const cs=f.geometry.coordinates;
      for(let k=0;k<cs.length;k++){
        const [lng,lat]=cs[k];
        addNode(lat,lng);
        if(k){
          const [plng,plat]=cs[k-1];
          const aId=addNode(plat,plng), bId=addNode(lat,lng);
          const w=havDist({lat:plat,lng:plng},{lat,lng});
          addEdge(aId,bId,w);
          segs.push({id:fid,a:aId,b:bId,alat:plat,alng:plng,blat:lat,blng:lng,w});
        }
      }
    });

    // Endpoint linking (bridging small gaps)
    const degrees = nodes.map(n=>edges.get(n.id).length);
    const endpoints = nodes.filter((n,i)=>degrees[i]===1);
    const degPerM = 1/111320;
    const cellDeg = ENDPOINT_LINK_TOLERANCE_M * degPerM * 1.2;
    const bucket=new Map();
    const key=(lat,lng)=>Math.round(lat/cellDeg)+'|'+Math.round(lng/cellDeg);
    endpoints.forEach(n=>{
      const k=key(n.lat,n.lng);
      if(!bucket.has(k)) bucket.set(k,[]);
      bucket.get(k).push(n);
    });
    let added=0;
    const offs=[-1,0,1];
    endpoints.forEach(n=>{
      const kLat=Math.round(n.lat/cellDeg), kLng=Math.round(n.lng/cellDeg);
      offs.forEach(oy=>offs.forEach(ox=>{
        const arr=bucket.get((kLat+oy)+'|'+(kLng+ox));
        if(!arr) return;
        arr.forEach(m=>{
          if(m.id<=n.id) return;
          const d=havDist(n,m);
          if(d<=ENDPOINT_LINK_TOLERANCE_M){ addEdge(n.id,m.id,d); added++; }
        });
      }));
    });

    function projectPointOnSegment(lat,lng,seg){
      const ax=seg.alng, ay=seg.alat, bx=seg.blng, by=seg.blat;
      const px=lng, py=lat;
      const vx=bx-ax, vy=by-ay, wx=px-ax, wy=py-ay;
      const vv=vx*vx+vy*vy;
      let t=vv===0?0:(vx*wx+vy*wy)/vv;
      if(t<0)t=0; else if(t>1)t=1;
      const projLng=ax+vx*t, projLat=ay+vy*t;
      return { t, lat:projLat, lng:projLng, d:havDist({lat:projLat,lng:projLng},{lat,lng}) };
    }

    function snapPoint(lat,lng){
      let best=null, bestD=Infinity;
      for(const s of segs){
        const pr=projectPointOnSegment(lat,lng,s);
        if(pr.d<bestD){ bestD=pr.d; best={ distance:pr.d, lat:pr.lat, lng:pr.lng, t:pr.t, seg:s }; }
      }
      return best;
    }

    function shortestPath(startId,endId){
      if(startId===endId) return {distance:0,path:[startId]};
      const distMap=new Map([[startId,0]]), prev=new Map();
      const pq=[{d:0,id:startId}];
      while(pq.length){
        pq.sort((a,b)=>a.d-b.d);
        const {d,id}=pq.shift();
        if(id===endId) break;
        if(d>distMap.get(id)) continue;
        for(const e of edges.get(id)){
          const nd=d+e.w;
          if(nd < (distMap.get(e.to)??Infinity)){
            distMap.set(e.to,nd); prev.set(e.to,id); pq.push({d:nd,id:e.to});
          }
        }
      }
      if(!distMap.has(endId)) return null;
      const path=[]; let cur=endId;
      while(cur!==undefined){ path.push(cur); if(cur===startId)break; cur=prev.get(cur); }
      path.reverse();
      return { distance:distMap.get(endId), path };
    }

    function componentIds(startId){
      const seen=new Set([startId]);
      const stack=[startId];
      while(stack.length){
        const id=stack.pop();
        for(const e of edges.get(id)){
          if(!seen.has(e.to)){ seen.add(e.to); stack.push(e.to); }
        }
      }
      return seen;
    }

    function pathDistance(a,b,cache){
      const key=a.lat+','+a.lng+'|'+b.lat+','+b.lng;
      if(cache && cache.has(key)) return cache.get(key);
      const sa=snapPoint(a.lat,a.lng), sb=snapPoint(b.lat,b.lng);
      if(!sa||!sb){ const fb=havDist(a,b); cache&&cache.set(key,fb); return fb; }

      const segAEnds=[
        { id:sa.seg.a, extra: sa.t * sa.seg.w },
        { id:sa.seg.b, extra:(1-sa.t)*sa.seg.w }
      ];
      const segBEnds=[
        { id:sb.seg.a, extra: sb.t * sb.seg.w },
        { id:sb.seg.b, extra:(1-sb.t)*sb.seg.w }
      ];
      let best=Infinity;
      for(const ea of segAEnds){
        for(const eb of segBEnds){
          const sp=shortestPath(ea.id,eb.id);
          if(!sp) continue;
          const total= sa.distance + ea.extra + sp.distance + eb.extra + sb.distance;
          if(total<best) best=total;
        }
      }
      if(!Number.isFinite(best)) best=havDist(a,b);
      cache&&cache.set(key,best);
      return best;
    }

    function bearing(a,b){
      const la=toRad(a.lat), lb=toRad(b.lat), dLon=toRad(b.lng-a.lng);
      const y=Math.sin(dLon)*Math.cos(lb);
      const x=Math.cos(la)*Math.sin(lb)-Math.sin(la)*Math.cos(lb)*Math.cos(dLon);
      return (Math.atan2(y,x)*180/Math.PI+360)%360;
    }

    // --- Component bridging (auto-connect nearby disconnected components) ---
    function buildComponents(){
      const seen=new Set(), comps=[];
      for(const n of nodes){
        if(seen.has(n.id)) continue;
        const stack=[n.id], comp=[];
        seen.add(n.id);
        while(stack.length){
          const id=stack.pop();
            comp.push(id);
          for(const e of edges.get(id)){
            if(!seen.has(e.to)){ seen.add(e.to); stack.push(e.to); }
          }
        }
        comps.push(comp);
      }
      return comps;
    }

    function connectComponents(maxGap=6){
      let added=0;
      let comps = buildComponents();
      const maxIter = 20;
      let iter=0;
      while(comps.length>1 && iter<maxIter){
        iter++;
        // Find nearest pair across any two different components
        let best = { d:Infinity, a:null, b:null, ai:-1, bi:-1 };
        for(let i=0;i<comps.length;i++){
          for(let j=i+1;j<comps.length;j++){
            for(const ida of comps[i]){
              const A = nodes[ida];
              for(const idb of comps[j]){
                const B = nodes[idb];
                const d = havDist(A,B);
                if(d < best.d){
                  best = { d, a:ida, b:idb, ai:i, bi:j };
                }
              }
            }
          }
        }
        if(!best.a || best.d > maxGap) break; // no close enough pairs
        addEdge(best.a, best.b, best.d);
        added++;
        // Merge components
        const merged = comps[best.ai].concat(comps[best.bi]);
        comps = comps.filter((c,k)=>k!==best.ai && k!==best.bi);
        comps.push(merged);
      }
      return { added, finalComponents: comps.length };
    }

    const compBridge = connectComponents(6); // up to 6 m gaps
    // --- End component bridging ---

    return {
      nodes, edges, segs,
      snapPoint, shortestPath, pathDistance, bearing,
      segmentBetween:(a,b)=>segs.find(s=>(s.a===a&&s.b===b)||(s.b===a&&s.a===b)),
      debug: {
        tolerance: ENDPOINT_LINK_TOLERANCE_M,
        addedLinks: added,
        componentBridges: compBridge.added,
        finalComponents: compBridge.finalComponents,
        componentIds,
        node: id=>nodes[id],
        degrees,
        totalNodes: nodes.length,
        totalEdges: [...edges.values()].reduce((s,l)=>s+l.length,0),
      }
    };
  }

  window.footpathGraph = { buildFootpathGraph };
})();