import { useMemo } from "react";

interface Star {
  id: number;
  top: string;
  left: string;
  size: number;
  opacity: number;
  animationDelay: string;
  animationDuration: string;
}

/** Seeded pseudo-random so the star field is stable across re-renders. */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const STAR_COUNT = 80;

export default function StarfieldBackground() {
  const stars = useMemo<Star[]>(() => {
    const rand = seededRandom(42);
    return Array.from({ length: STAR_COUNT }, (_, i) => ({
      id: i,
      top: `${(rand() * 100).toFixed(2)}%`,
      left: `${(rand() * 100).toFixed(2)}%`,
      // mix of tiny (1 px) and slightly larger (2 px) dots
      size: rand() > 0.85 ? 2 : 1,
      opacity: parseFloat((0.15 + rand() * 0.55).toFixed(2)),
      animationDelay: `${(rand() * 6).toFixed(2)}s`,
      animationDuration: `${(3 + rand() * 4).toFixed(2)}s`,
    }));
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={{
        // Night-sky gradient — matches body so the fixed backdrop is seamless
        backgroundImage:
          "radial-gradient(ellipse at 30% 20%, #10131F 0%, #060709 60%, #030304 100%)",
        backgroundColor: "#060709", // fallback
      }}
    >
      {/* Stars — bg-star resolves to #8A93B8 via Tailwind token */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-star animate-twinkle"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animationDelay: star.animationDelay,
            animationDuration: star.animationDuration,
          }}
        />
      ))}
    </div>
  );
}
