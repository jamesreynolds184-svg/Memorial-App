// filepath: c:\Users\james\Documents\NMA APP\memorials-app\js\geo-utils.js
// Remove ES module exports; attach to window for compatibility
(function(){
  function haversineMeters(a, b){
    const R=6371000;
    const toRad = d=>d*Math.PI/180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sa = Math.sin(dLat/2), sb = Math.sin(dLng/2);
    const h = sa*sa + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*sb*sb;
    return 2*R*Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  }
  function formatDistance(m){
    if (m < 950) return m.toFixed(0)+' m';
    return (m/1000).toFixed(2)+' km';
  }
  window.geoUtils = { haversineMeters, formatDistance };
})();
