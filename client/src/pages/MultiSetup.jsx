import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { getRandomGrid, selectHiddenSubject } from '../utils/gameLogic'
import playersData from '../data/players.json'
import teamsData from '../data/teams.json'
import './MultiSetup.css'

export default function MultiSetup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roomCode = searchParams.get('room')
  const socketRef = useRef(null)

  const [isHost, setIsHost] = useState(false)
  const [subjectMode, setSubjectMode] = useState(() => {
    return sessionStorage.getItem('subjectMode') || 'player'
  })
  const [grid, setGrid] = useState(() => {
    const mode = sessionStorage.getItem('subjectMode') || 'player'
    const pool = mode === 'player' ? playersData : teamsData
    return getRandomGrid(pool, 24)
  })
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [opponentReady, setOpponentReady] = useState(false)
  const [status, setStatus] = useState('selecting')

  useEffect(() => {
    const socket = io('http://localhost:3001', { transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected:', socket.id)
      const stored = sessionStorage.getItem('multiplayerConfig')
      const config = stored ? JSON.parse(stored) : {}
      socket.emit('rejoin_room', {
        roomCode,
        originalSocketId: config.socketId
      })
    })

    socket.on('room_state', ({ isHost: host, subjectMode: mode, grid: serverGrid }) => {
      console.log('room_state received, isHost:', host, 'grid length:', serverGrid?.length)
      setIsHost(host)
      if (mode) setSubjectMode(mode)
      if (serverGrid && serverGrid.length > 0) {
        setGrid(serverGrid)
      }
    })

    socket.on('mode_changed', ({ subjectMode: mode, grid: serverGrid }) => {
      console.log('mode_changed received:', mode)
      setSubjectMode(mode)
      if (serverGrid && serverGrid.length > 0) setGrid(serverGrid)
      setSelectedSubject(null)
    })

    socket.on('opponent_ready', () => {
      setOpponentReady(true)
    })

    socket.on('game_starting', ({ grid: serverGrid, subjectMode: mode, opponentSubjectId, mySubjectId, originalSocketId }) => {
      setStatus('starting')
      const existing = sessionStorage.getItem('multiplayerConfig')
      const existingConfig = existing ? JSON.parse(existing) : {}
      sessionStorage.setItem('multiplayerConfig', JSON.stringify({
        roomCode,
        subjectMode: mode,
        grid: serverGrid,
        gameMode: 'multiplayer',
        mySubjectId,
        opponentSubjectId,
        originalSocketId: existingConfig.socketId
      }))
      setTimeout(() => navigate(`/multiplay?room=${roomCode}`), 1500)
    })

    socket.on('opponent_disconnected', () => {
      alert('Your opponent disconnected.')
      navigate('/')
    })

    return () => socket.disconnect()
  }, [roomCode])

  const handleModeChange = (mode) => {
    if (!isHost) return
    setSubjectMode(mode)
    setSelectedSubject(null)
    socketRef.current.emit('change_mode', { roomCode, subjectMode: mode })
  }

  const handleSelectRandom = () => {
    if (grid.length === 0) return
    const random = selectHiddenSubject(grid)
    setSelectedSubject(random)
  }

  const handleReady = () => {
    if (!selectedSubject) return
    setIsReady(true)
    socketRef.current.emit('player_ready', {
      roomCode,
      subjectId: selectedSubject.id,
      subjectMode,
      grid
    })
  }

  return (
    <div className="multisetup">

      <div className="home-bg">
        <div className="home-bg-circle home-bg-circle-1" />
        <div className="home-bg-circle home-bg-circle-2" />
      </div>

      <div className="multisetup-container">

        <div className="multisetup-header">
          <div className="multisetup-room-badge">Room: {roomCode}</div>
          <h1 className="multisetup-title">Game Setup</h1>
          <p className="multisetup-subtitle">
            {isHost ? 'You are the host — pick the game mode' : 'Waiting for host to pick the game mode'}
          </p>
        </div>

        <div className="setup-toggle">
          <button
            className={`setup-toggle-btn ${subjectMode === 'player' ? 'active' : ''}`}
            onClick={() => handleModeChange('player')}
            disabled={!isHost}
          >
            🏀 Players
          </button>
          <button
            className={`setup-toggle-btn ${subjectMode === 'team' ? 'active' : ''}`}
            onClick={() => handleModeChange('team')}
            disabled={!isHost}
          >
            🏆 Teams
          </button>
        </div>

        <div className="multisetup-pick">
          <h2 className="multisetup-pick-title">
            Pick Your Hidden {subjectMode === 'player' ? 'Player' : 'Team'}
          </h2>
          <p className="multisetup-pick-subtitle">
            Your opponent will try to guess who you picked
          </p>

          <div className="multisetup-pick-options">
            <button
              className={`multisetup-pick-btn ${selectedSubject ? 'selected' : ''}`}
              onClick={handleSelectRandom}
              disabled={isReady || grid.length === 0}
            >
              {selectedSubject ? (
                <>
                  <span className="multisetup-pick-name">{selectedSubject.name}</span>
                  <span className="multisetup-pick-sub">
                    {subjectMode === 'player' ? selectedSubject.team : selectedSubject.conference}
                  </span>
                  <span className="multisetup-pick-change">Click to randomize again</span>
                </>
              ) : (
                <>
                  <span className="multisetup-pick-icon">🎲</span>
                  <span className="multisetup-pick-name">Random Pick</span>
                  <span className="multisetup-pick-sub">Let us choose for you</span>
                </>
              )}
            </button>
          </div>

          <p className="multisetup-pick-hint">
            Or scroll down to pick manually from the grid below
          </p>
        </div>

        <div className="multisetup-grid">
          {grid.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', gridColumn: '1 / -1' }}>
              Loading grid...
            </p>
          ) : (
            grid.map((subject) => (
              <button
                key={subject.id}
                className={`multisetup-grid-item ${selectedSubject?.id === subject.id ? 'selected' : ''}`}
                onClick={() => !isReady && setSelectedSubject(subject)}
                disabled={isReady}
              >
                <div className="multisetup-grid-photo">
                  {subject.photo_url || subject.logo_url ? (
                    <img
                      src={subject.photo_url || subject.logo_url}
                      alt={subject.name}
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div
                    className="multisetup-grid-initials"
                    style={{ display: subject.photo_url || subject.logo_url ? 'none' : 'flex' }}
                  >
                    {subject.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                </div>
                <div className="multisetup-grid-name">{subject.name}</div>
              </button>
            ))
          )}
        </div>

        <div className="multisetup-ready-status">
          <div className={`multisetup-player-status ${isReady ? 'ready' : 'pending'}`}>
            You {isReady ? '✓ Ready' : '— Not Ready'}
          </div>
          <div className="multisetup-vs">VS</div>
          <div className={`multisetup-player-status ${opponentReady ? 'ready' : 'pending'}`}>
            Opponent {opponentReady ? '✓ Ready' : '— Not Ready'}
          </div>
        </div>

        {status === 'starting' && (
          <div className="multisetup-starting">
            🏀 Both players ready — starting game!
          </div>
        )}

        {status !== 'starting' && (
          <div className="multisetup-footer">
            <button
              className="btn-primary multisetup-ready-btn"
              onClick={handleReady}
              disabled={!selectedSubject || isReady}
            >
              {isReady ? 'Waiting for opponent...' : "I'm Ready →"}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}