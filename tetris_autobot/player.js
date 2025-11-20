/* --- PLAYER CONTROL STATE --- */
let playerPiece = null;   // { type, x, y, rotation }
let playerLock = false;

/* Spawn a new player-controlled piece */
function spawnPlayerPiece() {
  const next = currentPieceObj();
  playerPiece = {
    type: next.type,
    x: 3,
    y: 0,
    rotation: 0
  };
}

/* Check collision of candidate piece */
function collides(grid, piece) {
  const shape = rotateMatrix(TETROMINO_SHAPES[piece.type], piece.rotation);

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;

      const gx = piece.x + c;
      const gy = piece.y + r;

      // out of bounds
      if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS)
        return true;

      // hits something
      if (grid[gy][gx] !== null)
        return true;
    }
  }
  return false;
}

function tryMove(dx, dy, drot) {
  if (!playerPiece) return;

  const test = {
    type: playerPiece.type,
    x: playerPiece.x + dx,
    y: playerPiece.y + dy,
    rotation: (playerPiece.rotation + drot + 4) % 4
  };

  if (!collides(grid, test)) {
    playerPiece = test;
  }
}

/* Hard drop returns the landing Y */
function getHardDropY(piece) {
  let y = piece.y;
  while (true) {
    const test = { ...piece, y: y + 1 };
    if (collides(grid, test)) break;
    y++;
  }
  return y;
}

/* Lock the piece into the grid */
function lockPlayerPiece() {
  if (!playerPiece) return;
  const landed = { ...playerPiece, y: getHardDropY(playerPiece) };
  addPieceToGrid(grid, landed);
  grid = clearLinesInGrid(grid);
  readIndex++;                  // consume one piece of queue
  playerPiece = null;           // force spawn next
}
