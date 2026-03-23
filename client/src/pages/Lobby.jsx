import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import './Lobby.css'

export default function Lobby() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode')
  const socketRef = useRef(null)

  const [status, setStatus] = useState('idle')
  const [roomCode, setRoomCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [error, setError] = useState('')
  const [playerCount, setPlayerCount] = useState(1)

  useEffect(() => {
    const socket = io('https://march-madness-snapback-game-production.up.railway.app', { transports: ['websocket'] })
    socketRef.current = socket

    const emitFindGame = () => {
      if (mode === 'quick') {
        console.log('Emitting find_game')
        setStatus('searching')
        const subjectMode = sessionStorage.getItem('subjectMode') || 'player'
        socket.emit('find_game', { subjectMode })
      }
    }

    if (socket.connected) {
      emitFindGame()
    } else {
      socket.on('connect', () => {
        console.log('Socket connected:', socket.id)
        emitFindGame()
      })
    }

    socket.on('match_found', ({ roomCode }) => {
      console.log('match_found received:', roomCode)
      setRoomCode(roomCode)
      setStatus('joined')
      sessionStorage.setItem('multiplayerConfig', JSON.stringify({
        roomCode,
        mode: 'multiplayer',
        socketId: socket.id
      }))
      setTimeout(() => navigate(`/multisetup?room=${roomCode}`), 1500)
    })

    socket.on('waiting_for_opponent', () => {
      console.log('waiting_for_opponent received')
      setStatus('searching')
    })

    socket.on('room_created', ({ roomCode }) => {
      console.log('room_created received:', roomCode)
      setRoomCode(roomCode)
      setStatus('waiting')
      sessionStorage.setItem('multiplayerConfig', JSON.stringify({
        roomCode,
        mode: 'multiplayer',
        socketId: socket.id
      }))
    })

    socket.on('room_joined', ({ roomCode }) => {
      console.log('room_joined received:', roomCode)
      setRoomCode(roomCode)
      setStatus('joined')
      sessionStorage.setItem('multiplayerConfig', JSON.stringify({
        roomCode,
        mode: 'multiplayer',
        socketId: socket.id
      }))
      setTimeout(() => navigate(`/multisetup?room=${roomCode}`), 1500)
    })

    socket.on('room_error', ({ message }) => {
      console.log('room_error received:', message)
      setError(message)
      setStatus('idle')
    })

    socket.on('player_joined', () => {
      console.log('player_joined received')
      setPlayerCount(2)
    })

    return () => {
      socket.disconnect()
    }
  }, [mode])

  useEffect(() => {
    if (playerCount === 2 && roomCode) {
      setTimeout(() => navigate(`/multisetup?room=${roomCode}`), 1500)
    }
  }, [playerCount, roomCode])

  const handleCreateRoom = () => {
    setError('')
    socketRef.current.emit('create_room')
  }

  const handleJoinRoom = () => {
    if (inputCode.trim().length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }
    setError('')
    socketRef.current.emit('join_room', { roomCode: inputCode.toUpperCase() })
  }

  const handleCancelSearch = () => {
    socketRef.current.emit('cancel_search')
    setStatus('idle')
    navigate('/')
  }

  return (
    <div className="lobby">

      <div className="home-bg">
        <div className="home-bg-circle home-bg-circle-1" />
        <div className="home-bg-circle home-bg-circle-2" />
      </div>

      <div className="lobby-container">

        <div className="lobby-header">
          <button className="setup-back" onClick={() => navigate('/')}>← Back</button>
          <h1 className="lobby-title">
            {mode === 'quick' ? 'Quick Match' : 'Private Match'}
          </h1>
          <p className="lobby-subtitle">
            {mode === 'quick'
              ? 'Finding you an opponent...'
              : 'Create a room or join a friend'
            }
          </p>
        </div>

        {mode === 'quick' && (
          <div className="lobby-card">
            {status === 'searching' && (
              <div className="lobby-searching">
                <div className="lobby-spinner" />
                <h2>Looking for an opponent</h2>
                <p>This won't take long...</p>
                <button className="btn-ghost" onClick={handleCancelSearch}>
                  Cancel
                </button>
              </div>
            )}
            {status === 'joined' && (
              <div className="lobby-found">
                <div className="lobby-found-icon">🎯</div>
                <h2>Opponent found!</h2>
                <p>Taking you to the game...</p>
              </div>
            )}
          </div>
        )}

        {mode === 'private' && status === 'idle' && (
          <div className="lobby-private">

            <div className="lobby-card">
              <h2>Create a Room</h2>
              <p>Get a 6-digit code to share with your friend</p>
              <button className="btn-primary" onClick={handleCreateRoom}>
                Create Room
              </button>
            </div>

            <div className="lobby-or">OR</div>

            <div className="lobby-card">
              <h2>Join a Room</h2>
              <p>Enter the code your friend shared with you</p>
              <div className="lobby-input-row">
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="lobby-code-input"
                />
                <button className="btn-primary" onClick={handleJoinRoom}>
                  Join
                </button>
              </div>
              {error && <p className="lobby-error">{error}</p>}
            </div>

          </div>
        )}

        {mode === 'private' && status === 'waiting' && (
          <div className="lobby-card lobby-waiting">
            <h2>Room Created!</h2>
            <div className="lobby-room-code">{roomCode}</div>
            <p>Share this code with your friend</p>
            <div className="lobby-players">
              <div className="lobby-player active">You ✓</div>
              <div className="lobby-player-dots">
                <span /><span /><span />
              </div>
              <div className={`lobby-player ${playerCount === 2 ? 'active' : 'waiting'}`}>
                {playerCount === 2 ? 'Friend ✓' : 'Waiting...'}
              </div>
            </div>
            <button className="btn-ghost" onClick={() => {
              socketRef.current.emit('cancel_search')
              setStatus('idle')
            }}>
              Cancel
            </button>
          </div>
        )}

        {mode === 'private' && status === 'joined' && (
          <div className="lobby-card lobby-found">
            <div className="lobby-found-icon">🎯</div>
            <h2>Opponent joined!</h2>
            <p>Taking you to the game...</p>
          </div>
        )}

      </div>
    </div>
  )
}