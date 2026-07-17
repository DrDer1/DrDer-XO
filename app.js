```javascript
document.addEventListener('DOMContentLoaded', () => {
  const translations = {
    aiGame: 'لعب ضد الذكاء الاصطناعي',
    localGame: 'لاعبان على نفس الجهاز',
    onlinePlay: 'اللعب عبر الإنترنت',
    settings: 'الإعدادات',
    backToMenu: 'القائمة الرئيسية',
    playAgain: 'لعب مرة أخرى',
    winner: 'الفائز',
    draw: 'تعادل',
    playerX: 'X',
    playerO: 'O',
    you: 'أنت',
    ai: 'AI',
    enterName: 'أدخل اسمك',
    roomCode: 'كود الغرفة',
    createRoom: 'إنشاء غرفة',
    joinRoom: 'الانضمام إلى غرفة',
    leaveRoom: 'مغادرة الغرفة',
    viewers: '👁',
    disconnected: 'انقطع اتصال اللاعب الآخر',
    aiLevel: 'مستوى الذكاء الاصطناعي',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    impossible: 'Impossible',
    newGame: 'مباراة جديدة',
    closeRoom: 'إغلاق الغرفة',
    spectator: 'مشاهد',
    setX: 'X',
    setO: 'O'
  };

  const screens = {
    mainMenu: document.getElementById('mainMenuScreen'),
    aiGame: document.getElementById('aiGameScreen'),
    localGame: document.getElementById('localGameScreen'),
    onlineLobby: document.getElementById('onlineLobbyScreen'),
    onlineRoom: document.getElementById('onlineRoomScreen'),
    settings: document.getElementById('settingsScreen')
  };

  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalPlayAgainBtn = document.getElementById('modalPlayAgainBtn');
  const modalMainMenuBtn = document.getElementById('modalMainMenuBtn');

  let currentScreen = 'mainMenu';
  let gameMode = null;
  let boardState = ['', '', '', '', '', '', '', '', ''];
  let currentPlayer = 'X';
  let gameActive = false;
  let aiEnabled = false;
  let aiLevel = 'impossible';
  let playerXName = translations.playerX;
  let playerOName = translations.playerO;
  let winningCells = [];

  const aiBoard = document.getElementById('aiGameBoard');
  const localBoard = document.getElementById('localGameBoard');
  const onlineBoard = document.getElementById('onlineGameBoard');

  function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[screenId]) {
      screens[screenId].classList.add('active');
      currentScreen = screenId;
    }
  }

  function resetGameState() {
    boardState = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = Math.random() < 0.5 ? 'X' : 'O';
    gameActive = true;
    winningCells = [];
  }

  function renderBoard(boardElement, state, winners = []) {
    if (!boardElement) return;
    boardElement.innerHTML = '';
    state.forEach((value, index) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (value === 'X') cell.classList.add('x-move');
      if (value === 'O') cell.classList.add('o-move');
      if (winners.includes(index)) cell.classList.add('winner-cell');
      cell.textContent = value;
      cell.dataset.index = index;
      boardElement.appendChild(cell);
    });
  }

  function updatePlayerDisplays() {
    const aiX = document.getElementById('aiPlayerXName');
    const aiO = document.getElementById('aiPlayerOName');
    const localX = document.getElementById('localPlayerXName');
    const localO = document.getElementById('localPlayerOName');
    const onlineX = document.getElementById('onlinePlayerXName');
    const onlineO = document.getElementById('onlinePlayerOName');
    
    if (aiX) aiX.textContent = playerXName;
    if (aiO) aiO.textContent = playerOName;
    if (localX) localX.textContent = playerXName;
    if (localO) localO.textContent = playerOName;
    if (onlineX) onlineX.textContent = playerXName;
    if (onlineO) onlineO.textContent = playerOName;
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
    if (state.every(cell => cell !== '')) {
      return { winner: 'draw', cells: [] };
    }
    return null;
  }

  function showModal(title, onPlayAgain, onMainMenu) {
    modalTitle.textContent = title;
    modalOverlay.style.display = 'flex';
    
    modalPlayAgainBtn.onclick = () => {
      modalOverlay.style.display = 'none';
      if (onPlayAgain) onPlayAgain();
    };
    
    modalMainMenuBtn.onclick = () => {
      modalOverlay.style.display = 'none';
      if (onMainMenu) onMainMenu();
    };
  }

  function hideModal() {
    modalOverlay.style.display = 'none';
  }

  function handleGameEnd(result) {
    gameActive = false;
    if (result.winner === 'draw') {
      showModal(translations.draw, restartCurrentGame, goToMainMenu);
    } else {
      winningCells = result.cells;
      const boardEl = getCurrentBoardElement();
      renderBoard(boardEl, boardState, winningCells);
      showModal(`${translations.winner}: ${result.winner}`, restartCurrentGame, goToMainMenu);
    }
  }

  function getCurrentBoardElement() {
    if (currentScreen === 'aiGame') return aiBoard;
    if (currentScreen === 'localGame') return localBoard;
    if (currentScreen === 'onlineRoom') return onlineBoard;
    return null;
  }

  function restartCurrentGame() {
    if (gameMode === 'ai') startAIGame();
    else if (gameMode === 'local') startLocalGame();
    else if (gameMode === 'online' && window.onlineManager) {
      window.onlineManager.resetOnlineGame();
    }
  }

  function goToMainMenu() {
    if (gameMode === 'online' && window.onlineManager) {
      window.onlineManager.leaveRoom();
    }
    gameMode = null;
    gameActive = false;
    aiEnabled = false;
    showScreen('mainMenu');
    hideModal();
  }

  function makeMove(index, boardElement) {
    if (!gameActive || boardState[index] !== '') return false;
    
    boardState[index] = currentPlayer;
    renderBoard(boardElement, boardState, winningCells);
    
    const result = checkWinner(boardState);
    if (result) {
      handleGameEnd(result);
      return true;
    }
    
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    
    if (aiEnabled && gameMode === 'ai' && currentPlayer === 'O' && gameActive) {
      setTimeout(() => {
        if (!gameActive) return;
        const aiMoveIndex = getAIMove([...boardState], aiLevel);
        if (aiMoveIndex !== -1 && boardState[aiMoveIndex] === '') {
          makeMove(aiMoveIndex, boardElement);
        }
      }, 250);
    }
    
    return true;
  }

  function startAIGame() {
    resetGameState();
    gameMode = 'ai';
    aiEnabled = true;
    aiLevel = document.getElementById('aiLevelSelect')?.value || 'impossible';
    playerXName = translations.you;
    playerOName = translations.ai;
    updatePlayerDisplays();
    renderBoard(aiBoard, boardState);
    showScreen('aiGame');
    
    if (currentPlayer === 'O') {
      setTimeout(() => {
        if (!gameActive) return;
        const aiMoveIndex = getAIMove([...boardState], aiLevel);
        if (aiMoveIndex !== -1 && boardState[aiMoveIndex] === '') {
          makeMove(aiMoveIndex, aiBoard);
        }
      }, 300);
    }
  }

  function startLocalGame() {
    resetGameState();
    gameMode = 'local';
    aiEnabled = false;
    playerXName = translations.playerX;
    playerOName = translations.playerO;
    updatePlayerDisplays();
    renderBoard(localBoard, boardState);
    showScreen('localGame');
  }

  document.querySelectorAll('[data-screen]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const screenId = e.target.dataset.screen;
      const action = e.target.dataset.action;
      
      if (action === 'startAI') startAIGame();
      else if (action === 'startLocal') startLocalGame();
      else if (action === 'showOnlineLobby') {
        if (window.onlineManager) window.onlineManager.showLobby();
        showScreen('onlineLobby');
      }
      else if (action === 'showSettings') showScreen('settings');
      else if (screenId) {
        if (gameMode === 'online' && window.onlineManager) {
          window.onlineManager.leaveRoom();
        }
        gameMode = null;
        gameActive = false;
        showScreen(screenId);
      }
    });
  });

  aiBoard.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || !gameActive || gameMode !== 'ai') return;
    if (currentPlayer !== 'X') return;
    const index = parseInt(cell.dataset.index);
    makeMove(index, aiBoard);
  });

  localBoard.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || !gameActive || gameMode !== 'local') return;
    const index = parseInt(cell.dataset.index);
    makeMove(index, localBoard);
  });

  onlineBoard.addEventListener('click', (e) => {
    if (gameMode !== 'online' || !window.onlineManager) return;
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const index = parseInt(cell.dataset.index);
    window.onlineManager.handleCellClick(index);
  });

  window.app = {
    translations,
    showScreen,
    showModal,
    hideModal,
    goToMainMenu,
    updatePlayerDisplays,
    renderBoard,
    setGameMode: (mode) => { gameMode = mode; },
    getGameMode: () => gameMode,
    setBoardState: (state) => { boardState = state; },
    getBoardState: () => boardState,
    setCurrentPlayer: (player) => { currentPlayer = player; },
    getCurrentPlayer: () => currentPlayer,
    setGameActive: (active) => { gameActive = active; },
    isGameActive: () => gameActive,
    setPlayerNames: (x, o) => {
      playerXName = x;
      playerOName = o;
      updatePlayerDisplays();
    },
    getCurrentScreen: () => currentScreen,
    handleGameEnd,
    getOnlineBoard: () => onlineBoard
  };
});
