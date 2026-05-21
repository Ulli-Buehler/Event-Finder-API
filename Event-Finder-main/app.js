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

const activeLayer = L.layerGroup().addTo(map);

L.circle(CENTER, {
  radius: RADIUS_METERS,
  color: "#007aff",
  fill: false,
  weight: 3
}).addTo(map);

L.circleMarker(CENTER, {
  radius: 6,
  color: "#007aff",
  fillColor: "#007aff",
  fillOpacity: 1
})
.addTo(map)
.bindPopup("Dettingen unter Teck");

const fileInput =
  document.getElementById("jsonFile");

const saveEventsBtn =
  document.getElementById("saveEventsBtn");

const eventsContainer =
  document.getElementById("events");

const adminStatus =
  document.getElementById("adminStatus");

const dataStatus =
  document.getElementById("dataStatus");

const promptText =
  document.getElementById("promptText");

const sharePromptBtn =
  document.getElementById("sharePromptBtn");

const updatePromptBtn =
  document.getElementById("updatePromptBtn");

const promptStatus =
  document.getElementById("promptStatus");

let allEvents = [];

let selectedEventsFileText = "";

let activeMarker = null;

fileInput?.addEventListener(
  "change",
  handleFileUpload
);

saveEventsBtn?.addEventListener(
  "click",
  saveEventsForEveryone
);

sharePromptBtn?.addEventListener(
  "click",
  sharePrompt
);

updatePromptBtn?.addEventListener(
  "click",
  savePrompt
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
        cache:"no-store"
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
        allEvents.length +
        " Events geladen. Noch nicht gespeichert.",
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

async function saveEventsForEveryone(){

  if(!selectedEventsFileText){

    setStatus(
      adminStatus,
      "Bitte zuerst eine events.json auswählen.",
      "error"
    );

    return;
  }

  try{

    setStatus(
      adminStatus,
      "Speichere Events zentral…",
      ""
    );

    const response = await fetch(
      "/api/save-events",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:selectedEventsFileText
      }
    );

    const result = await response.json();

    if(!response.ok){

      throw new Error(
        result.error ||
        "Speichern fehlgeschlagen"
      );
    }

    setStatus(
      adminStatus,
      "Events gespeichert. Seite lädt neu.",
      "ok"
    );

    setTimeout(() => {

      location.reload();

    }, 2500);

  }catch(error){

    setStatus(
      adminStatus,
      error.message,
      "error"
    );

    console.error(error);
  }
}

async function loadPrompt(){

  try{

    const response = await fetch(
      "prompt.txt?v=" + Date.now(),
      {
        cache:"no-store"
      }
    );

    if(!response.ok){

      throw new Error(
        "Noch kein prompt.txt vorhanden"
      );
    }

    promptText.value =
      await response.text();

    setStatus(
      promptStatus,
      "Suchtext geladen.",
      "ok"
    );

  }catch(error){

    promptText.value = "";

    setStatus(
      promptStatus,
      "Noch kein Suchtext gespeichert.",
      ""
    );
  }
}

async function savePrompt(){

  try{

    const text =
      promptText.value || "";

    if(!text.trim()){

      setStatus(
        promptStatus,
        "Suchtext ist leer.",
        "error"
      );

      return;
    }

    setStatus(
      promptStatus,
      "Neue Suche wird übernommen…",
      ""
    );

    const response = await fetch(
      "/api/save-prompt",
      {
        method:"POST",
        headers:{
          "Content-Type":
            "text/plain; charset=utf-8"
        },
        body:text
      }
    );

    const result = await response.json();

    if(!response.ok){

      throw new Error(
        result.error ||
        "Suchtext konnte nicht gespeichert werden"
      );
    }

    setStatus(
      promptStatus,
      "Neue Suche gespeichert.",
      "ok"
    );

  }catch(error){

    setStatus(
      promptStatus,
      error.message,
      "error"
    );

    console.error(error);
  }
}

async function sharePrompt(){

  const text =
    promptText.value || "";

  if(!text.trim()){

    setStatus(
      promptStatus,
      "Kein Suchtext vorhanden.",
      "error"
    );

    return;
  }

  try{

    if(navigator.share){

      await navigator.share({
        title:"Eventsuche",
        text:text
      });

      setStatus(
        promptStatus,
        "Teilen geöffnet.",
        "ok"
      );

      return;
    }

    await navigator.clipboard.writeText(text);

    setStatus(
      promptStatus,
      "Suchtext kopiert.",
      "ok"
    );

  }catch(error){

    setStatus(
      promptStatus,
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

function renderEvents(events){

  markersLayer.clearLayers();

  activeLayer.clearLayers();

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

  for(const event of sortedEvents){

    if(hasCoords(event)){

      const marker = L.marker([
        event.lat,
        event.lng
      ]).addTo(markersLayer);

      marker.bindPopup(`
        <b>${escapeHtml(event.title || "")}</b><br>
        ${escapeHtml(event.location || "")}
      `);

      marker.on("click", () => {

        highlightEvent(event);
      });

      bounds.push([
        event.lat,
        event.lng
      ]);

      event._marker = marker;
    }

    renderEventCard(event);
  }

  if(bounds.length > 0){

    map.fitBounds(bounds, {
      padding:[35,35]
    });

  }else{

    map.setView(CENTER, 9);
  }
}

function renderEventCard(event){

  const card =
    document.createElement("div");

  card.className = "event-card";

  card.addEventListener("click", () => {

    highlightEvent(event);

    if(hasCoords(event)){

      map.flyTo(
        [event.lat, event.lng],
        14,
        {
          duration:0.8
        }
      );

      event._marker?.openPopup();
    }
  });

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

    <div class="event-actions">

      ${
        event.maps
        ? `
          <a
            href="${escapeAttribute(event.maps)}"
            target="_blank"
            rel="noopener"
          >
            Karte
          </a>
        `
        : ""
      }

      ${
        event.url
        ? `
          <a
            class="source-link"
            href="${escapeAttribute(event.url)}"
            target="_blank"
            rel="noopener"
          >
            Quelle
          </a>
        `
        : ""
      }

    </div>
  `;

  event._card = card;

  eventsContainer.appendChild(card);
}

function highlightEvent(event){

  document
    .querySelectorAll(".event-card")
    .forEach(card => {
      card.classList.remove("active");
    });

  event._card?.classList.add("active");

  activeLayer.clearLayers();

  if(hasCoords(event)){

    activeMarker = L.circleMarker(
      [event.lat, event.lng],
      {
        radius:12,
        color:"#ff3b30",
        fillColor:"#ff3b30",
        fillOpacity:0.35,
        weight:3
      }
    ).addTo(activeLayer);
  }
}

function setStatus(
  element,
  text,
  type
){

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