import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

import QuizEngine from '../services/QuizEngine.js';
import webRTCManager from '../services/WebRTCManager.js'; // Corrected path
import { getTextTemplate } from '../utils/miscUtils.js'; // Import the utility
import { MSG_TYPE } from '../core/message-types.js'; // CORRECTED IMPORT: Use named import for MSG_TYPE
import questionsManager from '../services/QuestionsManager.js'; // Import questionsManager
import uiManager from '../ui/UIManager.js'; // Import UIManager
import Views from '../core/view-constants.js'; // Import Views for GameArea

import miscUtils from '../utils/miscUtils.js'; // Changed to default import

// Define message types used specifically by the client manager
const ClientMessageTypes = {
    REQUEST_JOIN: 'c_requestJoin',      // Client -> Host: Request to join after confirmation
    SUBMIT_ANSWER: 'c_submitAnswer',    // Client -> Host: Submit answer for current question
    FINISHED_GAME: 'c_finishedGame',    // Client -> Host: Notify host client finished quiz
    // Add other client-specific outgoing message types here if needed
};

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
        // Listen for data coming FROM the host (via WebRTCManager) - REMOVED FROM HERE
        // eventBus.on(Events.WebRTC.MessageReceived, this._boundHandleDataReceived);

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
        // Start listening for messages FROM this specific host NOW
        eventBus.on(Events.WebRTC.MessageReceived, this._boundHandleDataReceived);
        // Ready to receive game info, but game hasn't necessarily started.
        // The JoinLobby or Coordinator should manage the transition to the game view.
    }

    /**
     * Handles disconnection from the host.
     * @param {object} [payload] - Optional event payload.
     * @param {string} [payload.reason] - Optional reason for disconnection.
     */
    handleDisconnectedFromHost(payload) {
        console.warn('[MultiplayerClientManager] Disconnected from host.', payload?.reason || '');
        const wasActive = this.isGameActive;
        this._stopListeningForAnswers(); // Stop listening on disconnect

        // *** ADDED: Stop listening for WebRTC messages on disconnect ***
        eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleDataReceived);

        this.resetState(); // Reset internal state (also ensures listener is off if called directly)
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
        // *** ADDED: Ensure WebRTC message listener is off during reset ***
        eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleDataReceived);

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

        // Revert to using local variables for clarity
        const type = msg.type;
        const payload = msg.payload;

        console.log(`[MultiplayerClientManager] Received data from host (${sender}): Type=${type}`, payload);

        // --- Route message based on type ---
        switch (type) {
            case 'game_info':
                // Emitted before game officially starts, usually for confirmation screen
                // Payload example: { questions: { sheets: [...] }, difficulty: '...', players: { peerId: playerData, ... }, hostId: '...' }
                // Reconstruct the players Map from the plain object received via JSON
                let reconstructedPlayersMap = new Map();
                if (payload.players && typeof payload.players === 'object') {
                    reconstructedPlayersMap = new Map(Object.entries(payload.players));
                    // DEBUG: Log the reconstructed map and the host ID we expect
                    console.log('[MultiplayerClientManager DEBUG] Reconstructed players map:', reconstructedPlayersMap);
                    console.log('[MultiplayerClientManager DEBUG] Expecting host ID:', payload.hostId);
                }
                
                // Prepare the payload for the event, including the full questions data and difficulty
                const gameInfoPayload = {
                    questionsData: payload.questions, // Pass the questions structure
                    difficulty: payload.difficulty,   // Pass the difficulty
                    players: reconstructedPlayersMap, // Use the reconstructed Map
                    hostId: payload.hostId            // Pass the hostId
                };
                eventBus.emit(Events.Multiplayer.Client.GameInfoReceived, gameInfoPayload);

                // Attempt to save received custom sheets locally
                try {
                    if (gameInfoPayload.questionsData && Array.isArray(gameInfoPayload.questionsData.sheets)) {
                         const hostPlayer = reconstructedPlayersMap.get(gameInfoPayload.hostId);
                         const hostName = hostPlayer ? hostPlayer.name : 'Unknown Host';

                         gameInfoPayload.questionsData.sheets.forEach(sheet => {
                             if (sheet.isCustom) {
                                 // questionsManager is imported as a singleton instance
                                 questionsManager.addReceivedCustomSheet(sheet, hostName);
                             }
                         });
                    }
                } catch (saveError) {
                    console.error("[MultiplayerClientManager] Error trying to save received custom sheets:", saveError);
                    // Don't block game flow for this, just log it.
                }

                break;

            case MSG_TYPE.PREPARE_GAME:
                console.log("[MultiplayerClientManager] Received PREPARE_GAME from host.", payload);
                if (payload && payload.duration) {
                    // Emit the local event to start the countdown UI
                    eventBus.emit(Events.Game.CountdownStart, { 
                        duration: payload.duration, 
                        // Ensure the standard completion event is specified 
                        // so GameCoordinator knows when to start the actual game instance logic
                        completionEvent: Events.Game.CountdownComplete 
                    });
                    // Client game instance will be started AFTER countdown via 
                    // GameCoordinator._handleCountdownComplete
                } else {
                    console.error("[MultiplayerClientManager] Invalid PREPARE_GAME payload:", payload);
                    // Handle error - maybe disconnect or show feedback?
                }
                break;

            case MSG_TYPE.GAME_START:
                console.log(`[${this.constructor.name}] Received GAME_START from host.`);
                
                // Hide the WaitingDialog before navigating
                const waitingDialog = uiManager.getComponent('WaitingDialog');
                if (waitingDialog) {
                    waitingDialog.hide();
                }

                // Now navigate to the GameArea view
                eventBus.emit(Events.Navigation.ShowView, { viewName: Views.GameArea });
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
                 // --- ADDED DEBUG LOG --- 
                 console.debug(`[${this.constructor.name}] Received player_list_update from host. Payload:`, payload);
                 // --- END DEBUG LOG ---
                 if (payload.players && typeof payload.players === 'object') {
                     const updatedPlayersMap = new Map(Object.entries(payload.players));
                     console.log(`[${this.constructor.name}] Emitting PlayerListUpdated event.`, updatedPlayersMap);
                     eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: updatedPlayersMap });
                     // TODO: Maybe update localPlayerId if it changed? Not likely needed here.
                 } else {
                      console.warn(`[${this.constructor.name}] Received player_list_update without valid players object.`, payload);
                 }
                 break;

            case 'game_over':
                // Payload example: { results: { rankings: [...], scores: {...} } }
                this.isGameActive = false;
                // Remove redundant Game.Finished emission. Coordinator handles GAME_OVER.
                // eventBus.emit(Events.Game.Finished, { mode: 'multiplayer', results: payload }); 
                this.resetState(); // Reset host ID etc.
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

            // Host broadcasts this when a new player joins *during the lobby phase*
            case MSG_TYPE.PLAYER_LIST_UPDATE:
                console.log("[MultiplayerClientManager] Received PLAYER_LIST_UPDATE from host.", payload);
                if (payload && payload.players) {
                    try {
                        // Reconstruct Map from plain object
                        const playersMap = new Map(Object.entries(payload.players)); 
                        eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: playersMap });
                    } catch (mapError) {
                        console.error("[MultiplayerClientManager] Error processing PLAYER_LIST_UPDATE:", mapError, payload);
                    }
                } else {
                     console.warn("[MultiplayerClientManager] Invalid PLAYER_LIST_UPDATE payload.", payload);
                }
                break;
            
            // Host sends this when it cancels the lobby before starting
            case MSG_TYPE.FEEDBACK:
                // Forward feedback events (like lobby cancellation) to the UI
                if (payload && payload.message && payload.level) {
                    eventBus.emit(Events.System.ShowFeedback, { message: payload.message, level: payload.level });
                    // If the feedback indicates lobby closure, trigger disconnect handling
                    if (payload.message === getTextTemplate('mpHostLobbyCancelled')) {
                        this.handleDisconnectedFromHost({ reason: 'lobby_cancelled_by_host' });
                    }
                } else {
                     console.warn("[MultiplayerClientManager] Received malformed FEEDBACK message.", payload);
                }
                break;

            default:
                console.warn(`[MultiplayerClientManager] Received unhandled message type from host: ${type}`);
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
     * Sends the initial request to join the game to the host.
     * Called by GameCoordinator after connection is open and user confirms.
     * @param {string} playerName - The name the player wants to use.
     */
    sendJoinRequest(playerName) {
        if (!this.hostPeerId) {
            console.error("[MultiplayerClientManager] Cannot send join request: Not connected to host.");
            throw new Error("Not connected to host.");
        }
        console.log(`[MultiplayerClientManager] Sending join request to host ${this.hostPeerId} with name: ${playerName}`);

        // --- ADD DEBUG LOG ---
        const messageType = ClientMessageTypes.REQUEST_JOIN;
        console.log(`[MultiplayerClientManager DEBUG] messageType before sendToHost: '${messageType}' (Type: ${typeof messageType})`);
        // --- END DEBUG LOG ---

        // Use the WebRTCManager's core send function
        webRTCManager.sendToHost(messageType, { name: playerName });
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