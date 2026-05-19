import { chromium } from "playwright";
import fs from "fs";
 
const SOURCE_URL =
  "https://www.wasgehtapp.de/index.php?geo_id=15546&ort=Dettingen%20unter%20Teck&x=9.45&y=48.6167&einwohner=5603&region=01&select_ort=1&radius=40";

const MAX_EVENTS = 50;
const DETAIL_TIMEOUT_MS = 5000;
const RETRY_COUNT = 1;

const textLog = [];
const jsonEvents = [];

function log(line = "") {
  console.log(line);
  textLog.push(line);
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLocation(text) {
  return normalizeText(text)
    .replace(/^pin\s*/i, "")
    .replace(/\s*map\s*link\s*$/i, "")
    .replace(/\s*map\s*$/i, "")
    .trim();
}

function extractGeoFromUrl(url) {
  if (!url) return null;

  const decoded = decodeURIComponent(url);

  const match = decoded.match(
    /[?&]daddr=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i
  );

  if (!match) return null;

  return {
    lat: Number(match[1]),
    lng: Number(match[2])
  };
}

function geoToText(geo) {
  return geo ? `${geo.lat}, ${geo.lng}` : "";
}

async function waitForDetailChange(page, oldSnapshot) {
  await page.waitForFunction(
    previous => {
      const text = document.body.innerText || "";
      return (
        text.includes("calendar") &&
        text.includes("pin") &&
        text !== previous
      );
    },
    oldSnapshot,
    { timeout: DETAIL_TIMEOUT_MS }
  );
}

async function readActiveDetail(page) {
  return await page.evaluate(() => {
    const lines = (document.body.innerText || "")
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    const calendarIndex = lines.findIndex(line => line === "calendar");
    const pinIndex = lines.findIndex(
      (line, index) => index > calendarIndex && line === "pin"
    );

    const title = lines[calendarIndex - 1] || "";
    const date = lines[calendarIndex + 1] || "";
    const location = pinIndex >= 0 ? lines[pinIndex + 1] || "" : "";

    const mapCandidates = Array.from(document.querySelectorAll("a.map_link"))
      .map(a => a.href || "")
      .filter(Boolean);

    return {
      title,
      date,
      location,
      mapCandidates
    };
  });
}

async function tryReadEvent(page, index) {
  const cards = page.locator(".termin.inline");
  const card = cards.nth(index);

  const oldSnapshot = await page.evaluate(() => document.body.innerText || "");

  await card.click({ timeout: 10000 });

  await waitForDetailChange(page, oldSnapshot);

  const detail = await readActiveDetail(page);

  const geoCandidates = detail.mapCandidates
    .map(url => ({
      url,
      geo: extractGeoFromUrl(url)
    }))
    .filter(item => item.geo);

  const selected = geoCandidates.length
    ? geoCandidates[geoCandidates.length - 1]
    : null;

  return {
    title: normalizeText(detail.title),
    date: normalizeText(detail.date),
    location: cleanLocation(detail.location),
    geo: selected?.geo || null
  };
}

async function readEvent(page, index) {
  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    try {
      return await tryReadEvent(page, index);
    } catch (error) {
      lastError = error;

      await page.waitForTimeout(1000);

      if (attempt < RETRY_COUNT) {
        log(
          `   Retry für Event ${index + 1} (${attempt + 1}/${RETRY_COUNT})`
        );
      }
    }
  }

  throw lastError;
}

async function run() {
  const startedAt = Date.now();

  log("🔎 Debug Detail Importer V11 Retry");
  log(`Max Events: ${MAX_EVENTS}`);
  log("");

  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    viewport: {
      width: 390,
      height: 844,
      isMobile: true
    }
  });

  await page.goto(SOURCE_URL, {
    waitUntil: "networkidle",
    timeout: 60000
  });

  await page.waitForTimeout(3000);

  const count = await page.locator(".termin.inline").count();
  const total = Math.min(count, MAX_EVENTS);

  log(`Gefundene Container: ${count}`);
  log(`Teste Events: ${total}`);
  log("");

  for (let i = 0; i < total; i++) {
    const eventStartedAt = Date.now();

    try {
      const result = await readEvent(page, i);

      const durationMs = Date.now() - eventStartedAt;

      jsonEvents.push({
        index: i + 1,
        ok: true,
        title: result.title,
        date: result.date,
        location: result.location,
        geo: result.geo,
        durationMs
      });

      log(
        `${String(i + 1).padStart(2, "0")}. OK | ${result.title} | ${result.date} | ${result.location} | ${geoToText(result.geo)} | ${durationMs}ms`
      );
    } catch (error) {
      const durationMs = Date.now() - eventStartedAt;

      jsonEvents.push({
        index: i + 1,
        ok: false,
        error: error.message,
        durationMs
      });

      log(
        `${String(i + 1).padStart(2, "0")}. FEHLER | ${error.message} | ${durationMs}ms`
      );
    }
  }

  const errors = jsonEvents.filter(event => !event.ok);

  log("");
  log("========================");
  log("DEBUG SUMMARY");
  log("========================");
  log(`Events getestet: ${total}`);
  log(`Erfolgreich: ${jsonEvents.length - errors.length}`);
  log(`Fehler: ${errors.length}`);
  log(`Gesamtdauer: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  fs.writeFileSync("debug-output.txt", textLog.join("\n"), "utf8");
  fs.writeFileSync(
    "debug-output.json",
    JSON.stringify(jsonEvents, null, 2),
    "utf8"
  );

  await browser.close();
}

run().catch(error => {
  console.error(error);

  fs.writeFileSync(
    "debug-output.txt",
    String(error.stack || error),
    "utf8"
  );

  process.exit(1);
});
