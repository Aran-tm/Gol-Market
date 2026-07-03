// Cinematic "Stadium Night" backdrop: deep gradient, panning green/gold glows,
// faint grain, and floor grid lines fading into the dark.
export default function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950">
      {/* top spotlight */}
      <div className="absolute inset-0 bg-spotlight" />
      {/* roaming colored glows */}
      <div className="absolute -top-40 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-grass/20 blur-[140px] animate-glow-pan" />
      <div className="absolute bottom-[-12rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-gold/10 blur-[150px] animate-glow-pan" />
      {/* perspective pitch lines */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to top, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(to top, #000 0%, transparent 80%)",
          WebkitMaskImage: "linear-gradient(to top, #000 0%, transparent 80%)",
        }}
      />
      {/* grain */}
      <div className="absolute inset-0 bg-grain opacity-[0.15] mix-blend-overlay" />
    </div>
  );
}
