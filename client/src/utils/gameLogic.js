// ============================================================
// MARCH MADNESS DEDUCTION GAME — CORE GAME LOGIC
// ============================================================

// ------------------------------------------------------------
// GRID UTILITIES
// ------------------------------------------------------------

/**
 * Randomly selects `count` subjects from a pool.
 * Used at game start to build the 24-card grid.
 * @param {Array} pool - Full array of players or teams
 * @param {number} count - Number of cards to select (default 24)
 * @returns {Array} - Shuffled subset of the pool
 */
function getRandomGrid(pool, count = 24) {
  if (pool.length < count) {
    throw new Error(`Pool size (${pool.length}) is smaller than requested grid size (${count})`);
  }
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Randomly selects a hidden subject from the grid.
 * Used in AI mode and in multiplayer random pick mode.
 * @param {Array} grid - The 24-card grid
 * @returns {Object} - The selected hidden subject
 */
function selectHiddenSubject(grid) {
  const index = Math.floor(Math.random() * grid.length);
  return grid[index];
}

// ------------------------------------------------------------
// QUESTION EVALUATION — PLAYER MODE
// ------------------------------------------------------------

/**
 * Evaluates a yes/no question about a player.
 * Returns true (yes) or false (no).
 *
 * Supported attributes:
 *   position        — "Guard" | "Forward" | "Center"
 *   ppg_range       — "under10" | "10to15" | "15to20" | "20plus"
 *   height_range    — "under6ft3" | "6ft3to6ft6" | "6ft7plus"
 *   class_year      — "Freshman" | "Sophomore" | "Junior" | "Senior"
 *   conference      — exact string e.g. "ACC", "Big Ten"
 *   starter         — true | false
 *   team            — exact team name string
 *
 * @param {Object} subject - Player object from players.json
 * @param {string} attribute - The attribute being questioned
 * @param {*} value - The value to compare against
 * @returns {boolean}
 */
function evaluatePlayerQuestion(subject, attribute, value) {
  switch (attribute) {
    case "position":
      return subject.position === value;

    case "ppg_range": {
      const ppg = subject.ppg;
      if (value === "under10")  return ppg < 10;
      if (value === "10to15")   return ppg >= 10 && ppg < 15;
      if (value === "15to20")   return ppg >= 15 && ppg < 20;
      if (value === "20plus")   return ppg >= 20;
      return false;
    }

    case "height_range": {
      const totalInches = subject.height_ft * 12 + subject.height_in;
      if (value === "under6ft3")    return totalInches < 75;  // under 6'3"
      if (value === "6ft3to6ft6")   return totalInches >= 75 && totalInches <= 78; // 6'3" to 6'6"
      if (value === "6ft7plus")     return totalInches > 78;  // over 6'6"
      return false;
    }

    case "class_year":
      return subject.class_year === value;

    case "conference":
      return subject.conference === value;

    case "starter":
      return subject.starter === value;

    case "team":
      return subject.team === value;

    default:
      console.warn(`Unknown player attribute: ${attribute}`);
      return false;
  }
}

// ------------------------------------------------------------
// QUESTION EVALUATION — TEAM MODE
// ------------------------------------------------------------

/**
 * Evaluates a yes/no question about a team.
 * Returns true (yes) or false (no).
 *
 * Supported attributes:
 *   conference      — exact string e.g. "SEC", "Big Ten"
 *   region          — "East" | "West" | "Midwest" | "South"
 *   state           — exact state string e.g. "North Carolina"
 *   mascot_type     — "Animal" | "Bird" | "Person" | "Mythical" | "Other"
 *   public          — true | false
 *   championships   — "none" | "one" | "multiple" (0, 1, 2+)
 *   color           — checks if a color appears in the colors array
 *
 * @param {Object} subject - Team object from teams.json
 * @param {string} attribute - The attribute being questioned
 * @param {*} value - The value to compare against
 * @returns {boolean}
 */
function evaluateTeamQuestion(subject, attribute, value) {
  switch (attribute) {
    case "conference":
      return subject.conference === value;

    case "region":
      return subject.region === value;

    case "state":
      return subject.state === value;

    case "mascot_type":
      return subject.mascot_type === value;

    case "public":
      return subject.public === value;

    case "championships": {
      if (value === "none")     return subject.championships === 0;
      if (value === "one")      return subject.championships === 1;
      if (value === "multiple") return subject.championships > 1;
      return false;
    }

    case "color":
      return subject.colors.some(c =>
        c.toLowerCase().includes(value.toLowerCase())
      );

    default:
      console.warn(`Unknown team attribute: ${attribute}`);
      return false;
  }
}

// ------------------------------------------------------------
// GRID ELIMINATION
// ------------------------------------------------------------

/**
 * Filters the grid based on a yes/no answer to a question.
 * Returns a new grid with non-matching cards removed.
 *
 * @param {Array} grid - Current grid of subjects
 * @param {string} mode - "player" or "team"
 * @param {string} attribute - The attribute that was questioned
 * @param {*} value - The value that was questioned
 * @param {boolean} answer - true = yes, false = no
 * @returns {Array} - Filtered grid
 */
function eliminateCards(grid, mode, attribute, value, answer) {
  return grid.filter(subject => {
    const result = mode === "player"
      ? evaluatePlayerQuestion(subject, attribute, value)
      : evaluateTeamQuestion(subject, attribute, value);
    // Keep cards that match the answer
    // If answer is true (yes), keep subjects where result is true
    // If answer is false (no), keep subjects where result is false
    return result === answer;
  });
}

// ------------------------------------------------------------
// GUESS CHECKING
// ------------------------------------------------------------

/**
 * Checks if the player's guess matches the hidden subject.
 * @param {Object} guess - The subject the player guessed
 * @param {Object} hiddenSubject - The actual hidden subject
 * @returns {boolean} - true if correct, false if wrong
 */
function checkGuess(guess, hiddenSubject) {
  return guess.id === hiddenSubject.id;
}

// ------------------------------------------------------------
// GAME STATE FACTORY
// ------------------------------------------------------------

/**
 * Creates a fresh game state object.
 * Used at the start of every new game.
 *
 * @param {string} mode - "ai" or "multiplayer"
 * @param {string} subjectMode - "player" or "team"
 * @param {Array} grid - The 24-card grid for this game
 * @param {number} maxQuestions - Max questions allowed (default 10 for AI)
 * @param {number} maxGuesses - Max guesses allowed (default 3 for AI)
 * @param {number} timerSeconds - Seconds per question (default 90 for AI)
 * @returns {Object} - Game state
 */
function createGameState(
  mode,
  subjectMode,
  grid,
  maxQuestions = 10,
  maxGuesses = 3,
  timerSeconds = 90
) {
  return {
    mode,                         // "ai" | "multiplayer"
    subjectMode,                  // "player" | "team"
    grid: [...grid],              // full 24-card grid (display only)
    activeGrid: [...grid],        // cards still in play (shrinks as eliminated)
    hiddenSubject: null,          // set after subject selection
    questionsAsked: 0,
    questionsRemaining: maxQuestions,
    guessesRemaining: maxGuesses,
    timerSeconds,
    isGameOver: false,
    winner: null,                 // null | "player" | "ai" | "opponent"
    questionHistory: [],          // [{attribute, value, answer}]
  };
}

/**
 * Records a question and its answer into game state history.
 * Also decrements questions remaining.
 *
 * @param {Object} state - Current game state
 * @param {string} attribute - Attribute that was asked about
 * @param {*} value - Value that was asked about
 * @param {boolean} answer - true = yes, false = no
 * @returns {Object} - Updated game state
 */
function recordQuestion(state, attribute, value, answer) {
  const updatedGrid = eliminateCards(
    state.activeGrid,
    state.subjectMode,
    attribute,
    value,
    answer
  );

  return {
    ...state,
    activeGrid: updatedGrid,
    questionsAsked: state.questionsAsked + 1,
    questionsRemaining: state.questionsRemaining - 1,
    questionHistory: [
      ...state.questionHistory,
      { attribute, value, answer }
    ],
    isGameOver: state.questionsRemaining - 1 <= 0 && state.guessesRemaining <= 0,
  };
}

/**
 * Processes a guess attempt.
 * Decrements guesses remaining, sets isGameOver if needed.
 *
 * @param {Object} state - Current game state
 * @param {Object} guess - The subject being guessed
 * @returns {Object} - Updated state with result
 */
function processGuess(state, guess) {
  const correct = checkGuess(guess, state.hiddenSubject);
  const guessesRemaining = state.guessesRemaining - 1;
  const isGameOver = correct || guessesRemaining <= 0;

  return {
    ...state,
    guessesRemaining,
    isGameOver,
    winner: correct ? "player" : (isGameOver ? "ai" : null),
    lastGuessCorrect: correct,
  };
}

// ------------------------------------------------------------
// SCORING (AI MODE)
// ------------------------------------------------------------

/**
 * Calculates the player's score after an AI mode game.
 * Higher score = fewer questions used, more time remaining, fewer guesses used.
 *
 * @param {Object} state - Final game state
 * @param {number} timeRemainingSeconds - Seconds left on the last question timer
 * @param {number} maxQuestions - Max questions allowed in this game
 * @param {number} maxGuesses - Max guesses allowed in this game
 * @returns {number} - Final score
 */
function calculateScore(state, timeRemainingSeconds, maxQuestions = 10, maxGuesses = 3) {
  if (!state.winner || state.winner !== "player") return 0;

  const baseScore = 1000;
  const questionPenalty = state.questionsAsked * 50;       // -50 per question used
  const guessPenalty = (maxGuesses - state.guessesRemaining) * 100; // -100 per wrong guess
  const timeBonus = Math.floor(timeRemainingSeconds * 2);  // +2 per second remaining

  return Math.max(0, baseScore - questionPenalty - guessPenalty + timeBonus);
}

// ------------------------------------------------------------
// EXPORTS (for use in Node/React)
// ------------------------------------------------------------

// Uncomment based on your environment:

// CommonJS (Node/Express backend)
// module.exports = {
//   getRandomGrid,
//   selectHiddenSubject,
//   evaluatePlayerQuestion,
//   evaluateTeamQuestion,
//   eliminateCards,
//   checkGuess,
//   createGameState,
//   recordQuestion,
//   processGuess,
//   calculateScore,
// };

// ES Modules (React frontend)
export {
  getRandomGrid,
  selectHiddenSubject,
  evaluatePlayerQuestion,
  evaluateTeamQuestion,
  eliminateCards,
  checkGuess,
  createGameState,
  recordQuestion,
  processGuess,
  calculateScore,
};
