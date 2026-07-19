// Cinematic backdrop shown over the map while it's idle (first load, or after
// Reset) — three generated hero images crossfade in sequence via CSS only.
const HERO_IMAGES = ['/hero/hero-athens.jpg', '/hero/hero-hills.jpg', '/hero/hero-sunrise.jpg']

export default function HeroBackdrop({ active }) {
  return (
    <div className={`hero-backdrop${active ? ' hero-backdrop--active' : ''}`} aria-hidden="true">
      {HERO_IMAGES.map(src => (
        <div key={src} className="hero-layer" style={{ backgroundImage: `url(${src})` }} />
      ))}
      <div className="hero-scrim" />
    </div>
  )
}
