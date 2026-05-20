const map = L.map('map').setView([48.616, 9.45], 9);

L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution: '&copy; OpenStreetMap'
  }
).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

const center = [48.616, 9.45];

L.circle(center, {
  radius: 50000,
  color: '#007aff',
  fill:false
}).addTo(map);

L.marker(center).addTo(map);

const fileInput =
  document.getElementById("jsonFile");

const eventsContainer =
  document.getElementById("events");

let allEvents = [];

fileInput?.addEventListener(
  "change",
  handleFileUpload
);

async function handleFileUpload(event){

  const file =
    event.target.files[0];

  if(!file) return;

  const reader =
    new FileReader();

  reader.onload = async e => {

    try{

      const data =
        JSON.parse(e.target.result);

      allEvents = data;

      await enrichEvents(allEvents);

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

async function enrichEvents(events){

  for(const event of events){

    if(
      typeof event.lat === "number" &&
      typeof event.lng === "number"
    ){
      continue;
    }

    const query =
      encodeURIComponent(
        event.address ||
        event.location ||
        ""
      );

    if(!query) continue;

    try{

      const response =
        await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${query}`
        );

      const results =
        await response.json();

      if(results?.length){

        event.lat =
          parseFloat(results[0].lat);

        event.lng =
          parseFloat(results[0].lon);
      }
    }
    catch(error){

      console.warn(
        "Geocoding fehlgeschlagen:",
        event.title
      );
    }
  }
}

function renderEvents(events){

  markersLayer.clearLayers();

  eventsContainer.innerHTML = "";

  if(!Array.isArray(events)) return;

  for(const event of events){

    if(
      typeof event.lat === "number" &&
      typeof event.lng === "number"
    ){

      const marker =
        L.marker([
          event.lat,
          event.lng
        ]).addTo(markersLayer);

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

function renderEventCard(event){

  const card =
    document.createElement("div");

  card.className = "event-card";

  card.innerHTML = `
    <h3>
      ${event.title || ""}
    </h3>

    <div class="meta">
      ${event.date || ""}
      ${event.time || ""}
    </div>

    <div class="distance">
      ${event.distance_km || "?"} km
    </div>

    <p>
      ${event.location || ""}
    </p>

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

  if(bounds.length){

    map.fitBounds(
      bounds,
      {
        padding:[40,40]
      }
    );
  }
}