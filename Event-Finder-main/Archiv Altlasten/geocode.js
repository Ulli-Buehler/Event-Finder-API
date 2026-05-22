import fs from "fs";

const CACHE_FILE = "./geo-cache.json";

let geoCache = {};

if (fs.existsSync(CACHE_FILE)) {
  geoCache = JSON.parse(
    fs.readFileSync(CACHE_FILE, "utf8")
  );
}

async function geocode(place) {

  if (!place) {
    return {
      lat: 48.6167,
      lng: 9.45
    };
  }

  if (geoCache[place]) {
    console.log("CACHE:", place);

    return geoCache[place];
  }

  console.log("GEOCODE:", place);

  try {

    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        q: place + ", Baden-Württemberg, Germany",
        format: "json",
        limit: 1
      });

    const res = await fetch(url, {
      headers: {
        "User-Agent": "lokalevents-app"
      }
    });

    const data = await res.json();

    if (data && data.length > 0) {

      const result = {
        lat: Number(data[0].lat),
        lng: Number(data[0].lon)
      };

      geoCache[place] = result;

      fs.writeFileSync(
        CACHE_FILE,
        JSON.stringify(geoCache, null, 2)
      );

      // WICHTIG:
      // Nominatim nicht spammen
      await new Promise(r =>
        setTimeout(r, 1200)
      );

      return result;
    }

  } catch (err) {
    console.log("GEOCODE ERROR:", place);
  }

  return {
    lat: 48.6167,
    lng: 9.45
  };
}

export default geocode;