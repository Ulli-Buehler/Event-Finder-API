console.log("APP VERSION: eventbw-json-v30-clean-stats");

const EVENTBW_JSON_BASE_URL = "eventbw/feste-maerkte.json";
const EVENTBW_JSON_URL = () => EVENTBW_JSON_BASE_URL + "?v=" + Date.now();

let userPos = [48.6167, 9.45];
let radiusKm = 40;
let appEvents = [];
let importMeta = null;
let filtersOpen = false;
let activeMarker = null;
let sheetDragStartY = 0;
let sheetDragCurrentY = 0;
let sheetDragging = false;

const map = L.map("map").setView(userPos, 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

const radiusCircle = L.circle(userPos, {
  radius: radiusKm * 1000,
  color: "#007aff",
  fillColor: "#007aff",
  fillOpacity: 0.08,
  weight: 3
}).addTo(map);

const userMarker = L.circleMarker(userPos, {
  radius: 6,
  color: "#007aff",
  fillColor: "#007aff",
  fillOpacity: 1,
  weight: 2
})
.addTo(map)
.bindPopup("Dettingen unter Teck");

const cards = document.getElementById("cards");
const statusText = document.getElementById("status");
const radiusSlider = document.getElementById("radiusSlider");
const radiusLabel = document.getElementById("radiusLabel");
const lastUpdateInfo = document.getElementById("lastUpdateInfo");
const filterToggle = document.getElementById("filterToggle");
const filterPanel = document.getElementById("filterPanel");
const topPanel = document.querySelector(".top");

radiusSlider.min = 5;
radiusSlider.max = 200;
radiusSlider.value = 40;

const eventMeta = document.createElement("div");
eventMeta.className = "event-meta";
filterPanel.appendChild(eventMeta);

const markers = [];
let cardMarkers = [];

const sheet = document.createElement("div");
sheet.className = "sheet";

sheet.innerHTML = `
  <div class="sheet-drag-zone">
    <div class="sheet-handle"></div>
  </div>

  <h2 id="sheet-title"></h2>

  <div id="sheet-place"></div>

  <div id="sheet-date"></div>

  <div id="sheet-description"></div>

  <div id="sheet-geo-note" class="sheet-geo-note"></div>

  <div id="sheet-actions" class="sheet-actions">
    <a id="sheet-link" class="detail-link" href="#" target="_blank" rel="noopener">
      Details
    </a>

    <button id="navigationBtn" class="navigation-link" type="button">
      Navigation
    </button>
  </div>
`;

document.body.appendChild(sheet);

function hasCoords(event) {
  return (
    typeof event.lat === "number" &&
    typeof event.lng === "number" &&
    Number.isFinite(event.lat) &&
    Number.isFinite(event.lng)
  );
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return Math.round(
    R * 2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

function eventEmoji(event) {
  const text = (
    (event.title || "") + " " +
    (event.category || "") + " " +
    (event.city || "")
  ).toLowerCase();

  if (text.includes("markt")) return "🧺";
  if (text.includes("feste") || text.includes("fest")) return "🎪";
  if (text.includes("wein")) return "🍷";
  if (text.includes("museum")) return "🏛️";
  if (text.includes("garten")) return "🌿";

  return "📍";
}

function clearMarkers() {
  markers.forEach(marker => {
    map.removeLayer(marker);
  });

  markers.length = 0;
  cardMarkers = [];
}

function fitRadiusIntoView() {
  const zoomByRadius =
    radiusKm <= 30 ? 10 :
    radiusKm <= 55 ? 9 :
    radiusKm <= 85 ? 8 :
    radiusKm <= 140 ? 7 :
    6;

  map.setView(userPos, zoomByRadius, {
    animate: true
  });
}

function cleanTime(time) {
  if (!time) return "";

  const normalized = String(time).trim();

  if (
    normalized === "00:00 - 00:00 Uhr" ||
    normalized === "0:00 - 0:00 Uhr" ||
    normalized === "00:00 Uhr"
  ) {
    return "";
  }

  return normalized;
}

function formatEventDate(event) {
  const start = event.startDate || "";
  const end = event.endDate || "";
  const time = cleanTime(event.time);

  let date = start;

  if (end && end !== start) {
    date += " – " + end;
  }

  if (time) {
    date += " • " + time;
  }

  return date || "Datum unbekannt";
}

function formatSundayDate(value) {
  if (!value) {
    return "den aktuellen Sonntag";
  }

  const date = new Date(value + "T12:00:00");

  if (Number.isNaN(date.getTime())) {
    return "den aktuellen Sonntag";
  }

  return "Sonntag, den " + new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatUpdateTime(value) {
  if (!value) {
    return "unbekannt";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unbekannt";
  }

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function updateLastUpdateInfo() {
  const finishedAt =
    importMeta && importMeta.finishedAt
      ? importMeta.finishedAt
      : "";

  lastUpdateInfo.classList.remove("fresh", "stale");

  if (!finishedAt) {
    lastUpdateInfo.classList.add("stale");
    lastUpdateInfo.innerText =
      "⚠️ Datenstand unbekannt";
    return;
  }

  const finishedDate = new Date(finishedAt);

  if (Number.isNaN(finishedDate.getTime())) {
    lastUpdateInfo.classList.add("stale");
    lastUpdateInfo.innerText =
      "⚠️ Datenstand unbekannt";
    return;
  }

  const ageHours =
    (Date.now() - finishedDate.getTime()) / 36e5;

  if (ageHours > 18) {
    lastUpdateInfo.classList.add("stale");
    lastUpdateInfo.innerText =
      "⚠️ Daten möglicherweise veraltet: " +
      formatUpdateTime(finishedAt);
  } else {
    lastUpdateInfo.classList.add("fresh");
    lastUpdateInfo.innerText =
      "Letztes Update: " +
      formatUpdateTime(finishedAt);
  }
}

function normalizeEvent(raw, index) {
  const event = {
    id: "eventbw-" + (index + 1),
    title: raw.title || "Event",
    category: raw.category || "",
    city: raw.city || "",
    startDate: raw.startDate || "",
    endDate: raw.endDate || raw.startDate || "",
    time: cleanTime(raw.time || ""),
    detailUrl: raw.detailUrl || "",
    sourceUrl: raw.sourceUrl || "",
    page: raw.page || "",
    venue: raw.city || "",
    address: raw.city || "",
    description: "",
    geoEstimated: raw.geoEstimated === true || Boolean(raw.geoSource),
    geoSource: raw.geoSource || "",
    geoQuery: raw.geoQuery || "",
    lat: typeof raw.lat === "number" ? raw.lat : Number(raw.lat),
    lng: typeof raw.lng === "number" ? raw.lng : Number(raw.lng)
  };

  event.date = formatEventDate(event);

  return event;
}

async function fetchEventBwData() {
  const response = await fetch(EVENTBW_JSON_URL(), {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }

  return response.json();
}

async function loadEventBwEvents() {
  const data = await fetchEventBwData();

  importMeta = data.meta || null;
  appEvents = (data.events || []).map(normalizeEvent);

  updateLastUpdateInfo();
}


function openNavigation(event) {
  if (!hasCoords(event)) return;

  const lat = event.lat;
  const lng = event.lng;

  const destination =
    encodeURIComponent(lat + "," + lng);

  const wazeUrl =
    "waze://?ll=" + destination + "&navigate=yes";

  const googleUrl =
    "https://www.google.com/maps/dir/?api=1&destination=" + destination;

  const startedAt = Date.now();

  window.location.href = wazeUrl;

  setTimeout(() => {
    if (Date.now() - startedAt < 1800) {
      window.location.href = googleUrl;
    }
  }, 900);
}

function openSheet(event) {
  document.getElementById("sheet-title").innerText =
    event.title || "Event";

  document.getElementById("sheet-place").innerHTML =
    `<strong>${event.city || "Ort unbekannt"} • ${event.realDistanceText}</strong>`;

  document.getElementById("sheet-date").innerHTML =
    formatEventDate(event);

  document.getElementById("sheet-description").innerText =
    "Märkte/Feste für " + formatSundayDate(importMeta && importMeta.targetDate);

  const geoNote = document.getElementById("sheet-geo-note");

  if (!hasCoords(event)) {
    geoNote.innerText = "⚠️ Kein Kartenstandort gefunden";
    geoNote.style.display = "block";
  } else if (event.geoSource === "derived-detail") {
    geoNote.innerText = "📍 Position aus Detail-Ortsangabe berechnet";
    geoNote.style.display = "block";
  } else if (event.geoSource === "derived-title") {
    geoNote.innerText = "📍 Position aus Titel-Ortsangabe berechnet";
    geoNote.style.display = "block";
  } else if (event.geoSource === "derived-compound-city") {
    geoNote.innerText = "📍 Position aus Ortsteil berechnet";
    geoNote.style.display = "block";
  } else if (event.geoSource === "derived-region-bodensee") {
    geoNote.innerText = "📍 Grobe Position: Bodensee";
    geoNote.style.display = "block";
  } else {
    geoNote.innerText = "";
    geoNote.style.display = "none";
  }

  const sheetActions = document.getElementById("sheet-actions");
  const link = document.getElementById("sheet-link");
  const navigationBtn = document.getElementById("navigationBtn");

  if (event.detailUrl) {
    link.href = event.detailUrl;
    link.style.display = "inline-block";
  } else {
    link.href = "#";
    link.style.display = "none";
  }

  if (hasCoords(event)) {
    navigationBtn.style.display = "inline-block";
    navigationBtn.onclick = () => {
      openNavigation(event);
    };
  } else {
    navigationBtn.style.display = "none";
    navigationBtn.onclick = null;
  }

  sheetActions.style.display =
    event.detailUrl || hasCoords(event) ? "flex" : "none";

  resetSheetPosition();
  sheet.classList.add("open");
}

function closeSheet() {
  document.body.classList.remove("no-select");
  sheet.classList.remove("open");
  sheet.classList.remove("dragging");
  sheet.style.transform = "";
  sheet.style.transition = "";
}

function resetSheetPosition() {
  sheet.classList.remove("dragging");
  sheet.style.transform = "";
  sheet.style.transition = "";
}

function getPointerY(event) {
  if (event.touches && event.touches.length) {
    return event.touches[0].clientY;
  }

  if (event.changedTouches && event.changedTouches.length) {
    return event.changedTouches[0].clientY;
  }

  return event.clientY;
}

function startSheetDrag(event) {
  const interactiveTarget = event.target.closest("a, button");

  if (interactiveTarget) {
    return;
  }

  sheetDragging = true;
  document.body.classList.add("no-select");
  sheetDragStartY = getPointerY(event);
  sheetDragCurrentY = 0;

  sheet.classList.add("dragging");

  if (event.pointerId !== undefined && sheet.setPointerCapture) {
    sheet.setPointerCapture(event.pointerId);
  }
}

function moveSheetDrag(event) {
  if (!sheetDragging) return;

  const currentY = getPointerY(event);
  sheetDragCurrentY = Math.max(0, currentY - sheetDragStartY);

  sheet.style.transform =
    "translateY(" + sheetDragCurrentY + "px)";

  if (event.cancelable) {
    event.preventDefault();
  }
}

function endSheetDrag() {
  if (!sheetDragging) return;

  sheetDragging = false;
  document.body.classList.remove("no-select");

  if (sheetDragCurrentY > 90) {
    closeSheet();
    return;
  }

  resetSheetPosition();
}

sheet.addEventListener("pointerdown", startSheetDrag);
sheet.addEventListener("pointermove", moveSheetDrag);
sheet.addEventListener("pointerup", endSheetDrag);
sheet.addEventListener("pointercancel", endSheetDrag);

sheet.addEventListener("touchstart", startSheetDrag, { passive: false });
sheet.addEventListener("touchmove", moveSheetDrag, { passive: false });
sheet.addEventListener("touchend", endSheetDrag);
sheet.addEventListener("touchcancel", endSheetDrag);

function setFiltersOpen(open) {
  filtersOpen = open;

  filterPanel.classList.toggle("open", filtersOpen);
  topPanel.classList.toggle("compact", !filtersOpen);

  filterToggle.setAttribute(
    "aria-label",
    filtersOpen ? "Filter ausblenden" : "Filter anzeigen"
  );

  filterToggle.innerText =
    filtersOpen ? "Filter ausblenden" : "☰";

  setTimeout(fitRadiusIntoView, 260);
}

filterToggle.onclick = () => {
  setFiltersOpen(!filtersOpen);
};

function enrichVisibleEvent(event) {
  if (!hasCoords(event)) {
    return {
      ...event,
      hasLocation: false,
      realDistance: Number.POSITIVE_INFINITY,
      realDistanceText: "kein Geo"
    };
  }

  const dist = distanceKm(
    userPos[0],
    userPos[1],
    event.lat,
    event.lng
  );

  return {
    ...event,
    hasLocation: true,
    realDistance: dist,
    realDistanceText: dist + " km"
  };
}


function setActiveMarker(marker) {
  if (activeMarker) {
    activeMarker.setIcon(
      L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    );
    activeMarker.setZIndexOffset(0);
  }

  activeMarker = marker;

  if (activeMarker) {
    activeMarker.setIcon(
      L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [30, 49],
        iconAnchor: [15, 49],
        popupAnchor: [1, -40],
        shadowSize: [49, 49]
      })
    );
    activeMarker.setZIndexOffset(1000);
  }
}


let cardScrollSyncTimer = null;

function activeCardIndexFromScroll() {
  const cardList = [...cards.querySelectorAll(".card")];

  if (!cardList.length) {
    return -1;
  }

  const targetLeft = cards.scrollLeft;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  cardList.forEach((card, index) => {
    const distance = Math.abs(card.offsetLeft - targetLeft);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function syncActiveMarkerToScroll() {
  const index = activeCardIndexFromScroll();

  if (index >= 0 && cardMarkers[index]) {
    setActiveMarker(cardMarkers[index]);
  } else if (index >= 0) {
    setActiveMarker(null);
  }
}

function setupCardScrollSync() {
  if (cardScrollSyncTimer) {
    clearTimeout(cardScrollSyncTimer);
    cardScrollSyncTimer = null;
  }

  cards.onscroll = () => {
    if (cardScrollSyncTimer) {
      clearTimeout(cardScrollSyncTimer);
    }

    cardScrollSyncTimer = setTimeout(syncActiveMarkerToScroll, 80);
  };

  requestAnimationFrame(syncActiveMarkerToScroll);
}

function render() {
  closeSheet();

  cards.innerHTML = "";
  clearMarkers();

  radiusKm = Number(radiusSlider.value);
  radiusLabel.innerText = radiusKm + " km";

  statusText.innerText =
    "Zeigt Märkte und Feste für " +
    formatSundayDate(importMeta && importMeta.targetDate);

  radiusCircle.setLatLng(userPos);
  radiusCircle.setRadius(radiusKm * 1000);
  userMarker.setLatLng(userPos);

  fitRadiusIntoView();

  const visibleEvents = appEvents
    .map(enrichVisibleEvent)
    .filter(event => {
      if (!event.hasLocation) return true;
      return event.realDistance <= radiusKm;
    })
    .sort((a, b) => {
      if (a.hasLocation !== b.hasLocation) {
        return a.hasLocation ? -1 : 1;
      }

      if (a.hasLocation && b.hasLocation) {
        const byDistance = a.realDistance - b.realDistance;
        if (byDistance !== 0) return byDistance;
      }

      const byDate = String(a.startDate || "").localeCompare(String(b.startDate || ""));
      if (byDate !== 0) return byDate;

      return String(a.title || "").localeCompare(String(b.title || ""), "de");
    });

  const visibleWithGeo =
    visibleEvents.filter(event => event.hasLocation).length;

  const visibleWithoutGeo =
    visibleEvents.length - visibleWithGeo;

  let eventMetaText =
    appEvents.length +
    " Events gesamt · " +
    visibleEvents.length +
    " im Radius";

  if (visibleWithoutGeo) {
    eventMetaText +=
      "\nDavon " +
      visibleWithoutGeo +
      " ohne Kartenposition";
  }

  eventMeta.innerText = eventMetaText;

  visibleEvents.forEach(event => {
    let marker = null;

    if (event.hasLocation) {
      marker = L.marker([
        event.lat,
        event.lng
      ])
        .addTo(map)
        .on("click", () => {
          setActiveMarker(marker);
          openSheet(event);
        });

      markers.push(marker);
    }

    cardMarkers.push(marker);

    const card = document.createElement("div");
    card.className = event.hasLocation ? "card" : "card no-geo";

    card.onclick = () => {
      if (marker) {
        setActiveMarker(marker);
      } else {
        setActiveMarker(null);
      }

      card.scrollIntoView({
        behavior: "smooth",
        inline: "start",
        block: "nearest"
      });

      openSheet(event);
    };

    card.innerHTML = `
      <div class="card-image">
        ${eventEmoji(event)}
      </div>

      <div class="card-body">

        <h2>
          ${event.title || "Event"}
        </h2>

        <p class="card-place">
          <span class="card-city">${event.city || "Ort unbekannt"}</span>
          <span class="card-distance">${event.realDistanceText}</span>
        </p>

        <p class="card-date">
          ${formatEventDate(event)}
        </p>

      </div>
    `;

    cards.appendChild(card);
  });

  if (visibleEvents.length > 0) {
    const endSpacer = document.createElement("div");
    endSpacer.className = "cards-end-spacer";
    endSpacer.setAttribute("aria-hidden", "true");
    cards.appendChild(endSpacer);
  }

  if (markers.length > 0) {
    setActiveMarker(markers[0]);
  } else {
    setActiveMarker(null);
  }


  setupCardScrollSync();


  if (visibleEvents.length === 0) {
    cards.innerHTML = `
      <div class="card">
        <div class="card-body">
          <h2>
            Keine Events im Radius
          </h2>
        </div>
      </div>
    `;
  }
}

radiusSlider.oninput = render;

async function init() {
  try {
    setFiltersOpen(false);
    await loadEventBwEvents();
    render();
  } catch (err) {
    console.error(err);

    lastUpdateInfo.innerText =
      "Daten konnten nicht geladen werden";

    cards.innerHTML = `
      <div class="card">
        <div class="card-body">
          <h2>
            Fehler beim Laden
          </h2>
          <p>
            eventbw/feste-maerkte.json konnte nicht gelesen werden.
          </p>
        </div>
      </div>
    `;
  }
}

init();
