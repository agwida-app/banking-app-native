const GRADIENTS = [
  "from-[#f2e4da] via-[#ecd6cd] to-[#d9b7ae]",
  "from-[#efe6da] via-[#e3d3c4] to-[#c9a98f]",
  "from-[#f0e2e6] via-[#e3c7cd] to-[#c79aa5]",
  "from-[#e9ece2] via-[#d6ddc9] to-[#b7c19f]",
  "from-[#eee3f0] via-[#dcc7e0] to-[#b99ac0]",
  "from-[#f5ede0] via-[#e9d4b2] to-[#cfa96a]",
];

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function PlaceholderArt({
  seed,
  label,
  className = "",
}: {
  seed: string;
  label?: string;
  className?: string;
}) {
  const gradient = GRADIENTS[hashSeed(seed) % GRADIENTS.length];
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${gradient} ${className}`}
    >
      <svg
        className="absolute inset-0 h-full w-full opacity-20"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <circle cx="20" cy="20" r="35" fill="white" fillOpacity="0.25" />
        <circle cx="85" cy="90" r="45" fill="white" fillOpacity="0.15" />
      </svg>
      {label && (
        <span className="relative px-4 text-center font-semibold tracking-wide text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.18)]">
          {label}
        </span>
      )}
    </div>
  );
}
