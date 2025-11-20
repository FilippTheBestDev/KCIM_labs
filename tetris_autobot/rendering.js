/* --- CONSTANTS --- */
const COLS = 10;
const ROWS = 20;
const Y_OFFSET = ROWS - 20;

/* --- TETROMINO SHAPES (rotation 0) --- */
const TETROMINO_SHAPES = {
  I: [[1,1,1,1]],
  O: [[1,1],[1,1]],
  T: [[1,1,1],[0,1,0]],
  S: [[0,1,1],[1,1,0]],
  Z: [[1,1,0],[0,1,1]],
  J: [[1,0,0],[1,1,1]],
  L: [[0,0,1],[1,1,1]]
};

const TETROMINO_COLORS = {
  I: "#00F0F0", O: "#F0F000", T: "#A000F0",
  S: "#00F000", Z: "#F00000", J: "#0000F0", L: "#F0A000"
};

/* --- ROTATION (matrix rotation 0,1,2,3) --- */
function rotateMatrix(mat, rot) {
  let res = mat;
  for (let i = 0; i < rot; i++) res = rotate90(res);
  return res;
}
function rotate90(mat) {
  const rows = mat.length, cols = mat[0].length, out = [];
  for (let c = 0; c < cols; c++) {
    const row = [];
    for (let r = rows - 1; r >= 0; r--) row.push(mat[r][c]);
    out.push(row);
  }
  return out;
}

/* --- 7-bag generator --- */
function makeShuffledBag(bagId) {
  const types = ["I","O","T","S","Z","J","L"];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types.map((t, idx) => ({ type: t, bagId, bagIndex: idx }));
}
function buildPieceQueue(numBags = 30) {
  const q = [];
  for (let b = 0; b < numBags; b++) q.push(...makeShuffledBag(b));
  return q;
}

function gridFromPieces(placedPieces) {
  // empty grid
  const grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null)
  );

  for (const p of placedPieces) {
    const shape = rotateMatrix(TETROMINO_SHAPES[p.type], p.rotation || 0);
    const color = TETROMINO_COLORS[p.type];

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;

        const gx = p.x + c;
        const gy = p.y + r + Y_OFFSET;

        if (gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS) {
          grid[gy][gx] = color;  // or p.type if preferred
        }
      }
    }
  }

  return grid;
}


/* --- RENDER THE WHOLE GRID --- */
function renderEverything(grid, curPiece, previewTypes, holdType) {
  const gridEl = document.getElementById("grid");
  gridEl.innerHTML = "";

  // draw grid cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (grid[r][c]) cell.style.background = grid[r][c];
      gridEl.appendChild(cell);
    }
  }

  /* ---- PANEL (hold + current + previews) ----------------------------------- */
  // Remove previous panel if any
  const oldPanel = document.getElementById("sidePanel");
  if (oldPanel) oldPanel.remove();

  const panel = document.createElement("div");
  panel.id = "sidePanel";
  panel.style.display = "inline-block";
  panel.style.verticalAlign = "top";
  panel.style.marginLeft = "20px";
  panel.style.fontFamily = "monospace";

  document.body.appendChild(panel);

  function addLabel(txt) {
    const d = document.createElement("div");
    d.textContent = txt;
    d.style.marginTop = "8px";
    d.style.fontWeight = "bold";
    panel.appendChild(d);
  }

  function addMiniPiece(type) {
    const box = document.createElement("div");
    box.style.display = "inline-block";
    box.style.margin = "4px 0";
    box.style.background = "#222";
    box.style.padding = "4px";

    const shape = TETROMINO_SHAPES[type];
    const color = TETROMINO_COLORS[type];

    const rows = shape.length;
    const cols = shape[0].length;

    box.style.display = "grid";
    box.style.gridTemplateColumns = `repeat(${cols}, 10px)`;
    box.style.gridAutoRows = "10px";
    box.style.gap = "1px";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div");
        cell.style.width = "10px";
        cell.style.height = "10px";
        cell.style.background = shape[r][c] ? color : "#000";
        box.appendChild(cell);
      }
    }

    panel.appendChild(box);
  }

  /* ---- HOLD ---- */
  addLabel("HOLD");
  if (holdType) addMiniPiece(holdType);
  else {
    const e = document.createElement("div");
    e.textContent = "(empty)";
    e.style.fontSize = "12px";
    panel.appendChild(e);
  }

  /* ---- CURRENT ---- */
  addLabel("CURRENT");
  if(curPiece)
    addMiniPiece(curPiece.type);

  /* ---- PREVIEWS ---- */
  addLabel("PREVIEWS");
  previewTypes.forEach(t => addMiniPiece(t));

  /* --- DRAW PLAYER PIECE --- */
  if (curPiece && curPiece.x !== undefined) {
    const shape = rotateMatrix(TETROMINO_SHAPES[curPiece.type], curPiece.rotation);
    const color = TETROMINO_COLORS[curPiece.type];

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;

        const gx = curPiece.y + r;
        const gy = curPiece.x + c;

        if (
          gx >= 0 && gx < ROWS &&
          gy >= 0 && gy < COLS
        ) {
          const idx = gx * COLS + gy;
          const cell = gridEl.children[idx];
          if (cell) cell.style.background = color;
        }
      }
    }
  }
}