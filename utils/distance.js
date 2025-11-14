// utils/distance.js
// คืนค่าระยะทางเป็นกิโลเมตร (float)
function toRad(deg) {
  return deg * Math.PI / 180;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v === undefined || v === null)) return null;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return +(R * c).toFixed(2); // two decimals
}

module.exports = { haversineDistance };
