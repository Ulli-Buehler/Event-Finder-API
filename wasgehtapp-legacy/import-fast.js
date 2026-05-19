import { chromium } from "playwright";
import fs from "fs";

const BASE_SOURCE_URL =
  "https://www.wasgehtapp.de/index.php?geo_id=15546&ort=Dettingen%20unter%20Teck&x=9.45&y=48.6167&einwohner=5603&region=01&select_ort=1&radius=40";

const OUTPUT_TXT = "debug-output.txt";
const OUTPUT_JSON = "debug-output.json";

const FEST_MARKT_TXT = "feste-maerkte.txt";
const FEST_MARKT_JSON = "feste-maerkte.json";

const RAW_OUTPUT_TXT = "fast-raw-cards.txt";
const RAW_OUTPUT_JSON = "fast-raw-cards.json";

const FEST_MARKT_WORDS = [
  "fest",
  "feste",
  "festival",
  "stadtfest",
  "dorffest",
  "straßenfest",
  "strassenfest",
  "weinfest",
  "bierfest",
  "sommerfest",
  "frühlingsfest",
  "fruehlingsfest",
  "herbstfest",
  "jahrmarkt",
  "markt",
  "märkte",
  "maerkte",
  "flohmarkt",
  "weihnachtsmarkt",
  "kunstmarkt",
  "handwerkermarkt",
  "kreativmarkt",
  "wochenmarkt",
  "krämermarkt",
  "kraemermarkt",
  "messe"
];

const NOISE_IMAGE_PARTS = [
  "/img/external.png",
  "/img/loc.png",
  "/img/loc_extern.png",
  "/img/heart.png",
  "/img/disable.png",
  "/img/eintrittfrei.png",
  "/img/kid2.png"
];

function formatDateIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTargetSunday(baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setHours(12, 0, 0, 0);

  const day = date.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;

  date.setDate(date.getDate() + daysUntilSunday);

  return date;
}

function buildSourceUrl(targetDate) {
  const url = new URL(BASE_SOURCE_URL);
  url.searchParams.set("date", formatDateIso(targetDate));
  return url.toString();
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function normalizeOneLine(value) {
  return normalizeText(value).replace(/\s+/g, " ").trim();
}

function removeIcons(value) {
  return normalizeOneLine(value)
    .replace(/\bpin\b/gi, "")
    .replace(/\bcalendar\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDateTimeAndDistance(value) {
  return removeIcons(value)
    .replace(/^(heute|morgen|übermorgen|uebermorgen),?\s*/i, "")
    .replace(/^(Mo|Di|Mi|Do|Fr|Sa|So),\s*\d{1,2}\.\d{1,2},?\s*/i, "")
    .replace(/^\d{1,2}\s*:\s*\d{2}\s*Uhr\s*/i, "")
    .replace(/\s*,?\s*\d+(?:[,.]\d+)?\s*km\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDistanceKm(text) {
  const match = String(text || "").match(/(\d+(?:[,.]\d+)?)\s*km\b/i);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function parseTime(text) {
  const match = String(text || "").match(/\b([01]?\d|2[0-3])\s*:\s*([0-5]\d)\s*Uhr\b/i);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]} Uhr`;
}

function parseDateText(text) {
  const value = normalizeOneLine(text);

  const explicitDate = value.match(/\b(Mo|Di|Mi|Do|Fr|Sa|So),\s*(\d{1,2}\.\d{1,2})/i);
  if (explicitDate) return `${explicitDate[1]}, ${explicitDate[2]}`;

  const relativeDate = value.match(/\b(heute|morgen|übermorgen|uebermorgen)\b/i);
  if (relativeDate) return relativeDate[1];

  return "";
}

function splitCategoryTitle(text) {
  const cleaned = removeIcons(text).replace(/\s+\*$/, "").trim();
  const match = cleaned.match(/^([^:]{2,30}):\s*(.+)$/);

  if (!match) {
    return {
      category: "",
      title: cleaned
    };
  }

  return {
    category: match[1].trim(),
    title: match[2].trim()
  };
}

function parseTagsFromLine(line) {
  const cleaned = removeIcons(line);

  if (!/^tags?\s+/i.test(cleaned)) return [];

  return cleaned
    .replace(/^tags?\s+/i, "")
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
}

function isDateLine(line) {
  return /\b([01]?\d|2[0-3])\s*:\s*([0-5]\d)\s*Uhr\b/i.test(line);
}

function isPriceLine(line) {
  return /\b(ab\s*)?\d+(?:[,.]\d{2})?\s*€\b/i.test(line);
}

function isMetaLine(line) {
  const cleaned = removeIcons(line);

  if (!cleaned) return true;
  if (/^tags?\s+/i.test(cleaned)) return true;
  if (isDateLine(cleaned)) return true;
  if (isPriceLine(cleaned)) return true;

  return false;
}

function extractMainImage(images) {
  return images.find(src => {
    return !NOISE_IMAGE_PARTS.some(noise => src.includes(noise));
  }) || "";
}

function extractDetailUrl(links) {
  const link = links.find(item => item.href.includes("termin_details.php"));
  return link?.href || "";
}

function extractLocationUrl(links) {
  const link = links.find(item => item.href.includes("location.php"));
  return link?.href || "";
}

function extractExternalUrls(links) {
  return links
    .map(item => item.href)
    .filter(Boolean)
    .filter(href => !href.includes("wasgehtapp.de/termin_details.php"))
    .filter(href => !href.includes("wasgehtapp.de/location.php"))
    .filter(href => !href.includes("wasgehtapp.de/suche.php"));
}

function extractTagLinks(links) {
  return links
    .filter(item => item.href.includes("suche.php?tag="))
    .map(item => removeIcons(item.text))
    .filter(Boolean);
}

function extractLocationFromDateLine(lines) {
  const line = lines.find(isDateLine);
  if (!line) return "";

  return stripDateTimeAndDistance(line);
}

function extractTitleCategorySubtitle(lines, links) {
  const cleanedLines = lines.map(removeIcons).filter(Boolean);

  const detailLink = links.find(link => link.href.includes("termin_details.php"));
  const detailLinkText = removeIcons(detailLink?.text || "");

  const firstMeaningfulLine =
    cleanedLines.find(line => !isMetaLine(line)) || "";

  const titleSource = firstMeaningfulLine || detailLinkText;
  const { category, title } = splitCategoryTitle(titleSource);

  const subtitle = cleanedLines.find(line => {
    if (!line) return false;
    if (line === titleSource) return false;
    if (line === title) return false;
    if (line === detailLinkText) return false;
    if (isMetaLine(line)) return false;
    if (line.includes("termin_details.php")) return false;
    return true;
  }) || "";

  return {
    category,
    title,
    subtitle
  };
}

function hasKeyword(value, word) {
  return String(value || "")
    .toLowerCase()
    .includes(word.toLowerCase());
}

function isFestMarktEvent(event) {
  const haystack = [
    event.category,
    event.title,
    event.subtitle,
    event.tags.join(" "),
    event.location,
    event.rawText
  ].join(" ");

  return FEST_MARKT_WORDS.some(word => hasKeyword(haystack, word));
}

function formatEventLine(event) {
  const title = event.category ? `${event.category}: ${event.title}` : event.title;
  const dateTime = [event.dateText, event.time].filter(Boolean).join(", ");

  const parts = [
    `${String(event.index).padStart(3, "0")}. ${title || "-"}`,
    dateTime || "-",
    event.location || "-"
  ];

  if (event.distanceKm !== null) {
    parts.push(`${event.distanceKm} km`);
  }

  if (event.tags.length) {
    parts.push(`tags: ${event.tags.join(", ")}`);
  }

  return parts.join(" | ");
}

function createTextReport(title, sourceUrl, targetDateIso, events, durationSec) {
  const lines = [];

  lines.push(title);
  lines.push(`Zieldatum: ${targetDateIso}`);
  lines.push(`Quelle: ${sourceUrl}`);
  lines.push(`Events: ${events.length}`);
  lines.push(`Dauer: ${durationSec}s`);
  lines.push("");
  lines.push("========================");

  for (const event of events) {
    lines.push(formatEventLine(event));
  }

  return lines.join("\n");
}

function createRawTextReport(sourceUrl, targetDateIso, rawCards) {
  const lines = [];

  lines.push("Fast Importer Rohdaten - Wasgehtapp Übersicht V4");
  lines.push(`Zieldatum: ${targetDateIso}`);
  lines.push(`Quelle: ${sourceUrl}`);
  lines.push(`Events gefunden: ${rawCards.length}`);
  lines.push("");
  lines.push("========================");

  for (const card of rawCards) {
    lines.push("");
    lines.push(`EVENT ${String(card.index).padStart(3, "0")}`);
    lines.push("========================");

    lines.push("LINES:");
    for (const line of card.lines) {
      lines.push(`- ${line}`);
    }

    lines.push("");
    lines.push("LINKS:");
    for (const link of card.links) {
      lines.push(`- ${link.text || "(ohne Text)"} => ${link.href}`);
    }

    lines.push("");
    lines.push("IMAGES:");
    for (const image of card.images) {
      lines.push(`- ${image}`);
    }

    lines.push("");
    lines.push("RAW TEXT:");
    lines.push(card.text || "");
  }

  return lines.join("\n");
}

async function run() {
  const startedAt = Date.now();

  const targetDate = getTargetSunday();
  const targetDateIso = formatDateIso(targetDate);
  const sourceUrl = buildSourceUrl(targetDate);

  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    viewport: {
      width: 390,
      height: 844,
      isMobile: true
    }
  });

  await page.goto(sourceUrl, {
    waitUntil: "networkidle",
    timeout: 60000
  });

  await page.waitForTimeout(3000);

  const pageDateText = await page.evaluate(() => {
    const text = document.body.innerText || "";
    const match = text.match(/\b(Mo|Di|Mi|Do|Fr|Sa|So)\.,\s*\d{1,2}\.\s*[A-Za-zÄÖÜäöüß]+\s*\d{4}\b/);
    return match ? match[0] : "";
  });

  const rawCards = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".termin.inline")).map((el, index) => {
      const lines = (el.innerText || "")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

      const links = Array.from(el.querySelectorAll("a"))
        .map(a => ({
          text: (a.innerText || "").trim(),
          href: a.href || ""
        }))
        .filter(link => link.text || link.href);

      const images = Array.from(el.querySelectorAll("img"))
        .map(img => img.currentSrc || img.src || "")
        .filter(Boolean);

      return {
        index: index + 1,
        className: el.className || "",
        text: el.innerText || "",
        html: el.innerHTML || "",
        lines,
        links,
        images
      };
    });
  });

  const events = rawCards.map(card => {
    const rawText = normalizeText(card.text);
    const oneLine = normalizeOneLine(rawText);

    const { category, title, subtitle } = extractTitleCategorySubtitle(
      card.lines,
      card.links
    );

    const dateLine = card.lines.find(isDateLine) || "";
    const dateText = parseDateText(dateLine || oneLine);
    const time = parseTime(dateLine || oneLine);
    const location = extractLocationFromDateLine(card.lines);
    const distanceKm = parseDistanceKm(dateLine || oneLine);

    const lineTags = card.lines.flatMap(parseTagsFromLine);
    const linkTags = extractTagLinks(card.links);
    const tags = Array.from(new Set([...lineTags, ...linkTags]));

    return {
      index: card.index,
      category,
      title,
      subtitle,
      targetDate: targetDateIso,
      pageDateText,
      dateText,
      time,
      location,
      distanceKm,
      tags,
      imageUrl: extractMainImage(card.images),
      detailUrl: extractDetailUrl(card.links),
      locationUrl: extractLocationUrl(card.links),
      externalUrls: extractExternalUrls(card.links),
      rawText,
      rawLines: card.lines
    };
  });

  const festMarktEvents = events.filter(isFestMarktEvent);
  const durationSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  const fullReportLines = [];

  fullReportLines.push("Fast Importer - Wasgehtapp Übersicht V4");
  fullReportLines.push(`Zieldatum: ${targetDateIso}`);
  fullReportLines.push(`Seitendatum: ${pageDateText || "(nicht erkannt)"}`);
  fullReportLines.push(`Quelle: ${sourceUrl}`);
  fullReportLines.push(`Events gefunden: ${events.length}`);
  fullReportLines.push(`Feste/Märkte Treffer: ${festMarktEvents.length}`);
  fullReportLines.push(`Dauer: ${durationSec}s`);
  fullReportLines.push("");
  fullReportLines.push("Alle Treffer Feste/Märkte:");
  fullReportLines.push("========================");

  for (const event of festMarktEvents) {
    fullReportLines.push(formatEventLine(event));
  }

  fullReportLines.push("");
  fullReportLines.push("Alle importierten Events:");
  fullReportLines.push("========================");

  for (const event of events) {
    fullReportLines.push(formatEventLine(event));
  }

  fullReportLines.push("");
  fullReportLines.push("Erzeugte Dateien:");
  fullReportLines.push(`- ${OUTPUT_TXT}`);
  fullReportLines.push(`- ${OUTPUT_JSON}`);
  fullReportLines.push(`- ${FEST_MARKT_TXT}`);
  fullReportLines.push(`- ${FEST_MARKT_JSON}`);
  fullReportLines.push(`- ${RAW_OUTPUT_TXT}`);
  fullReportLines.push(`- ${RAW_OUTPUT_JSON}`);

  fs.writeFileSync(OUTPUT_TXT, fullReportLines.join("\n"), "utf8");
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(events, null, 2), "utf8");

  fs.writeFileSync(
    FEST_MARKT_TXT,
    createTextReport(
      "Feste/Märkte - Wasgehtapp Übersicht V4",
      sourceUrl,
      targetDateIso,
      festMarktEvents,
      durationSec
    ),
    "utf8"
  );
  fs.writeFileSync(FEST_MARKT_JSON, JSON.stringify(festMarktEvents, null, 2), "utf8");

  fs.writeFileSync(RAW_OUTPUT_TXT, createRawTextReport(sourceUrl, targetDateIso, rawCards), "utf8");
  fs.writeFileSync(RAW_OUTPUT_JSON, JSON.stringify(rawCards, null, 2), "utf8");

  console.log(fullReportLines.join("\n"));

  await browser.close();
}

run().catch(error => {
  console.error(error);

  fs.writeFileSync(
    OUTPUT_TXT,
    String(error.stack || error),
    "utf8"
  );

  process.exit(1);
});