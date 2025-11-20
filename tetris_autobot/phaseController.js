function PhaseController() {
    this.turn = 0;
    this.phase = PhaseController.Phases.PHASE_1;
    this.phaseObjects = [
        new Phase1(),
        new Phase2(),
        new Phase3()
    ]
};
PhaseController.Phases = {
    PHASE_1: 0,
    PHASE_2: 1,
    PHASE_3: 2,
};

PhaseController.prototype.getCurrentPhase = function() {
    return this.phase;
};
PhaseController.prototype.getPhaseObj = function() {
    return this.phaseObjects[this.phase];
};
PhaseController.prototype.updatePhases = function() {
    this.turn++;
    if(this.getCurrentPhase() === PhaseController.Phases.PHASE_1 && this.turn === 28 * 3) {
        this.turn = 0;
        this.phase = PhaseController.Phases.PHASE_2;
    }
    if(this.getCurrentPhase() === PhaseController.Phases.PHASE_2 && this.turn === 28 * 1) {
        this.turn = 0;
        this.phase = PhaseController.Phases.PHASE_3;
    }
    if(this.getCurrentPhase() === PhaseController.Phases.PHASE_3 && this.turn === 28 * 1) {
        this.turn = 0;
        this.phase = PhaseController.Phases.PHASE_1;
        this.resetAll();
    }
}
PhaseController.prototype.resetAll = function() {
    let phase1 = this.phaseObjects[PhaseController.Phases.PHASE_1];
    phase1.turn = 0;
    phase1.LOJ = { type: null, LPlaced:false, JPlaced:false, OPlaced:false };
    phase1.SZT = { leftZ:0, rightZ:0, leftS:0, rightS:0, leftTPlaced:0, rightTPlaced:0, bottomT:0 };
    phase1.I_cnt = 0;
    phase1.I_filled_times = 0;
    phase1.SZT_filled_times = 0;
    phase1.LOJ_filled_times = 0;

    let phase2 = this.phaseObjects[PhaseController.Phases.PHASE_2];
    phase2.turn = 0;
    phase2.LO = { L_cnt: 0, O_cnt: 0 };
    phase2.IJ = { I_cnt: 0, J_cnt: 0 };
    phase2.SZT = { leftZ:0, rightZ:0, leftS:0, rightS:0, leftTPlaced:0, rightTPlaced:0, bottomT:0 };
    phase2.LO_filled_times = 0;
    phase2.IJ_filled_times = 0;
    phase2.SZT_filled_times = 0;

    let phase3 = this.phaseObjects[PhaseController.Phases.PHASE_3];
    phase3.turn = 0;
    phase3.LO = { L_cnt: 0, O_cnt: 0 };
    phase3.IJ = { I_cnt: 0, J_cnt: 0 };
    phase3.SZT = { leftZ:0, rightZ:0, leftS:0, rightS:0, leftTPlaced:0, rightTPlaced:0, bottomT:0 };
    phase3.LO_filled_times = 0;
    phase3.IJ_filled_times = 0;
    phase3.SZT_filled_times = 0;
}