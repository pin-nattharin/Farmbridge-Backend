const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

async function geocodeAddress(address) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    console.log("GOOGLE_MAPS_API_KEY =", apiKey);

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    console.log("Geocode URL:", url);

    const res = await fetch(url);
    const data = await res.json();
    console.log("Geocode API response:", data);

    if (!data.results.length) return null;

    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  } catch (err) {
    console.error('Geocode failed', err);
    return null;
  }
}

module.exports = { geocodeAddress };
