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
}).addTo(map);

map.fitBounds(radiusCircle.getBounds(), {
  padding: [15, 15]
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

let markers = [];
let activeMarker = null;
let uploadedFileText = "";
let events = [];

window.addEventListener("load", () => {

  setTimeout(() => {

    map.invalidateSize();

    map.fitBounds(
      radiusCircle.getBounds(),
      {
        padding: [15, 15],
        animate: false
      }
    );

  }, 300);
});

jsonFileInput.addEventListener(
  "change",
  handleFileSelection
);

saveEventsBtn.addEventListener(
  "click",
  saveEvents
);

sharePromptBtn.addEventListener(
  "click",
  sharePrompt
);

updatePromptBtn.addEventListener(
  "click",
  savePrompt
);

loadStoredEvents();
loadPrompt();

async function loadStoredEvents() {

  try {

    const response =
      await fetch(
        "events.json?v=" + Date.now(),
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "events.json nicht gefunden"
      );
    }

    const data =
      await response.json();

    events =
      Array.isArray(data)
        ? data
        : [];

    renderEvents(events);

    dataStatus.textContent =
      `${events.length} gespeicherte Events geladen.`;

  } catch (error) {

    console.error(error);

    renderEvents([]);

    dataStatus.textContent =
      "0 gespeicherte Events geladen.";
  }
}

async function loadPrompt() {

  try {

    const response =
      await fetch(
        "prompt.txt?v=" + Date.now(),
        {
          cache: "no-store"
        }
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
      "Suchtext konnte nicht geladen werden.",
      "error"
    );
  }
}

function handleFileSelection(event) {

  const file =
    event.target.files[0];

  if (!file) {
    return;
  }

  const reader =
    new FileReader();

  reader.onload = e => {

    try {

      uploadedFileText =
        String(
          e.target.result || ""
        );

      const data =
        JSON.parse(uploadedFileText);

      events =
        Array.isArray(data)
          ? data
          : [];

      renderEvents(events);

      setStatus(
        adminStatus,
        `${events.length} Events geladen.`,
        "ok"
      );

    } catch (error) {

      console.error(error);

      uploadedFileText = "";

      setStatus(
        adminStatus,
        "JSON-Datei ungültig.",
        "error"
      );
    }
  };

  reader.readAsText(file);
}

async function saveEvents() {

  if (!uploadedFileText) {

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
      "Speichere Events zentral…"
    );

    const response =
      await fetch(
        "/api/save-events",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: uploadedFileText
        }
      );

    const result =
      await response.json();

    if (!response.ok) {

      throw new Error(
        result.error ||
        "Fehler beim Speichern."
      );
    }

    setStatus(
      adminStatus,
      "Events gespeichert. Seite lädt neu…",
      "ok"
    );

    setTimeout(() => {
      location.reload();
    }, 2000);

  } catch (error) {

    console.error(error);

    setStatus(
      adminStatus,
      error.message,
      "error"
    );
  }
}

async function sharePrompt() {

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
        title: "KI Eventfinder",
        text
      });

      setStatus(
        promptStatus,
        "Teilen geöffnet.",
        "ok"
      );

    } else {

      await navigator.clipboard.writeText(
        text
      );

      setStatus(
        promptStatus,
        "Suchtext kopiert.",
        "ok"
      );
    }

  } catch (error) {

    console.error(error);
  }
}

async function savePrompt() {

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

    setStatus(
      promptStatus,
      "Speichere neue Suche…"
    );

    const response =
      await fetch(
        "/api/save-prompt",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "text/plain"
          },
          body: text
        }
      );

    const result =
      await response.json();

    if (!response.ok) {

      throw new Error(
        result.error ||
        "Fehler beim Speichern."
      );
    }

    setStatus(
      promptStatus,
      "Neue Suche gespeichert.",
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

function renderEvents(list) {

  clearMarkers();

  eventsContainer.innerHTML = "";

  if (
    !Array.isArray(list) ||
    list.length === 0
  ) {

    eventsContainer.innerHTML = `
      <div class="event-card">
        <h3>Keine Events geladen</h3>
        <p>
          Öffne das Zahnrad und lade
          eine events.json hoch.
        </p>
      </div>
    `;

    return;
  }

  list.forEach((event, index) => {

    const card =
      document.createElement("div");

    card.className =
      "event-card";

    card.innerHTML = `
      <h3>
        ${escapeHtml(
          event.title || ""
        )}
      </h3>

      <div class="meta">
        ${escapeHtml(
          event.date || ""
        )}
        ${
          event.time
            ? " • " +
              escapeHtml(event.time)
            : ""
        }
      </div>

      <div class="distance">
        ${escapeHtml(
          String(
            event.distance_km || "?"
          )
        )} km
      </div>

      <p>
        ${escapeHtml(
          event.location || ""
        )}
      </p>

      <p>
        ${escapeHtml(
          event.description || ""
        )}
      </p>

      <div class="event-actions">

        ${
          event.maps
            ? `
              <a
                href="${escapeAttribute(
                  event.maps
                )}"
                target="_blank"
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
                href="${escapeAttribute(
                  event.source
                )}"
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
        selectEvent(index);
      }
    );

    eventsContainer.appendChild(card);

    if (
      typeof event.lat ===
        "number" &&
      typeof event.lng ===
        "number"
    ) {

      const marker =
        L.marker([
          event.lat,
          event.lng
        ]).addTo(map);

      marker.on(
        "click",
        () => {
          selectEvent(index);
        }
      );

      markers.push(marker);
    }
  });

  selectEvent(0);
}

function selectEvent(index) {

  const cards =
    document.querySelectorAll(
      ".event-card"
    );

  cards.forEach(card => {
    card.classList.remove(
      "active"
    );
  });

  if (cards[index]) {

    cards[index].classList.add(
      "active"
    );

    cards[index].scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  const event =
    events[index];

  if (
    !event ||
    typeof event.lat !==
      "number" ||
    typeof event.lng !==
      "number"
  ) {
    return;
  }

  if (activeMarker) {
    map.removeLayer(
      activeMarker
    );
  }

  activeMarker =
    L.circleMarker(
      [
        event.lat,
        event.lng
      ],
      {
        radius: 12,
        color: "#ff3b30",
        fillColor: "#ff3b30",
        fillOpacity: 1,
        weight: 3
      }
    ).addTo(map);
}

function clearMarkers() {

  markers.forEach(marker => {
    map.removeLayer(marker);
  });

  markers = [];

  if (activeMarker) {

    map.removeLayer(
      activeMarker
    );

    activeMarker = null;
  }
}

function setStatus(
  element,
  text,
  type = ""
) {

  if (!element) {
    return;
  }

  element.textContent = text;
  element.className =
    "status";

  if (type) {
    element.classList.add(type);
  }
}

function escapeHtml(value) {

  return String(
    value || ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      "\"",
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function escapeAttribute(value) {
  return escapeHtml(value);
}