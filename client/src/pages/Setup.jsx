import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Grid from '../components/Grid'
import { getRandomGrid, selectHiddenSubject } from '../utils/gameLogic'
import playersData from '../data/players.json'
import teamsData from '../data/teams.json'
import './Setup.css'

export default function Setup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const gameMode = searchParams.get('mode') || 'ai'

  const [subjectMode, setSubjectMode] = useState('player')
  const [grid, setGrid] = useState([])
  const [eliminatedIds, setEliminatedIds] = useState([])

  useEffect(() => {
    const pool = subjectMode === 'player' ? playersData : teamsData
    setGrid(getRandomGrid(pool, 24))
    setEliminatedIds([])
  }, [subjectMode])

  const handleStartGame = () => {
    const aiPick = selectHiddenSubject(grid)

    sessionStorage.setItem('gameConfig', JSON.stringify({
      gameMode,
      subjectMode,
      grid,
      aiPickId: aiPick.id,
      questionsRemaining: 10,
      guessesRemaining: 3,
      timerSeconds: 150,
    }))

    navigate('/game')
  }

  return (
    <div className="setup">

      {/* Header */}
      <div className="setup-header">
        <button className="setup-back" onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className="setup-header-text">
          <h1 className="setup-title">Choose Your Mode</h1>
          <p className="setup-subtitle">
            Pick Players or Teams — the AI will secretly select one from the grid below
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="setup-toggle">
        <button
          className={`setup-toggle-btn ${subjectMode === 'player' ? 'active' : ''}`}
          onClick={() => setSubjectMode('player')}
        >
          🏀 Players
        </button>
        <button
          className={`setup-toggle-btn ${subjectMode === 'team' ? 'active' : ''}`}
          onClick={() => setSubjectMode('team')}
        >
          🏆 Teams
        </button>
      </div>

      {/* Rules Strip */}
      <div className="setup-rules">
        <div className="setup-rule">
          <span className="setup-rule-value">10</span>
          <span className="setup-rule-label">Questions</span>
        </div>
        <div className="setup-rule-divider" />
        <div className="setup-rule">
          <span className="setup-rule-value">3</span>
          <span className="setup-rule-label">Guesses</span>
        </div>
        <div className="setup-rule-divider" />
        <div className="setup-rule">
          <span className="setup-rule-value">2:30</span>
          <span className="setup-rule-label">Per Question</span>
        </div>
      </div>

      {/* Grid */}
      <div className="setup-grid-section">
        <p className="setup-grid-label">
          The AI has already secretly picked one of these{' '}
          {subjectMode === 'player' ? 'players' : 'teams'} — can you figure out which one?
        </p>
        {grid.length > 0 && (
          <Grid
            grid={grid}
            mode={subjectMode}
            eliminatedIds={eliminatedIds}
            onEliminate={() => {}}
          />
        )}
      </div>

      {/* Start Button */}
      <div className="setup-footer">
        <button
          className="setup-start btn-primary"
          onClick={handleStartGame}
        >
          Start Game →
        </button>
      </div>

    </div>
  )
}