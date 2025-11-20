/* --- PHASE2 FSM --- */
function Phase2() {
  this.turn = 0;
  this.LO = { L_cnt: 0, O_cnt: 0 };
  this.IJ = { I_cnt: 0, J_cnt: 0 };
  this.SZT = { leftZ:0, rightZ:0, leftS:0, rightS:0, leftTPlaced:0, rightTPlaced:0, bottomT:0 };


  this.LO_filled_times = 0;
  this.IJ_filled_times = 0;
  this.SZT_filled_times = 0;
}



Phase2.prototype.canPlace = function(piece, isFirstHold = true) {
  const t = piece.type;
  const S = this.SZT;
  const L = this.LO;
  const I = this.IJ;

  if((this.turn + 1) % 28 === 0 && this.turn !== 0 && isFirstHold)
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

  if (t === "O")
    return true;

  if (t === "L")
    return true;

  if (t === "J")
    return true;

  if (t === "I")
    return true;

  return true;
};

/* --- execute: apply EXACT priority rules for T, S, Z and LOJ updates (only called when canPlace true) --- */
Phase2.prototype.execute = function(piece) {
  this.turn++;
  const t = piece.type;
  const S = this.SZT;
  const L = this.LO;
  const I = this.IJ;
  let x = y = rotation = 0;

  const IJ_y_offset = -8 * this.IJ_filled_times;
  const LO_y_offset = -4 * this.LO_filled_times;
  const SZT_y_offset = -12 * this.SZT_filled_times;

  // I counter rule (simple counter cycling)
  if (t === 'I') {
    if (this.IJ.I_cnt === 1 && this.IJ.J_cnt === 2) {
      this.IJ.I_cnt = 0;
      this.IJ.J_cnt = 0;
      this.IJ_filled_times++;
    }
    else {
      this.IJ.I_cnt++;
    }

    x = 4 + (this.IJ.I_cnt % 2);
    y = findFirstCollisionY(grid, x)-4;
    rotation = 1;
  }

  else if (t === "J") {
    if (this.IJ.J_cnt === 1 && this.IJ.I_cnt === 2) {
      this.IJ.I_cnt = 0;
      this.IJ.J_cnt = 0;
      this.IJ_filled_times++;
    }
    else {
      this.IJ.J_cnt++;
    }

    x = 4;
    if((this.IJ.J_cnt - 1) % 2 === 0)
      y = Math.min(findFirstCollisionY(grid, x), findFirstCollisionY(grid, x+1))-3;
    else
      y = Math.min(findFirstCollisionY(grid, x)-3, findFirstCollisionY(grid, x+1)-1);
    rotation = 3 + (-2 * ((this.IJ.J_cnt - 1) % 2));
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
    if (this.LO.O_cnt === 1 && this.LO.L_cnt === 2) {
      this.LO.L_cnt = 0;
      this.LO.O_cnt = 0;
      this.LO_filled_times++;
    }
    else {
      this.LO.O_cnt++;
    }

    x = 6; y = findFirstCollisionY(grid, x)-2; rotation = 0;
  }
  
  else if (t === "L") {
    if (this.LO.L_cnt === 1 && this.LO.O_cnt === 2) {
      this.LO.L_cnt = 0;
      this.LO.O_cnt = 0;
      this.LO_filled_times++;
    }
    else {
      this.LO.L_cnt++;
    }

    x = 8; y = findFirstCollisionY(grid, x+1)-3; rotation = 3 - 2 * (this.LO.L_cnt % 2);
  }


  // After each placement, if all three LOJ placed flags are false, ensure L.type is null
  /*
  if (!L.LPlaced && !L.JPlaced && !L.OPlaced) {
    L.type = null;
  }
  */

  return { x, y, rotation };
};