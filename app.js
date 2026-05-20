const map = L.map('map').setView([48.616, 9.45], 9);

L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution: '&copy; OpenStreetMap'
  }
).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

const fileInput =
  document.getElementById("jsonFile");

const eventsContainer =
  document.getElementById("events");

let allEvents = [];

fileInput?.addEventListener(
  "change",
  handleFileUpload
);

async function loadDefaultData(){

  try{

    const response =
      await fetch("./events.json");

    if(!response.ok){
      throw new Error("Keine events.json gefunden");
    }

    const data =
      await response.json();

    allEvents = data;

    renderEvents(allEvents);

  }
  catch(error){

    console.warn(
      "Keine Standarddaten geladen:",
      error
    );
  }
}

function handleFileUpload(event){

  const file =
    event.target.files[0];

  if(!file) return;

  const reader =
    new FileReader();

  reader.onload = e => {

    try{

      const data =
        JSON.parse(e.target.result);

      allEvents = data;

      renderEvents(allEvents);

    }
    catch(error){

      alert(
        "JSON-Datei konnte nicht gelesen werden"
      );

      console.error(error);
    }
  };

  reader.readAsText(file);
}

function renderEvents(events){

  markersLayer.clearLayers();

  eventsContainer.innerHTML = "";

  if(!Array.isArray(events)) return;

  for(const event of events){

    const latlng =
      getLatLng(event);

    if(latlng){

      const marker =
        L.marker(latlng)
          .addTo(markersLayer);

      marker.bindPopup(`
        <b>${event.title || ""}</b><br>
        ${event.location || ""}<br>
        ${event.date || ""}
      `);
    }

    renderEventCard(event);
  }

  fitMap(events);
}

function getLatLng(event){

  if(
    typeof event.lat === "number" &&
    typeof event.lng === "number"
  ){
    return [event.lat, event.lng];
  }

  return null;
}

function renderEventCard(event){

  const card =
    document.createElement("div");

  card.className = "event-card";

  card.innerHTML = `
    <h3>
      ${event.title || ""}
    </h3>

    <div>
      ${event.date || ""}
      ${event.time || ""}
    </div>

    <div>
      ${event.location || ""}
    </div>

    <div>
      ${event.distance_km || "?"} km
    </div>

    <p>
      ${event.description || ""}
    </p>

    ${
      event.maps
      ? `
      <a
        href="${event.maps}"
        target="_blank"
      >
        Karte öffnen
      </a>
      `
      : ""
    }
  `;

  eventsContainer.appendChild(card);
}

function fitMap(events){

  const bounds = [];

  for(const event of events){

    if(
      typeof event.lat === "number" &&
      typeof event.lng === "number"
    ){
      bounds.push([
        event.lat,
        event.lng
      ]);
    }
  }

  if(bounds.length > 0){

    map.fitBounds(
      bounds,
      {
        padding:[40,40]
      }
    );
  }
}

loadDefaultData();