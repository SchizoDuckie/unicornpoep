import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

import QuizEngine from '../services/QuizEngine.js';
import webRTCManager from '../services/WebRTCManager.js'; // Corrected path
import { getTextTemplate } from '../utils/miscUtils.js'; // Import the utility

import miscUtils from '../utils/miscUtils.js'; // Changed to default import

// Using MSG_TYPE defined in WebRTCManager for consistency if possible,
// or redefine here if needed for game-specific messages.
// For now, assuming WebRTCManager defines the transport-level types.

/**
 * Manages the client-side state and interactions during a multiplayer game.
 * Listens for game data received from the host (via WebRTCManager) and
 * translates it into local events for UI components. Also handles sending
 * client actions (like submitting answers) back to the host.
 */
class MultiplayerClientManager {
    constructor() {
        console.log('[MultiplayerClientManager] Initialized');
        this.isGameActive = false;
        this.hostPeerId = null; // Store the host's ID when connected
        this._boundHandleDataReceived = this.handleDataReceived.bind(this);
        this._boundHandleAnswerSubmitted = this.handleAnswerSubmitted.bind(this); // Bind answer handler
        this._listeningForAnswers = false; // Flag to track if we are listening

        this.listen();
    }

    /**
     * Sets up listeners for relevant events.
     * @private
     */
    listen() {
        // Listen for data coming FROM the host (via WebRTCManager)
        eventBus.on(Events.WebRTC.MessageReceived, this._boundHandleDataReceived);

        // Listen for the client successfully connecting TO the host
        eventBus.on(Events.Multiplayer.Client.ConnectedToHost, this.handleConnectedToHost.bind(this));

        // Listen for disconnection FROM the host
        eventBus.on(Events.Multiplayer.Client.DisconnectedFromHost, this.handleDisconnectedFromHost.bind(this));

        // Listen for game start/finish to manage the AnswerSubmitted listener
        eventBus.on(Events.Game.Started, this._handleGameStarted.bind(this));
        eventBus.on(Events.Game.Finished, this._handleGameFinished.bind(this));

        // DO NOT listen for AnswerSubmitted here initially
        // eventBus.on(Events.UI.GameArea.AnswerSubmitted, this.handleAnswerSubmitted.bind(this));
    }

    /** @private */
    _startListeningForAnswers() {
        if (!this._listeningForAnswers) {
            eventBus.on(Events.UI.GameArea.AnswerSubmitted, this._boundHandleAnswerSubmitted);
            this._listeningForAnswers = true;
            console.log(`[${this.constructor.name}] Started listening for answer submissions.`);
        }
    }

    /** @private */
    _stopListeningForAnswers() {
        if (this._listeningForAnswers) {
            eventBus.off(Events.UI.GameArea.AnswerSubmitted, this._boundHandleAnswerSubmitted);
            this._listeningForAnswers = false;
            console.log(`[${this.constructor.name}] Stopped listening for answer submissions.`);
        }
    }

    /**
     * Handles Game.Started event to determine if we should listen for answers.
     * @param {object} payload
     * @param {string} payload.mode
     * @param {string} payload.role
     * @private
     */
    _handleGameStarted(payload) {
        if (payload.mode === 'multiplayer' && payload.role === 'client') {
            this.startGame(this.hostPeerId); // Mark game active (might be redundant if startGame called elsewhere)
            this._startListeningForAnswers();
        } else {
            // If game started but not MP client, ensure we are NOT listening
            this._stopListeningForAnswers();
        }
    }

    /**
     * Handles Game.Finished event to stop listening for answers.
     * @param {object} payload
     * @param {string} payload.mode
     * @private
     */
    _handleGameFinished(payload) {
        // Stop listening regardless of which mode finished, just in case
        this._stopListeningForAnswers();
        // Reset internal state if it was a multiplayer game ending
        if (payload.mode === 'multiplayer') {
            this.resetState();
        }
    }

    /**
     * Handles the event when connection to the host is established.
     * @param {object} payload - Event payload.
     * @param {string} payload.hostId - The PeerJS ID of the host.
     */
    handleConnectedToHost({ hostId }) {
        console.log(`[MultiplayerClientManager] Connected to host: ${hostId}`);
        this.hostPeerId = hostId;
        // Ready to receive game info, but game hasn't necessarily started.
        // The JoinLobby or Coordinator should manage the transition to the game view.
    }

    /**
     * Handles disconnection from the host.
     * @param {object} [payload] - Optional event payload.
     * @param {string} [payload.reason] - Optional reason for disconnection.
     */
    handleDisconnectedFromHost(payload) {
        console.warn('[MultiplayerClientManager] Disconnected from host.', payload.reason || '');
        const wasActive = this.isGameActive;
        this._stopListeningForAnswers(); // Stop listening on disconnect
        this.resetState();
        // UI should react to DisconnectedFromHost or a specific Game.Finished/Error event
        // Emitting a generic error or feedback might be appropriate here.
        // Use template for feedback message
        eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('mcDisconnect'), level: 'warn' });
        // Potentially emit a game finished event if the game was active
        if (wasActive) {
             // Let _handleGameFinished manage state reset if event is emitted
             // eventBus.emit(Events.Game.Finished, { mode: 'multiplayer', results: { disconnected: true } });
             // No, Game.Finished should signify a *natural* end. Disconnect is different.
        }
         // TODO: Trigger navigation back to main menu or appropriate screen?
         // This might be handled by UIManager listening to DisconnectedFromHost or Game.Finished
    }

    /**
     * Marks the client game as active. Called by GameCoordinator or similar.
     * @param {string} hostId - The ID of the host peer.
     */
    startGame(hostId) {
        console.log(`[MultiplayerClientManager] Starting client game with host: ${hostId}`);
        this.isGameActive = true;
        this.hostPeerId = hostId;
        // Initial state is set, waiting for data from host (e.g., first question)
    }

    /**
     * Resets the manager's state, typically on game end or disconnection.
     * @private
     */
    resetState() {
        this.isGameActive = false;
        this.hostPeerId = null;
        console.log('[MultiplayerClientManager] State reset.');
    }

    /**
     * Handles incoming WebRTC data messages, parsing the type and payload.
     * @param {object} eventData - The event payload from Events.WebRTC.MessageReceived.
     * @param {any} eventData.msg - The raw message data received.
     * @param {string} eventData.sender - The PeerJS ID of the sender.
     * @private
     */
    handleDataReceived({ msg, sender }) {
        if (!this.hostPeerId || sender !== this.hostPeerId) {
            console.warn(`[MultiplayerClientManager] Received data from unexpected peer: ${sender}. Expected host: ${this.hostPeerId}. Ignoring.`);
            return;
        }

        // Assuming msg contains { type: string, payload: any }
        const type = msg.type;
        const payload = msg.payload;

        if (!type) {
            console.warn(`[MultiplayerClientManager] Received message without type from host ${sender}:`, msg);
            return;
        }

        if (!this.isGameActive && !['game_info', 'game_start'].includes(type)) {
             console.warn(`[MultiplayerClientManager] Received game data type '${type}' while game not active. Ignoring.`);
             // Allow 'game_info' even before game start (e.g., in JoinLobby confirm step)
             // Allow 'game_start' to trigger the active state.
             // return; // Removed return to allow game_start to activate
        }

        console.log(`[MultiplayerClientManager] Received data from host (${sender}): Type=${type}`, payload);

        // --- Route message based on type ---
        switch (type) {
            case 'game_info':
                // Emitted before game officially starts, usually for confirmation screen
                // Payload example: { settings: {...}, players: Map<string, object> }
                eventBus.emit(Events.Multiplayer.Client.GameInfoReceived, payload);
                break;

            case 'game_start':
                // Host signals the game is actually starting NOW
                // Payload example: { settings: {...}, players: Map<string, object>, /* any other initial state */ }
                this.isGameActive = true; // Mark game active on explicit start signal
                eventBus.emit(Events.Game.Started, { mode: 'multiplayer', settings: payload.settings, role: 'client' });
                // Update player list immediately on start
                if (payload.players) {
                     // Use getTextTemplate for default name if needed during conversion (although unlikely here)
                     const defaultName = getTextTemplate('mcDefaultPlayerName'); 
                     const playerMap = new Map(Object.entries(payload.players).map(([id, data]) => [
                         id, 
                         { ...data, name: data.name || defaultName } // Ensure name exists
                     ]));
                     eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: playerMap }); 
                }
                break;

            case 'question_new':
                // Payload example: { questionIndex: number, totalQuestions: number, questionData: {...} }
                eventBus.emit(Events.Game.QuestionNew, payload);
                break;

            case 'answer_result': // Host sending back result of *our* submitted answer
                // Payload example: { isCorrect: boolean, scoreDelta: number, correctAnswer: string, submittedAnswer: any, totalScore: number }
                 // Note: Emitting AnswerChecked might be confusing as it's usually internal to QuizEngine.
                 // We primarily care about the score update and potentially showing correct/incorrect feedback.
                const myResult = payload.isCorrect[webRTCManager.getMyPeerId()];
                const myScoreDelta = payload.scoreDelta[webRTCManager.getMyPeerId()];
                const myTotalScore = payload.totalScores[webRTCManager.getMyPeerId()];

                if (myTotalScore !== undefined) {
                    eventBus.emit(Events.Game.ScoreUpdated, { totalScore: myTotalScore });
                }
                // Emit a specific event for UI to show Correct/Incorrect based on *this* client's answer
                 eventBus.emit('multiplayer:client:answerResult', {
                     isCorrect: myResult,
                     correctAnswer: payload.correctAnswer,
                     // submittedAnswer: ?? // Host might not send this back
                     scoreDelta: myScoreDelta
                 });
                break;

            case 'round_results': // Host sending results after everyone answered or time ran out
                // Payload example: { scores: Map<string, number>, correctAnswers: {...}, /* other round summary */ }
                // TODO: Define and emit an appropriate event for displaying round results/leaderboard update.
                console.log('[MultiplayerClientManager] Round results received:', payload);
                 eventBus.emit('multiplayer:client:roundResults', payload);
                break;

            case 'player_update': // Another player's state changed (score, finished status)
                // Payload example: { peerId: string, updatedData: { score: number, isFinished: boolean } }
                eventBus.emit(Events.Multiplayer.Common.PlayerUpdated, payload);
                // PlayerListComponent should listen for PlayerUpdated and refresh specific player
                break;

             case 'player_list_update': // Full refresh of the player list
                 // Payload example: { players: Map<string, object> }
                 // Use getTextTemplate for default name if needed during conversion
                 const defaultPlayerName = getTextTemplate('mcDefaultPlayerName'); 
                 const updatedPlayerMap = new Map(Object.entries(payload.players).map(([id, data]) => [
                     id, 
                     { ...data, name: data.name || defaultPlayerName } // Ensure name exists
                 ]));
                 eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: updatedPlayerMap }); 
                 break;

            case 'game_over':
                // Payload example: { results: { rankings: [...], scores: {...} } }
                this.isGameActive = false;
                eventBus.emit(Events.Game.Finished, { mode: 'multiplayer', results: payload.results });
                this.resetState();
                break;

            case 'timer_tick':
                // Payload example: { remainingTime: number }
                eventBus.emit(Events.Game.TimeTick, payload);
                break;

             case 'timer_up':
                 // Payload example: {} or { timerId: '...' }
                 eventBus.emit(Events.Game.TimeUp, payload);
                 break;

             case 'error':
                // Host reported an error
                // Payload example: { message: string, context?: string }
                eventBus.emit(Events.System.ErrorOccurred, {
                    message: `Error from host: ${payload.message}`,
                    context: payload.context || 'Multiplayer Game (Host)',
                });
                break;

            case 'feedback':
                 // Host wants to show feedback to this client
                 // Payload example: { message: string, level: 'info'|'warn'|'error'|'success', duration?: number }
                 eventBus.emit(Events.System.ShowFeedback, payload);
                 break;

             case 'player_joined': // Notification that a new player joined the lobby/game
                 // Payload example: { peerId: string, playerData: { name: string } }
                 eventBus.emit(Events.Multiplayer.Common.PlayerJoined, payload);
                 break;

             case 'player_left': // Notification that a player left
                 // Payload example: { peerId: string }
                 eventBus.emit(Events.Multiplayer.Common.PlayerLeft, payload);
                 break;

            default:
                console.warn(`[MultiplayerClientManager] Unhandled data type from host: ${type}`);
        }
    }

    /**
     * Handles the local user submitting an answer. Sends it to the host via WebRTCManager.
     * @param {object} payload - The event payload from UI.GameArea.AnswerSubmitted.
     * @param {any} payload.answer - The answer submitted by the user.
     * @private
     */
    handleAnswerSubmitted({ answer }) {
        if (!this.isGameActive || !this.hostPeerId) {
            console.warn('[MultiplayerClientManager] Cannot submit answer: Game not active or host disconnected.');
            return;
        }
        console.log(`[MultiplayerClientManager] Sending answer to host: `, answer);
        // Use WebRTCManager to send the message
        webRTCManager.sendToHost('answer_submitted', { // Use type defined in MultiplayerGame for host handling
            answer: answer
        });
        // Local UI feedback (e.g., disable buttons) should be handled by the UI component
        // listening to UI.GameArea.AnswerSubmitted or 'multiplayer:client:answerResult'.
    }

     /**
     * Cleans up listeners when the manager is no longer needed.
     * (May not be strictly necessary if it's a singleton for the app lifetime,
     * but good practice if it could be destroyed/recreated).
     */
    destroy() {
        console.log(`[${this.constructor.name}] Destroying instance.`);
        this._stopListeningForAnswers(); // Ensure listener is removed on destroy
        eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleDataReceived);
        eventBus.off(Events.Multiplayer.Client.ConnectedToHost, this.handleConnectedToHost);
        eventBus.off(Events.Multiplayer.Client.DisconnectedFromHost, this.handleDisconnectedFromHost);
        eventBus.off(Events.Game.Started, this._handleGameStarted);
        eventBus.off(Events.Game.Finished, this._handleGameFinished);
        this.resetState();
    }
}

// Export a singleton instance (or manage instantiation via GameCoordinator)
const multiplayerClientManager = new MultiplayerClientManager();
export default multiplayerClientManager; 