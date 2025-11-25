/*
  voting.js (Router)
  ------------------
  Routes initialization to the correct voting module based on VOTING_MODE.
*/

import { VOTING_MODE } from './utils.js';
import { initAdaVoting } from './voting_ada.js';
import { initDRepVoting } from './voting_drep.js';

export function initVotingPage() {
    console.log(`Voting Router: Initializing mode [${VOTING_MODE}]`);

    if (VOTING_MODE === 'DREP_POWER') {
        initDRepVoting();
    } else {
        // Defaults to ADA_BALANCE logic
        initAdaVoting();
    }
}