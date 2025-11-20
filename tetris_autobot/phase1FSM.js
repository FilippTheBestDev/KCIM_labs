/* --- PHASE1 FSM --- */
function Phase1() {
  this.turn = 0;
  this.LOJ = { type: null, LPlaced:false, JPlaced:false, OPlaced:false };
  this.SZT = { leftZ:0, rightZ:0, leftS:0, rightS:0, leftTPlaced:0, rightTPlaced:0, bottomT:0 };
  this.I_cnt = 0;

  this.I_filled_times = 0;
  this.SZT_filled_times = 0;
  this.LOJ_filled_times = 0;
}
Phase1.LOJTypes = { O_BOTTOM: 0, O_TOP: 1 };

/* --- determine LOJ type from an array: the spec says arr = hold + 7 sequential pieces --- */
function determineLOJtypeFromSequence(arrTypes) {
  // arrTypes is an array of type strings (hold if present then current+6 previews)
  const idx = t => {
    const i = arrTypes.indexOf(t);
    return i === -1 ? Infinity : i;
  };
  const j = idx('J'), l = idx('L'), o = idx('O');
  if (j < o && l < o) return Phase1.LOJTypes.O_TOP;
  return Phase1.LOJTypes.O_BOTTOM;
}

/* --- canPlace EXACT rules for T, S, Z, LOJ (literal priority + other?hold) --- */
Phase1.prototype.canPlace = function(piece, isFirstHold = true) {
  const t = piece.type;
  const S = this.SZT;
  const L = this.LOJ;

  if((this.turn + 1) % 28 === 0 && this.turn !== 0 && isFirstHold && botMemory.holdPiece)
    return false;
  if(isLOJ(t) && isLOJ(botMemory.holdPiece ? botMemory.holdPiece.type : '') && isFirstHold)
    return false;

  // T RULES (priority order)
  if (t === "T") {
    if (S.bottomT === 0) return true;                           // rule1: bottomT=0 -> place (sets bottomT=1)
    if (S.rightS === 2 && S.rightTPlaced === 0) return true;   // rule2
    if (S.leftZ === 2 && S.leftTPlaced === 0) return true;     // rule3
    if (S.leftZ===2 && S.rightZ===2 && S.leftS===2 && S.rightS===2) return true; // rule4 reset
    return false; // other? hold
  }

  // S RULES
  if (t === "S") {
    if (S.rightS < 2) return true; // rule1
    if (S.rightS === 2 && S.leftTPlaced === 1 && S.leftS < 2) return true; // rule2
    return false; // other? hold
  }

  // Z RULES
  if (t === "Z") {
    if (S.bottomT === 0) return false; // rule1: hard hold
    if (S.leftZ < 2) return true; // rule2
    if (S.leftZ === 2 && S.rightTPlaced === 1 && S.rightZ < 2) return true; // rule3
    return false; // other? hold
  }

  // LOJ RULES (L, O, J)
  if (t === "O") {
    if (L.type === Phase1.LOJTypes.O_BOTTOM) return true;
    if (L.type === Phase1.LOJTypes.O_TOP) {
      // place O only if both J and L already placed (per your spec)
      if (L.JPlaced && L.LPlaced) return true;
      throw 'Phase1.prototype.canPlace: wrong placement O'
      //return false;
    }
    throw 'Phase1.prototype.canPlace: wrong placement O'
    //return true; // if LOJ type not set, allow (we'll compute soon)
  }

  if (t === "L") {
    if (L.type === Phase1.LOJTypes.O_BOTTOM) {
      if (L.OPlaced && !L.JPlaced) return true;
      if (L.OPlaced && L.JPlaced) return true; // will reset after
      if (!L.OPlaced && !L.JPlaced) return true;
      if (!L.OPlaced && L.JPlaced) return false; // spec: hold

      return false;
    }
    if (L.type === Phase1.LOJTypes.O_TOP) return true;

    return false;
  }

  if (t === "J") {
    if (L.type === Phase1.LOJTypes.O_BOTTOM) {
      if (L.OPlaced && !L.LPlaced) return true;
      if (L.OPlaced && L.LPlaced) return true; // will reset after
      if (!L.OPlaced && !L.LPlaced) return true;
      if (!L.OPlaced && L.LPlaced) return false; // spec: hold

      return false;
    }
    if (L.type === Phase1.LOJTypes.O_TOP) return true;

    return false;
  }

  // I has no hold rules
  if (t === "I") return true;

  // Default allow
  return true;
};

/* --- execute: apply EXACT priority rules for T, S, Z and LOJ updates (only called when canPlace true) --- */
Phase1.prototype.execute = function(piece) {
  this.turn++;
  const t = piece.type;
  const S = this.SZT;
  const L = this.LOJ;
  let x = y = rotation = 0;

  const I_y_offset = -4 * Math.floor(this.I_cnt / 2) + -8 * this.I_filled_times;
  const LOJ_y_offset = -3 * this.LOJ_filled_times;
  const SZT_y_offset = -12 * this.SZT_filled_times;

  // I counter rule (simple counter cycling)
  if (t === 'I') {
    if (this.I_cnt < 3) this.I_cnt++;
    else {
      this.I_cnt = 0;
      this.I_filled_times++;
    }

    x = 4 + (this.I_cnt % 2);
    y = findFirstCollisionY(grid, x) - 4;
    if(x === 5 && findFirstCollisionY(grid, 5) < findFirstCollisionY(grid, 4)) {
      x = 4;
      y = findFirstCollisionY(grid, 4) - 4;
    }
    rotation = 1;
  }

  // T rules - priority chain
  else if (t === "T") {
    if (S.bottomT === 0) {
      // Rule1
      S.bottomT = 1;
      console.log("[EXECUTE][T] rule1 bottomT set -> 1");
      x=0; y=findFirstCollisionY(grid, x)-2; rotation=2;
    } else if (S.rightS === 2 && S.rightTPlaced === 0) {
      // Rule2
      S.rightTPlaced = 1;
      console.log("[EXECUTE][T] rule2 rightTPlaced -> 1");
      x=2; y=findFirstCollisionY(grid, x)-2; rotation=1;
    } else if (S.leftZ === 2 && S.leftTPlaced === 0) {
      // Rule3
      S.leftTPlaced = 1;
      console.log("[EXECUTE][T] rule3 leftTPlaced -> 1");
      x=0; y=findFirstCollisionY(grid, x)-3; rotation=3;
    } else if (S.leftZ===2 && S.rightZ===2 && S.leftS===2 && S.rightS===2) {
      // Rule4 reset
      S.leftZ = S.rightZ = S.leftS = S.rightS = 0;
      S.leftTPlaced = S.rightTPlaced = 0;
      S.bottomT = 0;
      this.SZT_filled_times++;
      console.log("[EXECUTE][T] rule4 RESET SZT");
      x=1; y=findFirstCollisionY(grid, x)-1; rotation=0;
    } else {
      // other? hold -> shouldn't call execute when hold, but do nothing if called
      throw "[EXECUTE][T] other -> no state change (hold)";
    }
  }

  // S rules
  else if (t === "S") {
    if (S.rightS < 2) {
      S.rightS++;
      console.log("[EXECUTE][S] rightS++ ->", S.rightS);
      x=2; y=findFirstCollisionY(grid, 3)-3; rotation=1;
    } else if (S.rightS === 2 && S.leftTPlaced === 1 && S.leftS < 2) {
      S.leftS++;
      console.log("[EXECUTE][S] leftS++ ->", S.leftS);
      x=0; y=findFirstCollisionY(grid, 1)-3; rotation=1;
    } else {
      throw "[EXECUTE][S] other -> no state change (hold)";
    }
  }

  // Z rules
  else if (t === "Z") {
    if (S.bottomT === 0) {
      throw "[EXECUTE][Z] bottomT=0 -> HOLD (no state change)";
    } else if (S.leftZ < 2) {
      S.leftZ++;
      console.log("[EXECUTE][Z] leftZ++ ->", S.leftZ);
      x=0; y=findFirstCollisionY(grid, x)-3; rotation=1;
    } else if (S.leftZ === 2 && S.rightTPlaced === 1 && S.rightZ < 2) {
      S.rightZ++;
      console.log("[EXECUTE][Z] rightZ++ ->", S.rightZ);
      x=2; y=findFirstCollisionY(grid, x)-3; rotation=1;
    } else {
      throw "[EXECUTE][Z] other -> no state change (hold)";
    }
  }

  // LOJ updates:
  else if (t === "O") {
    if (L.type === Phase1.LOJTypes.O_BOTTOM) {
      L.OPlaced = true;
      console.log("[EXECUTE][O] OPlaced = true (O_BOTTOM)");
      x = 7;
      y = Math.max(findFirstCollisionY(grid, x), findFirstCollisionY(grid, x+1))-2;
      rotation = 0;
    } else if (L.type === Phase1.LOJTypes.O_TOP) {
      if (L.JPlaced && L.LPlaced) {
        // complete and reset LOJ
        L.OPlaced = true;
        // after completing the top case we can clear flags for the bag
        L.LPlaced = L.JPlaced = L.OPlaced = false;
        L.type = null;
        this.LOJ_filled_times++;
        console.log("[EXECUTE][O] O_TOP complete -> reset LOJ");
      } else {
        throw "[EXECUTE][O] O_TOP but J/L not both placed -> OPlaced flagged";
      }
      x = 7;
      y = findFirstCollisionY(grid, x)-2;
      rotation = 0;
    } else {
      throw "[EXECUTE][O] LOJ.type unknown -> mark OPlaced";
    }
  }
  
  else if (t === "L") {
    if (L.type === Phase1.LOJTypes.O_BOTTOM) {
      if (L.OPlaced && !L.JPlaced) {
        L.LPlaced = true;
        console.log("[EXECUTE][L] OPlaced & !JPlaced -> LPlaced true");
      } else if (L.OPlaced && L.JPlaced) {
        // both around O already placed -> reset
        L.LPlaced = true;
        L.LPlaced = L.JPlaced = L.OPlaced = false;
        L.type = null;
        this.LOJ_filled_times++;
        console.log("[EXECUTE][L] OPlaced & JPlaced -> reset LOJ");
      } else if (!L.OPlaced && !L.JPlaced) {
        L.LPlaced = true;
        console.log("[EXECUTE][L] neither O nor J placed -> LPlaced true");
      } else if (!L.OPlaced && L.JPlaced) {
        // spec says hold; if placed anyway, mark
        throw "[EXECUTE][L] !OPlaced & JPlaced -> (spec: hold) placed anyway -> LPlaced true";
      }
      rotation = 3; x = 8; y = findFirstCollisionY(grid, x+1)-3;
    } else if ((L.type === Phase1.LOJTypes.O_TOP)) {
      // O_TOP or unknown: place
      L.LPlaced = true;
      console.log("[EXECUTE][L] O_TOP -> LPlaced true");
      rotation = 1; x = 6; y = findFirstCollisionY(grid, x)-3;
    } else {
      throw "[EXECUTE][L] Unknown type -> error"
    }
  }

  else if (t === "J") {
    if (L.type === Phase1.LOJTypes.O_BOTTOM) {
      if (L.OPlaced && !L.LPlaced) {
        L.JPlaced = true;
        console.log("[EXECUTE][J] OPlaced & !LPlaced -> JPlaced true");
      } else if (L.OPlaced && L.LPlaced) {
        L.JPlaced = true;
        L.LPlaced = L.JPlaced = L.OPlaced = false;
        L.type = null;
        this.LOJ_filled_times++;
        console.log("[EXECUTE][J] OPlaced & LPlaced -> reset LOJ");
      } else if (!L.OPlaced && !L.LPlaced) {
        L.JPlaced = true;
        console.log("[EXECUTE][J] neither O nor L placed -> JPlaced true");
      } else if (!L.OPlaced && L.LPlaced) {
        // spec says hold; if placed anyway, mark
        throw "[EXECUTE][J] !OPlaced & LPlaced -> (spec: hold) placed anyway -> JPlaced true";
      }
      rotation = 1; x = 6; y = findFirstCollisionY(grid, x)-3;
    } else if ((L.type === Phase1.LOJTypes.O_TOP)) {
      L.JPlaced = true;
      console.log("[EXECUTE][J] O_TOP -> JPlaced true");
      rotation = 3; x = 8; y = findFirstCollisionY(grid, x)-3;
    } else {
      throw "[EXECUTE][J] Unknown type -> error"
    }
  }

  // After each placement, if all three LOJ placed flags are false, ensure L.type is null
  /*
  if (!L.LPlaced && !L.JPlaced && !L.OPlaced) {
    L.type = null;
  }
  */

  return { x, y, rotation };
};