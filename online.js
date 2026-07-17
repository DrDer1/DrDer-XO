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

    const firstTurn = Math.random() < 0.5 ? 'X' : 'O';

    const roomData = {
      ownerId: this.playerId,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      lastActivity: firebase.database.ServerValue.TIMESTAMP,
      status: 'playing',
      players: {
        X: { id: '', name: '' },
        O: { id: '', name: '' }
      },
      spectators: {
        [this.playerId]: { id: this.playerId, name: this.playerName }
      },
      board: ['', '', '', '', '', '', '', '', ''],
      turn: firstTurn,
      winner: null,
      viewersCount: 1
    };

    this.roomRef = this.db.ref(`rooms/${roomCode}`);
    this.roomRef.set(roomData).then(() => {
      this.attachListeners();
      window.app.showScreen('onlineRoom');
      window.app.setGameMode('online');
      document.getElementById('roomCodeDisplay').textContent = `كود: ${roomCode}`;
      this.updateUI(roomData);
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
      
      if (!room.players.X.id && !room.players.O.id) {
        const firstTurn = Math.random() < 0.5 ? 'X' : 'O';
        if (firstTurn === 'X') {
          updates['players/X'] = { id: this.playerId, name: this.playerName };
          this.myRole = 'X';
        } else {
          updates['players/O'] = { id: this.playerId, name: this.playerName };
          this.myRole = 'O';
        }
        updates['turn'] = firstTurn;
        updates['status'] = 'playing';
        updates['board'] = ['', '', '', '', '', '', '', '', ''];
        updates['winner'] = null;
      } else if (!room.players.X.id && room.players.O.id) {
        updates['players/X'] = { id: this.playerId, name: this.playerName };
        this.myRole = 'X';
        updates['status'] = 'playing';
        updates['board'] = ['', '', '', '', '', '', '', '', ''];
        updates['winner'] = null;
        if (!room.turn) updates['turn'] = Math.random() < 0.5 ? 'X' : 'O';
      } else if (room.players.X.id && !room.players.O.id) {
        updates['players/O'] = { id: this.playerId, name: this.playerName };
        this.myRole = 'O';
        updates['status'] = 'playing';
        updates['board'] = ['', '', '', '', '', '', '', '', ''];
        updates['winner'] = null;
        if (!room.turn) updates['turn'] = Math.random() < 0.5 ? 'X' : 'O';
      } else {
        updates[`spectators/${this.playerId}`] = { id: this.playerId, name: this.playerName };
        this.myRole = 'spectator';
      }
      
      updates[`viewersCount`] = (room.viewersCount || 0) + 1;
      updates[`lastActivity`] = firebase.database.ServerValue.TIMESTAMP;

      this.roomRef.update(updates).then(() => {
        this.attachListeners();
        window.app.showScreen('onlineRoom');
        window.app.setGameMode('online');
        document.getElementById('roomCodeDisplay').textContent = `كود: ${roomCode}`;
      });
    });
  }

  attachListeners() {
    if (this.unsubscribe) {
      this.unsubscribe();
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
    const xName = xPlayer?.name || 'X';
    const oName = oPlayer?.name || 'O';
    
    window.app.setPlayerNames(xName, oName);

    const board = data.board || ['', '', '', '', '', '', '', '', ''];
    window.app.setBoardState([...board]);

    const winners = data.winner && data.winner !== 'draw' ? window.app.checkWinner(board)?.cells || [] : [];
    window.app.setWinningCells(winners);
    
    window.app.renderBoard(window.app.getOnlineBoard(), board, winners);

    window.app.setCurrentPlayer(data.turn || 'X');
    
    this.myRole = 'spectator';
    if (data.players?.X?.id === this.playerId) this.myRole = 'X';
    if (data.players?.O?.id === this.playerId) this.myRole = 'O';
    if (data.spectators && data.spectators[this.playerId]) this.myRole = 'spectator';

    const isActive = data.status === 'playing' && !data.winner;
    window.app.setGameActive(isActive);

    if (data.winner) {
      if (data.winner === 'draw') {
        window.app.showModal('تعادل', () => this.resetOnlineGame(), () => window.app.goToMainMenu());
      } else {
        window.app.showModal(`الفائز: ${data.winner}`, () => this.resetOnlineGame(), () => window.app.goToMainMenu());
      }
    }

    this.renderAdminPanel(data);
  }

  handleCellClick(index) {
    if (!window.app.isGameActive()) return false;
    if (this.myRole !== 'X' && this.myRole !== 'O') return false;
    if (window.app.getCurrentPlayer() !== this.myRole) return false;
    
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

    this.roomRef.update(updates);
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
      winner: null,
      status: 'playing',
      lastActivity: firebase.database.ServerValue.TIMESTAMP
    });
  }

  setPlayerRole(targetPlayerId, role) {
    if (!this.isOwner || !this.roomRef) return;

    this.roomRef.once('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      
      const updates = {};
      
      if (data.players?.X?.id === targetPlayerId) {
        updates['players/X'] = { id: '', name: '' };
      }
      if (data.players?.O?.id === targetPlayerId) {
        updates['players/O'] = { id: '', name: '' };
      }

      if (role === 'X' || role === 'O') {
        const targetData = data.spectators?.[targetPlayerId] || 
                          (data.players?.X?.id === targetPlayerId ? data.players.X : null) ||
                          (data.players?.O?.id === targetPlayerId ? data.players.O : null);
        if (targetData) {
          updates[`players/${role}`] = { id: targetPlayerId, name: targetData.name };
        }
      }

      if (role === 'spectator') {
        const xData = data.players?.X?.id === targetPlayerId ? data.players.X : null;
        const oData = data.players?.O?.id === targetPlayerId ? data.players.O : null;
        const playerData = xData || oData;
        if (playerData) {
          updates[`spectators/${targetPlayerId}`] = { id: targetPlayerId, name: playerData.name };
        }
      }

      updates.lastActivity = firebase.database.ServerValue.TIMESTAMP;
      this.roomRef.update(updates);
    });
  }

  closeRoom() {
    if (this.roomRef && this.isOwner) {
      this.roomRef.remove();
    }
  }

  leaveRoom() {
    if (this.roomRef && this.playerId) {
      const updates = {};
      updates[`spectators/${this.playerId}`] = null;
      if (this.myRole === 'X') updates['players/X'] = { id: '', name: '' };
      if (this.myRole === 'O') updates['players/O'] = { id: '', name: '' };
      updates.lastActivity = firebase.database.ServerValue.TIMESTAMP;
      
      this.roomRef.update(updates);
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.roomRef = null;
    this.currentRoomId = null;
    this.isOwner = false;
    this.myRole = 'spectator';
    window.app.setGameMode(null);
  }

  handleRoomClosed() {
    alert('تم إغلاق الغرفة');
    this.leaveRoom();
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
          document.getElementById('disconnectionMessage').style.display = 'flex';
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
        if (!allPlayers[id]) {
          allPlayers[id] = { ...info, role: 'spectator' };
        }
      });
    }

    Object.entries(allPlayers).forEach(([id, info]) => {
      const row = document.createElement('div');
      row.className = 'admin-player-row';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'admin-player-name';
      nameSpan.textContent = `${info.name} (${info.role === 'spectator' ? 'مشاهد' : info.role})`;
      
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
