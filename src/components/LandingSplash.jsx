// Full-viewport title card shown on load — a proper "cover" for the atlas,
// distinct from HeroBackdrop's ambient in-map cycle. Always mounted; CSS
// (opacity + pointer-events) hides it after Enter, matching the app's
// established slide/hide pattern (see BookDetailPanel).
const HERO_IMAGES = ['/hero/hero-sunrise.jpg', '/hero/hero-athens.jpg', '/hero/hero-hills.jpg']

export default function LandingSplash({ open, onEnter }) {
  return (
    <div
      className={`landing-splash${open ? '' : ' landing-splash--hidden'}`}
      aria-hidden={!open}
    >
      {HERO_IMAGES.map(src => (
        <div key={src} className="hero-layer landing-splash__layer" style={{ backgroundImage: `url(${src})` }} />
      ))}
      <div className="hero-scrim landing-splash__scrim" />

      <div className="landing-splash__card">
        <div className="landing-splash__eyebrow">An Atlas of Paul&rsquo;s Missionary Journeys</div>
        <h1 className="landing-splash__title">Paul&rsquo;s<br />World</h1>
        <p className="landing-splash__subtitle">
          The roads, the letters, and the twenty years that carried the gospel to Rome.
        </p>
        <p className="landing-splash__verse">Σαῦλε Σαῦλε, τί με διώκεις;</p>
        <button className="landing-splash__enter" onClick={onEnter}>
          <span>Enter the Atlas</span>
          <svg width="11" height="8" viewBox="0 0 11 8" aria-hidden="true">
            <path d="M1 1.5 5.5 6 10 1.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
