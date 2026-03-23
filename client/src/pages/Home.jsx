import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()
  const [rulesOpen, setRulesOpen] = useState(false)

  return (
    <div className="home">

      {/* Background decoration */}
      <div className="home-bg">
        <div className="home-bg-circle home-bg-circle-1" />
        <div className="home-bg-circle home-bg-circle-2" />
      </div>

      {/* Logo / Title */}
      <div className="home-hero">
        <div className="home-logo">
          <span className="home-logo-bracket">[</span>
          <span className="home-logo-icon">🏀</span>
          <span className="home-logo-bracket">]</span>
        </div>
        <h1 className="home-title">Who's In Your<br />Bracket?</h1>
        <p className="home-subtitle">
          The March Madness deduction game. Ask questions.<br />
          Eliminate players. Guess before they guess you.
        </p>
      </div>

      {/* Game mode buttons */}
      <div className="home-modes">
        <button
          className="mode-card mode-card-ai"
          onClick={() => navigate('/setup?mode=ai')}
        >
          <div className="mode-card-icon">🤖</div>
          <div className="mode-card-content">
            <h2>Play AI</h2>
            <p>Go head to head against Groq. 5 questions. Limited guesses. Clock is ticking.</p>
          </div>
          <div className="mode-card-arrow">→</div>
        </button>

        <button
          className="mode-card mode-card-quick"
          onClick={() => navigate('/modepick?mode=quick')}
        >
          <div className="mode-card-icon">⚡</div>
          <div className="mode-card-content">
            <h2>Quick Match</h2>
            <p>Jump into a live game instantly. We'll find you an opponent right now.</p>
          </div>
          <div className="mode-card-arrow">→</div>
        </button>

        <button
          className="mode-card mode-card-private"
          onClick={() => navigate('/modepick?mode=private')}
        >
          <div className="mode-card-icon">🔒</div>
          <div className="mode-card-content">
            <h2>Private Match</h2>
            <p>Create a room and share the code with a friend. Play on your own terms.</p>
          </div>
          <div className="mode-card-arrow">→</div>
        </button>
      </div>

      {/* How to Play Button */}
      <div className="rules-section">
        <button
          className="rules-toggle"
          onClick={() => setRulesOpen(true)}
        >
          <span>How to Play</span>
          <span className="rules-chevron">▾</span>
        </button>
      </div>

      {/* How to Play Modal */}
      {rulesOpen && (
        <div className="rules-backdrop" onClick={() => setRulesOpen(false)}>
          <div className="rules-modal" onClick={(e) => e.stopPropagation()}>

            <div className="rules-modal-header">
              <h2>How to Play</h2>
              <button className="rules-close-btn" onClick={() => setRulesOpen(false)}>✕</button>
            </div>

            <div className="rules-modal-body">

              <div className="rules-block">
                <h3>How to Play</h3>
                <ul>
                  <li>Depending on the game mode you and your opponent each secretly pick a player or team from the same 24-card grid</li>
                  <li>Take turns asking yes/no questions about each other's hidden subject</li>
                  <li>Use the answers to eliminate cards from your board</li>
                  <li>First to correctly guess their opponent's subject wins</li>
                </ul>
              </div>

              <div className="rules-block">
                <h3>Rules</h3>
                <ul>
                  <li>One question per turn</li>
                  <li>You must answer honestly</li>
                  <li>You can eliminate cards manually as you narrow down options</li>
                  <li>On your turn you can either ask a question OR make a guess</li>
                  <li>Wrong guess costs you — you only get a limited number</li>
                </ul>
              </div>

              <div className="rules-block">
                <h3>AI Mode</h3>
                <ul>
                  <li>Before the game starts you choose whether to play with Players or Teams</li>
                  <li>You will be shown a grid of 24 players or teams to work with</li>
                  <li>The AI secretly picks one subject from your grid — you have to figure out which one</li>
                  <li>Ask yes/no questions to narrow down your options</li>
                  <li>10 questions max</li>
                  <li>2 minutes 30 seconds per question</li>
                  <li>3 guesses total — wrong guesses count against you</li>
                  <li>Scored on speed and efficiency</li>
                </ul>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="home-footer">
        <p>Built for the 2026 NCAA Tournament · 68 teams · 105 players</p>
      </div>

    </div>
  )
}