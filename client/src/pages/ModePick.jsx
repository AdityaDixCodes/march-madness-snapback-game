import { useNavigate, useSearchParams } from 'react-router-dom'
import './ModePick.css'

export default function ModePick() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode')

  const handlePick = (subjectMode) => {
    sessionStorage.setItem('subjectMode', subjectMode)
    navigate(`/lobby?mode=${mode}`)
  }

  return (
    <div className="modepick">
      <div className="home-bg">
        <div className="home-bg-circle home-bg-circle-1" />
        <div className="home-bg-circle home-bg-circle-2" />
      </div>

      <div className="modepick-container">
        <div className="modepick-header">
          <button className="modepick-back" onClick={() => navigate('/')}>← Back</button>
          <h1 className="modepick-title">What are we playing with?</h1>
          <p className="modepick-subtitle">Choose a mode — both players will use the same set</p>
        </div>

        <div className="modepick-options">
          <button className="modepick-card" onClick={() => handlePick('player')}>
            <span className="modepick-icon">🏀</span>
            <h2>Players</h2>
            <p>24 real 2026 March Madness players on your board</p>
          </button>

          <button className="modepick-card" onClick={() => handlePick('team')}>
            <span className="modepick-icon">🏆</span>
            <h2>Teams</h2>
            <p>24 real 2026 NCAA tournament teams on your board</p>
          </button>
        </div>
      </div>
    </div>
  )
}