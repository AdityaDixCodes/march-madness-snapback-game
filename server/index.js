require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Groq = require('groq-sdk');
const playersData = require('./data/players.json');
const teamsData = require('./data/teams.json');

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ── Groq API proxy route ──
app.post('/api/ask', async (req, res) => {
  const { question, subject, subjectMode } = req.body;

  const systemPrompt = `You are hosting a deduction game called "Who's In Your Bracket?" based on the 2026 NCAA March Madness tournament.

You have secretly selected this ${subjectMode === 'player' ? 'player' : 'team'}:
${JSON.stringify(subject, null, 2)}

The player is trying to figure out who you picked by asking yes/no questions.

Rules you must follow:
- Answer ONLY with "Yes" or "No" followed by one short sentence of personality (max 10 words)
- Base your answer strictly on the data above — never lie
- Never reveal the name directly
- Be slightly competitive and fun in tone
- If asked something you cannot determine from the data, answer "No"

Example responses:
"Yes. This player knows how to score."
"No. Wrong conference entirely."
"Yes. Definitely not a bench warmer."`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 100,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ]
    });

    const answer = completion.choices[0].message.content;
    res.json({ answer });

  } catch (err) {
    console.error('Groq error:', err.message);
    res.status(500).json({ error: 'Failed to get response' });
  }
});

// ── Matchmaking & Room State ──
let waitingQueue = [];
const rooms = {};
const roomModes = {};
const roomReady = {};
const roomGrids = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRandomGrid(pool, count = 24) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
  console.log('First player photo_url:', grid[0].photo_url);
  return grid;
}

// ── Socket.io ──
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Quick Match
  socket.on('find_game', ({ subjectMode } = {}) => {
    console.log('find_game received from:', socket.id, 'mode:', subjectMode);
    const waiting = waitingQueue.find(p => p.id !== socket.id);
    if (waiting) {
      waitingQueue = waitingQueue.filter(p => p.id !== waiting.id);
      const roomCode = generateRoomCode();
      rooms[roomCode] = [waiting.id, socket.id];
      const mode = subjectMode || waiting.subjectMode || 'player';
      roomModes[roomCode] = mode;

      // Generate shared grid immediately at match time
      const pool = mode === 'player' ? playersData : teamsData;
      roomGrids[roomCode] = getRandomGrid(pool, 24);
      console.log('Grid generated for room:', roomCode, 'length:', roomGrids[roomCode].length);

      socket.join(roomCode);
      io.sockets.sockets.get(waiting.id)?.join(roomCode);
      io.to(roomCode).emit('match_found', { roomCode });
      console.log('Match found, room:', roomCode);
    } else {
      waitingQueue.push({ id: socket.id, subjectMode: subjectMode || 'player' });
      socket.emit('waiting_for_opponent');
      console.log('Added to queue, queue length:', waitingQueue.length);
    }
  });

  // Cancel search
  socket.on('cancel_search', () => {
    waitingQueue = waitingQueue.filter(p => p.id !== socket.id);
    console.log('Player cancelled search:', socket.id);
  });

  // Create private room
  socket.on('create_room', () => {
    console.log('create_room received from:', socket.id);
    const roomCode = generateRoomCode();
    rooms[roomCode] = [socket.id];
    socket.join(roomCode);
    socket.emit('room_created', { roomCode });
    console.log('Room created:', roomCode);
  });

  // Join private room
  socket.on('join_room', ({ roomCode }) => {
    console.log('join_room received, code:', roomCode);
    const room = rooms[roomCode];
    if (!room) {
      socket.emit('room_error', { message: 'Room not found. Check the code and try again.' });
      return;
    }
    if (room.length >= 2) {
      socket.emit('room_error', { message: 'Room is full.' });
      return;
    }
    rooms[roomCode].push(socket.id);
    socket.join(roomCode);

    // Generate grid when second player joins private room
    if (!roomGrids[roomCode]) {
      const mode = roomModes[roomCode] || 'player';
      const pool = mode === 'player' ? playersData : teamsData;
      roomGrids[roomCode] = getRandomGrid(pool, 24);
      console.log('Grid generated for private room:', roomCode);
    }

    socket.emit('room_joined', { roomCode });
    socket.to(roomCode).emit('player_joined');
    console.log('Player joined room:', roomCode);
  });

  // Rejoin room after navigation to MultiSetup
  socket.on('rejoin_room', ({ roomCode, originalSocketId }) => {

    console.log('rejoin_room received')
    console.log('roomCode:', roomCode)
    console.log('originalSocketId received:', originalSocketId)
    console.log('rooms[roomCode]:', rooms[roomCode])
    console.log('room[0]:', rooms[roomCode]?.[0])
    console.log('match?', rooms[roomCode]?.[0] === originalSocketId)

    const room = rooms[roomCode];
    if (!room) {
      console.log('Room not found:', roomCode);
      return;
    }
    socket.join(roomCode);

    // Use originalSocketId to determine host
    const isHost = room[0] === originalSocketId;

    // Generate grid if somehow not done yet
    if (!roomGrids[roomCode]) {
      const mode = roomModes[roomCode] || 'player';
      const pool = mode === 'player' ? playersData : teamsData;
      roomGrids[roomCode] = getRandomGrid(pool, 24);
      console.log('Grid generated as fallback in rejoin_room:', roomCode);
    }

    console.log(`Player ${socket.id} rejoined room ${roomCode}, originalId: ${originalSocketId}, isHost: ${isHost}`);
    console.log('Sending grid length:', roomGrids[roomCode].length);

    socket.emit('room_state', {
      isHost,
      subjectMode: roomModes[roomCode] || 'player',
      grid: roomGrids[roomCode]
    });
  });

  // Host changes mode
  socket.on('change_mode', ({ roomCode, subjectMode }) => {
    roomModes[roomCode] = subjectMode;
    const pool = subjectMode === 'player' ? playersData : teamsData;
    roomGrids[roomCode] = getRandomGrid(pool, 24);
    socket.to(roomCode).emit('mode_changed', {
      subjectMode,
      grid: roomGrids[roomCode]
    });
    socket.emit('room_state', {
      isHost: true,
      subjectMode,
      grid: roomGrids[roomCode]
    });
    console.log(`Mode changed to ${subjectMode} in room ${roomCode}`);
  });

  // Player ready
socket.on('player_ready', ({ roomCode, subjectId }) => {
  if (!roomReady[roomCode]) roomReady[roomCode] = {};
  roomReady[roomCode][socket.id] = { subjectId };
  socket.to(roomCode).emit('opponent_ready');
  console.log(`Player ready in room ${roomCode}, subjectId: ${subjectId}`);
  console.log('Ready players so far:', Object.keys(roomReady[roomCode]));

  const readyPlayers = Object.keys(roomReady[roomCode]);
  console.log('Ready count:', readyPlayers.length);
  if (readyPlayers.length === 2) {
    console.log('Both ready, emitting game_starting');
    const player1 = roomReady[roomCode][readyPlayers[0]];
    const player2 = roomReady[roomCode][readyPlayers[1]];
    const sharedGrid = roomGrids[roomCode];
    const sharedMode = roomModes[roomCode] || 'player';

    io.to(readyPlayers[0]).emit('game_starting', {
      grid: sharedGrid,
      subjectMode: sharedMode,
      opponentSubjectId: player2.subjectId,
      mySubjectId: player1.subjectId,
      originalSocketId: readyPlayers[0]
    });
    io.to(readyPlayers[1]).emit('game_starting', {
      grid: sharedGrid,
      subjectMode: sharedMode,
      opponentSubjectId: player1.subjectId,
      mySubjectId: player2.subjectId,
      originalSocketId: readyPlayers[1]
    });
    console.log(`Game starting in room ${roomCode}`);
  }
});

  // Rejoin game after navigation to MultiPlay
  socket.on('rejoin_game', ({ roomCode, originalSocketId }) => {
    const room = rooms[roomCode];
    if (!room) {
      console.log('Room not found for rejoin_game:', roomCode);
      return;
    }
    socket.join(roomCode);
    const isFirstTurn = room[0] === originalSocketId;
    socket.emit('game_init', {
      isFirstTurn,
      grid: roomGrids[roomCode]
    });
    console.log(`Player rejoined game in room ${roomCode}, originalId: ${originalSocketId}, first turn: ${isFirstTurn}`);
  });

  // Ask question
  socket.on('ask_question', ({ roomCode, question }) => {
    socket.to(roomCode).emit('question_received', { question });
    console.log(`Question in room ${roomCode}: ${question}`);
  });

  // Answer question
// Answer question
socket.on('answer_question', ({ roomCode, question, answer }) => {
  console.log('answer_question received in room:', roomCode)
  console.log('Emitting turn_changed true to opponent, false to answerer')
  socket.to(roomCode).emit('answer_received', { question, answer })
  socket.to(roomCode).emit('turn_changed', { isYourTurn: true })
  socket.emit('turn_changed', { isYourTurn: false })
  console.log(`Answer in room ${roomCode}: ${answer}`)
})
  // Make guess
  socket.on('make_guess', ({ roomCode, guessId, correct, name }) => {
    socket.to(roomCode).emit('opponent_guessed', { correct, name });
    if (!correct) {
      socket.to(roomCode).emit('turn_changed', { isYourTurn: true });
      socket.emit('turn_changed', { isYourTurn: false });
    }
  });

  // Turn timeout
  socket.on('turn_timeout', ({ roomCode }) => {
    socket.to(roomCode).emit('turn_changed', { isYourTurn: true });
    socket.emit('turn_changed', { isYourTurn: false });
  });

  // Game timeout
  socket.on('game_timeout', ({ roomCode, eliminatedCount }) => {
    if (!roomReady[roomCode]) roomReady[roomCode] = {};
    roomReady[roomCode][`timeout_${socket.id}`] = { eliminatedCount };
    const timeoutPlayers = Object.keys(roomReady[roomCode]).filter(k => k.startsWith('timeout_'));
    if (timeoutPlayers.length === 2) {
      const p1 = roomReady[roomCode][timeoutPlayers[0]];
      const p2 = roomReady[roomCode][timeoutPlayers[1]];
      const winner = p1.eliminatedCount > p2.eliminatedCount
        ? timeoutPlayers[0].replace('timeout_', '')
        : p2.eliminatedCount > p1.eliminatedCount
          ? timeoutPlayers[1].replace('timeout_', '')
          : null;
      io.to(roomCode).emit('game_over', {
        reason: winner
          ? `⏰ Time's up! The player who eliminated the most cards wins!`
          : `⏰ Time's up! It's a draw!`,
        winner
      });
    }
  });

  socket.on('disconnect', () => {
    waitingQueue = waitingQueue.filter(p => p.id !== socket.id);
    for (const [roomCode, players] of Object.entries(rooms)) {
      if (players.includes(socket.id)) {
        socket.to(roomCode).emit('opponent_disconnected');
        break;
      }
    }
    console.log('Player disconnected:', socket.id);
  });
});

server.listen(3001, () => {
  console.log('Server running on port 3001');
});