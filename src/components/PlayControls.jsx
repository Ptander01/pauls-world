import { useState } from 'react'

export default function PlayControls({ isPlaying, playSpeed, onPlay, onPause, onReset, onSpeedChange }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={`play-controls ${isOpen ? 'play-controls--open' : ''}`}>

      {/* Caret tab — always visible */}
      <button
        className={`pc-toggle ${isPlaying ? 'pc-toggle--active' : ''}`}
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
        title={isOpen ? 'Collapse play controls' : 'Expand play controls'}
      >
        <span className="pc-toggle-label">Play</span>
        <svg className="pc-caret" width="10" height="6" viewBox="0 0 10 6" fill="none">
          <polyline
            points={isOpen ? '1,5 5,1 9,5' : '1,1 5,5 9,1'}
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        {isPlaying && <span className="pc-dot" aria-hidden="true" />}
      </button>

      {/* Collapsible panel */}
      <div className="pc-content">
        <div className="pc-card">

          <button className="pc-rewind" onClick={onReset} title="Rewind to start" aria-label="Reset">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <polygon points="8,2 2,8 8,14" fill="currentColor" opacity="0.85"/>
              <rect x="9" y="2" width="2.5" height="12" rx="1" fill="currentColor" opacity="0.85"/>
            </svg>
          </button>

          <button
            className={`pc-playbtn ${isPlaying ? 'pc-playbtn--playing' : ''}`}
            onClick={isPlaying ? onPause : onPlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying
              ? <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
                  <rect x="1"  y="1" width="5" height="16" rx="1.5" fill="currentColor"/>
                  <rect x="10" y="1" width="5" height="16" rx="1.5" fill="currentColor"/>
                </svg>
              : <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
                  <polygon points="2,1 14,9 2,17" fill="currentColor"/>
                </svg>
            }
          </button>

          <div className="pc-speeds">
            {[0.5, 1, 2].map(s => (
              <button
                key={s}
                className={`pc-speed ${playSpeed === s ? 'pc-speed--active' : ''}`}
                onClick={() => onSpeedChange(s)}
              >
                {s === 0.5 ? '½×' : `${s}×`}
              </button>
            ))}
          </div>

        </div>
      </div>

    </div>
  )
}
