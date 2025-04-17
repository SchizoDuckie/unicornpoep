import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { ConnectionStatus } from '../core/connection-constants.js'; // Import ConnectionStatus

import QuizEngine from '../services/QuizEngine.js';
import webRTCManager from '../services/WebRTCManager.js'; // Corrected path
import { getTextTemplate } from '../utils/miscUtils.js'; // Import the utility
import { MSG_TYPE } from '../core/message-types.js'; // CORRECTED IMPORT: Use named import for MSG_TYPE
import questionsManager from '../services/QuestionsManager.js'; // Import questionsManager
import uiManager from '../ui/UIManager.js'; // Import UIManager
import Views from '../core/view-constants.js'; // Import Views for GameArea

import miscUtils from '../utils/miscUtils.js'; // Changed to default import


/**
 * Manages the client-side state and interactions during a multiplayer game.
 * Listens for game data received from the host (via WebRTCManager) and
 * translates it into local events for UI components. Also handles sending
 * client actions (like submitting answers) back to the host.
 * Provides methods for initiating and terminating connections.
 */
class MultiplayerClientManager {

    /**
     * Initializes the MultiplayerClientManager instance.
     * Sets up initial state and registers event listeners.
     */
    constructor() {
        // Track the client state
        this.isGameActive = false;
        this.hostPeerId = null;
        this._playerName = null; // Store player name internally
        this._listeningForAnswers = false;
        this._receivedGameData = null;
        this._receivedDifficulty = null;
        this._receivedPlayers = null;
        
        console.log(`[${this.constructor.name}] Initialized`);
        this.listen();
    }

    /**
     * Initializes event listeners.
     */
    listen() {
        // WebRTC and event setup
        eventBus.on(Events.UI.JoinLobby.ConfirmClicked, this._handleConfirmJoin);
        eventBus.on(Events.Multiplayer.Client.ConnectedToHost, this.handleConnectedToHost);
        eventBus.on(Events.Multiplayer.Client.DisconnectedFromHost, this.handleDisconnectedFromHost);
        eventBus.on(Events.Game.Started, this._handleGameStarted);
        eventBus.on(Events.Game.Finished, this._handleGameFinished);
    }

    /**
     * Handles the confirmation to join from the UI.
     * Sends the join request message to the host and notifies the host when ready.
     * @param {object} payload
     * @param {string} payload.playerName - The player name confirmed in the UI.
     * @private
     * @event Events.UI.JoinLobby.ConfirmClicked
     */
    _handleConfirmJoin = ({ playerName }) => {
        console.log(`[${this.constructor.name}] Received ConfirmClicked. Player Name: ${playerName}`);
        // Update internal player name if it changed during confirmation
        // This ensures the name used in sendJoinRequest is the latest one
        this._playerName = playerName; 
        
        // Send the join request to the host
        try {
            // Use the internally stored player name
            this.sendJoinRequest(this._playerName); 
        } catch (error) {
            console.error(`[${this.constructor.name}] Error sending join request:`, error);
            eventBus.emit(Events.System.ShowFeedback, { message: `Failed to send join request: ${error.message}`, level: 'error' });
            return; 
        }

        // Use instance properties for clarity
        const questionsData = this._receivedGameData;
        const difficulty = this._receivedDifficulty;
        const settings = this.settings;
        const hostId = this.hostPeerId;

        try {
            console.log(`[${this.constructor.name}] Preparing QuizEngine after join confirmation...`);
            const clientQuizEngine = QuizEngine.createInstance({ questionsData, difficulty });
            if (clientQuizEngine.getQuestionCount() === 0) {
                throw new Error("QuizEngine loaded 0 questions from host data.");
            }
            console.log(`[${this.constructor.name}] QuizEngine prepared. Notifying host with client_ready.`);
            // Protocol: After confirming join, explicitly notify the host that this client is ready.
            const currentName = this._playerName || 'Unknown Player'; // Use stored name or fallback
            webRTCManager.sendToHost(MSG_TYPE.C_REQUEST_JOIN, { 
                name: currentName,
                isReady: true
            });
        } catch (error) {
            console.error(`[${this.constructor.name}] Error preparing client game after confirmation:`, error);
            eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('errorProcessingGameInfo', `Error processing game info: ${error.message}`), level: 'error' });
            // Disconnect if critical error during setup
            this.disconnect();
        }
        // Assume JoinLobbyComponent manages its own UI state transition to 'waiting'.
    }

    /** @private */
    _startListeningForAnswers() {
        if (!this._listeningForAnswers) {
            eventBus.on(Events.UI.GameArea.AnswerSubmitted, this.handleAnswerSubmitted);
            this._listeningForAnswers = true;
            console.log(`[${this.constructor.name}] Started listening for answer submissions.`);
        }
    }

    /** @private */
    _stopListeningForAnswers() {
        if (this._listeningForAnswers) {
            eventBus.off(Events.UI.GameArea.AnswerSubmitted, this.handleAnswerSubmitted);
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
     * @event Events.Game.Started
     */
    _handleGameStarted = (payload) => {
        debugger;
        if (payload.mode === 'multiplayer') {
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
     * @event Events.Game.Finished
     */
    _handleGameFinished = (payload) => {
        // Stop listening regardless of which mode finished, just in case
        this._stopListeningForAnswers();
        // Reset internal state if it was a multiplayer game ending
        debugger;
        if (payload.mode === 'multiplayer') {
            this.resetState();
        }
    }

    /**
     * Handles the event when connection to the host is established.
     * @param {object} payload - Event payload.
     * @param {string} payload.hostId - The PeerJS ID of the host.
     * @event Events.Multiplayer.Client.ConnectedToHost
     */
    handleConnectedToHost = ({ hostId }) => {
        console.log(`[MultiplayerClientManager] Connected to host: ${hostId}`);
        this.hostPeerId = hostId;
        // Start listening for messages FROM this specific host NOW
        eventBus.on(Events.WebRTC.MessageReceived, this.handleDataReceived);
        // The manager is now connected. It should automatically receive GAME_INFO from the host.
        // handleDataReceived will process GAME_INFO and emit Events.Multiplayer.Client.GameInfoReceived
        // The JoinLobbyComponent listens for this to update the UI.
    }

    /**
     * Handles disconnection from the host.
     * @param {object} [payload] - Optional event payload.
     * @param {string} [payload.reason] - Optional reason for disconnection.
     * @event Events.Multiplayer.Client.DisconnectedFromHost
     */
    handleDisconnectedFromHost = (payload) => {
        console.warn('[MultiplayerClientManager] Disconnected from host.', payload.reason || '');
        const wasActive = this.isGameActive;
        this._stopListeningForAnswers(); // Stop listening on disconnect

        // *** ADDED: Stop listening for WebRTC messages on disconnect ***
        eventBus.off(Events.WebRTC.MessageReceived, this.handleDataReceived);

        this.resetState(); // Reset internal state (also ensures listener is off if called directly)
        // UI should react to DisconnectedFromHost or a specific Game.Finished/Error event
        // Emitting a generic error or feedback might be appropriate here.
        // Use template for feedback message
        eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('mcDisconnect'), level: 'warn' });
        // Potentially emit a game finished event if the game was active
        if (wasActive) {
             // The coordinator listening to DisconnectedFromHost should handle UI changes.
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
        eventBus.off(Events.WebRTC.MessageReceived, this.handleDataReceived);

        this.isGameActive = false;
        this.hostPeerId = null;
        this._receivedGameData = null;
        this._receivedDifficulty = null;
        this._receivedPlayers = null;
        this._playerName = null; // Clear player name on reset
        console.log('[MultiplayerClientManager] State reset.');
    }

    /**
     * Handles incoming WebRTC data messages received via the EventBus.
     * Correctly destructures the event payload { msg, sender }.
     * @param {object} eventPayload - The payload from Events.WebRTC.MessageReceived.
     * @param {object} eventPayload.msg - The actual message object { type, payload }.
     * @param {string} eventPayload.sender - The peer ID of the sender (the host).
     * @private
     * @event Events.WebRTC.MessageReceived
     */
    handleDataReceived = ({ msg, sender }) => { // Destructure the event payload here
        const data = msg;
        const senderId = sender;

        if (!data || typeof data.type !== 'string' || !data.type) {
            console.warn(`[MultiplayerClientManager] Received invalid data structure from host ${senderId}:`, data);
            return;
        }

        // Verify sender is the expected host
        const expectedHostId = this.hostPeerId;
        if (!expectedHostId) {
             console.warn(`[MultiplayerClientManager] Received message from ${senderId}, but client manager has no expected host ID set yet.`);
             debugger;
             return;
        }
        if (senderId !== expectedHostId) {
             console.warn(`[MultiplayerClientManager] Received message from unexpected sender ${senderId}, expected ${expectedHostId}. Ignored.`);
             debugger;
             return;
        }

        const { type, payload } = data; // Destructure the inner 'data' object

        switch (type) {
            case MSG_TYPE.GAME_INFO:
                console.log(`[MultiplayerClientManager] Received GAME_INFO from host:`, payload);
                if (payload) {
                    const gameData = payload.questionsData;
                    const playersData = payload.players;
                    const difficulty = payload.difficulty;

                    // --- NEW: Store received info --- 
                    this._receivedGameData = gameData;
                    this._receivedDifficulty = difficulty;
                    this._receivedPlayers = playersData;
                    console.log(`[${this.constructor.name}] Stored received game info.`);
                    // --- END NEW --- 

                    // Emit event for UI update (JoinLobbyComponent)
                    /**
                     * Emits the GameInfoReceived event for the UI (JoinLobbyComponent).
                     * Ensures the questionsData structure matches what the host sent ({ sheets: [...] }).
                     */
                    eventBus.emit(Events.Multiplayer.Client.GameInfoReceived, { 
                        questionsData: payload.questionsData, 
                        difficulty: payload.difficulty, 
                        players: payload.players,
                        hostId: this.hostPeerId
                    });

                    // --- QuizEngine Init REMOVED from here --- 

                } else {
                    console.error(`[MultiplayerClientManager] Received GAME_INFO with missing/invalid payload from ${senderId}`, payload);
                    eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('errorInvalidGameInfoPayload'), level: 'error' });
                    this.disconnect(); // Disconnect due to critical error
                }
                break;

            case MSG_TYPE.PLAYER_LIST_UPDATE: // Handle player list updates separately
                if (payload && payload.players && typeof payload.players === 'object') {
                    this.players = new Map(Object.entries(payload.players));
                    console.log(`[${this.constructor.name}] Updated player list from PLAYER_LIST_UPDATE:`, this.players);
                    eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: this.players });
                } else {
                    console.warn(`[${this.constructor.name}] Received invalid PLAYER_LIST_UPDATE payload:`, payload);
                }
                break;

            case MSG_TYPE.GAME_START: // Host started the game
                console.log('[MultiplayerClientManager] Received GAME_START from host. Payload:', payload);

                // --- FIX: Hide waiting dialog FIRST ---
                console.log('[MultiplayerClientManager] Hiding waiting dialog...');
                eventBus.emit(Events.System.HideWaitingDialog);
                // --- END FIX ---

                // 1. Extract countdown duration (use default if missing)
                const countdownDurationSec = payload.countdownDuration ?? 5;
                const startDelayMs = (countdownDurationSec * 1000) + 500; // Add buffer

                console.log(`[MultiplayerClientManager] Starting ${countdownDurationSec}s countdown locally.`);
                // 2. Emit CountdownStart locally for UI (AFTER hiding dialog)
                eventBus.emit(Events.Game.CountdownStart, { duration: countdownDurationSec });

                // Mark game as potentially active (will be confirmed by coordinator)
                this.isGameActive = true;

                // 3. Delay emitting the GameStarted event for the coordinator
                setTimeout(() => {
                    // Safety check: Ensure we are still connected and expecting to start
                    if (!this.isGameActive || !this.hostPeerId) {
                         console.warn("[MultiplayerClientManager] Game start timeout fired, but state is no longer active. Aborting GameStarted emission.");
                         return;
                    }

                    console.log("[MultiplayerClientManager] Countdown finished. Emitting Multiplayer.GameStarted.");
                    // 4. Emit the event Coordinator listens for to actually create/start client game instance
                    eventBus.emit(Events.Multiplayer.GameStarted, {
                        gameData: {
                            // Use the game data received and stored earlier via GAME_INFO
                            questionsData: this._receivedGameData,
                            difficulty: this._receivedDifficulty,
                            players: this._receivedPlayers,
                            hostId: this.hostPeerId
                        }
                    });
                }, startDelayMs);
                break;

            case MSG_TYPE.PREPARE_GAME: // Host is preparing - NOW IGNORED
                 console.log(`[${this.constructor.name}] Received PREPARE_GAME, but ignoring as GAME_START now handles countdown.`);
                // eventBus.emit(Events.Game.CountdownStart, { duration: payload.duration || 3 }); // REMOVED
                break;

            // --- Add Handling for Game-Specific Messages --- 
            case MSG_TYPE.NEXT_QUESTION:
                if (this.isGameActive && payload) {
                     console.log(`[${this.constructor.name}] Received NEXT_QUESTION:`, payload);
                     eventBus.emit(Events.Game.QuestionNew, payload);
                 } else {
                     console.warn(`[${this.constructor.name}] Ignoring NEXT_QUESTION (Game active: ${this.isGameActive}, Payload: ${!!payload})`);
                 }
                break;
            case MSG_TYPE.ANSWER_RESULT:
                 if (this.isGameActive && payload) {
                     console.log(`[${this.constructor.name}] Received ANSWER_RESULT:`, payload);
                     eventBus.emit(Events.Game.AnswerChecked, payload);
                 } else {
                     console.warn(`[${this.constructor.name}] Ignoring ANSWER_RESULT (Game active: ${this.isGameActive}, Payload: ${!!payload})`);
                 }
                break;
            case MSG_TYPE.SCORE_UPDATE:
                 if (this.isGameActive && payload) {
                     console.log(`[${this.constructor.name}] Received SCORE_UPDATE:`, payload);
                     // Ensure player list is updated locally before emitting
                     if (payload.peerId && this.players.has(payload.peerId)) {
                          const player = this.players.get(payload.peerId);
                          player.score = payload.newScore; // Assuming payload has { peerId, newScore }
                          this.players.set(payload.peerId, player);
                     } else {
                          console.warn(`[${this.constructor.name}] Received SCORE_UPDATE for unknown peer ${payload.peerId}`);
                     }
                     // Emit score update event for UI
                     eventBus.emit(Events.Game.ScoreUpdated, payload); 
                     // Also emit player list update as scores changed
                     eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: this.players });
                 } else {
                     console.warn(`[${this.constructor.name}] Ignoring SCORE_UPDATE (Game active: ${this.isGameActive}, Payload: ${!!payload})`);
                 }
                break;
            case MSG_TYPE.GAME_OVER:
                 if (this.isGameActive && payload) {
                     console.log(`[${this.constructor.name}] Received GAME_OVER:`, payload);
                     // Emit Game.Finished event - MultiplayerClientGame listens for this?
                     eventBus.emit(Events.Game.Finished, { mode: 'multiplayer', role: 'client', results: payload });
                     this.isGameActive = false; // Mark game inactive
                 } else {
                     console.warn(`[${this.constructor.name}] Ignoring GAME_OVER (Game active: ${this.isGameActive}, Payload: ${!!payload})`);
                 }
                break;
            case MSG_TYPE.FEEDBACK: // Generic feedback from host
                 if (payload) {
                     console.log(`[${this.constructor.name}] Received FEEDBACK: ${payload.message} (${payload.level})`);
                     eventBus.emit(Events.System.ShowFeedback, payload); // Forward feedback to UI
                 } else {
                     console.warn(`[${this.constructor.name}] Received invalid FEEDBACK message.`);
                 }
                 break;

            // Messages client should IGNORE (or handle differently):
            case MSG_TYPE.PING: // Handled by WebRTCManager
            case MSG_TYPE.PONG: // Handled by WebRTCManager
                 // console.log(`[${this.constructor.name}] Ignoring message type ${type}`);
                 break;

            default:
                console.warn(`[MultiplayerClientManager] Received unhandled message type from host: ${type}`, payload);
        }
    }

    /**
     * Handles the local user submitting an answer. Sends it to the host via WebRTCManager.
     * @param {object} payload - The event payload from UI.GameArea.AnswerSubmitted.
     * @param {any} payload.answer - The answer submitted by the user.
     * @private
     * @event Events.UI.GameArea.AnswerSubmitted
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
     * Sends a join request to the host with the client's player name.
     * @param {string} playerName - The name the client wishes to use.
     * @throws {Error} If not connected to a host.
     */
    sendJoinRequest(playerName) {
        if (!this.hostPeerId) {
            console.error("[MultiplayerClientManager] Cannot send join request: Not connected to host.");
            throw new Error("Not connected to host.");
        }
        console.log(`[MultiplayerClientManager] Sending join request to host ${this.hostPeerId} with name: ${playerName}`);

        // Send the join request
        webRTCManager.sendToHost(MSG_TYPE.C_REQUEST_JOIN, { name: playerName });
        
        // Send CLIENT_READY with explicit string type to avoid null type issues
        setTimeout(() => {
            // Use the constant directly to avoid any issues with undefined imports
            console.log(`[MultiplayerClientManager] Sending CLIENT_READY message (first attempt). Using string literal: '${CLIENT_READY}'`);
            
            const currentName = this._playerName || 'Unknown Player'; // Use stored name or fallback
            // Use the explicit string to avoid any import issues
            webRTCManager.sendToHost(MSG_TYPE.CLIENT_READY, { 
                name: currentName,
                isReady: true  // Explicitly include isReady flag
            });
            
            // Send a second CLIENT_READY message as backup with explicit string
            setTimeout(() => {
                console.log(`[MultiplayerClientManager] Sending CLIENT_READY message (second attempt). Using explicit string '${CLIENT_READY}'`);
                const backupName = this._playerName || 'Unknown Player'; // Use stored name again
                webRTCManager.sendToHost(CLIENT_READY, { 
                    name: backupName,
                    isReady: true  // Explicitly include isReady flag
                });
            }, 1000); // Try again 1 second after the first attempt
        }, 800); // Increase delay to ensure join request is fully processed first
    }

    /**
     * Initiates a connection attempt to the host.
     * Called by the MultiplayerClientCoordinator.
     * 
     * @param {string} code The 6-digit join code.
     * @param {string} playerName The name the player wishes to use.
     */
    initiateConnection = (code, playerName) => {
        console.log(`[${this.constructor.name}] Initiating connection. Code: ${code}, Player: ${playerName}`);
        if (webRTCManager.status !== ConnectionStatus.DISCONNECTED && webRTCManager.status !== ConnectionStatus.ERROR) {
            console.warn(`[${this.constructor.name}] Cannot initiate connection, WebRTCManager status is ${webRTCManager.status}.`);
            eventBus.emit(Events.System.ShowFeedback, { message: getTextTemplate('gameErrorJoinWhileActive', 'Cannot join, connection already active.'), level: 'error' });
            // Emit specific failure event for UI
            eventBus.emit(Events.Multiplayer.Client.JoinFailed, { reason: 'Connection already active' });
            return;
        }

        // Store the player name for use upon connection
        this._playerName = playerName;

        // Initiate connection via WebRTCManager
        // The manager will listen for ConnectedToHost event
        webRTCManager.connectToHost(code, playerName);
    }

    /**
     * Disconnects from the host and resets the manager state.
     * Called by the MultiplayerClientCoordinator or internally on error/completion.
     */
    disconnect = () => {
        console.log(`[${this.constructor.name}] Disconnecting.`);
        if (webRTCManager.status !== ConnectionStatus.DISCONNECTED) {
            webRTCManager.disconnect(); // Tell WebRTCManager to close connection
        }
        this.resetState(); // Ensure local state is reset
    }

    /**
     * Cleans up listeners when the manager is no longer needed.
     * (May not be strictly necessary if it's a singleton for the app lifetime,
     * but good practice if it could be destroyed/recreated).
     */
    destroy() {
        console.log(`[${this.constructor.name}] Destroying instance.`);
        this._stopListeningForAnswers(); // Ensure listener is removed on destroy
        eventBus.off(Events.WebRTC.MessageReceived, this.handleDataReceived);
        eventBus.off(Events.Multiplayer.Client.ConnectedToHost, this.handleConnectedToHost);
        eventBus.off(Events.Multiplayer.Client.DisconnectedFromHost, this.handleDisconnectedFromHost);
        eventBus.off(Events.Game.Started, this._handleGameStarted);
        eventBus.off(Events.Game.Finished, this._handleGameFinished);
        eventBus.off(Events.UI.JoinLobby.ConfirmClicked, this._handleConfirmJoin);
        this.resetState();
    }

    /**
     * Returns the currently stored player name for this client.
     * @returns {string | null} The player name.
     */
    getPlayerName() {
        return this._playerName;
    }
}

// Export a singleton instance (listeners are registered globally on import)
/**
 * Singleton instance of MultiplayerClientManager.
 * All event listeners are registered globally on import.
 * Do not instantiate directly; import this instance wherever needed.
 */
const multiplayerClientManager = new MultiplayerClientManager();
export default multiplayerClientManager; 