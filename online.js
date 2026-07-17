class OnlineGameManager {
  constructor() {
    this.db = null;
    this.roomRef = null;
    this.playerId = this.getOrCreatePlayerId();
    this.playerName = '';
    this.currentRoomId = null;
    this.isOwner = false;
    this.myRole = 'spectator';
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
    this.myRole = 'spectator';

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
      this.myRole = 'spectator';

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
      this.updateUI(data);
      this.checkDisconnection(data);
    });
  }

  updateUI(data) {
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
    const winners = (winner && winner !== 'draw') ? window.app.checkWinner(board)?.cells || [] : [];
    window.app.setWinningCells(winners);
    
    const onlineBoard = window.app.getOnlineBoard();
    window.app.renderBoard(onlineBoard, board, winners);

    const turn = data.turn || 'X';
    window.app.setCurrentPlayer(turn);
    
    this.myRole = 'spectator';
    if (xPlayer?.id === this.playerId) this.myRole = 'X';
    if (oPlayer?.id === this.playerId) this.myRole = 'O';
    if (data.spectators && data.spectators[this.playerId]) this.myRole = 'spectator';

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

  handleCellClick(index) {
    const isActive = window.app.isGameActive();
    if (!isActive) return false;
    
    if (this.myRole !== 'X' && this.myRole !== 'O') return false;
    
    const currentTurn = window.app.getCurrentPlayer();
    if (currentTurn !== this.myRole) return false;
    
    const board = [...window.app.getBoardState()];
    if (board[index] !== '') return false;

    board[index] = this.myRole;
    const nextTurn = this.myRole === 'X' ? 'O' : 'X';
    
    const result = this.checkOnlineWinner(board);
    const updates = {
      board: board,
      turn: nextTurn,
      lastActivity: firebase.database.ServerValue.TIMESTAMP
    };

    if (result) {
      updates.status = 'finished';
      updates.winner = result === 'draw' ? 'draw' : result;
    }

    this.roomRef.update(updates).catch(error => {
      console.error('Error updating move:', error);
    });
    
    return true;
  }

  checkOnlineWinner(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (const line of lines) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    if (board.every(cell => cell !== '')) return 'draw';
    return null;
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

    this.roomRef.once('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      
      const updates = {};
      
      if (data.players?.X?.id === targetPlayerId && role !== 'X') {
        updates['players/X'] = { id: '', name: '' };
      }
      if (data.players?.O?.id === targetPlayerId && role !== 'O') {
        updates['players/O'] = { id: '', name: '' };
      }

      const targetData = data.spectators?.[targetPlayerId] || 
                        (data.players?.X?.id === targetPlayerId ? data.players.X : null) ||
                        (data.players?.O?.id === targetPlayerId ? data.players.O : null);

      if (role === 'X' || role === 'O') {
        if (targetData) {
          updates[`players/${role}`] = { id: targetPlayerId, name: targetData.name };
          updates[`spectators/${targetPlayerId}`] = null;
        }
      } else if (role === 'spectator') {
        if (targetData) {
          updates[`spectators/${targetPlayerId}`] = { id: targetPlayerId, name: targetData.name };
        }
      }

      const xPlayer = updates['players/X'] || data.players?.X;
      const oPlayer = updates['players/O'] || data.players?.O;
      const xId = xPlayer?.id || '';
      const oId = oPlayer?.id || '';
      const hasBothPlayers = xId !== '' && oId !== '';
      
      if (hasBothPlayers && data.status === 'waiting') {
        const firstTurn = Math.random() < 0.5 ? 'X' : 'O';
        updates.status = 'playing';
        updates.turn = firstTurn;
        updates.board = ['', '', '', '', '', '', '', '', ''];
        updates.winner = '';
      }

      updates.lastActivity = firebase.database.ServerValue.TIMESTAMP;
      
      this.roomRef.update(updates).catch(error => {
        console.error('Error setting player role:', error);
      });
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
      const updates = {};
      updates[`spectators/${this.playerId}`] = null;
      if (this.myRole === 'X') updates['players/X'] = { id: '', name: '' };
      if (this.myRole === 'O') updates['players/O'] = { id: '', name: '' };
      updates.lastActivity = firebase.database.ServerValue.TIMESTAMP;
      
      this.roomRef.update(updates).catch(error => {
        console.error('Error leaving room:', error);
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
    this.myRole = 'spectator';
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
        if (!otherExists && !otherIsSpectator && this.myRole !== 'spectator') {
          const disconnectionMessage = document.getElementById('disconnectionMessage');
          if (disconnectionMessage) {
            disconnectionMessage.style.display = 'flex';
          }
          window.app.setGameActive(false);
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
