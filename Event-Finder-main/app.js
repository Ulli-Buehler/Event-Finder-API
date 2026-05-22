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
    hasCount
    ? (
        active
        ? 58
        : 52
      )
    : (
        active
        ? 46
        : 38
      );

  const anchorX =
    size / 2;

  const anchorY =
    size;

  const fontSize =
    hasCount
    ? (
        count >= 100
        ? 12
        : count >= 10
        ? 14
        : 16
      )
    : 11;

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -anchorY + 6],
    html: `
      <svg
        width="${size}"
        height="${size}"
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        style="
          display:block;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.55));
        "
      >
        <path
          d="M20 2C12.4 2 6.2 8.2 6.2 15.8C6.2 26.2 20 38 20 38C20 38 33.8 26.2 33.8 15.8C33.8 8.2 27.6 2 20 2Z"
          fill="${color}"
          stroke="#ffffff"
          stroke-width="2"
        />

        ${
          hasCount
          ? `
            <circle
              cx="20"
              cy="15.8"
              r="11"
              fill="#ffffff"
            />

            <text
              x="20"
              y="20.5"
              text-anchor="middle"
              font-size="${fontSize}"
              font-weight="900"
              font-family="Arial, sans-serif"
              fill="${color}"
            >
              ${count}
            </text>
          `
          : `
            <circle
              cx="20"
              cy="15.8"
              r="5.5"
              fill="#ffffff"
            />
          `
        }
      </svg>
    `
  });
}