/** A soft sun with a door-shaped centre: "safe way out". Decorative. */
export function SunSafeLogo({ className = "size-8" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className}>
      <g stroke="#f5a524" strokeWidth="2.4" strokeLinecap="round">
        <path d="M16 2.5v3M16 26.5v3M2.5 16h3M26.5 16h3M6.4 6.4l2.1 2.1M23.5 23.5l2.1 2.1M6.4 25.6l2.1-2.1M23.5 8.5l2.1-2.1" />
      </g>
      <circle cx="16" cy="16" r="8.5" fill="#ffd66b" />
      <path d="M13 21v-5a3 3 0 0 1 6 0v5z" fill="#1e4a55" />
    </svg>
  );
}
