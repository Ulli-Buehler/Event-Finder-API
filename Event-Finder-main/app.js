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

  const file = event.target.files[0