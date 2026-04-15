const SETTINGS_KEY = 'luckyNumbersSettingsV1';
const STATE_KEY = 'luckyNumbersGameStateV1';

const BOARD_SIZE = 4;
const DIAGONAL_VALUES_FIXED = [1, 7, 13, 20];
const CPU_LEVELS = ['easy', 'medium', 'hard'];

const DEFAULT_SETTINGS = {
  playerCount: 2,
  fixedDiagonal: false,
  players: [
    { kind: 'human', cpuLevel: 'easy', name: 'プレイヤー1' },
    { kind: 'cpu', cpuLevel: 'easy', name: 'プレイヤー2' },
    { kind: 'cpu', cpuLevel: 'medium', name: 'プレイヤー3' },
    { kind: 'cpu', cpuLevel: 'hard', name: 'プレイヤー4' }
  ]
};

let settings = loadSettings();
let state = loadGameState();
let cpuTimer = null;

const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const statusEl = document.getElementById('status');
const messageEl = document.getElementById('message');
const deckCountEl = document.getElementById('deck-count');
const faceupListEl = document.getElementById('faceup-list');
const heldTileEl = document.getElementById('held-tile');
const discardHeldBtn = document.getElementById('discard-held-btn');
const cancelHeldBtn = document.getElementById('cancel-held-btn');
const playersArea = document.getElementById('players-area');
const drawDeckBtn = document.getElementById('draw-deck-btn');
const resetGameBtn = document.getElementById('reset-game-btn');
const newGameBtn = document.getElementById('new-game-btn');

init();

function init() {
  bindGlobalEvents();
  render();
}

function bindGlobalEvents() {
  drawDeckBtn.addEventListener('click', onDrawDeck);
  discardHeldBtn.addEventListener('click', onDiscardHeld);
  cancelHeldBtn.addEventListener('click', onCancelHeld);
  resetGameBtn.addEventListener('click', onResetGame);
  newGameBtn.addEventListener('click', () => {
    startNewGameFromSettings();
  });
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return structuredClone(DEFAULT_SETTINGS);
    }
    const parsed = JSON.parse(raw);
    return normalizeSettings(parsed);
  } catch (error) {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadGameState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.players)) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function saveGameState() {
  if (!state) {
    localStorage.removeItem(STATE_KEY);
    return;
  }
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function clearGameState() {
  localStorage.removeItem(STATE_KEY);
  state = null;
}

function normalizeSettings(input) {
  const base = structuredClone(DEFAULT_SETTINGS);
  const playerCount = clamp(Number(input.playerCount) || 2, 1, 4);
  base.playerCount = playerCount;
  base.fixedDiagonal = Boolean(input.fixedDiagonal);

  if (Array.isArray(input.players)) {
    for (let i = 0; i < 4; i += 1) {
      const src = input.players[i] || {};
      base.players[i] = {
        kind: src.kind === 'cpu' ? 'cpu' : 'human',
        cpuLevel: CPU_LEVELS.includes(src.cpuLevel) ? src.cpuLevel : 'easy',
        name: typeof src.name === 'string' && src.name.trim() ? src.name.trim() : `プレイヤー${i + 1}`
      };
    }
  }

  return base;
}

function render() {
  clearTimeout(cpuTimer);
  cpuTimer = null;

  renderSetupScreen();
  if (state) {
    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    renderGame();
    scheduleCpuIfNeeded();
  } else {
    setupScreen.classList.remove('hidden');
    gameScreen.classList.add('hidden');
  }
}

function renderSetupScreen() {
  const playerRows = Array.from({ length: 4 }, (_, index) => {
    const p = settings.players[index];
    const disabled = index >= settings.playerCount ? 'disabled' : '';
    const currentType = p.kind === 'human' ? 'human' : `cpu-${p.cpuLevel}`;
    return `
      <div class="setup-block">
        <h3>${escapeHtml(`プレイヤー${index + 1}`)}</h3>
        <div class="player-config-list">
          <div class="player-config-row">
            <label for="player-type-${index}">操作</label>
            <select id="player-type-${index}" data-player-index="${index}" data-role="type" ${disabled}>
              <option value="human" ${currentType === 'human' ? 'selected' : ''}>人間</option>
              <option value="cpu-easy" ${currentType === 'cpu-easy' ? 'selected' : ''}>CPU(やさしい)</option>
              <option value="cpu-medium" ${currentType === 'cpu-medium' ? 'selected' : ''}>CPU(ふつう)</option>
              <option value="cpu-hard" ${currentType === 'cpu-hard' ? 'selected' : ''}>CPU(つよい)</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');

  setupScreen.innerHTML = `
    <h2>試合前設定</h2>
    <div class="setup-grid">
      <div class="setup-block">
        <div class="field-row">
          <label for="player-count">プレイヤー人数</label>
          <select id="player-count">
            <option value="1" ${settings.playerCount === 1 ? 'selected' : ''}>1</option>
            <option value="2" ${settings.playerCount === 2 ? 'selected' : ''}>2</option>
            <option value="3" ${settings.playerCount === 3 ? 'selected' : ''}>3</option>
            <option value="4" ${settings.playerCount === 4 ? 'selected' : ''}>4</option>
          </select>
        </div>

        <div class="field-row">
          <label>
            <input type="checkbox" id="fixed-diagonal" ${settings.fixedDiagonal ? 'checked' : ''}>
            初期対角線を 1 / 7 / 13 / 20 に固定
          </label>
        </div>

        <div class="field-row">
          <button id="start-game-btn" type="button" class="primary">ゲーム開始</button>
        </div>

        <div class="small">
          設定はローカルストレージに保存されます。<br>
          対局中は盤面も自動保存され、リロード後に再開できます。
        </div>
      </div>

      <div>
        ${playerRows}
      </div>
    </div>
  `;

  const playerCountSelect = document.getElementById('player-count');
  const fixedDiagonalCheckbox = document.getElementById('fixed-diagonal');
  const startGameBtn = document.getElementById('start-game-btn');

  playerCountSelect.addEventListener('change', (event) => {
    settings.playerCount = clamp(Number(event.target.value), 1, 4);
    saveSettings();
    render();
  });

  fixedDiagonalCheckbox.addEventListener('change', (event) => {
    settings.fixedDiagonal = event.target.checked;
    saveSettings();
  });

  startGameBtn.addEventListener('click', () => {
    startNewGameFromSettings();
  });

  for (let i = 0; i < 4; i += 1) {
    const typeEl = document.getElementById(`player-type-${i}`);

    if (typeEl) {
      typeEl.addEventListener('change', (event) => {
        const value = event.target.value;
        if (value === 'human') {
          settings.players[i].kind = 'human';
          settings.players[i].cpuLevel = 'easy'; // デフォルト
        } else if (value.startsWith('cpu-')) {
          settings.players[i].kind = 'cpu';
          settings.players[i].cpuLevel = value.substring(4); // 'cpu-easy' -> 'easy'
        }
        saveSettings();
      });
    }
  }
}

function startNewGameFromSettings() {
  saveSettings();
  state = createInitialState(settings);
  saveGameState();
  render();
}

function createInitialState(currentSettings) {
  const players = [];
  const drawPile = createShuffledPile(currentSettings.playerCount);
  const faceUp = [];

  for (let i = 0; i < currentSettings.playerCount; i += 1) {
    const board = createEmptyBoard();
    if (currentSettings.fixedDiagonal) {
      for (let d = 0; d < BOARD_SIZE; d += 1) {
        const value = DIAGONAL_VALUES_FIXED[d];
        board[d][d] = value;
        removeOneFromPile(drawPile, value);
      }
    } else {
      const drawn = [];
      for (let d = 0; d < BOARD_SIZE; d += 1) {
        drawn.push(drawPile.pop());
      }
      drawn.sort((a, b) => a - b);
      for (let d = 0; d < BOARD_SIZE; d += 1) {
        board[d][d] = drawn[d];
      }
    }

    players.push({
      id: i,
      name: currentSettings.players[i].name || `プレイヤー${i + 1}`,
      kind: currentSettings.players[i].kind,
      cpuLevel: currentSettings.players[i].cpuLevel,
      board
    });
  }

  return {
    version: 1,
    settingsSnapshot: structuredClone(currentSettings),
    players,
    drawPile,
    faceUp,
    currentPlayer: 0,
    heldTile: null,
    heldFrom: null,
    gameOver: false,
    winners: [],
    resultReason: '',
    turnCount: 1,
    message: 'ゲーム開始',
    lastAction: null
  };
}

function createShuffledPile(playerCount) {
  const pile = [];
  for (let copy = 0; copy < playerCount; copy += 1) {
    for (let value = 1; value <= 20; value += 1) {
      pile.push(value);
    }
  }
  shuffle(pile);
  return pile;
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function removeOneFromPile(pile, value) {
  const index = pile.indexOf(value);
  if (index >= 0) {
    pile.splice(index, 1);
  }
}

function renderGame() {
  const current = getCurrentPlayer();
  const currentIsHuman = current && current.kind === 'human';
  const canDiscardHeld = state.heldTile !== null && state.heldFrom === 'deck' && !state.gameOver;
  const canCancelHeld = state.heldTile !== null && state.heldFrom === 'faceup' && !state.gameOver;

  statusEl.innerHTML = state.gameOver
    ? buildGameOverText()
    : `${escapeHtml(current.name)} の手番 (${state.turnCount} 手目)`;

  messageEl.textContent = state.message || '';

  deckCountEl.textContent = `山札: ${state.drawPile.length} 枚`;

  heldTileEl.className = 'held-tile';
  if (state.heldTile === null) {
    heldTileEl.textContent = 'なし';
    heldTileEl.classList.add('empty');
  } else {
    heldTileEl.textContent = state.heldTile;
  }

  discardHeldBtn.classList.toggle('hidden', !canDiscardHeld);
  cancelHeldBtn.classList.toggle('hidden', !canCancelHeld);
  drawDeckBtn.disabled = !currentIsHuman || state.gameOver || state.heldTile !== null || state.drawPile.length === 0;

  renderFaceUpList(currentIsHuman);
  renderPlayers();
}

function renderFaceUpList(currentIsHuman) {
  faceupListEl.innerHTML = '';

  if (state.faceUp.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'なし';
    empty.className = 'small';
    faceupListEl.appendChild(empty);
    return;
  }

  state.faceUp.forEach((value, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'faceup-tile';
    btn.textContent = value;
    btn.disabled = !currentIsHuman || state.gameOver || state.heldTile !== null;

    btn.addEventListener('click', () => {
      onTakeFaceUp(index);
    });

    faceupListEl.appendChild(btn);
  });
}

function renderPlayers() {
  playersArea.innerHTML = '';

  state.players.forEach((player, playerIndex) => {
    const panel = document.createElement('div');
    panel.className = 'player-panel';
    if (!state.gameOver && state.currentPlayer === playerIndex) {
      panel.classList.add('active');
    }

    const empties = countEmpty(player.board);
    const header = document.createElement('div');
    header.className = 'player-header';
    header.innerHTML = `
      <div>
        <strong>${escapeHtml(player.name)}</strong>
        <div class="player-meta">${player.kind === 'cpu' ? `CPU (${cpuLevelLabel(player.cpuLevel)})` : '人間'}</div>
      </div>
      <div>
        <span class="player-badge">${16 - empties}/16</span>
        ${state.gameOver && state.winners.includes(playerIndex) ? '<span class="player-badge win-badge">勝ち</span>' : ''}
      </div>
    `;

    const board = document.createElement('div');
    board.className = 'board';

    for (let r = 0; r < BOARD_SIZE; r += 1) {
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'board-cell';
        if (r === c) {
          cell.classList.add('diagonal');
        }

        const value = player.board[r][c];
        if (value === null) {
          cell.classList.add('empty');
          cell.textContent = '·';
        } else {
          cell.textContent = value;
        }

        const isCurrentHuman = !state.gameOver &&
          state.currentPlayer === playerIndex &&
          getCurrentPlayer().kind === 'human';

        if (isCurrentHuman && state.heldTile !== null) {
          const valid = canPlaceOnBoard(player.board, r, c, state.heldTile);
          if (valid) {
            cell.classList.add('selectable');
            cell.addEventListener('click', () => {
              onPlaceHeld(playerIndex, r, c);
            });
          } else {
            cell.classList.add('invalid');
          }
        } else {
          cell.disabled = true;
        }

        board.appendChild(cell);
      }
    }

    panel.appendChild(header);
    panel.appendChild(board);
    playersArea.appendChild(panel);
  });
}

function onDrawDeck() {
  if (!state || state.gameOver) {
    return;
  }

  const player = getCurrentPlayer();
  if (player.kind !== 'human') {
    return;
  }
  if (state.heldTile !== null) {
    setMessage('すでに手元にタイルがあります。');
    return;
  }
  if (state.drawPile.length === 0) {
    setMessage('山札はありません。');
    return;
  }

  const value = state.drawPile.pop();
  state.heldTile = value;
  state.heldFrom = 'deck';
  state.message = `山札から ${value} を引きました。盤面に置くか、テーブルに出してください。`;
  saveGameState();
  render();
}

function onTakeFaceUp(index) {
  if (!state || state.gameOver) {
    return;
  }

  const player = getCurrentPlayer();
  if (player.kind !== 'human') {
    return;
  }
  if (state.heldTile !== null) {
    setMessage('先に手元のタイルを処理してください。');
    return;
  }
  if (index < 0 || index >= state.faceUp.length) {
    return;
  }

  const value = state.faceUp.splice(index, 1)[0];
  state.heldTile = value;
  state.heldFrom = 'faceup';
  state.message = `テーブルの ${value} を取りました。`;
  saveGameState();
  render();
}

function onDiscardHeld() {
  if (!state || state.gameOver) {
    return;
  }

  const player = getCurrentPlayer();
  if (player.kind !== 'human') {
    return;
  }
  if (state.heldTile === null || state.heldFrom !== 'deck') {
    return;
  }

  state.faceUp.push(state.heldTile);
  state.message = `${player.name} は ${state.heldTile} をテーブルに出しました。`;
  state.lastAction = { type: 'discard', value: state.heldTile };
  state.heldTile = null;
  state.heldFrom = null;

  finishTurn();
}

function onCancelHeld() {
  if (!state || state.gameOver) {
    return;
  }

  const player = getCurrentPlayer();
  if (player.kind !== 'human') {
    return;
  }
  if (state.heldTile === null || state.heldFrom !== 'faceup') {
    return;
  }

  state.faceUp.push(state.heldTile);
  state.faceUp.sort((a, b) => a - b);
  state.message = `${player.name} は ${state.heldTile} の取得をキャンセルしました。`;
  state.heldTile = null;
  state.heldFrom = null;
  saveGameState();
  render();
}

function onPlaceHeld(playerIndex, row, col) {
  if (!state || state.gameOver) {
    return;
  }

  if (state.currentPlayer !== playerIndex) {
    return;
  }

  const player = state.players[playerIndex];
  if (player.kind !== 'human') {
    return;
  }

  if (state.heldTile === null) {
    return;
  }

  if (!canPlaceOnBoard(player.board, row, col, state.heldTile)) {
    setMessage('そこには置けません。');
    return;
  }

  const replaced = player.board[row][col];
  player.board[row][col] = state.heldTile;

  if (replaced !== null) {
    state.faceUp.push(replaced);
    state.message = `${player.name} は ${state.heldTile} を置き、${replaced} と交換しました。`;
    state.lastAction = {
      type: 'swap',
      placed: state.heldTile,
      removed: replaced,
      row,
      col
    };
  } else {
    state.message = `${player.name} は ${state.heldTile} を置きました。`;
    state.lastAction = {
      type: 'place',
      placed: state.heldTile,
      row,
      col
    };
  }

  state.heldTile = null;
  state.heldFrom = null;

  finishTurn();
}

function finishTurn() {
  checkGameEndAfterTurn();
  if (!state.gameOver) {
    state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
    state.turnCount += 1;
  }
  saveGameState();
  render();
}

function checkGameEndAfterTurn() {
  const completedPlayers = state.players
    .map((player, index) => ({ index, empties: countEmpty(player.board) }))
    .filter((entry) => entry.empties === 0);

  if (completedPlayers.length > 0) {
    state.gameOver = true;
    state.winners = completedPlayers.map((entry) => entry.index);
    state.resultReason = 'complete';
    state.message = buildWinnerMessage('盤面完成');
    return;
  }

  if (state.drawPile.length === 0) {
    const emptiesList = state.players.map((player, index) => ({
      index,
      empties: countEmpty(player.board)
    }));
    const minEmpties = Math.min(...emptiesList.map((entry) => entry.empties));
    state.gameOver = true;
    state.winners = emptiesList
      .filter((entry) => entry.empties === minEmpties)
      .map((entry) => entry.index);
    state.resultReason = 'deck_empty';
    state.message = buildWinnerMessage('山札切れ');
  }
}

function buildGameOverText() {
  const names = state.winners.map((index) => state.players[index].name).join(' / ');
  if (state.resultReason === 'complete') {
    return `ゲーム終了: ${names} の勝利（盤面完成）`;
  }
  return `ゲーム終了: ${names} の勝利（山札切れ時の空きマス最少）`;
}

function buildWinnerMessage(reason) {
  const names = state.winners.map((index) => state.players[index].name).join(' / ');
  if (reason === '盤面完成') {
    return `${names} が盤面を完成させました。`;
  }
  return `${names} が空きマス最少で勝利しました。`;
}

function scheduleCpuIfNeeded() {
  if (!state || state.gameOver) {
    return;
  }

  const player = getCurrentPlayer();
  if (!player || player.kind !== 'cpu') {
    return;
  }

  cpuTimer = setTimeout(() => {
    runCpuTurn();
  }, 700);
}

function runCpuTurn() {
  if (!state || state.gameOver) {
    return;
  }

  const player = getCurrentPlayer();
  if (!player || player.kind !== 'cpu') {
    return;
  }

  const action = chooseCpuAction(player, player.cpuLevel);

  if (!action) {
    state.message = `${player.name} は手を進められませんでした。`;
    finishTurn();
    return;
  }

  if (action.type === 'take_faceup') {
    const value = state.faceUp.splice(action.faceUpIndex, 1)[0];
    applyCpuPlacement(player, value, 'faceup', action.move);
    return;
  }

  if (action.type === 'draw_and_place') {
    const value = state.drawPile.pop();
    applyCpuPlacement(player, value, 'deck', action.move);
    return;
  }

  if (action.type === 'draw_and_discard') {
    const value = state.drawPile.pop();
    state.faceUp.push(value);
    state.message = `${player.name} は山札から ${value} を引き、テーブルに出しました。`;
    state.lastAction = { type: 'discard', value };
    finishTurn();
  }
}

function applyCpuPlacement(player, value, source, move) {
  const replaced = player.board[move.row][move.col];
  player.board[move.row][move.col] = value;

  if (replaced !== null) {
    state.faceUp.push(replaced);
    state.message = `${player.name} は ${source === 'faceup' ? 'テーブル' : '山札'}の ${value} を置き、${replaced} と交換しました。`;
    state.lastAction = {
      type: 'swap',
      placed: value,
      removed: replaced,
      row: move.row,
      col: move.col
    };
  } else {
    state.message = `${player.name} は ${source === 'faceup' ? 'テーブル' : '山札'}の ${value} を置きました。`;
    state.lastAction = {
      type: 'place',
      placed: value,
      row: move.row,
      col: move.col
    };
  }

  finishTurn();
}

function chooseCpuAction(player, level) {
  const board = player.board;
  const faceUpMoves = state.faceUp.map((value, index) => ({
    type: 'take_faceup',
    faceUpIndex: index,
    value,
    moveOptions: getAllValidMoves(board, value)
  })).filter((entry) => entry.moveOptions.length > 0);

  if (level === 'easy') {
    const canUseFaceUp = faceUpMoves.length > 0 && Math.random() < 0.45;
    if (canUseFaceUp) {
      const pick = sample(faceUpMoves);
      return {
        type: 'take_faceup',
        faceUpIndex: pick.faceUpIndex,
        move: sample(pick.moveOptions)
      };
    }

    if (state.drawPile.length === 0) {
      if (faceUpMoves.length > 0) {
        const pick = sample(faceUpMoves);
        return {
          type: 'take_faceup',
          faceUpIndex: pick.faceUpIndex,
          move: sample(pick.moveOptions)
        };
      }
      return null;
    }

    const drawnValue = state.drawPile[state.drawPile.length - 1];
    const drawMoves = getAllValidMoves(board, drawnValue);
    if (drawMoves.length === 0 || Math.random() < 0.3) {
      return { type: 'draw_and_discard' };
    }
    return {
      type: 'draw_and_place',
      move: sample(drawMoves)
    };
  }

  if (level === 'medium') {
    const candidates = [];

    faceUpMoves.forEach((entry) => {
      entry.moveOptions.forEach((move) => {
        candidates.push({
          type: 'take_faceup',
          faceUpIndex: entry.faceUpIndex,
          value: entry.value,
          move,
          score: evaluateMove(board, entry.value, move, false)
        });
      });
    });

    if (state.drawPile.length > 0) {
      const drawnValue = state.drawPile[state.drawPile.length - 1];
      const drawMoves = getAllValidMoves(board, drawnValue);
      drawMoves.forEach((move) => {
        candidates.push({
          type: 'draw_and_place',
          value: drawnValue,
          move,
          score: evaluateMove(board, drawnValue, move, false)
        });
      });
      candidates.push({
        type: 'draw_and_discard',
        score: evaluateDiscard(board, drawnValue)
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (best.type === 'take_faceup') {
      return best;
    }
    if (best.type === 'draw_and_place') {
      return best;
    }
    return { type: 'draw_and_discard' };
  }

  const hardCandidates = [];

  faceUpMoves.forEach((entry) => {
    entry.moveOptions.forEach((move) => {
      hardCandidates.push({
        type: 'take_faceup',
        faceUpIndex: entry.faceUpIndex,
        value: entry.value,
        move,
        score: evaluateMove(board, entry.value, move, true)
      });
    });
  });

  if (state.drawPile.length > 0) {
    const drawnValue = state.drawPile[state.drawPile.length - 1];
    const drawMoves = getAllValidMoves(board, drawnValue);
    drawMoves.forEach((move) => {
      hardCandidates.push({
        type: 'draw_and_place',
        value: drawnValue,
        move,
        score: evaluateMove(board, drawnValue, move, true)
      });
    });
    hardCandidates.push({
      type: 'draw_and_discard',
      score: evaluateDiscard(board, drawnValue) - 4
    });
  }

  if (hardCandidates.length === 0) {
    return null;
  }

  hardCandidates.sort((a, b) => b.score - a.score);
  const best = hardCandidates[0];
  if (best.type === 'draw_and_discard') {
    return { type: 'draw_and_discard' };
  }
  return best;
}

function getAllValidMoves(board, value) {
  const moves = [];
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (canPlaceOnBoard(board, r, c, value)) {
        moves.push({ row: r, col: c });
      }
    }
  }
  return moves;
}

function canPlaceOnBoard(board, row, col, value) {
  const clone = board.map((line) => line.slice());
  clone[row][col] = value;

  return isRowValid(clone[row]) && isColumnValid(clone, col);
}

function isRowValid(row) {
  let prev = -Infinity;
  for (const value of row) {
    if (value === null) {
      continue;
    }
    if (value <= prev) {
      return false;
    }
    prev = value;
  }
  return true;
}

function isColumnValid(board, col) {
  let prev = -Infinity;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const value = board[row][col];
    if (value === null) {
      continue;
    }
    if (value <= prev) {
      return false;
    }
    prev = value;
  }
  return true;
}

function evaluateMove(board, value, move, hardMode) {
  const clone = board.map((line) => line.slice());
  const replaced = clone[move.row][move.col];
  clone[move.row][move.col] = value;

  let score = 0;

  const emptiesBefore = countEmpty(board);
  const emptiesAfter = countEmpty(clone);

  score += (emptiesBefore - emptiesAfter) * 35;
  if (replaced !== null) {
    score -= 7;
  }

  score += countBoardFlexibility(clone) * 0.8;
  score += countFilledOrderedPrefix(clone) * 1.5;
  score += cornerBias(move.row, move.col, value);

  if (hardMode) {
    score += evaluateFuturePotential(clone) * 1.2;
    score -= conflictPenalty(clone) * 1.5;
  }

  return score;
}

function evaluateDiscard(board, value) {
  let score = -18;
  score += countBoardFlexibility(board) * 0.15;
  if (value <= 3 || value >= 18) {
    score += 2;
  }
  return score;
}

function countBoardFlexibility(board) {
  let total = 0;
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== null) {
        continue;
      }
      total += countFitRange(board, r, c);
    }
  }
  return total;
}

function countFitRange(board, row, col) {
  let count = 0;
  for (let value = 1; value <= 20; value += 1) {
    if (canPlaceOnBoard(board, row, col, value)) {
      count += 1;
    }
  }
  return count;
}

function countFilledOrderedPrefix(board) {
  let score = 0;

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== null) {
        score += 1;
      }
    }
  }

  return score;
}

function cornerBias(row, col, value) {
  const idealMin = row * 5 + col + 1;
  const idealMax = row * 5 + col + 8;
  if (value >= idealMin && value <= idealMax) {
    return 6;
  }
  if (row === 0 && col === 0 && value <= 4) {
    return 8;
  }
  if (row === 3 && col === 3 && value >= 17) {
    return 8;
  }
  return 0;
}

function evaluateFuturePotential(board) {
  let score = 0;
  const remainingSamples = [2, 5, 8, 11, 14, 17, 20];
  remainingSamples.forEach((value) => {
    score += getAllValidMoves(board, value).length;
  });
  return score;
}

function conflictPenalty(board) {
  let penalty = 0;
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    let values = board[r].filter((v) => v !== null);
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] - values[i - 1] <= 1) {
        penalty += 1;
      }
    }
  }
  for (let c = 0; c < BOARD_SIZE; c += 1) {
    const values = [];
    for (let r = 0; r < BOARD_SIZE; r += 1) {
      if (board[r][c] !== null) {
        values.push(board[r][c]);
      }
    }
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] - values[i - 1] <= 1) {
        penalty += 1;
      }
    }
  }
  return penalty;
}

function onResetGame() {
  clearGameState();
  settings = loadSettings();
  setMessageStandalone('対局をリセットしました。試合前設定に戻ります。');
  render();
}

function getCurrentPlayer() {
  return state ? state.players[state.currentPlayer] : null;
}

function countEmpty(board) {
  let total = 0;
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] === null) {
        total += 1;
      }
    }
  }
  return total;
}

function setMessage(text) {
  state.message = text;
  saveGameState();
  render();
}

function setMessageStandalone(text) {
  messageEl.textContent = text;
}

function cpuLevelLabel(level) {
  if (level === 'easy') {
    return 'やさしい';
  }
  if (level === 'medium') {
    return 'ふつう';
  }
  return 'つよい';
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}