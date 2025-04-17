import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
// Removed: import ErrorDialog from '../dialogs/error-dialog.js';
import miscUtils from '../utils/miscUtils.js';
// Removed: import { ConnectionStatus } from '../core/connection-constants.js';

// Removed: Game mode classes

// Removed: Services
// import questionsManager from './QuestionsManager.js';
// import webRTCManager from './WebRTCManager.js';
// import uiManager from '../ui/UIManager.js';
// import highscoreManager from './HighscoreManager.js';

// Removed: Dialogs
// import WaitingDialog from '../dialogs/waiting-dialog.js';

// Removed: Constants
// import { MSG_TYPE } from '../core/message-types.js';

// Removed: Service Classes
// import MultiplayerClientManager from './MultiplayerClientManager.js';
// import QuizEngine from '../services/QuizEngine.js';

/**
 * NO LONGER USED - Refactored into specific coordinators:
 * - SinglePlayerGameCoordinator
 * - MultiplayerHostCoordinator
 * - MultiplayerClientCoordinator
 * 
 * This file can likely be deleted after verifying the new coordinators are
 * correctly instantiated and functioning in js/UnicornPoep.js.
 */
class GameCoordinator_DEPRECATED {
    /**
     * @deprecated Use specific coordinators instead.
     */
    constructor() {
        console.warn("[GameCoordinator_DEPRECATED] This class is deprecated and should not be instantiated. Use specific coordinators.");
        // Keep minimal structure to avoid breaking existing import if not yet updated
        // this._bindMethods();
        // this.registerListeners();
    }

    _bindMethods() { }
    registerListeners() { }

    // --- ALL METHODS BELOW ARE MOVED/REMOVED --- 

    /*
    // ... (All previous methods removed) ...
    handleRequestMultiplayerChoice() { ... }
    handleShowJoinLobby() { ... }
    _handleValidJoinCodeDetected({ joinCode }) { ... }
    handleLobbyCancel() { ... }
    handleGameFinished({ mode, results }) { ... }
    handleLeaveGame() { ... }
    handleWebRTCConnectionFailure({ error, context, peerId }) { ... }
    resetState() { ... }
    _handleClientConnectedToHost({ hostId }) { ... }
    async _handleWebRTCMessageReceived({ msg, sender }) { ... }
    _handleLocalPlayerFinished({ score }) { ... }
    _handleMultiplayerDialogClosed() { ... }
    _handlePlayAgainRequest = () => { ... };
    async _handleClientReadyToStart({ playerName, hostId, questionsData, difficulty, settings }) { ... }
    _loadPlayerName() { ... }
    _savePlayerName(name) { ... }
    */
}

// Exporting null or an empty object might be safer than exporting the deprecated class
// export default GameCoordinator_DEPRECATED;
export default null; // Indicate this module is no longer the primary export