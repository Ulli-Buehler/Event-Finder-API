function renderEventCard(
  event,
  eventIndex
){

  const card =
    document.createElement("div");

  card.className = "event-card";

  card.dataset.eventIndex =
    String(eventIndex);

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

    <div
      style="
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:8px;
      "
    >

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

      ${
        event.source
        ? `
          <a
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

  eventsContainer.appendChild(card);
}