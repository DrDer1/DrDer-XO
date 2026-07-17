class OnlineGameManager {
  constructor() {
    this.db = null;
    this.roomRef = null;
    this.playerId = this.getOrCreatePlayerId();
    this.playerName = '';
    this.currentRoomId = null;
    this.myRole = null;
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
    this.myRole = 'X';
    const roomCode = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.currentRoomId = roomCode;

    const roomData = {
      playerX: {
        id: this.playerId,
        name: this.playerName
      },
      playerO: null,
      board: ['', '', '', '', '', '', '', '', ''],
      turn: 'X',
      status: 'waiting',
      winner: '',
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    this.roomRef = this.db.ref(`rooms/${roomCode}`);
    this.roomRef.set(roomData).then(() => {
      this.roomRef.onDisconnect().remove();
      this.attachListeners();
      window.app.showScreen('onlineRoom');
      window.app.setGameMode('online');
      document.getElementById('roomCodeDisplay').textContent = `كود: ${roomCode}`;
      document.getElementById('adminPanel').style.display = 'none';
      this.updateUI(roomData);
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

      if (room.playerO && room.playerO.id) {
        alert('الغرفة ممتلئة');
        this.roomRef = null;
        return;
      }

      if (room.playerX && room.playerX.id === this.playerId) {
        this.myRole = 'X';
        this.attachListeners();
        window.app.showScreen('onlineRoom');
        window.app.setGameMode('online');
        document.getElementById('roomCodeDisplay').textContent = `كود: ${roomCode}`;
        document.getElementById('adminPanel').style.display = 'none';
        return;
      }

      this.myRole = 'O';

      const updates = {
        playerO: {
          id: this.playerId,
          name: this.playerName
        },
        status: 'playing',
        turn: 'X'
      };

      this.roomRef.update(updates).then(() => {
        this.roomRef.onDisconnect().remove();
        this.attachListeners();
        window.app.showScreen('onlineRoom');
        window.app.setGameMode('online');
        document.getElementById('roomCodeDisplay').textContent = `كود: ${roomCode}`;
        document.getElementById('adminPanel').style.display = 'none';
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
    });
  }

  updateUI(data) {
    if (!data) return;

    const xPlayer = data.playerX;
    const oPlayer = data.playerO;
    const xName = xPlayer?.name || 'X';
    const oName = oPlayer?.name || 'O';

    window.app.setPlayerNames(xName, oName);

    const board = data.board || ['', '', '', '', '', '', '', '', ''];
    window.app.setBoardState([...board]);

    const winner = data.winner || '';
    const winners = (winner && winner !== 'draw') ? this.checkWinnerFromBoard(board)?.cells || [] : [];
    window.app.setWinningCells(winners);

    const onlineBoard = window.app.getOnlineBoard();
    window.app.renderBoard(onlineBoard, board, winners);

    window.app.setCurrentPlayer(data.turn || 'X');

    const isPlaying = data.status === 'playing';
    const hasWinner = winner !== '' && winner !== null && winner !== undefined;
    const isActive = isPlaying && !hasWinner;

    window.app.setGameActive(isActive);

    if (hasWinner) {
      window.app.setGameActive(false);
      if (winner === 'draw') {
        window.app.showModal('تعادل', () => this.resetGame(), () => this.leaveRoomAndGoHome());
      } else {
        window.app.showModal(`الفائز: ${winner}`, () => this.resetGame(), () => this.leaveRoomAndGoHome());
      }
    }
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

    this.roomRef.transaction((currentData) => {
      if (!currentData) return;

      if (currentData.status !== 'playing') return;
      if (currentData.winner) return;

      if (currentData.turn !== this.myRole) return;

      const board = [...(currentData.board || ['', '', '', '', '', '', '', '', ''])];
      if (board[index] !== '') return;

      board[index] = this.myRole;
      const nextTurn = this.myRole === 'X' ? 'O' : 'X';

      currentData.board = board;
      currentData.turn = nextTurn;

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

  resetGame() {
    if (!this.roomRef) return;
    const firstTurn = Math.random() < 0.5 ? 'X' : 'O';
    this.roomRef.update({
      board: ['', '', '', '', '', '', '', '', ''],
      turn: firstTurn,
      winner: '',
      status: 'playing'
    }).catch(error => {
      console.error('Error resetting game:', error);
    });
  }

  leaveRoom() {
    if (this.roomRef) {
      this.roomRef.remove().catch(error => {
        console.error('Error removing room:', error);
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
    this.myRole = null;
  }

  handleRoomClosed() {
    this.cleanup();
    window.app.setGameMode(null);
    window.app.setGameActive(false);
    alert('تم حذف الغرفة');
    window.app.goToMainMenu();
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
});
