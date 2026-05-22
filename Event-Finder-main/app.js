const CENTER = [48.616, 9.45];
const RADIUS_METERS = 50000;

const DEFAULT_MARKER_COLOR = "#007aff";
const ACTIVE_MARKER_COLOR = "#ff3b30";

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
  color: DEFAULT_MARKER_COLOR,
  fill: false,
  weight: 4
}).addTo(map);

L.circleMarker(CENTER, {
  radius: 8,
  color: DEFAULT_MARKER_COLOR,
  fillColor: DEFAULT_MARKER_COLOR,
  fillOpacity: 1,
  weight: 3
})
.addTo(map)
.bindPopup("Dettingen unter Teck");

const fileInput =
  document.getElementById("eventsFileInput");

const eventsContainer =
  document.getElementById("events");

const adminStatus =
  document.getElementById("adminStatus");

const dataStatus =
  document.getElementById("dataStatus");

const promptText =
  document.getElementById("promptText");

const sharePromptBtn =
  document.getElementById("exportPromptBtn");

const promptFileInput =
  document.getElementById("promptFileInput");

const eventMarkers = [];

let allEvents = [];

let selectedEventsFileText = "";

fileInput?.addEventListener(
  "change",
  handleFileUpload
);

promptFileInput?.addEventListener(
  "change",
  handlePromptImport
);

sharePromptBtn?.addEventListener(
  "click",
  sharePrompt
);

init();

async function init(){

  await loadSavedEvents();

  await loadPrompt();
}

async function loadSavedEvents(){

  try{

    const response = await fetch(
      "events.json?v=" + Date.now(),
      {
        cache: "no-store"
      }
    );

    if(!response.ok){

      throw new Error(
        "Keine gespeicherte events.json gefunden"
      );
    }

    const data = await response.json();

    allEvents =
      Array.isArray(data)
      ? data
      : [];

    renderEvents(allEvents);

    dataStatus.textContent =
      allEvents.length +
      " gespeicherte Events geladen.";

  }catch(error){

    console.warn(error);

    dataStatus.textContent =
      "Noch keine gespeicherten Events vorhanden.";

    renderEvents([]);
  }
}

function handleFileUpload(event){

  const file = event.target.files[0];

  if(!file) return;

  const reader = new FileReader();

  reader.onload = e => {

    try{

      selectedEventsFileText =
        String(e.target.result || "");

      const data =
        JSON.parse(selectedEventsFileText);

      allEvents =
        Array.isArray(data)
        ? data
        : [];

      renderEvents(allEvents);

      setStatus(
        adminStatus,
        "Events importiert.",
        "ok"
      );

    }catch(error){

      selectedEventsFileText = "";

      setStatus(
        adminStatus,
        "JSON-Datei konnte nicht gelesen werden.",
        "error"
      );

      console.error(error);
    }
  };

  reader.readAsText(file);
}

function handlePromptImport(event){

  const file = event.target.files[0];

  if(!file) return;

  const reader = new FileReader();

  reader.onload = e => {

    try{

      const text =
        String(e.target.result || "");

      promptText.value = text;

      setStatus(
        adminStatus,
        "Suchtext importiert.",
        "ok"
      );

    }catch(error){

      setStatus(
        adminStatus,
        "Suchtext konnte nicht importiert werden.",
        "error"
      );

      console.error(error);
    }
  };

  reader.readAsText(file);
}

async function loadPrompt(){

  try{

    const response = await fetch(
      "prompt.txt?v=" + Date.now(),
      {
        cache: "no-store"
      }
    );

    if(!response.ok){

      throw new Error(
        "Noch kein prompt.txt vorhanden"
      );
    }

    promptText.value =
      await response.text();

  }catch(error){

    promptText.value = "";
  }
}

async function sharePrompt(){

  const text =
    promptText.value || "";

  if(!text.trim()){

    setStatus(
      adminStatus,
      "Kein Suchtext vorhanden.",
      "error"
    );

    return;
  }

  try{

    if(navigator.share){

      await navigator.share({
        title: "Suchanfrage Events",
        text: text
      });

      setStatus(
        adminStatus,
        "Teilen geöffnet.",
        "ok"
      );

      return;
    }

    await navigator.clipboard.writeText(text);

    setStatus(
      adminStatus,
      "Suchtext wurde kopiert.",
      "ok"
    );

  }catch(error){

    setStatus(
      adminStatus,
      "Teilen abgebrochen.",
      ""
    );
  }
}

function hasCoords(event){

  return (
    typeof event.lat === "number" &&
    typeof event.lng === "number" &&
    Number.isFinite(event.lat) &&
    Number.isFinite(event.lng)
  );
}

function getCoordKey(event){

  return [
    Number(event.lat).toFixed(5),
    Number(event.lng).toFixed(5)
  ].join(",");
}

function renderEvents(events){

  markersLayer.clearLayers();

  eventMarkers.length = 0;

  eventsContainer.innerHTML = "";

  if(
    !Array.isArray(events) ||
    events.length === 0
  ){

    eventsContainer.innerHTML = `
      <div class="event-card">
        <h3>Keine Events geladen</h3>
      </div>
    `;

    map.setView(CENTER, 9);

    return;
  }

  const bounds = [];

  const sortedEvents =
    [...events].sort((a, b) => {

      const da =
        Number(a.distance_km ?? 9999);

      const db =
        Number(b.distance_km ?? 9999);

      return da - db;
    });

  const groups =
    createEventGroups(sortedEvents);

  const markerByKey =
    new Map();

  for(const event of sortedEvents){

    let markerIndex = null;

    if(hasCoords(event)){

      const key =
        getCoordKey(event);

      if(!markerByKey.has(key)){

        const group =
          groups.get(key);

        const marker =
          createMarker(group);

        markerIndex =
          eventMarkers.length;

        markerByKey.set(
          key,
          markerIndex
        );

        eventMarkers.push(marker);

        bounds.push([
          group.lat,
          group.lng
        ]);

      }else{

        markerIndex =
          markerByKey.get(key);
      }
    }

    renderEventCard(
      event,
      markerIndex
    );
  }

  setupVisibleCardTracking();

  if(bounds.length > 0){

    map.fitBounds(bounds, {
      padding:[40,40]
    });

  }else{

    map.setView(CENTER, 9);
  }
}

function createEventGroups(events){

  const groups =
    new Map();

  for(const event of events){

    if(!hasCoords(event)){
      continue;
    }

    const key =
      getCoordKey(event);

    if(!groups.has(key)){

      groups.set(
        key,
        {
          key: key,
          lat: event.lat,
          lng: event.lng,
          events: []
        }
      );
    }

    groups.get(key).events.push(event);
  }

  return groups;
}

function createMarker(group){

  const marker = L.marker(
    [group.lat, group.lng],
    {
      icon: createEventIcon(
        false,
        group.events.length
      )
    }
  ).addTo(markersLayer);

  marker.bindPopup(
    createMarkerPopup(group)
  );

  marker.on("click", () => {

    const index =
      eventMarkers.indexOf(marker);

    const card =
      eventsContainer.querySelector(
        `[data-marker-index="${index}"]`
      );

    if(!card){
      return;
    }

    card.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    highlightVisibleMarker(card);
  });

  return marker;
}

function createMarkerPopup(group){

  const title =
    group.events.length === 1
    ? escapeHtml(group.events[0].title || "")
    : group.events.length + " Events an diesem Ort";

  const location =
    escapeHtml(
      group.events[0]?.location || ""
    );

  const list =
    group.events
      .slice(0, 5)
      .map(event => {
        return `
          <div>
            ${escapeHtml(event.title || "")}
          </div>
        `;
      })
      .join("");

  return `
    <b>${title}</b><br>
    ${location}
    ${
      group.events.length > 1
      ? `<hr>${list}`
      : `<br>${escapeHtml(group.events[0]?.date || "")}`
    }
  `;
}

function createEventIcon(
  active,
  count
){

  const color =
    active
    ? ACTIVE_MARKER_COLOR
    : DEFAULT_MARKER_COLOR;

  const hasCount =
    Number(count) > 1;

  const size =
    active
    ? 46
    : 38;

  const anchorX =
    size / 2;

  const anchorY =
    size;

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -anchorY + 6],
    html: `
      <svg
        width="${size}"
        height="${size}"
        viewBox="0 0 38 38"
        xmlns="http://www.w3.org/2000/svg"
        style="display:block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.45));"
      >
        <path
          d="M19 2C11.8 2 6 7.8 6 15C6 24.8 19 36 19 36C19 36 32 24.8 32 15C32 7.8 26.2 2 19 2Z"
          fill="${color}"
          stroke="#ffffff"
          stroke-width="2"
        />

        ${
          hasCount
          ? `
            <circle
              cx="19"
              cy="15"
              r="9"
              fill="#ffffff"
            />

            <text
              x="19"
              y="18.5"
              text-anchor="middle"
              font-size="10"
              font-weight="800"
              font-family="Arial, sans-serif"
              fill="${color}"
            >
              ${count}
            </text>
          `
          : `
            <circle
              cx="19"
              cy="15"
              r="5"
              fill="#ffffff"
            />
          `
        }
      </svg>
    `
  });
}

function renderEventCard(
  event,
  markerIndex
){

  const card =
    document.createElement("div");

  card.className = "event-card";

  if(markerIndex !== null){

    card.dataset.markerIndex =
      String(markerIndex);
  }

  const hasPoint =
    hasCoords(event);

  card.innerHTML = `
    <h3>
      ${escapeHtml(event.title || "")}
    </h3>

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

function setupVisibleCardTracking(){

  const cards =
    eventsContainer.querySelectorAll(".event-card");

  const observer =
    new IntersectionObserver(
      entries => {

        let bestEntry = null;

        for(const entry of entries){

          if(!entry.isIntersecting){
            continue;
          }

          if(
            !bestEntry ||
            entry.intersectionRatio >
            bestEntry.intersectionRatio
          ){
            bestEntry = entry;
          }
        }

        if(!bestEntry){
          return;
        }

        highlightVisibleMarker(
          bestEntry.target
        );
      },
      {
        root: eventsContainer,
        threshold: [0.35, 0.6, 0.9]
      }
    );

  cards.forEach(card => {
    observer.observe(card);
  });
}

function highlightVisibleMarker(card){

  const activeIndex =
    Number(card.dataset.markerIndex);

  eventMarkers.forEach(
    (marker, index) => {

      const active =
        index === activeIndex;

      const popup =
        marker.getPopup();

      const groupCount =
        getMarkerGroupCount(marker);

      marker.setIcon(
        createEventIcon(
          active,
          groupCount
        )
      );

      if(popup){
        marker.bindPopup(popup.getContent());
      }

      if(active){

        marker.setZIndexOffset(1000);
      }else{

        marker.setZIndexOffset(0);
      }
    }
  );
}

function getMarkerGroupCount(marker){

  const popup =
    marker.getPopup();

  if(!popup){
    return 1;
  }

  const content =
    popup.getContent();

  const match =
    String(content).match(
      /<b>(\d+) Events an diesem Ort<\/b>/
    );

  if(match){
    return Number(match[1]);
  }

  return 1;
}

function setStatus(
  element,
  text,
  type
){

  if(!element){
    return;
  }

  element.textContent = text;

  element.className = "status";

  if(type){

    element.classList.add(type);
  }
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