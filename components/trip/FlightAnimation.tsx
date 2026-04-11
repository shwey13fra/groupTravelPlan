// Path goes: bottom-left pin → curves through Create a Trip button (center) → top-right pin
// The loop happens around the button area to reinforce it as a waypoint

const PATH =
  "M 80 510 C 220 380 380 140 500 360 C 545 410 515 470 458 445 C 395 415 395 295 500 330 C 610 360 780 210 920 105";

function MapPin({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <path
        d="M0-26C-13-26-20-13-20,0C-20,13,0,30,0,30C0,30,20,13,20,0C20-13,13-26,0-26Z"
        fill="#ef4444"
      />
      <circle r="7" fill="white" />
      <ellipse cy="31" rx="6" ry="2.5" fill="rgba(0,0,0,0.18)" />
    </g>
  );
}

function Airplane() {
  return (
    // Plane faces right; rotate="auto" on animateMotion tilts it to follow the curve
    <g transform="translate(-20,-13)">
      {/* Fuselage */}
      <ellipse cx="17" cy="13" rx="20" ry="8" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
      {/* Nose */}
      <path d="M34,8 Q46,13 34,18Z" fill="#bae6fd" stroke="#7dd3fc" strokeWidth="0.8" />
      {/* Upper wing */}
      <polygon points="11,8 30,0 30,8" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" />
      {/* Lower wing */}
      <polygon points="11,18 30,26 30,18" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" />
      {/* Tail fin */}
      <polygon points="0,8 -3,1 5,8" fill="#cbd5e1" />
      <polygon points="0,18 -3,25 5,18" fill="#cbd5e1" />
      {/* Windows */}
      <circle cx="26" cy="13" r="2.5" fill="#7dd3fc" opacity="0.9" />
      <circle cx="20" cy="13" r="2.5" fill="#7dd3fc" opacity="0.9" />
      <circle cx="14" cy="13" r="2.5" fill="#7dd3fc" opacity="0.9" />
    </g>
  );
}

export function FlightAnimation() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1000 600"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Dashed flight path */}
        <path
          id="route"
          d={PATH}
          fill="none"
          stroke="#1a2332"
          strokeOpacity="0.2"
          strokeWidth="2.5"
          strokeDasharray="13 8"
          strokeLinecap="round"
        />

        {/* Waypoint dot at the button (center of page ≈ 500,360) */}
        <circle cx="500" cy="355" r="5" fill="#1a2332" fillOpacity="0.18" />

        {/* Start pin – bottom left */}
        <MapPin x={80} y={510} />

        {/* End pin – top right */}
        <MapPin x={920} y={105} />

        {/* Animated plane */}
        <g>
          <animateMotion dur="9s" repeatCount="indefinite" rotate="auto">
            <mpath href="#route" />
          </animateMotion>
          <Airplane />
        </g>
      </svg>
    </div>
  );
}
