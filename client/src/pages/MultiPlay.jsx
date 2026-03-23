import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import Grid from '../components/Grid'
import './MultiPlay.css'

export default function MultiPlay() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roomCode = searchParams.get('room')
  const socketRef = useRef(null)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  const [config, setConfig] = useState(null)
  const [mySubject, setMySubject] = useState(null)
  const [opponentSubject, setOpponentSubject] = useState(null)
  const [eliminatedIds, setEliminatedIds] = useState([])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [waitingForAnswer, setWaitingForAnswer] = useState(false)
  const [myQuestionsLeft, setMyQuestionsLeft] = useState(5)
  const [myGuessesLeft, setMyGuessesLeft] = useState(3)
  const [turnTimer, setTurnTimer] = useState(15)
  const [gameTimer, setGameTimer] = useState(300)
  const [guessMode, setGuessMode] = useState(false)
  const [selectedGuess, setSelectedGuess] = useState(null)
  const [gameOver, setGameOver] = useState(false)
  const [gameResult, setGameResult] = useState(null)
  const [pendingQuestion, setPendingQuestion] = useState(null)

  // Load config from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('multiplayerConfig')
    if (!stored) { navigate('/'); return }
    const parsed = JSON.parse(stored)
    setConfig(parsed)

    const grid = parsed.grid
    const mySubjectData = grid.find(s => s.id === parsed.mySubjectId)
    const opponentSubjectData = grid.find(s => s.id === parsed.opponentSubjectId)
    setMySubject(mySubjectData)
    setOpponentSubject(opponentSubjectData)
  }, [])

  // Socket setup
  useEffect(() => {
    if (!roomCode) return

    const socket = io('https://march-madness-snapback-game-production.up.railway.app', { transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('MultiPlay connected, socket:', socket.id)
      const stored = sessionStorage.getItem('multiplayerConfig')
      const parsed = stored ? JSON.parse(stored) : {}
      console.log('Emitting rejoin_game with originalSocketId:', parsed.originalSocketId)
      socket.emit('rejoin_game', {
        roomCode,
        originalSocketId: parsed.originalSocketId
      })
    })

    socket.on('game_init', ({ isFirstTurn }) => {
      console.log('game_init received, isFirstTurn:', isFirstTurn)
      setIsMyTurn(isFirstTurn)
      setMessages([{
        role: 'system',
        text: isFirstTurn
          ? "Game started! You go first — ask a yes/no question."
          : "Game started! Waiting for opponent's question..."
      }])
    })

    socket.on('question_received', ({ question }) => {
      console.log('question_received:', question)
      setPendingQuestion(question)
      setMessages(prev => [...prev, { role: 'opponent', text: question }])
      setMessages(prev => [...prev, { role: 'system', text: "Answer your opponent's question:" }])
    })

    socket.on('answer_received', ({ question, answer }) => {
      console.log('answer_received:', answer)
      setWaitingForAnswer(false)
      setMessages(prev => [...prev, {
        role: 'system',
        text: `Your question "${question}" was answered: ${answer ? 'YES ✓' : 'NO ✗'}`
      }])
    })

    socket.on('turn_changed', ({ isYourTurn }) => {
      console.log('turn_changed received, isYourTurn:', isYourTurn)
      setIsMyTurn(isYourTurn)
      if (isYourTurn) {
        setTurnTimer(15)
        setMessages(prev => [...prev, {
          role: 'system',
          text: 'Your turn — ask a question or make a guess!'
        }])
      }
    })

    socket.on('opponent_guessed', ({ correct, name }) => {
      if (correct) {
        setGameOver(true)
        setGameResult('lose')
      } else {
        setMessages(prev => [...prev, {
          role: 'system',
          text: `Your opponent guessed wrong! Their turn is over.`
        }])
      }
    })

    socket.on('game_over', ({ reason, winner }) => {
      setGameOver(true)
      setGameResult(winner === socket.id ? 'win' : 'lose')
      setMessages(prev => [...prev, { role: 'system', text: reason }])
    })

    socket.on('opponent_disconnected', () => {
      setGameOver(true)
      setGameResult('win')
    })

    return () => socket.disconnect()
  }, [roomCode])

  // Turn timer
  useEffect(() => {
    if (!isMyTurn || gameOver || waitingForAnswer) return
    if (turnTimer <= 0) {
      handleTurnTimeout()
      return
    }
    const interval = setInterval(() => setTurnTimer(prev => prev - 1), 1000)
    return () => clearInterval(interval)
  }, [isMyTurn, turnTimer, gameOver, waitingForAnswer])

  // Game timer
  useEffect(() => {
    if (gameOver) return
    if (gameTimer <= 0) {
      handleGameTimeout()
      return
    }
    const interval = setInterval(() => setGameTimer(prev => prev - 1), 1000)
    return () => clearInterval(interval)
  }, [gameTimer, gameOver])

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const handleTurnTimeout = () => {
    setMessages(prev => [...prev, { role: 'system', text: '⏰ Time ran out for your turn!' }])
    setIsMyTurn(false)
    socketRef.current.emit('turn_timeout', { roomCode })
  }

  const handleGameTimeout = () => {
    socketRef.current.emit('game_timeout', { roomCode, eliminatedCount: eliminatedIds.length })
  }

  const handleAskQuestion = () => {
    if (!input.trim() || !isMyTurn || gameOver || myQuestionsLeft <= 0) return
    const question = input.trim()
    setInput('')
    setWaitingForAnswer(true)
    setMyQuestionsLeft(prev => prev - 1)
    setMessages(prev => [...prev, { role: 'me', text: question }])
    socketRef.current.emit('ask_question', { roomCode, question })
  }

  const handleAnswer = (answer) => {
    if (!pendingQuestion) return
    const q = pendingQuestion
    setPendingQuestion(null)
    socketRef.current.emit('answer_question', { roomCode, question: q, answer })
    setMessages(prev => [...prev, {
      role: 'me',
      text: answer ? 'YES ✓' : 'NO ✗',
      isYes: answer
    }])
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
    if (!selectedGuess || !opponentSubject || gameOver) return
    const correct = selectedGuess.id === opponentSubject.id
    const guessName = selectedGuess.name
    setGuessMode(false)
    setSelectedGuess(null)

    socketRef.current.emit('make_guess', {
      roomCode,
      guessId: selectedGuess.id,
      correct,
      name: guessName
    })

    if (correct) {
      setGameOver(true)
      setGameResult('win')
    } else {
      const guessesAfter = myGuessesLeft - 1
      setMyGuessesLeft(guessesAfter)
      setMessages(prev => [...prev, {
        role: 'system',
        text: `Wrong guess! ${guessesAfter} guess${guessesAfter !== 1 ? 'es' : ''} remaining.`
      }])
      setIsMyTurn(false)
      if (guessesAfter <= 0) {
        setGameOver(true)
        setGameResult('lose')
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
    const statsSubject = gameResult === 'lose' ? opponentSubject : null
    const questionsUsed = 5 - myQuestionsLeft
    const guessesUsed = 3 - myGuessesLeft
    const timeLeft = formatTime(gameTimer)

    return (
      <div className="gameover-overlay">
        <div className="gameover-modal">

          {gameResult === 'win' ? (
            <>
              <div className="gameover-icon">🏆</div>
              <h1 className="gameover-title win">You Win!</h1>
              <p className="gameover-subtitle">You figured it out before they did.</p>
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
                  <span className="gameover-stat-value">{timeLeft}</span>
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
                <span className="gameover-answer-name">{opponentSubject?.name}</span>
              </p>

              {statsSubject && config.subjectMode === 'player' && (
                <div className="gameover-subject-card">
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Team</span>
                    <span className="gameover-subject-value">{statsSubject.team}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Position</span>
                    <span className="gameover-subject-value">{statsSubject.position}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">PPG</span>
                    <span className="gameover-subject-value">{statsSubject.ppg}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Class</span>
                    <span className="gameover-subject-value">{statsSubject.class_year}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Conference</span>
                    <span className="gameover-subject-value">{statsSubject.conference}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Seed</span>
                    <span className="gameover-subject-value">#{statsSubject.team_seed}</span>
                  </div>
                </div>
              )}

              {statsSubject && config.subjectMode === 'team' && (
                <div className="gameover-subject-card">
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Conference</span>
                    <span className="gameover-subject-value">{statsSubject.conference}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Record</span>
                    <span className="gameover-subject-value">{statsSubject.record}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Region</span>
                    <span className="gameover-subject-value">{statsSubject.region}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Mascot</span>
                    <span className="gameover-subject-value">{statsSubject.mascot}</span>
                  </div>
                  <div className="gameover-subject-row">
                    <span className="gameover-subject-label">Championships</span>
                    <span className="gameover-subject-value">{statsSubject.championships}</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="gameover-actions">
            <button className="btn-primary" onClick={() => navigate('/modepick?mode=quick')}>
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

  if (!config) return <div className="game-loading">Loading game...</div>

  const turnWarning = turnTimer <= 5
  const gameWarning = gameTimer <= 60

  return (
    <div className="game">

      {gameOver && <GameOverScreen />}

      {/* Status Bar */}
      <div className="game-status-bar">
        <button className="game-quit" onClick={() => navigate('/')}>✕ Quit</button>

        <div className="game-stats">
          <div className="game-stat">
            <span className="game-stat-value">{myQuestionsLeft}</span>
            <span className="game-stat-label">Questions</span>
          </div>
          <div className="game-stat-divider" />
          <div className="game-stat">
            <span className="game-stat-value">{myGuessesLeft}</span>
            <span className="game-stat-label">Guesses</span>
          </div>
          <div className="game-stat-divider" />
          <div className={`game-stat ${isMyTurn && turnWarning ? 'danger' : ''}`}>
            <span className="game-stat-value">{isMyTurn ? turnTimer : '—'}</span>
            <span className="game-stat-label">Turn Timer</span>
          </div>
          <div className="game-stat-divider" />
          <div className={`game-stat ${gameWarning ? 'warning' : ''}`}>
            <span className="game-stat-value">{formatTime(gameTimer)}</span>
            <span className="game-stat-label">Game Timer</span>
          </div>
        </div>

        <div className={`game-turn-badge ${isMyTurn ? 'your-turn' : 'their-turn'}`}>
          {isMyTurn ? '🟢 Your Turn' : '⏳ Their Turn'}
        </div>
      </div>

      {/* Main Layout */}
      <div className="game-layout">

        {/* Grid */}
        <div className="game-grid-panel">
          {config.grid && (
            <Grid
              grid={config.grid}
              mode={config.subjectMode}
              eliminatedIds={eliminatedIds}
              onEliminate={handleEliminate}
              guessMode={guessMode}
              selectedGuessId={selectedGuess?.id}
              onGuessSelect={handleGuessSelect}
            />
          )}
        </div>

        {/* Chat Panel */}
        <div className="game-chat-panel">

          {mySubject && (
            <div className="multiplay-my-subject">
              <span className="multiplay-my-subject-label">Your hidden {config.subjectMode}:</span>
              <span className="multiplay-my-subject-name">{mySubject.name}</span>
            </div>
          )}

          <div className="game-chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
                {msg.role === 'opponent' && (
                  <div className="chat-msg-avatar">OPP</div>
                )}
                {msg.role === 'me' && (
                  <div className="chat-msg-avatar-me">ME</div>
                )}
                <div className={`chat-msg-bubble ${msg.isYes === true ? 'yes' : msg.isYes === false ? 'no' : ''}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {pendingQuestion && !gameOver && (
            <div className="multiplay-answer-btns">
              <p className="multiplay-answer-label">Answer your opponent:</p>
              <div className="multiplay-answer-row">
                <button className="multiplay-yes-btn" onClick={() => handleAnswer(true)}>
                  YES ✓
                </button>
                <button className="multiplay-no-btn" onClick={() => handleAnswer(false)}>
                  NO ✗
                </button>
              </div>
            </div>
          )}

          {guessMode && (
            <div className="game-guess-banner">
              {selectedGuess
                ? `Guessing: ${selectedGuess.name} — press Enter or Confirm`
                : 'Click a card to make your guess'
              }
            </div>
          )}

          {!gameOver && !pendingQuestion && (
            <div className="game-input-area">
              {!guessMode ? (
                <>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={isMyTurn ? "Ask a yes/no question..." : "Waiting for opponent..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!isMyTurn || waitingForAnswer || myQuestionsLeft <= 0}
                    className="game-input"
                  />
                  <button
                    className="game-send-btn"
                    onClick={handleAskQuestion}
                    disabled={!isMyTurn || !input.trim() || waitingForAnswer || myQuestionsLeft <= 0}
                  >
                    →
                  </button>
                  <button
                    className="game-guess-btn"
                    onClick={() => setGuessMode(true)}
                    disabled={!isMyTurn || gameOver}
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