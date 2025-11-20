/* main.js — интеграция игрока + плавный бот (фикс: не пропускать первую фигуру, спецслучай для первого T) */

/* --- helpers --- */
function isLOJ(p) { return p === 'L' || p === 'O' || p === 'J'; }

/* --- GLOBALS (rendering.js provides buildPieceQueue, gridFromPieces, etc.) --- */
let pieceQueue = buildPieceQueue(10000);
let placedPieces = [];
let readIndex = 0;
let grid = gridFromPieces(placedPieces);

const previewSize = 6;
const botMemory = { holdPiece: null, lastPlacedType: null, firstTHandled: false };
const phaseController = new PhaseController();
const phase1 = phaseController.getPhaseObj();

/* --- utility: build arr = hold + current + next6 (types) --- */
function buildHoldPlusPreviewTypes() {
  const arr = [];
  if (botMemory.holdPiece) arr.push(botMemory.holdPiece.type);
  for (let i = 0; i < 14; i++) {
    const idx = readIndex + i;
    if (idx < pieceQueue.length) arr.push(pieceQueue[idx].type);
  }
  return arr;
}

/* --- helpers --- */
function peekPreviews(n = previewSize) {
  return pieceQueue.slice(readIndex + 0, readIndex + 0 + n).map(p => p.type);
}
function currentPieceObj() { return pieceQueue[readIndex]; }

/* --- reset function --- */
function resetAll() {
  placedPieces = [];
  pieceQueue = buildPieceQueue(300);
  readIndex = 0;
  phase1.turn = 0;
  phase1.LOJ = { type: null, LPlaced:false, JPlaced:false, OPlaced:false };
  phase1.SZT = { leftZ:0, rightZ:0, leftS:0, rightS:0, leftTPlaced:0, rightTPlaced:0, bottomT:0 };
  phase1.I_cnt = 0;
  botMemory.holdPiece = null;
  botMemory.lastPlacedType = null;
  botMemory.firstTHandled = false;
  grid = gridFromPieces(placedPieces);
  console.clear();
  console.log("RESET complete");
  renderEverything(grid, null, peekPreviews(), null);
}


function findFirstCollisionY(grid, x) {
  for (let y = 0; y < ROWS; y++) {
    if (grid[y][x] !== null) {
      return y;  // first occupied cell in the column
    }
  }
  return ROWS;   // empty column → collision at floor
}

function clearLinesInGrid(grid) {
  const newGrid = [];

  // Keep only rows that are NOT full
  for (let r = 0; r < ROWS; r++) {
    const isFull = grid[r].every(cell => cell !== null);
    if (!isFull) newGrid.push(grid[r].slice());  // keep it
  }

  // Count how many lines were cleared
  const cleared = ROWS - newGrid.length;

  // Add empty rows at top for each cleared line
  for (let i = 0; i < cleared; i++) {
    newGrid.unshift(Array(COLS).fill(null));
  }

  return newGrid;
}

function addPieceToGrid(grid, piece) {
  if(!piece)
    return;
  
  const shape = rotateMatrix(TETROMINO_SHAPES[piece.type], piece.rotation || 0);
  const color = TETROMINO_COLORS[piece.type];

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;

      const gx = piece.x + c;
      const gy = piece.y + r;

      // inside grid?
      if (gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS) {
        grid[gy][gx] = color;   // or piece.type if you want type markers
      }
    }
  }
}


/* ------------------------------------------------
   Player state & movement helpers
   ------------------------------------------------ */

let activePiece = null;   // active on-screen piece {type,x,y,rotation,_target}
let botEnabled = false;
let botBusy = false;

/* collision / fit check using global grid */
function canPieceFit(gridLocal, piece) {
  const shape = rotateMatrix(TETROMINO_SHAPES[piece.type], piece.rotation || 0);
  const yOffset = (typeof Y_OFFSET !== "undefined") ? Y_OFFSET : 0;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const gx = piece.x + c;
      const gy = piece.y + r + yOffset;
      if (gx < 0 || gx >= COLS) return false;
      if (gy >= ROWS) return false;
      if (gy >= 0 && gridLocal[gy][gx]) return false;
    }
  }
  return true;
}

/* Try moving activePiece by dx,dy */
function tryMoveActive(dx, dy) {
  if (!activePiece) return false;
  const test = { ...activePiece, x: activePiece.x + dx, y: activePiece.y + dy };
  if (canPieceFit(grid, test)) {
    activePiece = test;
    return true;
  }
  return false;
}

/* Try rotating activePiece by dir (+1 CW, -1 CCW) */
function tryRotateActive(dir) {
  if (!activePiece) return false;
  const test = { ...activePiece, rotation: (activePiece.rotation + dir + 4) % 4 };
  if (canPieceFit(grid, test)) {
    activePiece = test;
    return true;
  }
  return false;
}

/* move down one */
function tryDownActive() {
  return tryMoveActive(0, 1);
}

/* compute hard-drop landing row for a piece (based on current grid & piece coords) */
function computeHardDropY(piece) {
  let y = piece.y;
  while (true) {
    const test = { ...piece, y: y + 1 };
    if (!canPieceFit(grid, test)) break;
    y++;
    if (y > ROWS + 10) break;
  }
  return y;
}

/* lock activePiece into grid at its landing Y (uses target if provided) */
function lockActivePiece() {
  if (!activePiece) return;
  const finalY = (activePiece._target && typeof activePiece._target.y === "number")
                  ? activePiece._target.y
                  : computeHardDropY(activePiece);
  const placed = { type: activePiece.type, x: activePiece.x, y: finalY, rotation: activePiece.rotation };
  placedPieces.push(placed);
  botMemory.lastPlacedType = placed.type;
  addPieceToGrid(grid, placed);
  grid = clearLinesInGrid(grid);
  activePiece = null;
  renderEverything(grid, null, peekPreviews(), botMemory.holdPiece ? botMemory.holdPiece.type : null);
}

/* hard drop and lock immediately */
function hardDropActive() {
  if (!activePiece) return;
  if (activePiece._target && typeof activePiece._target.y === "number") {
    activePiece.y = activePiece._target.y;
  } else {
    activePiece.y = computeHardDropY(activePiece);
  }
  lockActivePiece();
}

/* ------------------------------------------------
   BOT integration: logical decision -> spawn active -> plan -> execute (animated)
   ------------------------------------------------ */

/* toggle button (assumes an element #toggleBot exists) */
document.getElementById("toggleBot").addEventListener("click", () => {
  botEnabled = !botEnabled;
  document.getElementById("toggleBot").textContent = "BOT MODE: " + (botEnabled ? "ON" : "OFF");
  if (botEnabled && !activePiece && readIndex < pieceQueue.length) {
    // start the logical bot pipeline
    spawnNextLogicalPiece();
  }
});

/* Build a plan (list of actions) to move activePiece to its logical target
   includes special-case handling for first T per your request */
function botBuildPlanFromActive() {
  if (!activePiece || !activePiece._target) return [];
  const target = activePiece._target;
  const plan = [];

  // Special-case: first T placement (if not handled yet in botMemory)
  if (phaseController.getPhaseObj().SZT.bottomT === 1 && activePiece.type === "T" &&
      phaseController.getPhaseObj().SZT.leftTPlaced === 0 &&
      phaseController.getPhaseObj().SZT.rightTPlaced === 0 &&
      (phaseController.getPhaseObj().SZT.rightS > 0 || phaseController.getPhaseObj().SZT.leftS > 0)) {
    // We'll implement: rotation=1, move left by 1, then repeatedly move down until vertical alignment,
    // then set rotation=0, then hardDrop.
    // Represent actions: rotateTo1, left, repeat downUntilY, rotateTo0, hardDrop
    if(phaseController.getCurrentPhase() !== PhaseController.Phases.PHASE_3) {
      plan.push({ action: "rotateTo", rot: 3 });
      plan.push({ action: "left" });
      plan.push({ action: "left" });
      plan.push({ action: "left" });
      plan.push({ action: "left" });
      plan.push({ action: "downUntilY", y: target.y });
      plan.push({ action: "rotateTo", rot: 2 });
      plan.push({ action: "hardDrop" });
      return plan;
    }
    else {
      plan.push({ action: "rotateTo", rot: 3 });
      plan.push({ action: "right" });
      plan.push({ action: "right" });
      plan.push({ action: "right" });
      plan.push({ action: "downUntilY", y: target.y });
      plan.push({ action: "rotateTo", rot: 2 });
      plan.push({ action: "hardDrop" });
      return plan;
    }
  }

  if (activePiece.type === "O" &&
      phaseController.getCurrentPhase() === PhaseController.Phases.PHASE_1 &&
      phaseController.getPhaseObj().LOJ.type === Phase1.LOJTypes.O_BOTTOM &&
      phaseController.getPhaseObj().LOJ.JPlaced) {
    // We'll implement: rotation=1, move left by 1, then repeatedly move down until vertical alignment,
    // then set rotation=0, then hardDrop.
    // Represent actions: rotateTo1, left, repeat downUntilY, rotateTo0, hardDrop
    plan.push({ action: "right" });
    plan.push({ action: "right" });
    plan.push({ action: "right" });
    plan.push({ action: "right" });
    plan.push({ action: "right" });
    plan.push({ action: "right" });
    plan.push({ action: "right" });
    plan.push({ action: "downUntilY", y: target.y });
    plan.push({ action: "left" });
    plan.push({ action: "hardDrop" });
    return plan;
  }

  if (activePiece.type === "O" &&
      phaseController.getCurrentPhase() === PhaseController.Phases.PHASE_1 &&
      phaseController.getPhaseObj().LOJ.type === Phase1.LOJTypes.O_BOTTOM &&
      phaseController.getPhaseObj().LOJ.LPlaced) {
    // We'll implement: rotation=1, move left by 1, then repeatedly move down until vertical alignment,
    // then set rotation=0, then hardDrop.
    // Represent actions: rotateTo1, left, repeat downUntilY, rotateTo0, hardDrop
    plan.push({ action: "right" });
    plan.push({ action: "right" });
    plan.push({ action: "right" });
    plan.push({ action: "downUntilY", y: target.y });
    plan.push({ action: "right" });
    plan.push({ action: "hardDrop" });
    return plan;
  }
  // Default plan: rotate CW rSteps times, then horizontal moves, then hardDrop
  const rCur = activePiece.rotation || 0;
  const rTarget = target.rotation || 0;
  const cwSteps = (rTarget - rCur + 4) % 4;
  for (let i = 0; i < cwSteps; i++) plan.push({ action: "rotateCW" });

  const dx = target.x - activePiece.x;
  if (dx < 0) {
    for (let i = 0; i < Math.abs(dx); i++) plan.push({ action: "left" });
  } else if (dx > 0) {
    for (let i = 0; i < dx; i++) plan.push({ action: "right" });
  }

  plan.push({ action: "hardDrop" });
  return plan;
}

/* Execute plan with small delays to animate bot */
async function botExecutePlan(plan, msPerStep = 60) {
  msPerStep = document.getElementById("myRange").value;
  botBusy = true;

  for (const step of plan) {
    if (!botEnabled) break;

    switch (step.action) {
      case "left":
        tryMoveActive(-1, 0);
        break;
      case "right":
        tryMoveActive(1, 0);
        break;
      case "rotateCW":
        tryRotateActive(1);
        break;
      case "rotateCCW":
        tryRotateActive(-1);
        break;
      case "rotateTo":
        // set rotation to requested value by applying rotations if safe
        if (!activePiece) break;
        // try to rotate step by step to desired rotation
        while (activePiece.rotation !== step.rot) {
          const diff = (step.rot - activePiece.rotation + 4) % 4;
          const dir = (diff === 3) ? -1 : 1; // choose shorter way but keep safe
          if (!tryRotateActive(dir)) {
            // if rotation fails, break to avoid infinite loop
            break;
          }
        }
        break;
      case "down":
        tryDownActive();
        break;
      case "downUntilY":
        // repeatedly step down until our piece.y equals target y (or until collision)
        if (!activePiece) break;
        // Safety: if target.y is above current, skip
        while (activePiece.y < step.y) {
          const moved = tryDownActive();
          renderEverything(grid, activePiece, peekPreviews(), botMemory.holdPiece ? botMemory.holdPiece.type : null);
          await new Promise(r => setTimeout(r, msPerStep));
          if (!moved) break; // blocked
        }
        break;
      case "hardDrop":
        // align to target.x and rotation if target provided to avoid collision
        if (activePiece && activePiece._target) {
          activePiece.x = activePiece._target.x;
          activePiece.rotation = activePiece._target.rotation;
        }
        hardDropActive();
        // mark firstTHandled if it was T
        if (activePiece && activePiece.type === "T") botMemory.firstTHandled = true;
        botBusy = false;
        // After lock, spawn next logical piece after a small pause
        await new Promise(r => setTimeout(r, msPerStep));
        if (botEnabled) spawnNextLogicalPiece();
        return;
    }

    renderEverything(grid, activePiece, peekPreviews(), botMemory.holdPiece ? botMemory.holdPiece.type : null);
    await new Promise(r => setTimeout(r, msPerStep));
  }

  botBusy = false;
}

/* ------------------------------------------------
   The heart: spawnNextLogicalPiece() — implements your startRefactored decision logic,
   but DOES NOT instantly place the piece. Instead it:
     - computes shouldHold & pieceToPlaceObj
     - calls phase.execute to get target (x,y,rotation)
     - advances readIndex properly and updates phases
     - spawns activePiece with attached _target for bot to animate toward
   Added guards to avoid skipping the very first piece and handle edge cases.
   ------------------------------------------------ */

let _spawnInProgress = false; // guard to avoid concurrent spawns that caused skipping

function spawnNextLogicalPiece() {
  if (_spawnInProgress) return;
  _spawnInProgress = true;

  try {
    const phase = phaseController.getPhaseObj();

    if (readIndex >= pieceQueue.length - previewSize) {
      console.warn("No more pieces in queue");
      _spawnInProgress = false;
      return;
    }

    // If there's already an activePiece, do not spawn another (prevents double spawn)
    if (activePiece) {
      _spawnInProgress = false;
      return;
    }

    const curObj = currentPieceObj();
    if (!curObj) {
      _spawnInProgress = false;
      return;
    }

    const curType = curObj.type;
    console.log("LOGICAL_SPAWN: readIndex=", readIndex, "cur=", curType, "hold=", botMemory.holdPiece ? botMemory.holdPiece.type : null);

    // If PHASE_1 and LOJ unknown - determine LOJ type
    if (phaseController.getCurrentPhase && phaseController.getCurrentPhase() === PhaseController.Phases.PHASE_1) {
      if (phase.LOJ.type === null) {
        const arr = buildHoldPlusPreviewTypes();
        phase.LOJ.type = determineLOJtypeFromSequence(arr);
        console.log("[DEBUG] Determined LOJ.type:", phase.LOJ.type);
      }
    }

    // Decision: canPlace? shouldHold?
    const testPieceObj = { type: curType };
    let canPlaceBefore = phase.canPlace(testPieceObj, true);
    let shouldHold = !canPlaceBefore;

    if (phaseController.getCurrentPhase && phaseController.getCurrentPhase() === PhaseController.Phases.PHASE_1) {
      if (isLOJ(curType) && botMemory.holdPiece && isLOJ(botMemory.holdPiece.type)) {
        shouldHold = true;
      }
    }

    // allow phase override
    if (typeof phase.shouldBotHold === "function") {
      try {
        const override = phase.shouldBotHold(curObj, botMemory.holdPiece);
        if (override === true || override === false) shouldHold = override;
      } catch (e) {
        console.warn("phase.shouldBotHold error:", e);
      }
    }

    console.log(`[DECISION] canPlaceBefore=${canPlaceBefore} shouldHold=${shouldHold}`);

    // Hold / Swap logic
    let pieceToPlaceObj = null;
    let advanceReadIndex = false;
    let advanceExtra = false;

    if (shouldHold) {
      if (!botMemory.holdPiece) {
        botMemory.holdPiece = curObj;
        pieceToPlaceObj = pieceQueue[readIndex + 1];
        advanceReadIndex = true;
        advanceExtra = true;
        console.log("BOT: initial hold set to", botMemory.holdPiece.type, "placing next", pieceToPlaceObj ? pieceToPlaceObj.type : null);
      } else {
        const held = botMemory.holdPiece;
        botMemory.holdPiece = curObj;
        pieceToPlaceObj = held;
        advanceReadIndex = true;
        console.log("BOT: swapped, placing held", pieceToPlaceObj.type, "new hold", botMemory.holdPiece.type);
      }
    } else {
      pieceToPlaceObj = curObj;
      advanceReadIndex = true;
    }

    if (!pieceToPlaceObj) {
      console.warn("No pieceToPlaceObj determined (edge case). Aborting spawn.");
      _spawnInProgress = false;
      return;
    }

    // Validate canPlace for final piece
    if (!phase.canPlace(pieceToPlaceObj, false)) {
      throw new Error("Bot attempted illegal placement after hold/swap");
    }

    // Get final position from deterministic algorithm
    const newPos = phase.execute({ type: pieceToPlaceObj.type });

    // store target on logical piece (we will animate activePiece to this target)
    pieceToPlaceObj._target = { x: newPos.x, y: newPos.y, rotation: newPos.rotation };

    // Advance readIndex exactly like original
    if (advanceReadIndex) {
      readIndex++;
      if (advanceExtra) readIndex++;
    }

    // update phases after consuming pieces
    phaseController.updatePhases();

    // Now spawn the active piece (for player or bot to control)
    spawnActiveFromLogical(pieceToPlaceObj);
  } catch (err) {
    console.error("spawnNextLogicalPiece error:", err);
  } finally {
    _spawnInProgress = false;
  }
}

/* Spawn activePiece from the logical piece (not yet locked) */
function spawnActiveFromLogical(logicalPiece) {
  activePiece = {
    type: logicalPiece.type,
    x: 3,
    y: 0,
    rotation: 0,
    _target: logicalPiece._target
  };

  // If immediate collision on spawn -> lock at target position
  if (!canPieceFit(grid, activePiece)) {
    console.warn("Spawn collision: locking at target immediately");
    const placed = { type: logicalPiece.type, x: logicalPiece._target.x, y: logicalPiece._target.y, rotation: logicalPiece._target.rotation };
    placedPieces.push(placed);
    botMemory.lastPlacedType = placed.type;
    addPieceToGrid(grid, placed);
    grid = clearLinesInGrid(grid);
    renderEverything(grid, null, peekPreviews(), botMemory.holdPiece ? botMemory.holdPiece.type : null);
    // spawn next logical piece automatically if bot is on
    if (botEnabled) spawnNextLogicalPiece();
    return;
  }

  renderEverything(grid, activePiece, peekPreviews(), botMemory.holdPiece ? botMemory.holdPiece.type : null);

  // If bot is enabled and not busy, build plan and execute
  if (botEnabled && !botBusy) {
    const plan = botBuildPlanFromActive();
    botExecutePlan(plan, 210).catch(err => {
      console.error("botExecutePlan failed:", err);
      botBusy = false;
    });
  }
}

/* ------------------------------------------------
   Keyboard input for manual control (disabled while botEnabled)
   ------------------------------------------------ */
document.addEventListener("keydown", e => {
  if (botEnabled) return; // player blocked while bot runs
  if (!activePiece) return;

  switch (e.key) {
    case "ArrowLeft":
      tryMoveActive(-1, 0);
      break;
    case "ArrowRight":
      tryMoveActive(1, 0);
      break;
    case "ArrowDown":
      tryMoveActive(0, 1);
      break;
    case "z":
    case "Z":
      tryRotateActive(-1);
      break;
    case "x":
    case "X":
      tryRotateActive(1);
      break;
    case "c":
    case "C":
    case " ":
      // manual hard drop and then spawn next logical piece (keeps readIndex consistent)
      hardDropActive();
      spawnNextLogicalPiece();
      return;
  }

  renderEverything(grid, activePiece, peekPreviews(), botMemory.holdPiece ? botMemory.holdPiece.type : null);
});

/* ------------------------------------------------
   runOnce step button (keeps compatibility)
   ------------------------------------------------ */
document.getElementById('runOnce').addEventListener('click', () => {
  try {
    spawnNextLogicalPiece();
  } catch (e) {
    console.error("runOnce error:", e);
  }
});

/* ------------------------------------------------
   Initialization
   ------------------------------------------------ */
resetAll();
// spawn first logical piece so game is ready (guarded inside spawn function)
//spawnNextLogicalPiece();
