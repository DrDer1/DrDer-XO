function getAIMove(board, level) {
  const emptyCells = board.reduce((acc, val, idx) => {
    if (val === '') acc.push(idx);
    return acc;
  }, []);

  if (emptyCells.length === 0) return -1;

  switch (level) {
    case 'easy':
      return easyMove(emptyCells);
    case 'medium':
      return mediumMove(board, emptyCells);
    case 'hard':
      return hardMove(board, emptyCells);
    case 'impossible':
      return impossibleMove(board);
    default:
      return impossibleMove(board);
  }
}

function easyMove(emptyCells) {
  return emptyCells[Math.floor(Math.random() * emptyCells.length)];
}

function mediumMove(board, emptyCells) {
  if (Math.random() < 0.5) {
    return minimaxMove(board, 'O');
  }
  return easyMove(emptyCells);
}

function hardMove(board, emptyCells) {
  if (Math.random() < 0.8) {
    return minimaxMove(board, 'O');
  }
  return easyMove(emptyCells);
}

function impossibleMove(board) {
  return minimaxMove(board, 'O');
}

function minimaxMove(board, aiPlayer) {
  const humanPlayer = aiPlayer === 'O' ? 'X' : 'O';
  let bestScore = -Infinity;
  let bestMove = -1;

  for (let i = 0; i < 9; i++) {
    if (board[i] === '') {
      board[i] = aiPlayer;
      const score = minimax(board, 0, false, aiPlayer, humanPlayer, -Infinity, Infinity);
      board[i] = '';
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }

  return bestMove;
}

function minimax(board, depth, isMaximizing, aiPlayer, humanPlayer, alpha, beta) {
  const winner = checkStaticWinner(board);
  if (winner === aiPlayer) return 10 - depth;
  if (winner === humanPlayer) return depth - 10;
  if (board.every(cell => cell !== '')) return 0;

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === '') {
        board[i] = aiPlayer;
        const evalScore = minimax(board, depth + 1, false, aiPlayer, humanPlayer, alpha, beta);
        board[i] = '';
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === '') {
        board[i] = humanPlayer;
        const evalScore = minimax(board, depth + 1, true, aiPlayer, humanPlayer, alpha, beta);
        board[i] = '';
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
    }
    return minEval;
  }
}

function checkStaticWinner(board) {
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
  return null;
}
