const SETTINGS_KEY = "multi_reversi_settings_v1";
const GAME_KEY = "multi_reversi_game_v1";

const DEFAULT_SETTINGS = {
  playerCount: 2,
  boardSize: 8,
  players: [
    { name: "プレイヤー1", color: "#111111", isCpu: false, cpuLevel: 1 },
    { name: "プレイヤー2", color: "#ffffff", isCpu: false, cpuLevel: 1 },
    { name: "プレイヤー3", color: "#ef4444", isCpu: true, cpuLevel: 1 },
    { name: "プレイヤー4", color: "#3b82f6", isCpu: true, cpuLevel: 1 }
  ]
};

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];

const settingsScreen = document.getElementById("settingsScreen");
const gameScreen = document.getElementById("gameScreen");
const playerCountSelect = document.getElementById("playerCount");
const boardSizeSelect = document.getElementById("boardSize");
const playersConfig = document.getElementById("playersConfig");
const startGameButton = document.getElementById("startGameButton");
const resetGameButton = document.getElementById("resetGameButton");
const boardEl = document.getElementById("board");
const turnInfoEl = document.getElementById("turnInfo");
const statusInfoEl = document.getElementById("statusInfo");
const scoreBoardEl = document.getElementById("scoreBoard");

let settings = loadSettings();
let gameState = loadGame();

renderSettings();

if (gameState) {
  showGameScreen();
  renderGame();
  maybeRunCpuTurn();
} else {
  showSettingsScreen();
}

playerCountSelect.addEventListener("change", () => {
  settings.playerCount = Number(playerCountSelect.value);
  saveSettings(settings);
  renderSettings();
});

boardSizeSelect.addEventListener("change", () => {
  settings.boardSize = Number(boardSizeSelect.value);
  saveSettings(settings);
});

startGameButton.addEventListener("click", () => {
  settings = collectSettingsFromForm();
  saveSettings(settings);
  gameState = createNewGame(settings);
  saveGame(gameState);
  showGameScreen();
  renderGame();
  maybeRunCpuTurn();
});

resetGameButton.addEventListener("click", () => {
  localStorage.removeItem(GAME_KEY);
  gameState = null;
  settings = loadSettings();
  renderSettings();
  showSettingsScreen();
});

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!saved) {
      return structuredClone(DEFAULT_SETTINGS);
    }
    return normalizeSettings(saved);
  } catch (error) {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function saveSettings(nextSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(nextSettings)));
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_KEY));
    if (!saved) {
      return null;
    }
    return saved;
  } catch (error) {
    return null;
  }
}

function saveGame(nextGame) {
  localStorage.setItem(GAME_KEY, JSON.stringify(nextGame));
}

function normalizeSettings(raw) {
  const normalized = structuredClone(DEFAULT_SETTINGS);

  normalized.playerCount = clamp(Number(raw.playerCount) || 2, 2, 4);
  normalized.boardSize = normalizeBoardSize(Number(raw.boardSize) || 8);

  normalized.players = [0, 1, 2, 3].map((index) => {
    const source = raw.players && raw.players[index] ? raw.players[index] : DEFAULT_SETTINGS.players[index];
    return {
      name: `プレイヤー${index + 1}`,
      color: source.color || DEFAULT_SETTINGS.players[index].color,
      isCpu: Boolean(source.isCpu),
      cpuLevel: clamp(Number(source.cpuLevel) || 1, 1, 3)
    };
  });

  return normalized;
}

function normalizeBoardSize(size) {
  const allowed = [6, 8, 10, 12];
  return allowed.includes(size) ? size : 8;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderSettings() {
  playerCountSelect.value = String(settings.playerCount);
  boardSizeSelect.value = String(settings.boardSize);

  playersConfig.innerHTML = "";

  settings.players.forEach((player, index) => {
    const enabled = index < settings.playerCount;
    const card = document.createElement("div");
    card.className = `player-card${enabled ? "" : " disabled"}`;

    card.innerHTML = `
      <h3>プレイヤー${index + 1}</h3>
      <div class="field-row">
        <label for="playerColor${index}">駒の色</label>
        <input id="playerColor${index}" type="color" value="${player.color}" ${enabled ? "" : "disabled"}>
      </div>
      <div class="field-row">
        <label for="playerType${index}">操作</label>
        <select id="playerType${index}" ${enabled ? "" : "disabled"}>
          <option value="human" ${!player.isCpu ? "selected" : ""}>人間</option>
          <option value="cpu-easy" ${player.isCpu && player.cpuLevel === 1 ? "selected" : ""}>CPU(やさしい)</option>
          <option value="cpu-normal" ${player.isCpu && player.cpuLevel === 2 ? "selected" : ""}>CPU(ふつう)</option>
          <option value="cpu-hard" ${player.isCpu && player.cpuLevel === 3 ? "selected" : ""}>CPU(つよい)</option>
        </select>
      </div>
    `;

    playersConfig.appendChild(card);

    const colorInput = card.querySelector(`#playerColor${index}`);
    const typeSelect = card.querySelector(`#playerType${index}`);

    colorInput.addEventListener("input", () => {
      settings.players[index].color = colorInput.value;
      saveSettings(settings);
    });

    typeSelect.addEventListener("change", () => {
      const value = typeSelect.value;
      if (value === "human") {
        settings.players[index].isCpu = false;
        settings.players[index].cpuLevel = 1;
      } else if (value === "cpu-easy") {
        settings.players[index].isCpu = true;
        settings.players[index].cpuLevel = 1;
      } else if (value === "cpu-normal") {
        settings.players[index].isCpu = true;
        settings.players[index].cpuLevel = 2;
      } else if (value === "cpu-hard") {
        settings.players[index].isCpu = true;
        settings.players[index].cpuLevel = 3;
      }
      saveSettings(settings);
    });
  });
}

function collectSettingsFromForm() {
  const nextSettings = {
    playerCount: Number(playerCountSelect.value),
    boardSize: Number(boardSizeSelect.value),
    players: settings.players.map((player, index) => {
      const colorInput = document.getElementById(`playerColor${index}`);
      const typeSelect = document.getElementById(`playerType${index}`);
      let isCpu = false;
      let cpuLevel = 1;
      if (typeSelect) {
        const value = typeSelect.value;
        if (value === "human") {
          isCpu = false;
          cpuLevel = 1;
        } else if (value === "cpu-easy") {
          isCpu = true;
          cpuLevel = 1;
        } else if (value === "cpu-normal") {
          isCpu = true;
          cpuLevel = 2;
        } else if (value === "cpu-hard") {
          isCpu = true;
          cpuLevel = 3;
        }
      }
      return {
        name: `プレイヤー${index + 1}`,
        color: colorInput ? colorInput.value : player.color,
        isCpu,
        cpuLevel
      };
    })
  };

  return normalizeSettings(nextSettings);
}

function showSettingsScreen() {
  settingsScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
}

function showGameScreen() {
  settingsScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
}

function createEmptyBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function createNewGame(nextSettings) {
  const size = nextSettings.boardSize;
  const playerCount = nextSettings.playerCount;
  const activePlayers = nextSettings.players.slice(0, playerCount);

  const board = createEmptyBoard(size);
  setupInitialBoard(board, playerCount);

  const state = {
    board,
    boardSize: size,
    currentPlayer: 0,
    players: activePlayers,
    winnerIndices: [],
    isFinished: false,
    consecutivePasses: 0,
    moveCount: countOccupied(board),
    message: "ゲーム開始"
  };

  const validMoves = getValidMoves(state, state.currentPlayer);
  if (validMoves.length === 0) {
    advanceTurn(state, "開始時に置ける場所がないためパス");
  }

  return state;
}

function setupInitialBoard(board, playerCount) {
  const size = board.length;
  const center = Math.floor(size / 2);

  if (playerCount === 2) {
    const mid1 = size / 2 - 1;
    const mid2 = size / 2;

    board[mid1][mid1] = 0;
    board[mid1][mid2] = 1;
    board[mid2][mid1] = 1;
    board[mid2][mid2] = 0;
    return;
  }

  if (playerCount === 3) {
    // 3x4 の中央ブロックを使用し、各プレイヤー4個ずつ配置
    const startRow = center - 2;
    const startCol = center - 2;

    const pattern = [
      [0, 1, 2, 0],
      [2, 0, 1, 2],
      [1, 2, 0, 1]
    ];

    for (let r = 0; r < pattern.length; r += 1) {
      for (let c = 0; c < pattern[r].length; c += 1) {
        board[startRow + r][startCol + c] = pattern[r][c];
      }
    }
    return;
  }

  if (playerCount === 4) {
    // 4x4 の中央ブロックを使用し、各プレイヤー4個ずつ配置
    const startRow = center - 2;
    const startCol = center - 2;

    const pattern = [
      [0, 1, 2, 3],
      [3, 0, 1, 2],
      [2, 3, 0, 1],
      [1, 2, 3, 0]
    ];

    for (let r = 0; r < pattern.length; r += 1) {
      for (let c = 0; c < pattern[r].length; c += 1) {
        board[startRow + r][startCol + c] = pattern[r][c];
      }
    }
  }
}

function renderGame() {
  if (!gameState) {
    return;
  }

  renderBoard();
  renderScoreBoard();
  renderStatus();
}

function renderBoard() {
  const size = gameState.boardSize;
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

  const validMoves = getValidMoves(gameState, gameState.currentPlayer);
  const validMap = new Map(
    validMoves.map((move) => [`${move.row},${move.col}`, move])
  );

  gameState.board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const cellEl = document.createElement("button");
      cellEl.className = "cell";
      cellEl.type = "button";

      const key = `${rowIndex},${colIndex}`;
      const move = validMap.get(key);
      const isHumanTurn = !gameState.players[gameState.currentPlayer].isCpu && !gameState.isFinished;

      if (move && isHumanTurn) {
        cellEl.classList.add("valid");
        cellEl.addEventListener("click", () => {
          handleMove(rowIndex, colIndex);
        });
      } else {
        cellEl.classList.add("disabled");
      }

      if (cell !== null) {
        const discEl = document.createElement("div");
        discEl.className = "disc";
        discEl.style.background = gameState.players[cell].color;
        cellEl.appendChild(discEl);
      }

      boardEl.appendChild(cellEl);
    });
  });
}

function renderScoreBoard() {
  const counts = getScores(gameState.board, gameState.players.length);
  scoreBoardEl.innerHTML = "";

  gameState.players.forEach((player, index) => {
    const item = document.createElement("div");
    item.className = `score-item${gameState.currentPlayer === index && !gameState.isFinished ? " current" : ""}`;

    const roleText = player.isCpu
      ? `CPU(${cpuLabel(player.cpuLevel)})`
      : "人間";

    item.innerHTML = `
      <div class="color-chip" style="background:${player.color}"></div>
      <div>
        <div>${player.name}</div>
        <div style="font-size: 0.85rem; color: #cbd5e1;">${roleText}</div>
      </div>
      <div>${counts[index]}</div>
    `;

    scoreBoardEl.appendChild(item);
  });

  if (gameState.isFinished) {
    const winnerBox = document.createElement("div");
    winnerBox.className = "winner-box";

    if (gameState.winnerIndices.length === 1) {
      winnerBox.textContent = `勝者: ${gameState.players[gameState.winnerIndices[0]].name}`;
    } else {
      const names = gameState.winnerIndices.map((index) => gameState.players[index].name).join(" / ");
      winnerBox.textContent = `引き分け: ${names}`;
    }

    scoreBoardEl.appendChild(winnerBox);
  }
}

function renderStatus() {
  const current = gameState.players[gameState.currentPlayer];
  const validMoves = getValidMoves(gameState, gameState.currentPlayer);

  if (gameState.isFinished) {
    turnInfoEl.textContent = "対局終了";
  } else {
    turnInfoEl.textContent = `現在の手番: ${current.name}`;
  }

  statusInfoEl.textContent = `${gameState.message} / 置ける場所: ${validMoves.length}`;
}

function cpuLabel(level) {
  if (level === 1) {
    return "やさしい";
  }
  if (level === 2) {
    return "ふつう";
  }
  return "つよい";
}

function handleMove(row, col) {
  if (!gameState || gameState.isFinished) {
    return;
  }

  const player = gameState.players[gameState.currentPlayer];
  if (player.isCpu) {
    return;
  }

  const validMoves = getValidMoves(gameState, gameState.currentPlayer);
  const target = validMoves.find((move) => move.row === row && move.col === col);

  if (!target) {
    return;
  }

  applyMove(gameState, target);
  saveGame(gameState);
  renderGame();
  maybeRunCpuTurn();
}

function maybeRunCpuTurn() {
  if (!gameState || gameState.isFinished) {
    return;
  }

  const player = gameState.players[gameState.currentPlayer];
  if (!player.isCpu) {
    return;
  }

  setTimeout(() => {
    if (!gameState || gameState.isFinished) {
      return;
    }

    const move = chooseCpuMove(gameState, gameState.currentPlayer, player.cpuLevel);

    if (!move) {
      advanceTurn(gameState, `${player.name} はパス`);
      saveGame(gameState);
      renderGame();
      maybeRunCpuTurn();
      return;
    }

    applyMove(gameState, move);
    saveGame(gameState);
    renderGame();
    maybeRunCpuTurn();
  }, 450);
}

function chooseCpuMove(state, playerIndex, level) {
  const moves = getValidMoves(state, playerIndex);

  if (moves.length === 0) {
    return null;
  }

  if (level === 1) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (level === 2) {
    return chooseBestByGreedy(state, playerIndex, moves);
  }

  return chooseBestByEvaluation(state, playerIndex, moves);
}

function chooseBestByGreedy(state, playerIndex, moves) {
  let bestScore = -Infinity;
  let bestMoves = [];

  moves.forEach((move) => {
    const gain = move.flips.length;
    const cornerBonus = isCorner(state.boardSize, move.row, move.col) ? 100 : 0;
    const edgeBonus = isEdge(state.boardSize, move.row, move.col) ? 10 : 0;
    const score = gain * 10 + cornerBonus + edgeBonus;

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  });

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function chooseBestByEvaluation(state, playerIndex, moves) {
  let bestScore = -Infinity;
  let bestMoves = [];

  moves.forEach((move) => {
    const simulated = cloneGameState(state);
    applyMove(simulated, move, true);

    const myScore = getScores(simulated.board, simulated.players.length)[playerIndex];
    const myMobility = getValidMoves(simulated, playerIndex).length;

    let opponentMobility = 0;
    for (let i = 0; i < simulated.players.length; i += 1) {
      if (i !== playerIndex) {
        opponentMobility += getValidMoves(simulated, i).length;
      }
    }

    let score = 0;
    score += myScore * 4;
    score += move.flips.length * 8;
    score += myMobility * 6;
    score -= opponentMobility * 3;

    if (isCorner(simulated.boardSize, move.row, move.col)) {
      score += 200;
    } else if (isEdge(simulated.boardSize, move.row, move.col)) {
      score += 20;
    }

    if (isDangerNearCorner(simulated.boardSize, move.row, move.col)) {
      score -= 40;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  });

  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function applyMove(state, move, skipCpuLoop = false) {
  const playerIndex = state.currentPlayer;

  state.board[move.row][move.col] = playerIndex;
  move.flips.forEach(([row, col]) => {
    state.board[row][col] = playerIndex;
  });

  state.moveCount = countOccupied(state.board);
  state.consecutivePasses = 0;
  state.message = `${state.players[playerIndex].name} が (${move.row + 1}, ${move.col + 1}) に配置`;

  advanceTurn(state, null, skipCpuLoop);
}

function advanceTurn(state, forcedMessage = null) {
  if (isBoardFull(state.board)) {
    finishGame(state);
    return;
  }

  let nextPlayer = state.currentPlayer;
  let passCount = 0;

  for (let step = 1; step <= state.players.length; step += 1) {
    const candidate = (state.currentPlayer + step) % state.players.length;
    const validMoves = getValidMoves(state, candidate);

    if (validMoves.length > 0) {
      nextPlayer = candidate;
      state.currentPlayer = nextPlayer;
      state.message = forcedMessage || state.message;
      return;
    }

    passCount += 1;
  }

  state.consecutivePasses += passCount;

  if (passCount >= state.players.length - 1) {
    finishGame(state);
    return;
  }

  state.currentPlayer = nextPlayer;
  state.message = forcedMessage || "全員パス";
}

function finishGame(state) {
  state.isFinished = true;
  const scores = getScores(state.board, state.players.length);
  const max = Math.max(...scores);
  state.winnerIndices = scores
    .map((score, index) => ({ score, index }))
    .filter((item) => item.score === max)
    .map((item) => item.index);
  state.message = "対局が終了しました";
}

function getValidMoves(state, playerIndex) {
  if (state.isFinished) {
    return [];
  }

  const size = state.boardSize;
  const moves = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (state.board[row][col] !== null) {
        continue;
      }

      const flips = getFlipsForMove(state.board, size, row, col, playerIndex);
      if (flips.length > 0) {
        moves.push({ row, col, flips });
      }
    }
  }

  return moves;
}

function getFlipsForMove(board, size, row, col, playerIndex) {
  const allFlips = [];

  DIRECTIONS.forEach(([dr, dc]) => {
    let r = row + dr;
    let c = col + dc;
    const line = [];
    let foundOpponent = false;

    while (isInside(size, r, c)) {
      const cell = board[r][c];

      if (cell === null) {
        line.length = 0;
        break;
      }

      if (cell === playerIndex) {
        if (foundOpponent) {
          allFlips.push(...line);
        }
        break;
      }

      foundOpponent = true;
      line.push([r, c]);
      r += dr;
      c += dc;
    }
  });

  return allFlips;
}

function isInside(size, row, col) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

function getScores(board, playerCount) {
  const counts = Array(playerCount).fill(0);

  board.forEach((row) => {
    row.forEach((cell) => {
      if (cell !== null) {
        counts[cell] += 1;
      }
    });
  });

  return counts;
}

function countOccupied(board) {
  let count = 0;
  board.forEach((row) => {
    row.forEach((cell) => {
      if (cell !== null) {
        count += 1;
      }
    });
  });
  return count;
}

function isBoardFull(board) {
  return countOccupied(board) === board.length * board.length;
}

function cloneGameState(state) {
  return {
    ...state,
    board: state.board.map((row) => [...row]),
    players: state.players.map((player) => ({ ...player })),
    winnerIndices: [...state.winnerIndices]
  };
}

function isCorner(size, row, col) {
  return (
    (row === 0 && col === 0) ||
    (row === 0 && col === size - 1) ||
    (row === size - 1 && col === 0) ||
    (row === size - 1 && col === size - 1)
  );
}

function isEdge(size, row, col) {
  return row === 0 || col === 0 || row === size - 1 || col === size - 1;
}

function isDangerNearCorner(size, row, col) {
  const dangerPositions = [
    [0, 1], [1, 0], [1, 1],
    [0, size - 2], [1, size - 1], [1, size - 2],
    [size - 2, 0], [size - 1, 1], [size - 2, 1],
    [size - 2, size - 1], [size - 1, size - 2], [size - 2, size - 2]
  ];

  return dangerPositions.some(([r, c]) => r === row && c === col);
}