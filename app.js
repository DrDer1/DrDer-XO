document.addEventListener('DOMContentLoaded', () => {
  const screens = {
    mainMenu: document.getElementById('mainMenuScreen'),
    game: document.getElementById('gameScreen')
  };

  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalPlayAgainBtn = document.getElementById('modalPlayAgainBtn');
  const modalMainMenuBtn = document.getElementById('modalMainMenuBtn');

  const gameBoard = document.getElementById('gameBoard');
  const playerXNameEl = document.getElementById('playerXName');
  const playerONameEl = document.getElementById('playerOName');

  let gameMode = null;
  let boardState = ['', '', '', '', '', '', '', '', ''];
  let currentPlayer = 'X';
  let gameActive = false;
  let aiEnabled = false;
  let winningCells = [];

  function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[screenId]) screens[screenId].classList.add('active');
  }

  function resetGameState() {
    boardState = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = Math.random() < 0.5 ? 'X' : 'O';
    gameActive = true;
    winningCells = [];
  }

  function getWinLineStyle(cells) {
    if (!cells || cells.length !== 3) return null;
    const boardRect = gameBoard.getBoundingClientRect();
    const cellElements = gameBoard.querySelectorAll('.cell');
    if (cellElements.length !== 9) return null;
    
    const first = cellElements[cells[0]].getBoundingClientRect();
    const last = cellElements[cells[2]].getBoundingClientRect();
    
    if (!first || !last) return null;
    
    const x1 = first.left + first.width / 2 - boardRect.left;
    const y1 = first.top + first.height / 2 - boardRect.top;
    const x2 = last.left + last.width / 2 - boardRect.left;
    const y2 = last.top + last.height / 2 - boardRect.top;
    
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
    
    return {
      width: `${length}px`,
      top: `${y1}px`,
      left: `${x1}px`,
      transform: `rotate(${angle}deg)`,
      transformOrigin: '0 50%'
    };
  }

  function renderBoard(state, winners = []) {
    const existingLine = gameBoard.querySelector('.win-line');
    if (existingLine) existingLine.remove();
    
    gameBoard.innerHTML = '';
    state.forEach((value, index) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (value === 'X') cell.classList.add('x-move');
      if (value === 'O') cell.classList.add('o-move');
      if (winners.includes(index)) cell.classList.add('winner-cell');
      cell.textContent = value;
      cell.dataset.index = index;
      gameBoard.appendChild(cell);
    });
    
    if (winners.length === 3) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const style = getWinLineStyle(winners);
          if (style) {
            const line = document.createElement('div');
            line.className = 'win-line';
            Object.assign(line.style, style);
            gameBoard.appendChild(line);
          }
        });
      });
    }
  }

  function checkWinner(state) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (const line of lines) {
      const [a, b, c] = line;
      if (state[a] && state[a] === state[b] && state[a] === state[c]) {
        return { winner: state[a], cells: line };
      }
    }
    if (state.every(cell => cell !== '')) return { winner: 'draw', cells: [] };
    return null;
  }

  function showModal(title, onPlayAgain, onMainMenu) {
    if (!modalTitle || !modalOverlay) return;
    modalTitle.textContent = title;
    modalOverlay.style.display = 'flex';
    modalPlayAgainBtn.onclick = () => { modalOverlay.style.display = 'none'; if (onPlayAgain) onPlayAgain(); };
    modalMainMenuBtn.onclick = () => { modalOverlay.style.display = 'none'; if (onMainMenu) onMainMenu(); };
  }

  function handleGameEnd(result) {
    gameActive = false;
    if (result.winner === 'draw') {
      showModal('تعادل', restartGame, goToMainMenu);
    } else {
      winningCells = result.cells;
      renderBoard(boardState, winningCells);
      setTimeout(() => {
        showModal(`الفائز: ${result.winner}`, restartGame, goToMainMenu);
      }, 500);
    }
  }

  function makeMove(index) {
    if (!gameActive || index < 0 || index > 8 || boardState[index] !== '') return;
    
    boardState[index] = currentPlayer;
    renderBoard(boardState);
    
    const result = checkWinner(boardState);
    if (result) {
      handleGameEnd(result);
      return;
    }
    
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    
    if (aiEnabled && currentPlayer === 'O' && gameActive) {
      setTimeout(() => {
        if (!gameActive) return;
        const aiIndex = getAIMove([...boardState], 'impossible');
        if (aiIndex !== -1 && aiIndex >= 0 && aiIndex <= 8 && boardState[aiIndex] === '') {
          makeMove(aiIndex);
        }
      }, 250);
    }
  }

  function startAIGame() {
    resetGameState();
    gameMode = 'ai';
    aiEnabled = true;
    playerXNameEl.textContent = 'أنت';
    playerONameEl.textContent = 'AI';
    renderBoard(boardState);
    showScreen('game');
    if (currentPlayer === 'O') {
      setTimeout(() => {
        if (!gameActive) return;
        const aiIndex = getAIMove([...boardState], 'impossible');
        if (aiIndex !== -1 && aiIndex >= 0 && aiIndex <= 8) {
          makeMove(aiIndex);
        }
      }, 300);
    }
  }

  function startLocalGame() {
    resetGameState();
    gameMode = 'local';
    aiEnabled = false;
    playerXNameEl.textContent = 'اللاعب X';
    playerONameEl.textContent = 'اللاعب O';
    renderBoard(boardState);
    showScreen('game');
  }

  function restartGame() {
    if (gameMode === 'ai') startAIGame();
    else startLocalGame();
  }

  function goToMainMenu() {
    gameActive = false;
    gameMode = null;
    showScreen('mainMenu');
  }

  document.getElementById('playAIBtn').addEventListener('click', startAIGame);
  document.getElementById('playLocalBtn').addEventListener('click', startLocalGame);
  document.getElementById('backBtn').addEventListener('click', goToMainMenu);

  gameBoard.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || !gameActive) return;
    if (aiEnabled && currentPlayer === 'O') return;
    const index = parseInt(cell.dataset.index);
    if (isNaN(index)) return;
    makeMove(index);
  });

  gameBoard.addEventListener('touchend', (e) => {
    e.preventDefault();
    const cell = e.target.closest('.cell');
    if (!cell || !gameActive) return;
    if (aiEnabled && currentPlayer === 'O') return;
    const index = parseInt(cell.dataset.index);
    if (isNaN(index)) return;
    makeMove(index);
  });
});
