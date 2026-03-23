import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Grid from '../components/Grid'
import { checkGuess, recordQuestion, processGuess, createGameState } from '../utils/gameLogic'
import './Game.css'

export default function Game() {
  const navigate = useNavigate()
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  const [config, setConfig] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [eliminatedIds, setEliminatedIds] = useState([])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(150)
  const [timerActive, setTimerActive] = useState(true)
  const [guessMode, setGuessMode] = useState(false)
  const [selectedGuess, setSelectedGuess] = useState(null)
  const [gameOver, setGameOver] = useState(false)
  const [gameResult, setGameResult] = useState(null)
  const [questionsUsed, setQuestionsUsed] = useState(0)
  const [guessesUsed, setGuessesUsed] = useState(0)
  const [finalTimeLeft, setFinalTimeLeft] = useState(null)

  // Load game config from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('gameConfig')
    if (!stored) {
      navigate('/')
      return
    }
    const parsed = JSON.parse(stored)

    // Force 5 questions
    parsed.questionsRemaining = 5
    parsed.guessesRemaining = 3

    setConfig(parsed)

    const state = createGameState(
      parsed.gameMode,
      parsed.subjectMode,
      parsed.grid,
      5,
      parsed.guessesRemaining,
      parsed.timerSeconds
    )

    const hidden = parsed.grid.find(s => s.id === parsed.aiPickId)
    state.hiddenSubject = hidden
    setGameState(state)

    setMessages([{
      role: 'ai',
      text: `I've picked a ${parsed.subjectMode === 'player' ? 'player' : 'team'} from the grid. You have 5 questions and 3 guesses to figure out who it is. Ask away!`
    }])
  }, [])

  // Timer countdown
  useEffect(() => {
    if (!timerActive || gameOver) return
    if (timeLeft <= 0) {
      handleTimeUp()
      return
    }
    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [timerActive, timeLeft, gameOver])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleTimeUp = () => {
    setTimerActive(false)
    setMessages(prev => [...prev, {
      role: 'system',
      text: '⏰ Time is up for this question!'
    }])
    setGameState(prev => ({
      ...prev,
      questionsRemaining: prev.questionsRemaining - 1
    }))
    setQuestionsUsed(prev => prev + 1)
    setTimeLeft(150)
    setTimerActive(true)
  }

  const handleAskQuestion = async () => {
    if (!input.trim() || loading || gameOver) return
    if (gameState.questionsRemaining <= 0) return

    const question = input.trim()
    setInput('')
    setLoading(true)
    setTimerActive(false)

    setMessages(prev => [...prev, { role: 'player', text: question }])

    try {
      const response = await fetch('https://march-madness-snapback-game-production.up.railway.app/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          subject: gameState.hiddenSubject,
          subjectMode: config.subjectMode
        })
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      const aiText = data.answer.replace(/^["']|["']$/g, '').trim()
      const isYes = aiText.toLowerCase().startsWith('yes')

      setMessages(prev => [...prev, { role: 'ai', text: aiText, isYes }])

      const updatedState = recordQuestion(gameState, 'raw_question', question, isYes)
      setGameState(updatedState)
      setQuestionsUsed(prev => prev + 1)

      if (updatedState.questionsRemaining <= 0 && updatedState.guessesRemaining > 0) {
        setMessages(prev => [...prev, {
          role: 'system',
          text: `No more questions! You have ${updatedState.guessesRemaining} guess${updatedState.guessesRemaining > 1 ? 'es' : ''} remaining. Click a card to guess!`
        }])
      }

    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, {
        role: 'system',
        text: 'Something went wrong. Try asking again.'
      }])
    }

    setLoading(false)
    setTimeLeft(150)
    setTimerActive(true)
    inputRef.current?.focus()
  }

  const handleEliminate = (id, eliminate) => {
    if (eliminate) {
      setEliminatedIds(prev => [...prev, id])
    } else {
      setEliminatedIds(prev => prev.filter(eid => eid !== id))
    }
  }

  const handleGuessSelect = (subject) => {
    if (!guessMode || gameOver) return
    setSelectedGuess(subject)
  }

  const handleConfirmGuess = () => {
    if (!selectedGuess || gameOver) return

    const correct = checkGuess(selectedGuess, gameState.hiddenSubject)
    const updatedState = processGuess(gameState, selectedGuess)
    setGameState(updatedState)
    setGuessMode(false)
    setSelectedGuess(null)
    setGuessesUsed(prev => prev + 1)

    if (correct) {
      setTimerActive(false)
      setGameOver(true)
      setGameResult('win')
      setFinalTimeLeft(timeLeft)
      setMessages(prev => [...prev, {
        role: 'system',
        text: `🎉 Correct! It was ${gameState.hiddenSubject.name}! You win!`
      }])
    } else {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `No, that's not right! ${updatedState.guessesRemaining} guess${updatedState.guessesRemaining !== 1 ? 'es' : ''} remaining.`
      }])

      if (updatedState.guessesRemaining <= 0) {
        setTimerActive(false)
        setGameOver(true)
        setGameResult('lose')
        setFinalTimeLeft(timeLeft)
        setMessages(prev => [...prev, {
          role: 'system',
          text: `Game over! It was ${gameState.hiddenSubject.name}. Better luck next time!`
        }])
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (guessMode) handleConfirmGuess()
      else handleAskQuestion()
    }
  }

  // Game Over Screen
  const GameOverScreen = () => {
    const hiddenSubject = gameState?.hiddenSubject

    return (
      <div className="gameover-overlay">
        <div className="gameover-modal">

          {gameResult === 'win' ? (
            <>
              <div className="gameover-icon">🏆</div>
              <h1 className="gameover-title win">You Win!</h1>
              <p className="gameover-subtitle">You outsmarted the AI.</p>

              <div className="gameover-stats">
                <div className="gameover-stat">
                  <span className="gameover-stat-value">{questionsUsed}</span>
                  <span className="gameover-stat-label">Questions Asked</span>
                </div>
                <div className="gameover-stat">
                  <span className="gameover-stat-value">{guessesUsed}</span>
                  <span className="gameover-stat-label">Guesses Used</span>
                </div>
                <div className="gameover-stat">
                  <span className="gameover-stat-value">{formatTime(finalTimeLeft ?? timeLeft)}</span>
                  <span className="gameover-stat-label">Time Left</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="gameover-icon">💀</div>
              <h1 className="gameover-title lose">You Lose!</h1>
              <p className="gameover-subtitle">
                The answer was{' '}
                <span className="gameover-answer-name">{hiddenSubject?.name}</span>
              </p>

              {hiddenSubject && config.subjectMode === 'player' && (
                <div className="gameover-subject-card">
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Team</span>
                    <span className="gameover-subject-value">{hiddenSubject.team}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Position</span>
                    <span className="gameover-subject-value">{hiddenSubject.position}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">PPG</span>
                    <span className="gameover-subject-value">{hiddenSubject.ppg}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Class</span>
                    <span className="gameover-subject-value">{hiddenSubject.class_year}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Conference</span>
                    <span className="gameover-subject-value">{hiddenSubject.conference}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Seed</span>
                    <span className="gameover-subject-value">#{hiddenSubject.team_seed}</span>
                  </div>
                </div>
              )}

              {hiddenSubject && config.subjectMode === 'team' && (
                <div className="gameover-subject-card">
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Conference</span>
                    <span className="gameover-subject-value">{hiddenSubject.conference}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Record</span>
                    <span className="gameover-subject-value">{hiddenSubject.record}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Region</span>
                    <span className="gameover-subject-value">{hiddenSubject.region}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Mascot</span>
                    <span className="gameover-subject-value">{hiddenSubject.mascot}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Championships</span>
                    <span className="gameover-subject-value">{hiddenSubject.championships}</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="gameover-actions">
            <button className="btn-primary" onClick={() => navigate('/setup?mode=ai')}>
              Play Again
            </button>
            <button className="btn-secondary" onClick={() => navigate('/')}>
              Home
            </button>
          </div>

        </div>
      </div>
    )
  }

  if (!config || !gameState) return (
    <div className="game-loading">Loading game...</div>
  )

  const timerWarning = timeLeft <= 30
  const timerDanger = timeLeft <= 10

  return (
    <div className="game">

      {gameOver && <GameOverScreen />}

      {/* Status Bar */}
      <div className="game-status-bar">
        <button className="game-quit" onClick={() => navigate('/')}>✕ Quit</button>

        <div className="game-stats">
          <div className="game-stat">
            <span className="game-stat-value">{gameState.questionsRemaining}</span>
            <span className="game-stat-label">Questions</span>
          </div>
          <div className="game-stat-divider" />
          <div className="game-stat">
            <span className="game-stat-value">{gameState.guessesRemaining}</span>
            <span className="game-stat-label">Guesses</span>
          </div>
          <div className="game-stat-divider" />
          <div className={`game-stat ${timerWarning ? 'warning' : ''} ${timerDanger ? 'danger' : ''}`}>
            <span className="game-stat-value">{formatTime(timeLeft)}</span>
            <span className="game-stat-label">Time Left</span>
          </div>
        </div>

        <div className="game-mode-badge">
          {config.subjectMode === 'player' ? '🏀 Players' : '🏆 Teams'}
        </div>
      </div>

      {/* Main Layout */}
      <div className="game-layout">

        {/* Grid */}
        <div className="game-grid-panel">
          <Grid
            grid={config.grid}
            mode={config.subjectMode}
            eliminatedIds={eliminatedIds}
            onEliminate={handleEliminate}
            guessMode={guessMode}
            selectedGuessId={selectedGuess?.id}
            onGuessSelect={handleGuessSelect}
          />
        </div>

        {/* Chat Panel */}
        <div className="game-chat-panel">

          <div className="game-chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
                {msg.role === 'ai' && (
                  <div className="chat-msg-avatar">AI</div>
                )}
                <div className={`chat-msg-bubble ${msg.isYes === true ? 'yes' : msg.isYes === false ? 'no' : ''}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg chat-msg-ai">
                <div className="chat-msg-avatar">AI</div>
                <div className="chat-msg-bubble chat-loading">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {guessMode && (
            <div className="game-guess-banner">
              {selectedGuess
                ? `Guessing: ${selectedGuess.name} — press Enter or click Confirm`
                : `Click a card on the board to make your guess`
              }
            </div>
          )}

          {!gameOver && (
            <div className="game-input-area">
              {!guessMode ? (
                <>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Ask a yes/no question..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading || gameState.questionsRemaining <= 0}
                    className="game-input"
                  />
                  <button
                    className="game-send-btn"
                    onClick={handleAskQuestion}
                    disabled={loading || !input.trim() || gameState.questionsRemaining <= 0}
                  >
                    {loading ? '...' : '→'}
                  </button>
                  <button
                    className="game-guess-btn"
                    onClick={() => setGuessMode(true)}
                    disabled={loading}
                  >
                    Guess
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="game-cancel-guess"
                    onClick={() => { setGuessMode(false); setSelectedGuess(null) }}
                  >
                    Cancel
                  </button>
                  <button
                    className="game-confirm-guess btn-primary"
                    onClick={handleConfirmGuess}
                    disabled={!selectedGuess}
                  >
                    Confirm Guess
                  </button>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}