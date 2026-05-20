const CENTER = [48.616, 9.45];
const RADIUS_METERS = 50000;

const map = L.map("map").setView(CENTER, 9);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "&copy; OpenStreetMap"
  }
).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

L.circle(CENTER, {
  radius: RADIUS_METERS,
  color: "#007aff",
  fill: false,
  weight: 4
}).addTo(map);

L.circleMarker(CENTER, {
  radius: 7,
  color: "#007aff",
  fillColor: "#007aff",
  fillOpacity: 1
})
.addTo(map)
.bindPopup("Dettingen unter Teck");

const fileInput = document.getElementById("jsonFile");
const eventsContainer = document.getElementById("events");

let allEvents = [];

fileInput?.addEventListener(
  "change",
  handleFileUpload
);

function handleFileUpload(event){

  const file = event.target.files[0];

  if(!file) return;

  const reader = new FileReader();

  reader.onload = e => {

    try{

      const data = JSON.parse(e.target.result);

      allEvents = Array.isArray(data)
        ? data
        : [];

      renderEvents(allEvents);

    }
    catch(error){

      alert("JSON-Datei konnte nicht gelesen werden");
      console.error(error);
    }
  };

  reader.readAsText(file);
}

function hasCoords(event){

  return (
    typeof event.lat === "number" &&
    typeof event.lng === "number" &&
    Number.isFinite(event.lat) &&
    Number.isFinite(event.lng)
  );
}

function renderEvents(events){

  markersLayer.clearLayers();
  eventsContainer.innerHTML = "";

  if(!Array.isArray(events) || events.length === 0){

    eventsContainer.innerHTML = `
      <div class="event-card">
        <h3>Keine Events geladen</h3>
        <p>Wähle oben deine events.json aus.</p>
      </div>
    `;

    return;
  }

  const bounds = [];

  for(const event of events){

    if(hasCoords(event)){

      const marker = L.marker([
        event.lat,
        event.lng
      ]).addTo(markersLayer);

      marker.bindPopup(`
        <b>${escapeHtml(event.title || "")}</b><br>
        ${escapeHtml(event.location || "")}<br>
        ${escapeHtml(event.date || "")}
      `);

      bounds.push([
        event.lat,
        event.lng
      ]);
    }

    renderEventCard(event);
  }

  if(bounds.length > 0){

    map.fitBounds(bounds, {
      padding:[40,40]
    });

  } else {

    map.setView(CENTER, 9);

    eventsContainer.insertAdjacentHTML(
      "afterbegin",
      `
      <div class="event-card">
        <h3>Keine Koordinaten gefunden</h3>
        <p>
          Die Events wurden geladen, aber die JSON-Datei enthält keine
          <b>lat</b> und <b>lng</b> Werte. Marker können deshalb nicht zuverlässig gesetzt werden.
        </p>
      </div>
      `
    );
  }
}

function renderEventCard(event){

  const card = document.createElement("div");

  card.className = "event-card";

  const hasPoint = hasCoords(event);

  card.innerHTML = `
    <h3>${escapeHtml(event.title || "")}</h3>

    <div class="meta">
      ${escapeHtml(event.date || "")}
      ${escapeHtml(event.time || "")}
    </div>

    <div class="distance">
      ${event.distance_km ?? "?"} km
    </div>

    <p>
      ${escapeHtml(event.location || "")}
    </p>

    <p>
      ${escapeHtml(event.description || "")}
    </p>

    ${
      hasPoint
      ? `
        <p class="meta">
          Koordinaten:
          ${event.lat},
          ${event.lng}
        </p>
      `
      : `
        <p class="meta">
          Kein Kartenpunkt vorhanden
        </p>
      `
    }

    ${
      event.maps
      ? `
        <a
          href="${escapeAttribute(event.maps)}"
          target="_blank"
          rel="noopener"
        >
          Karte öffnen
        </a>
      `
      : ""
    }
  `;

  eventsContainer.appendChild(card);
}

function escapeHtml(value){

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value){

  return escapeHtml(value);
}