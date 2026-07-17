class OnlineGameManager {
  constructor() {
    this.db = null;
    this.roomRef = null;
    this.playerId = this.getOrCreatePlayerId();
    this.playerName = '';
    this.currentRoomId = null;
    this.isOwner = false;
    this.unsubscribe = null;
    this.initFirebase();
  }

  getOrCreatePlayerId() {
    let id = localStorage.getItem('drder_player_id');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).substr(2, 15);
      localStorage.setItem('drder_player_id', id);
    }
    return id;
  }

  initFirebase() {
    if (typeof firebase === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
      script.onload = () => {
        const dbScript = document.createElement('script');
        dbScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js';
        dbScript.onload = () => this.configureFirebase();
        document.head.appendChild(dbScript);
      };
      document.head.appendChild(script);
    } else {
      this.configureFirebase();
    }
  }

  configureFirebase() {
    const firebaseConfig = {
      apiKey: "AIzaSyABDQ38fI6dAxtndb77G3yVtwsiTMl8P6w",
      authDomain: "drder-xo.firebaseapp.com",
      databaseURL: "https://drder-xo-default-rtdb.asia-southeast1.firebasedatabase.app/",
      projectId: "drder-xo",
      storageBucket: "drder-xo.firebasestorage.app",
      messagingSenderId: "870918760824",
      appId: "1:870918760824:web:f2424cf0b4974af081808d"
    };

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    this.db = firebase.database();
  }

  showLobby() {
    document.getElementById('playerNameInput').value = this.playerName || '';
    document.getElementById('roomCodeInput').style.display = 'none';
    document.getElementById('roomCodeInput').value = '';

    document.getElementById('createRoomBtn').onclick = () => this.createRoom();
    document.getElementById('joinRoomBtn').onclick = () => {
      const roomInput = document.getElementById('roomCodeInput');
      if (roomInput.style.display === 'none' || roomInput.style.display === '') {
        roomInput.style.display = 'block';
        roomInput.focus();
      } else {
        this.joinRoom(roomInput.value.trim().toUpperCase());
      }
    };
  }

  createRoom() {
    const name = document.getElementById('playerNameInput').value.trim();
    if (!name) {
      alert('الرجاء إدخال اسم');
      return;
    }
    this.playerName = name;
    const roomCode = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.currentRoomId = roomCode;
    this.isOwner = true;

    const roomData = {
      ownerId: this.playerId,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      lastActivity: firebase.database.ServerValue.TIMESTAMP,
      status: 'waiting',
      players: {
        X: { id: '', name: '' },
        O: { id: '', name: '' }
      },
      spectators: {
        [this.playerId]: { id: this.playerId, name: this.playerName }
      },
      board: ['', '', '', '', '', '', '', '', ''],
      turn: 'X',
      winner: '',
      viewersCount: 1
    };

    this.roomRef = this.db.ref(`rooms/${roomCode}`);
    this.roomRef.set(roomData).then(() => {
      this.attachListeners();
      window.app.showScreen('onlineRoom');
      window.app.setGameMode('online');
      document.getElementById('roomCodeDisplay').textContent = `كود: ${roomCode}`;
    }).catch(error => {
      console.error('Error creating room:', error);
    });
  }

  joinRoom(roomCode) {
    const name = document.getElementById('playerNameInput').value.trim();
    if (!name) {
      alert('الرجاء إدخال اسم');
      return;
    }
    if (!roomCode) {
      alert('الرجاء إدخال كود الغرفة');
      return;
    }
    this.playerName = name;
    this.currentRoomId = roomCode;
    this.roomRef = this.db.ref(`rooms/${roomCode}`);

    this.roomRef.once('value', (snapshot) => {
      if (!snapshot.exists()) {
        alert('الغرفة غير موجودة');
        this.roomRef = null;
        return;
      }

      const room = snapshot.val();
      this.isOwner = (room.ownerId === this.playerId);

      const updates = {};
      updates[`spectators/${this.playerId}`] = { id: this.playerId, name: this.playerName };
      updates[`viewersCount`] = (room.viewersCount || 0) + 1;
      updates[`lastActivity`] = firebase.database.ServerValue.TIMESTAMP;

      this.roomRef.update(updates).then(() => {
        this.attachListeners();
        window.app.showScreen('onlineRoom');
        window.app.setGameMode('online');
        document.getElementById('roomCodeDisplay').textContent = `كود: ${roomCode}`;
      }).catch(error => {
        console.error('Error joining room:', error);
      });
    });
  }

  attachListeners() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.unsubscribe = this.roomRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        this.handleRoomClosed();
        return;
      }
      this.syncUIFromFirebase(data);
      this.checkDisconnection(data);
    });
  }

  syncUIFromFirebase(data) {
    if (!data) return;

    document.getElementById('viewerCountDisplay').textContent = `👁 ${data.viewersCount || 0}`;

    const xPlayer = data.players?.X;
    const oPlayer = data.players?.O;
    const xName = xPlayer?.id ? xPlayer.name : 'X';
    const oName = oPlayer?.id ? oPlayer.name : 'O';

    window.app.setPlayerNames(xName, oName);

    const board = data.board || ['', '', '', '', '', '', '', '', ''];
    window.app.setBoardState([...board]);

    const winner = data.winner || '';
    const winners = (winner && winner !== 'draw') ? this.checkWinnerFromBoard(board)?.cells || [] : [];
    window.app.setWinningCells(winners);

    const onlineBoard = window.app.getOnlineBoard();
    window.app.renderBoard(onlineBoard, board, winners);

    window.app.setCurrentPlayer(data.turn || 'X');

    const hasBothPlayers = xPlayer?.id && oPlayer?.id;
    const isPlaying = data.status === 'playing';
    const hasWinner = winner !== '' && winner !== null && winner !== undefined;
    const isActive = hasBothPlayers && isPlaying && !hasWinner;

    window.app.setGameActive(isActive);

    if (hasWinner) {
      window.app.setGameActive(false);
      if (winner === 'draw') {
        window.app.showModal('تعادل', () => this.resetOnlineGame(), () => this.leaveRoomAndGoHome());
      } else {
        window.app.showModal(`الفائز: ${winner}`, () => this.resetOnlineGame(), () => this.leaveRoomAndGoHome());
      }
    }

    this.renderAdminPanel(data);
  }

  checkWinnerFromBoard(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (const line of lines) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], cells: line };
      }
    }
    if (board.every(cell => cell !== '')) {
      return { winner: 'draw', cells: [] };
    }
    return null;
  }

  handleCellClick(index) {
    if (!this.roomRef) return;

    const cellRef = this.roomRef;

    cellRef.transaction((currentData) => {
      if (!currentData) {
        return;
      }

      const xPlayer = currentData.players?.X;
      const oPlayer = currentData.players?.O;

      if (currentData.status !== 'playing') return;
      if (currentData.winner) return;
      if (!xPlayer?.id || !oPlayer?.id) return;

      let myRole = null;
      if (xPlayer.id === this.playerId) myRole = 'X';
      if (oPlayer.id === this.playerId) myRole = 'O';
      if (!myRole) return;

      if (currentData.turn !== myRole) return;

      const board = [...(currentData.board || ['', '', '', '', '', '', '', '', ''])];
      if (board[index] !== '') return;

      board[index] = myRole;

      const nextTurn = myRole === 'X' ? 'O' : 'X';
      currentData.board = board;
      currentData.turn = nextTurn;
      currentData.lastActivity = firebase.database.ServerValue.TIMESTAMP;

      const result = this.checkWinnerFromBoard(board);
      if (result) {
        currentData.status = 'finished';
        currentData.winner = result.winner;
      }

      return currentData;
    }).catch(error => {
      console.error('Transaction failed:', error);
    });
  }

  resetOnlineGame() {
    if (!this.roomRef) return;
    const firstTurn = Math.random() < 0.5 ? 'X' : 'O';
    this.roomRef.update({
      board: ['', '', '', '', '', '', '', '', ''],
      turn: firstTurn,
      winner: '',
      status: 'playing',
      lastActivity: firebase.database.ServerValue.TIMESTAMP
    }).catch(error => {
      console.error('Error resetting game:', error);
    });
  }

  setPlayerRole(targetPlayerId, role) {
    if (!this.isOwner || !this.roomRef) return;

    this.roomRef.transaction((currentData) => {
      if (!currentData) return;

      if (currentData.players?.X?.id === targetPlayerId && role !== 'X') {
        currentData.players.X = { id: '', name: '' };
      }
      if (currentData.players?.O?.id === targetPlayerId && role !== 'O') {
        currentData.players.O = { id: '', name: '' };
      }

      const targetData = currentData.spectators?.[targetPlayerId] ||
        (currentData.players?.X?.id === targetPlayerId ? currentData.players.X : null) ||
        (currentData.players?.O?.id === targetPlayerId ? currentData.players.O : null);

      if (role === 'X' || role === 'O') {
        if (targetData) {
          currentData.players[role] = { id: targetPlayerId, name: targetData.name };
          if (currentData.spectators && currentData.spectators[targetPlayerId]) {
            delete currentData.spectators[targetPlayerId];
          }
        }
      } else if (role === 'spectator') {
        if (targetData) {
          if (!currentData.spectators) {
            currentData.spectators = {};
          }
          currentData.spectators[targetPlayerId] = { id: targetPlayerId, name: targetData.name };
        }
      }

      const xId = currentData.players?.X?.id || '';
      const oId = currentData.players?.O?.id || '';
      const hasBothPlayers = xId !== '' && oId !== '';

      if (hasBothPlayers && currentData.status === 'waiting') {
        const firstTurn = Math.random() < 0.5 ? 'X' : 'O';
        currentData.status = 'playing';
        currentData.turn = firstTurn;
        currentData.board = ['', '', '', '', '', '', '', '', ''];
        currentData.winner = '';
      }

      currentData.lastActivity = firebase.database.ServerValue.TIMESTAMP;

      return currentData;
    }).catch(error => {
      console.error('Transaction failed:', error);
    });
  }

  closeRoom() {
    if (this.roomRef && this.isOwner) {
      this.roomRef.remove().catch(error => {
        console.error('Error closing room:', error);
      });
    }
  }

  leaveRoom() {
    if (this.roomRef && this.playerId) {
      this.roomRef.transaction((currentData) => {
        if (!currentData) return;

        if (currentData.spectators && currentData.spectators[this.playerId]) {
          delete currentData.spectators[this.playerId];
        }
        if (currentData.players?.X?.id === this.playerId) {
          currentData.players.X = { id: '', name: '' };
        }
        if (currentData.players?.O?.id === this.playerId) {
          currentData.players.O = { id: '', name: '' };
        }
        currentData.lastActivity = firebase.database.ServerValue.TIMESTAMP;

        return currentData;
      }).catch(error => {
        console.error('Transaction failed:', error);
      });
    }

    this.cleanup();
  }

  leaveRoomAndGoHome() {
    this.leaveRoom();
    window.app.setGameMode(null);
    window.app.setGameActive(false);
    window.app.showScreen('mainMenu');
    window.app.hideModal();
  }

  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.roomRef = null;
    this.currentRoomId = null;
    this.isOwner = false;
  }

  handleRoomClosed() {
    this.cleanup();
    window.app.setGameMode(null);
    window.app.setGameActive(false);
    alert('تم إغلاق الغرفة');
    window.app.goToMainMenu();
  }

  checkDisconnection(data) {
    const xId = data.players?.X?.id;
    const oId = data.players?.O?.id;
    const isPlaying = data.status === 'playing';

    if (isPlaying && xId && oId) {
      const otherId = this.playerId === xId ? oId : (this.playerId === oId ? xId : null);
      if (otherId) {
        const otherExists = (data.players.X.id === otherId) || (data.players.O.id === otherId);
        const otherIsSpectator = data.spectators && data.spectators[otherId];
        if (!otherExists && !otherIsSpectator) {
          const myRole = (xId === this.playerId) ? 'X' : (oId === this.playerId ? 'O' : 'spectator');
          if (myRole !== 'spectator') {
            const disconnectionMessage = document.getElementById('disconnectionMessage');
            if (disconnectionMessage) {
              disconnectionMessage.style.display = 'flex';
            }
            window.app.setGameActive(false);
          }
        }
      }
    }
  }

  renderAdminPanel(data) {
    const panel = document.getElementById('adminPanel');
    if (!panel) return;

    if (!this.isOwner) {
      panel.style.display = 'none';
      return;
    }

    panel.style.display = 'flex';
    panel.innerHTML = '';

    const allPlayers = {};
    if (data.players?.X?.id) allPlayers[data.players.X.id] = { ...data.players.X, role: 'X' };
    if (data.players?.O?.id) allPlayers[data.players.O.id] = { ...data.players.O, role: 'O' };
    if (data.spectators) {
      Object.entries(data.spectators).forEach(([id, info]) => {
        if (id && info && !allPlayers[id]) {
          allPlayers[id] = { ...info, role: 'spectator' };
        }
      });
    }

    Object.entries(allPlayers).forEach(([id, info]) => {
      const row = document.createElement('div');
      row.className = 'admin-player-row';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'admin-player-name';
      const roleText = info.role === 'spectator' ? 'مشاهد' : info.role;
      nameSpan.textContent = `${info.name} (${roleText})`;

      const actions = document.createElement('div');
      actions.className = 'admin-player-actions';

      if (info.role !== 'X') {
        const setXBtn = document.createElement('button');
        setXBtn.className = 'admin-btn';
        setXBtn.textContent = 'X';
        setXBtn.onclick = () => this.setPlayerRole(id, 'X');
        actions.appendChild(setXBtn);
      }

      if (info.role !== 'O') {
        const setOBtn = document.createElement('button');
        setOBtn.className = 'admin-btn';
        setOBtn.textContent = 'O';
        setOBtn.onclick = () => this.setPlayerRole(id, 'O');
        actions.appendChild(setOBtn);
      }

      if (info.role !== 'spectator') {
        const setSpecBtn = document.createElement('button');
        setSpecBtn.className = 'admin-btn';
        setSpecBtn.textContent = 'مشاهد';
        setSpecBtn.onclick = () => this.setPlayerRole(id, 'spectator');
        actions.appendChild(setSpecBtn);
      }

      row.appendChild(nameSpan);
      row.appendChild(actions);
      panel.appendChild(row);
    });

    const adminActions = document.createElement('div');
    adminActions.style.display = 'flex';
    adminActions.style.gap = '8px';
    adminActions.style.marginTop = '8px';

    const newGameBtn = document.createElement('button');
    newGameBtn.className = 'btn';
    newGameBtn.textContent = 'مباراة جديدة';
    newGameBtn.onclick = () => this.resetOnlineGame();

    const closeRoomBtn = document.createElement('button');
    closeRoomBtn.className = 'btn admin-btn danger';
    closeRoomBtn.textContent = 'إغلاق الغرفة';
    closeRoomBtn.onclick = () => this.closeRoom();

    adminActions.appendChild(newGameBtn);
    adminActions.appendChild(closeRoomBtn);
    panel.appendChild(adminActions);
  }
}

window.onlineManager = new OnlineGameManager();

document.addEventListener('DOMContentLoaded', () => {
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  if (leaveRoomBtn) {
    leaveRoomBtn.addEventListener('click', () => {
      if (window.onlineManager) {
        window.onlineManager.leaveRoomAndGoHome();
      }
    });
  }

  const disconnectionBackBtn = document.getElementById('disconnectionBackBtn');
  if (disconnectionBackBtn) {
    disconnectionBackBtn.addEventListener('click', () => {
      const disconnectionMessage = document.getElementById('disconnectionMessage');
      if (disconnectionMessage) {
        disconnectionMessage.style.display = 'none';
      }
      if (window.onlineManager) {
        window.onlineManager.leaveRoomAndGoHome();
      }
    });
  }
});
