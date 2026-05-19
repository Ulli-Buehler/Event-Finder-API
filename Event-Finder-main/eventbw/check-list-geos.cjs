#!/usr/bin/env node
'use strict';

/**
 * Diagnose: Prüft, ob EventBW auf den Listen-/Kategorie-Seiten bereits Geo-Daten
 * pro Event im HTML/JS ausliefert.
 *
 * Nutzung:
 *   node eventbw/check-list-geos.cjs
 *
 * Optional:
 *   EVENT_TITLE="Gutenbergs Geopoints" node eventbw/check-list-geos.cjs
 *   EVENTBW_CHECK_URL="https://..." node eventbw/check-list-geos.cjs
 */

const TARGET_TITLE = process.env.EVENT_TITLE || 'Gutenbergs Geopoints';

const URLS = [
  process.env.EVENTBW_CHECK_URL || '',
  'https://www.veranstaltung-baden-wuerttemberg.de/kategorie/feste/?post_type=event&ort&region&von=2026-05-17&bis=2026-05-17',
  'https://www.veranstaltung-baden-wuerttemberg.de/kategorie/feste/',
  'https://www.veranstaltung-baden-wuerttemberg.de/kategorie/maerkte/',
].filter(Boolean);

const USER_AGENT =
  'Mozilla/5.0 EventBW-GeoListDiagnostic/1.0 (+https://github.com/Ulli-Buehler/Event-Finder)';

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8211;|&#8212;/g, '-')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&hellip;/g, '...');
}

function cleanText(value) {
  return decodeHtml(String(value || ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,*/*',
    },
  });

  const html = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return html;
}

function findCoordinateLikeSnippets(html) {
  const snippets = [];
  const patterns = [
    /(?:lat|latitude)["']?\s*[:=]\s*["']?-?\d{1,2}[.,]\d+[\s\S]{0,180}?(?:lng|lon|longitude)["']?\s*[:=]\s*["']?-?\d{1,3}[.,]\d+/gi,
    /(?:lng|lon|longitude)["']?\s*[:=]\s*["']?-?\d{1,3}[.,]\d+[\s\S]{0,180}?(?:lat|latitude)["']?\s*[:=]\s*["']?-?\d{1,2}[.,]\d+/gi,
    /data-(?:lat|latitude)=["']-?\d{1,2}[.,]\d+["'][\s\S]{0,180}?data-(?:lng|lon|longitude)=["']-?\d{1,3}[.,]\d+["']/gi,
    /L\.marker\s*\(\s*\[\s*-?\d{1,2}[.,]\d+\s*,\s*-?\d{1,3}[.,]\d+\s*\]/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      snippets.push({
        index: match.index,
        snippet: cleanText(html.slice(Math.max(0, match.index - 120), match.index + match[0].length + 120)),
      });
    }
  }

  return snippets.slice(0, 30);
}

function findEndpointSnippets(html) {
  const snippets = [];
  const patterns = [
    /wp-admin\/admin-ajax\.php[^"' <)]*/gi,
    /\/wp-json\/[^"' <)]*/gi,
    /ajaxurl\s*=\s*["'][^"']+["']/gi,
    /rest_url[^"' <)]*/gi,
    /map[^"' <)]*(?:json|ajax|api)[^"' <)]*/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      snippets.push(cleanText(html.slice(Math.max(0, match.index - 160), match.index + match[0].length + 220)));
    }
  }

  return [...new Set(snippets)].slice(0, 30);
}

function findTitleContext(html, title) {
  const normalizedHtml = normalizeText(html);
  const normalizedTitle = normalizeText(title);
  const index = normalizedHtml.indexOf(normalizedTitle);

  if (index < 0) {
    return null;
  }

  // Approximate because normalized index is not exact raw index.
  const rawIndex =
    html.toLowerCase().indexOf(title.toLowerCase()) >= 0
      ? html.toLowerCase().indexOf(title.toLowerCase())
      : Math.max(0, index);

  const window = html.slice(Math.max(0, rawIndex - 3500), rawIndex + 6500);
  const coordinateSnippets = findCoordinateLikeSnippets(window);

  return {
    rawIndex,
    textPreview: cleanText(window).slice(0, 1800),
    coordinateSnippets,
  };
}

async function run() {
  console.log('EventBW Listen-Geo Diagnose');
  console.log('Target title:', TARGET_TITLE);
  console.log('');

  for (const url of URLS) {
    console.log('='.repeat(90));
    console.log('URL:', url);

    try {
      const html = await fetchHtml(url);
      console.log('HTML length:', html.length);

      const titleContext = findTitleContext(html, TARGET_TITLE);
      console.log('Title found:', Boolean(titleContext));

      const globalCoordinateSnippets = findCoordinateLikeSnippets(html);
      console.log('Global coordinate-like snippets:', globalCoordinateSnippets.length);

      if (globalCoordinateSnippets.length) {
        console.log('');
        console.log('Global coordinate snippets:');
        globalCoordinateSnippets.slice(0, 8).forEach((item, index) => {
          console.log(`  ${index + 1}.`, item.snippet);
        });
      }

      if (titleContext) {
        console.log('');
        console.log('Title context preview:');
        console.log(titleContext.textPreview);

        console.log('');
        console.log('Coordinate snippets near title:', titleContext.coordinateSnippets.length);

        titleContext.coordinateSnippets.slice(0, 8).forEach((item, index) => {
          console.log(`  ${index + 1}.`, item.snippet);
        });
      }

      const endpointSnippets = findEndpointSnippets(html);
      console.log('');
      console.log('Possible map/ajax endpoint snippets:', endpointSnippets.length);

      endpointSnippets.slice(0, 10).forEach((snippet, index) => {
        console.log(`  ${index + 1}.`, snippet);
      });
    } catch (error) {
      console.log('FAILED:', String(error.message || error));
    }

    console.log('');
  }

  console.log('Fazit lesen:');
  console.log('- Wenn "Coordinate snippets near title" > 0 ist, können wir Listenseiten-Geo direkt importieren.');
  console.log('- Wenn nur "Global coordinate-like snippets" > 0 ist, müssen wir prüfen, wie Marker Event-IDs zugeordnet sind.');
  console.log('- Wenn nur Endpoint-Snippets auftauchen, kommen Geos vermutlich per AJAX/API und wir müssen diesen Endpoint nachbauen.');
  console.log('- Wenn nichts auftaucht, sind Geos wahrscheinlich nur auf Detailseiten oder serverseitig versteckt.');
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
