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

L.circleMarker(CENTER, {
  radius: 8,
  color: "#008cff",
  fillColor: "#008cff",
  fillOpacity: 1,
  weight: 2
})
.addTo(map)
.bindPopup("Dettingen unter Teck");

const eventsContainer = document.getElementById("events");
const dataStatus = document.getElementById("dataStatus");
const adminStatus = document.getElementById("adminStatus");
const promptStatus = document.getElementById("promptStatus");
const jsonFileInput = document.getElementById("jsonFile");
const saveEventsBtn = document.getElementById("saveEventsBtn");
const sharePromptBtn = document.getElementById("sharePromptBtn");
const updatePromptBtn = document.getElementById("updatePromptBtn");
const promptTextarea = document.getElementById("promptText");

let events = [];
let markers = [];
let activeMarker = null;
let selectedEventsFileText = "";

window.addEventListener("load", () => {
  setTimeout(() => {
    map.invalidateSize();

    map.fitBounds(radiusCircle.getBounds(), {
      padding: [12, 12],
      animate: false
    });
  }, 250);
});

jsonFileInput.addEventListener("change", handleFileSelect);
saveEventsBtn.addEventListener("click", saveEventsForEveryone);
sharePromptBtn.addEventListener("click", sharePrompt);
updatePromptBtn.addEventListener("click", savePrompt);

loadStoredEvents();
loadPrompt();

function setStatus(element, text, type = "") {
  if (!element) return;

  element.textContent = text;
  element.className = "status";

  if (type) {
    element.classList.add(type);
  }
}

async function loadStoredEvents() {
  try {
    const response = await fetch(
      "events.json?v=" + Date.now(),
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error("events.json nicht gefunden");
    }

    const data = await response.json();

    events = Array.isArray(data)
      ? data
      : [];

    renderEvents(events);

    dataStatus.textContent =
      `${events.length} gespeicherte Events geladen.`;

  } catch (error) {
    console.error(error);

    events = [];

    renderEvents([]);

    dataStatus.textContent =
      "0 gespeicherte Events geladen.";
  }
}

async function loadPrompt() {
  try {
    const response = await fetch(
      "prompt.txt?v=" + Date.now(),
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error("prompt.txt fehlt");
    }

    promptTextarea.value = await response.text();

    setStatus(
      promptStatus,
      "Suchtext geladen.",
      "ok"
    );

  } catch (error) {
    console.error(error);

    setStatus(
      promptStatus,
      "Suchtext konnte nicht geladen werden.",
      "error"
    );
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = e => {
    try {
      selectedEventsFileText =
        String(e.target.result || "");

      const data =
        JSON.parse(selectedEventsFileText);

      events = Array.isArray(data)
        ? data
        : [];

      renderEvents(events);

      setStatus(
        adminStatus,
        `${events.length} Events geladen. Noch nicht zentral gespeichert.`,
        "ok"
      );

    } catch (error) {
      console.error(error);

      selectedEventsFileText = "";

      setStatus(
        adminStatus,
        "JSON-Datei konnte nicht gelesen werden.",
        "error"
      );
    }
  };

  reader.readAsText(file);
}

async function saveEventsForEveryone() {
  if (!selectedEventsFileText) {
    setStatus(
      adminStatus,
      "Bitte zuerst eine events.json auswählen.",
      "error"
    );

    return;
  }

  try {
    setStatus(
      adminStatus,
      "Speichere Events zentral…",
      ""
    );

    const response = await fetch(
      "/api/save-events",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: selectedEventsFileText
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Events konnten nicht gespeichert werden."
      );
    }

    setStatus(
      adminStatus,
      "Events zentral gespeichert. Seite lädt neu…",
      "ok"
    );

    setTimeout(() => {
      location.reload();
    }, 2500);

  } catch (error) {
    console.error(error);

    setStatus(
      adminStatus,
      error.message,
      "error"
    );
  }
}

async function savePrompt() {
  const text =
    promptTextarea.value || "";

  if (!text.trim()) {
    setStatus(
      promptStatus,
      "Kein Suchtext vorhanden.",
      "error"
    );

    return;
  }

  try {
    setStatus(
      promptStatus,
      "Neue Suche wird gespeichert…",
      ""
    );

    const response = await fetch(
      "/api/save-prompt",
      {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        },
        body: text
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Suchtext konnte nicht gespeichert werden."
      );
    }

    setStatus(
      promptStatus,
      "Neue Suche zentral gespeichert.",
      "ok"
    );

  } catch (error) {
    console.error(error);

    setStatus(
      promptStatus,
      error.message,
      "error"
    );
  }
}

async function sharePrompt() {
  const text =
    promptTextarea.value || "";

  if (!text.trim()) {
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
        title: "KI Eventfinder",
        text
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

  } catch (error) {
    console.error(error);

    setStatus(
      promptStatus,
      "Teilen abgebrochen.",
      ""
    );
  }
}

function clearMarkers() {
  markers.forEach(marker => {
    map.removeLayer(marker);
  });

  markers = [];

  if (activeMarker) {
    map.removeLayer(activeMarker);
    activeMarker = null;
  }
}

function renderEvents(list) {
  clearMarkers();

  eventsContainer.innerHTML = "";

  if (!Array.isArray(list) || list.length === 0) {
    eventsContainer.innerHTML = `
      <div class="event-card">
        <h3>Keine Events geladen</h3>
        <p>Öffne das Zahnrad und lade eine events.json hoch.</p>
      </div>
    `;

    map.fitBounds(radiusCircle.getBounds(), {
      padding: [12, 12],
      animate: false
    });

    return;
  }

  list.forEach((event, index) => {
    createEventCard(event, index);
    createEventMarker(event, index);
  });

  map.fitBounds(radiusCircle.getBounds(), {
    padding: [12, 12],
    animate: false
  });

  selectEvent(0, false);
}

function createEventMarker(event, index) {
  if (!hasCoords(event)) return;

  const marker = L.marker([
    event.lat,
    event.lng
  ]).addTo(map);

  marker.on("click", () => {
    scrollToEvent(index);
    selectEvent(index, false);
  });

  markers.push(marker);
}

function createEventCard(event, index) {
  const card =
    document.createElement("div");

  card.className = "event-card";

  card.innerHTML = `
    <h3>${escapeHtml(event.title || "Unbenanntes Event")}</h3>

    <div class="meta">
      ${escapeHtml(event.date || "")}
      ${event.time ? " • " + escapeHtml(event.time) : ""}
    </div>

    <div class="distance">
      ${escapeHtml(event.distance_km ?? "?")} km
    </div>

    <p>${escapeHtml(event.location || "")}</p>

    <p>${escapeHtml(event.description || "")}</p>

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
        event.source
          ? `
            <a
              class="source-link"
              href="${escapeAttribute(event.source)}"
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

  card.addEventListener("click", () => {
    selectEvent(index, false);
  });

  eventsContainer.appendChild(card);
}

function selectEvent(index, scrollCard) {
  const cards =
    document.querySelectorAll(".event-card");

  cards.forEach(card => {
    card.classList.remove("active");
  });

  if (cards[index]) {
    cards[index].classList.add("active");
  }

  const event =
    events[index];

  if (!event || !hasCoords(event)) return;

  if (activeMarker) {
    map.removeLayer(activeMarker);
  }

  activeMarker = L.circleMarker(
    [event.lat, event.lng],
    {
      radius: 13,
      color: "#ff3b30",
      fillColor: "#ff3b30",
      fillOpacity: 1,
      weight: 3
    }
  ).addTo(map);

  if (scrollCard) {
    scrollToEvent(index);
  }
}

function scrollToEvent(index) {
  const cards =
    document.querySelectorAll(".event-card");

  if (!cards[index]) return;

  cards[index].scrollIntoView({
    behavior: "smooth",
    inline: "center",
    block: "nearest"
  });
}

let scrollTimer = null;

eventsContainer.addEventListener(
  "scroll",
  () => {
    clearTimeout(scrollTimer);

    scrollTimer = setTimeout(() => {
      const cards =
        document.querySelectorAll(".event-card");

      let bestIndex = 0;
      let bestDistance = Infinity;

      cards.forEach((card, index) => {
        const rect =
          card.getBoundingClientRect();

        const cardCenter =
          rect.left + rect.width / 2;

        const screenCenter =
          window.innerWidth / 2;

        const distance =
          Math.abs(cardCenter - screenCenter);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      selectEvent(bestIndex, false);
    }, 120);
  },
  {
    passive: true
  }
);

function hasCoords(event) {
  return (
    typeof event.lat === "number" &&
    typeof event.lng === "number" &&
    Number.isFinite(event.lat) &&
    Number.isFinite(event.lng)
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}