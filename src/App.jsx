import { useState, useEffect, useRef, useMemo } from 'react'
import MapView from './components/MapView'
import FilterPanel from './components/FilterPanel'
import TimelineBar from './components/TimelineBar'
import BookDetailPanel from './components/BookDetailPanel'
import PlayControls from './components/PlayControls'
import journeyData from './data/pauline-journeys-data.json'
import './index.css'

// Verify durationDays and churchEvents are accessible
console.group('[data] Journey duration totals')
journeyData.journeys.forEach(j => {
  const total = j.waypoints.reduce((s, w) => s + (w.durationDays || 0), 0)
  console.log(`${j.shortName}: ${total} days across ${j.waypoints.length} waypoints`)
})
console.log(`churchEvents: ${journeyData.churchEvents.length} events across ${[...new Set(journeyData.churchEvents.map(e => e.churchId))].length} churches`)
console.groupEnd()

const PLAY_START = 44
const PLAY_END   = 67

export default function App() {
  const [activeJourneys, setActiveJourneys] = useState(new Set())
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [viewMode, setViewMode]             = useState('journeys')
  const [timelineYear, setTimelineYear]     = useState(null)
  const [hoveredCityId, setHoveredCityId]   = useState(null)
  const [provincesGeo, setProvincesGeo]     = useState(null)
  const [showProvinces, setShowProvinces]   = useState(true)
  const [isPlaying, setIsPlaying]           = useState(false)
  const [playSpeed, setPlaySpeed]           = useState(1)
  const [detailJourneyId, setDetailJourneyId]       = useState(null)
  const [activeChurchTracks, setActiveChurchTracks] = useState(new Set())

  const playFrameRef           = useRef(null)
  const playStartTimeRef       = useRef(null)
  const playStartYearRef       = useRef(PLAY_START)
  const playSpeedRef           = useRef(1)
  const playEndRef             = useRef(PLAY_END)
  const detailJourneyIdRef     = useRef(null)
  const lastActivatedRef       = useRef(new Set())

  useEffect(() => { playSpeedRef.current = playSpeed }, [playSpeed])
  useEffect(() => { detailJourneyIdRef.current = detailJourneyId }, [detailJourneyId])

  useEffect(() => {
    fetch('/provinces.geojson')
      .then(r => r.json())
      .then(setProvincesGeo)
      .catch(err => console.warn('Province data unavailable:', err))
  }, [])

  const selectedBook   = useMemo(() => {
    if (!selectedBookId) return null
    return journeyData.books.find(b => b.id === selectedBookId) ?? null
  }, [selectedBookId])

  const highlightRange = selectedBook ? selectedBook.dateRange : null

  function stopFrame() {
    if (playFrameRef.current) {
      cancelAnimationFrame(playFrameRef.current)
      playFrameRef.current = null
    }
  }

  function startPlayLoop(fromYear) {
    playStartYearRef.current = fromYear
    playStartTimeRef.current = performance.now()

    function tick(now) {
      const elapsed      = now - playStartTimeRef.current
      const yearsElapsed = (elapsed / 1000) * playSpeedRef.current / 1.5
      const newYear      = Math.min(playStartYearRef.current + yearsElapsed, playEndRef.current)

      setTimelineYear(newYear)

      // Activate journeys as their start year is reached (only on change)
      const shouldBeActive = journeyData.journeys
        .filter(j => j.dateRange[0] <= newYear)
        .map(j => j.id)
      const prev = lastActivatedRef.current
      const newlyActive = shouldBeActive.filter(id => !prev.has(id))
      if (newlyActive.length > 0) {
        newlyActive.forEach(id => prev.add(id))
        setActiveJourneys(new Set(prev))
      }

      if (newYear >= playEndRef.current) {
        setIsPlaying(false)
        playFrameRef.current = null
        return
      }
      playFrameRef.current = requestAnimationFrame(tick)
    }

    playFrameRef.current = requestAnimationFrame(tick)
  }

  function handlePlay() {
    const detailId  = detailJourneyIdRef.current
    const detailJrn = detailId ? journeyData.journeys.find(j => j.id === detailId) : null
    const effectiveStart = detailJrn ? detailJrn.dateRange[0] : PLAY_START
    const effectiveEnd   = detailJrn ? detailJrn.dateRange[1] : PLAY_END
    playEndRef.current   = effectiveEnd

    const from = (timelineYear !== null && timelineYear >= effectiveStart && timelineYear < effectiveEnd)
      ? timelineYear
      : effectiveStart

    // Seed lastActivatedRef with journeys already active before the start year
    lastActivatedRef.current = new Set(
      journeyData.journeys.filter(j => j.dateRange[0] <= from).map(j => j.id)
    )
    setIsPlaying(true)
    startPlayLoop(from)
  }

  function handlePause() {
    stopFrame()
    setIsPlaying(false)
  }

  function handleReset() {
    stopFrame()
    setIsPlaying(false)
    setTimelineYear(null)
    setActiveJourneys(new Set())
    setSelectedBookId(null)
    lastActivatedRef.current = new Set()
  }

  function handleSpeedChange(speed) {
    setPlaySpeed(speed)
    playSpeedRef.current = speed
    if (isPlaying) {
      stopFrame()
      // Restart from current year with new speed
      const from = timelineYear ?? PLAY_START
      playStartYearRef.current = from
      playStartTimeRef.current = performance.now()

      function tick(now) {
        const elapsed      = now - playStartTimeRef.current
        const yearsElapsed = (elapsed / 1000) * playSpeedRef.current / 1.5
        const newYear      = Math.min(playStartYearRef.current + yearsElapsed, playEndRef.current)

        setTimelineYear(newYear)

        const shouldBeActive = journeyData.journeys
          .filter(j => j.dateRange[0] <= newYear)
          .map(j => j.id)
        const prev = lastActivatedRef.current
        const newlyActive = shouldBeActive.filter(id => !prev.has(id))
        if (newlyActive.length > 0) {
          newlyActive.forEach(id => prev.add(id))
          setActiveJourneys(new Set(prev))
        }

        if (newYear >= playEndRef.current) {
          setIsPlaying(false)
          playFrameRef.current = null
          return
        }
        playFrameRef.current = requestAnimationFrame(tick)
      }

      playFrameRef.current = requestAnimationFrame(tick)
    }
  }

  function handleJourneyToggle(journeyId) {
    if (isPlaying) handlePause()
    setActiveJourneys(prev => {
      const next = new Set(prev)
      if (next.has(journeyId)) next.delete(journeyId)
      else next.add(journeyId)
      return next
    })
  }

  function handleBookSelect(bookId) {
    if (isPlaying) handlePause()
    setSelectedBookId(prev => prev === bookId ? null : bookId)
  }

  function handleYearChange(year) {
    if (isPlaying) handlePause()
    setTimelineYear(year)
  }

  // Reset church tracks when drilling into a different journey
  useEffect(() => {
    setActiveChurchTracks(new Set())
  }, [detailJourneyId])

  function handleChurchTrackToggle(churchId) {
    setActiveChurchTracks(prev => {
      const next = new Set(prev)
      if (next.has(churchId)) next.delete(churchId)
      else next.add(churchId)
      return next
    })
  }

  useEffect(() => () => stopFrame(), [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Paul's World</h1>
      </header>
      <div className="app-body">
        <div className="map-container">
          <FilterPanel
            activeJourneys={activeJourneys}
            selectedBookId={selectedBookId}
            viewMode={viewMode}
            showProvinces={showProvinces}
            onJourneyToggle={handleJourneyToggle}
            onBookSelect={handleBookSelect}
            onViewModeChange={setViewMode}
            onShowProvincesChange={setShowProvinces}
          />
          <MapView
            activeJourneys={activeJourneys}
            selectedBookId={selectedBookId}
            timelineYear={timelineYear}
            hoveredCityId={hoveredCityId}
            onCityHover={setHoveredCityId}
            onCityClick={() => {}}
            provincesGeo={provincesGeo}
            showProvinces={showProvinces}
            isPlaying={isPlaying}
            detailJourneyId={detailJourneyId}
          />
          <BookDetailPanel
            book={selectedBook}
            onClose={() => handleBookSelect(null)}
          />
        </div>
      </div>
      <TimelineBar
        activeJourneys={activeJourneys}
        selectedBookId={selectedBookId}
        timelineYear={timelineYear}
        onYearChange={handleYearChange}
        onBookClick={handleBookSelect}
        highlightRange={highlightRange}
        isPlaying={isPlaying}
        detailJourneyId={detailJourneyId}
        onDetailJourneyChange={setDetailJourneyId}
        churchEvents={journeyData.churchEvents}
        activeChurchTracks={activeChurchTracks}
        onChurchTrackToggle={handleChurchTrackToggle}
        onCityHover={setHoveredCityId}
        hoveredCityId={hoveredCityId}
      />
      <PlayControls
        isPlaying={isPlaying}
        playSpeed={playSpeed}
        onPlay={handlePlay}
        onPause={handlePause}
        onReset={handleReset}
        onSpeedChange={handleSpeedChange}
      />
    </div>
  )
}
