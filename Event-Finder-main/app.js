const CENTER = [48.616, 9.45];
const RADIUS_KM = 50;

const map = L.map("map", {
  zoomControl: true
});

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "&copy; OpenStreetMap"
  }
).addTo(map);

const radiusCircle = L.circle(CENTER, {
  radius: RADIUS_KM * 1000,
  color: "#008cff",
  weight: 4,
  fillOpacity: 0
}).addTo(map);

const homeMarker = L.circleMarker(CENTER, {
  radius: 10,
  color: "#008cff",
  fillColor: "#008cff",
  fillOpacity: 1,
  weight: 2
}).addTo(map);

map.fitBounds(radiusCircle.getBounds(), {
  padding: [20, 20]
});

const eventsContainer =
  document.getElementById("events");

const dataStatus =
  document.getElementById("dataStatus");

const adminStatus =
  document.getElementById("adminStatus");

const promptStatus =
  document.getElementById("promptStatus");

const jsonFileInput =
  document.getElementById("jsonFile");

const saveEventsBtn =
  document.getElementById("saveEventsBtn");

const sharePromptBtn =
  document.getElementById("sharePromptBtn");

const updatePromptBtn =
  document.getElementById("updatePromptBtn");

const promptTextarea =
  document.getElementById("promptText");

let uploadedEvents = [];
let mapMarkers = [];
let activeMarker = null;

function setStatus(
  element,
  text,
  type = ""
) {

  element.textContent = text;
  element.className = "status";

  if (type) {
    element.classList.add(type);
  }
}

function clearMarkers() {

  mapMarkers.forEach(marker => {
    map.removeLayer(marker);
  });

  mapMarkers = [];

  if (activeMarker) {
    map.removeLayer(activeMarker);
    activeMarker = null;
  }
}

function createMarker(event, index) {

  if (
    typeof event.lat !== "number" ||
    typeof event.lng !== "number"
  ) {
    return null;
  }

  const marker = L.marker([
    event.lat,
    event.lng
  ]).addTo(map);

  marker.on("click", () => {

    scrollToCard(index);
    highlightEvent(index);
  });

  return marker;
}

function createActiveMarker(event) {

  if (
    typeof event.lat !== "number" ||
    typeof event.lng !== "number"
  ) {
    return;
  }

  if (activeMarker) {
    map.removeLayer(activeMarker);
  }

  activeMarker = L.circleMarker(
    [event.lat, event.lng],
    {
      radius: 12,
      color: "#ff3b30",
      fillColor: "#ff3b30",
      fillOpacity: 1,
      weight: 3
    }
  ).addTo(map);
}

function scrollToCard(index) {

  const cards =
    document.querySelectorAll(".event-card");

  if (!cards[index]) {
    return;
  }

  cards[index].scrollIntoView({
    behavior: "smooth",
    inline: "center"
  });
}

function highlightEvent(index) {

  const cards =
    document.querySelectorAll(".event-card");

  cards.forEach(card => {
    card.classList.remove("active");
  });

  if (cards[index]) {
    cards[index].classList.add("active");
  }

  const event =
    uploadedEvents[index];

  if (event) {
    createActiveMarker(event);
  }
}

function renderEvents(events) {

  clearMarkers();

  uploadedEvents = events || [];

  eventsContainer.innerHTML = "";

  if (!uploadedEvents.length) {

    eventsContainer.innerHTML = `
      <div class="event-card">
        <h3>Keine Events geladen</h3>
        <p>
          Öffne das Zahnrad und lade
          eine events.json hoch.
        </p>
      </div>
    `;

    dataStatus.textContent =
      "0 gespeicherte Events geladen.";

    return;
  }

  dataStatus.textContent =
    `${uploadedEvents.length} gespeicherte Events geladen.`;

  uploadedEvents.forEach((event, index) => {

    const card =
      document.createElement("div");

    card.className = "event-card";

    card.innerHTML = `
      <h3>
        ${event.title || "Unbenanntes Event"}
      </h3>

      <div class="meta">
        ${event.date || ""}
        ${event.time ? " • " + event.time : ""}
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

      <div class="event-actions">

        ${
          event.link
            ? `
              <a
                href="${event.link}"
                target="_blank"
              >
                Event öffnen
              </a>
            `
            : ""
        }

        ${
          event.source
            ? `
              <a
                class="source-link"
                href="${event.source}"
                target="_blank"
              >
                Quelle
              </a>
            `
            : ""
        }

      </div>
    `;

    card.addEventListener(
      "click",
      () => {
        highlightEvent(index);
      }
    );

    eventsContainer.appendChild(card);

    const marker =
      createMarker(event, index);

    if (marker) {
      mapMarkers.push(marker);
    }
  });

  highlightEvent(0);

  eventsContainer.addEventListener(
    "scroll",
    handleCardScroll,
    { passive: true }
  );
}

function handleCardScroll() {

  const cards =
    document.querySelectorAll(".event-card");

  let bestIndex = 0;
  let bestDistance = Infinity;

  cards.forEach((card, index) => {

    const rect =
      card.getBoundingClientRect();

    const center =
      rect.left + rect.width / 2;

    const distance =
      Math.abs(
        center - window.innerWidth / 2
      );

    if (distance < bestDistance) {

      bestDistance = distance;
      bestIndex = index;
    }
  });

  highlightEvent(bestIndex);
}

async function loadStoredEvents() {

  try {

    const response =
      await fetch(
        "events.json?v=" + Date.now()
      );

    if (!response.ok) {
      throw new Error(
        "events.json nicht gefunden"
      );
    }

    const data =
      await response.json();

    renderEvents(data);

  } catch (error) {

    console.error(error);

    renderEvents([]);
  }
}

async function loadPrompt() {

  try {

    const response =
      await fetch(
        "prompt.txt?v=" + Date.now()
      );

    if (!response.ok) {
      throw new Error(
        "prompt.txt fehlt"
      );
    }

    const text =
      await response.text();

    promptTextarea.value = text;

    setStatus(
      promptStatus,
      "Suchtext geladen.",
      "ok"
    );

  } catch (error) {

    console.error(error);

    setStatus(
      promptStatus,
      "prompt.txt konnte nicht geladen werden.",
      "error"
    );
  }
}

saveEventsBtn.addEventListener(
  "click",
  async () => {

    const file =
      jsonFileInput.files[0];

    if (!file) {

      setStatus(
        adminStatus,
        "Bitte zuerst eine events.json auswählen.",
        "error"
      );

      return;
    }

    try {

      const text =
        await file.text();

      JSON.parse(text);

      const blob = new Blob(
        [text],
        {
          type: "application/json"
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;
      link.download = "events.json";

      document.body.appendChild(link);

      link.click();

      link.remove();

      URL.revokeObjectURL(url);

      setStatus(
        adminStatus,
        "Neue events.json gespeichert.",
        "ok"
      );

    } catch (error) {

      console.error(error);

      setStatus(
        adminStatus,
        "Ungültige JSON-Datei.",
        "error"
      );
    }
  }
);

sharePromptBtn.addEventListener(
  "click",
  async () => {

    const text =
      promptTextarea.value.trim();

    if (!text) {

      setStatus(
        promptStatus,
        "Kein Suchtext vorhanden.",
        "error"
      );

      return;
    }

    try {

      if (navigator.share) {

        await navigator.share({
          text
        });

      } else {

        await navigator.clipboard.writeText(
          text
        );

        alert("Suchtext kopiert.");
      }

    } catch (error) {

      console.error(error);
    }
  }
);

updatePromptBtn.addEventListener(
  "click",
  () => {

    const text =
      promptTextarea.value.trim();

    if (!text) {

      setStatus(
        promptStatus,
        "Kein Suchtext vorhanden.",
        "error"
      );

      return;
    }

    const blob = new Blob(
      [text],
      {
        type: "text/plain"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = "prompt.txt";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    setStatus(
      promptStatus,
      "Neue prompt.txt gespeichert.",
      "ok"
    );
  }
);

loadStoredEvents();
loadPrompt();