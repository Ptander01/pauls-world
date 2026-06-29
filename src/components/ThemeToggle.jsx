import { useState } from 'react'

export default function ThemeToggle({ theme, onToggle }) {
  const [pressed, setPressed] = useState(false)
  const isDark = theme === 'dark'

  function handleClick() {
    setPressed(true)
    setTimeout(() => {
      onToggle()
      setTimeout(() => setPressed(false), 400)
    }, 140)
  }

  return (
    <div className={`tt-wrap${isDark ? '' : ' tt-wrap--light'}`}>
      {/* Warm ambient glow (light mode only) */}
      <div className="tt-glow-wide" />
      <div className="tt-glow-mid" />
      <div className="tt-glow-core" />

      <button
        className={`tt${isDark ? '' : ' tt--light'}${pressed ? ' tt--pressed' : ''}`}
        onClick={handleClick}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {/* Track outer body */}
        <span className="tt-track">
          {/* Track inner recess */}
          <span className="tt-recess" />
          {/* Warm floor glow in light mode */}
          <span className="tt-floor-glow" />

          {/* Knob */}
          <span className="tt-knob">
            {/* Moon icon */}
            <span className={`tt-icon tt-icon--moon${isDark ? ' tt-icon--visible' : ''}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.22)" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </span>
            {/* Sun icon */}
            <span className={`tt-icon tt-icon--sun${isDark ? '' : ' tt-icon--visible'}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="rgba(100,90,75,0.25)" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            </span>
            {/* Knob specular */}
            <span className="tt-knob-spec" />
          </span>

          {/* Track rim */}
          <span className="tt-rim" />
        </span>
      </button>

      {/* Cast shadow */}
      <div className="tt-shadow" />
    </div>
  )
}
