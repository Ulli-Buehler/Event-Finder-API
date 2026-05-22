import fs from "fs";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const SOURCE_URL =
  "https://www.wasgehtapp.de/index.php?geo_id=15546&ort=Dettingen%20unter%20Teck&x=9.45&y=48.6167&einwohner=5603&region=01&select_ort=1&radius=40";

const OUTPUT_FILE = "./src/data/events.js";
const MISSING_GEO_FILE = "./src/data/missing-geo-events.json";

const DATA_DIR = "./src/data";

const CATEGORY_RULES = [
  { category: "Konzert", words: ["konzert", "live", "band", "musik", "jazz", "rock", "pop", "chor", "orchester"] },
  { category: "Party", words: ["party", "club", "dj", "disco", "tanzen", "dance"] },
  { category: "Bühne", words: ["theater", "bühne", "kabarett", "comedy", "show", "aufführung", "musical"] },
  { category: "Kino", words: ["kino", "film", "open air kino"] },
  { category: "Markt", words: ["markt", "flohmarkt", "weihnachtsmarkt", "verkaufsoffen"] },
  { category: "Sport", words: ["sport", "lauf", "turnier", "spiel", "wanderung", "rad"] },
  { category: "Kinder", words: ["kinder", "familie", "kids", "jugend"] },
  { category: "Vortrag", words: ["vortrag", "lesung", "führung", "kurs", "workshop", "seminar"] },
  { category: "Fest", words: ["fest", "hocketse", "straßenfest", "stadtfest", "dorffest"] }
];

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function saveEvents(events) {
  ensureDataDir();

  fs.writeFileSync(
    OUTPUT_FILE,
    `const EVENTS = ${JSON.stringify(events, null, 2)};\n`,
    "utf8"
  );
}

function saveMissingGeo(events) {
  ensureDataDir();
  fs.writeFileSync(MISSING_GEO_FILE, JSON.stringify(events, null, 2), "utf8");
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function simplifyForCompare(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(title) {
  let t = normalizeText(title);

  t = t
    .replace(/^[-–—•]+/, "")
    .replace(/^(konzert|party|bühne|theater|kino|markt|sport|kinder|vortrag|lesung|fest)\s*:\s*/i, "")
    .replace(/\s*\.\.mehr\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return t;
}

function cleanDescription(description) {
  let d = normalizeText(description);

  if (isBadTextLine(d)) return "";

  d = d
    .replace(/\s*\.\.mehr\s*$/i, "")
    .replace(/^[-–—•]+/, "")
    .trim();

  return d;
}

function isBadTextLine(text) {
  const t = simplifyForCompare(text);

  if (!t) return true;
  if (t.length < 4) return true;

  const exactBad = new Set([
    "zurück",
    "vor",
    "heute",
    "morgen",
    "nächster tag",
    "buchen",
    "link",
    "mehr",
    "key anmelden",
    "home startseite",
    "gear einstellungen",
    "search suche",
    "map karte",
    "favoriten",
    "anzeige",
    "events",
    "veranstaltungen"
  ]);

  if (exactBad.has(t)) return true;

  if (/^\(?uraufführung\)?$/i.test(normalizeText(text))) return true;
  if (/^tags\b/i.test(normalizeText(text))) return true;
  if (/\bpin\b/i.test(text)) return true;
  if (/\d{1,2}:\d{2}\s*Uhr/i.test(text)) return true;
  if (/^\d+([,.]\d+)?\s*km$/i.test(t)) return true;

  return false;
}

function isBadTitle(title) {
  const t = cleanTitle(title);
  const compare = simplifyForCompare(t);

  if (isBadTextLine(t)) return true;
  if (compare.length < 4) return true;
  if (!/[a-zäöüß]/i.test(t)) return true;

  return false;
}

function extractCategory(rawTitle, description = "") {
  const full = simplifyForCompare(`${rawTitle} ${description}`);

  const explicit = normalizeText(rawTitle).match(
    /^(konzert|party|bühne|theater|kino|markt|sport|kinder|vortrag|lesung|fest)\s*:/i
  );

  if (explicit) {
    const value = explicit[1].toLowerCase();

    if (value === "theater") return "Bühne";
    if (value === "lesung") return "Vortrag";

    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.words.some(word => full.includes(word))) {
      return rule.category;
    }
  }

  return "Sonstiges";
}

function extractLocation(line) {
  const cleaned = normalizeText(line)
    .replace(/^.*?\bpin\s+/i, "")
    .replace(/\s+favoriten.*$/i, "")
    .replace(/\s+X.*$/i, "")
    .replace(/,\s*\d+([,.]\d+)?\s*km.*$/i, "");

  const parts = cleaned
    .split(",")
    .map(part => normalizeText(part))
    .filter(Boolean);

  return {
    venue: parts[0] || "",
    city: parts.length > 1 ? parts[parts.length - 1] : ""
  };
}

function extractDate(line, fallbackDate = "") {
  const date =
    line.match(/([A-Za-zÄÖÜäöü]{2},\s*\d{2}\.\d{2}(?:\.\d{2})?)/)?.[1] ||
    line.match(/\bmorgen\b/i)?.[0] ||
    fallbackDate ||
    "";

  const time = line.match(/(\d{1,2}:\d{2})\s*Uhr/i)?.[1] || "";

  return [date, time ? `${time} Uhr` : ""].filter(Boolean).join(" · ");
}

function buildAddress(event) {
  let venue = event.venue || "";
  const city = event.city || "";

  venue = venue.replace(/\(.*?\)/g, "").trim();
  venue = venue.replace(/\s+/g, " ");

  if (venue && city) return `${venue}, ${city}, Deutschland`;
  if (city) return `${city}, Deutschland`;

  return "";
}

async function geocode(address) {
  if (!address) return { lat: null, lng: null };

  try {
    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        q: address,
        format: "json",
        limit: 1
      });

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Event-Finder/1.0"
      }
    });

    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: Number(data[0].lat),
        lng: Number(data[0].lon)
      };
    }
  } catch {
    console.log("⚠️ Geocoding Fehler:", address);
  }

  return { lat: null, lng: null };
}

function eventKey(event) {
  const title = simplifyForCompare(event.title)
    .replace(/\b(open air|live|veranstaltung)\b/g, "")
    .trim();

  const day = simplifyForCompare(event.date.split("·")[0] || event.date);
  const venue = simplifyForCompare(event.venue);
  const city = simplifyForCompare(event.city);

  return [title, day, venue, city].join("|");
}

function findPreviousContent(lines, index) {
  let title = "";
  let description = "";

  for (let j = index - 1; j >= Math.max(0, index - 8); j--) {
    const candidate = normalizeText(lines[j]);

    if (isBadTextLine(candidate)) continue;

    if (!title) {
      title = candidate;
      continue;
    }

    if (!description && simplifyForCompare(candidate) !== simplifyForCompare(title)) {
      description = candidate;
      break;
    }
  }

  return {
    title: cleanTitle(title),
    description: cleanDescription(description)
  };
}

function parseEventsFromText(text) {
  const lines = text
    .split("\n")
    .map(line => normalizeText(line))
    .filter(Boolean);

  const events = [];
  let currentSectionDate = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const sectionDate = line.match(
      /\/\s*([A-Za-zÄÖÜäöü]{2},\s*\d{2}\.\d{2}\.\d{2})/
    );

    if (sectionDate) {
      currentSectionDate = sectionDate[1];
      continue;
    }

    const isLocationLine =
      /\bpin\b/i.test(line) && /\d{1,2}:\d{2}\s*Uhr/i.test(line);

    if (!isLocationLine) continue;

    const location = extractLocation(line);
    const date = extractDate(line, currentSectionDate);

    if (!location.venue || !date) continue;

    const content = findPreviousContent(lines, i);

    if (isBadTitle(content.title)) continue;

    const category = extractCategory(content.title, content.description);

    events.push({
      title: content.title,
      category,
      city: location.city,
      venue: location.venue,
      street: "",
      zip: "",
      date,
      description: content.description,
      image: "",
      url: SOURCE_URL,
      source: SOURCE_URL
    });
  }

  const unique = [];
  const seen = new Set();

  for (const event of events) {
    const key = eventKey(event);

    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(event);
  }

  return unique;
}

async function scrapeEvents() {
  console.log("Quelle:", SOURCE_URL);

  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "Event-Finder/1.0"
    }
  });

  const html = await response.text();
  const $ = cheerio.load(html);
  const bodyText = $("body").text();

  return parseEventsFromText(bodyText);
}

async function run() {
  const scrapedEvents = await scrapeEvents();

  console.log(`${scrapedEvents.length} Events auf Quelle gefunden`);

  if (scrapedEvents.length === 0) {
    console.log("❌ Abbruch: Keine Events gefunden.");
    console.log("events.js wird NICHT überschrieben.");
    return;
  }

  const finalEvents = [];
  const missingGeoEvents = [];
  let id = 1;

  for (const event of scrapedEvents) {
    const address = buildAddress(event);
    const geo = await geocode(address);

    const finalEvent = {
      ...event,
      id: `event-${id++}`,
      address,
      lat: geo.lat,
      lng: geo.lng
    };

    if (finalEvent.lat === null || finalEvent.lng === null) {
      missingGeoEvents.push(finalEvent);
    }

    finalEvents.push(finalEvent);

    console.log(
      `${finalEvent.title} | ${finalEvent.category} | ${finalEvent.lat}, ${finalEvent.lng}`
    );

    await new Promise(resolve => setTimeout(resolve, 1100));
  }

  saveEvents(finalEvents);
  saveMissingGeo(missingGeoEvents);

  console.log(`⚠️ ${missingGeoEvents.length} Events ohne Geokoordinaten`);
  console.log(`✅ ${finalEvents.length} Events gespeichert`);
  console.log("✅ src/data/events.js korrekt als const EVENTS geschrieben");
}

run();