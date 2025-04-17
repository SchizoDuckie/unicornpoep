import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import BaseGameMode from './BaseGameMode.js';
import QuizEngine from '../services/QuizEngine.js';
import { MSG_TYPE } from '../core/message-types.js';
// Removed direct import of WebRTCManager - use events
import miscUtils from '../utils/miscUtils.js';
import Timer from '../core/timer.js';

const COUNTDOWN_DURATION_MS = 5000; // 5 seconds

/**
 * Manages the state and logic for a multiplayer game session from the host's perspective.
 * Extends BaseGameMode.
 * - Initializes game with selected sheets/difficulty.
 * - Receives answers/finish signals from clients.
 * - Manages player scores and readiness.
 * - Determines game end condition.
 * - Broadcasts game state updates (scores, game over) to clients.
 * @typedef {import('../services/WebRTCManager.js').PlayerData} PlayerData
 */
class MultiplayerHostGame extends BaseGameMode {
    /**
     * Creates an instance of MultiplayerHostGame.
     * @param {object} settings - Game settings (e.g., { sheetIds, difficulty }).
     * @param {QuizEngine} quizEngineInstance - An initialized QuizEngine instance with host questions.
     * @param {string} localPlayerName - The name of the host player.
     * @param {string} hostPeerId - The host's own PeerJS ID.
     */
    constructor(settings, quizEngineInstance, localPlayerName, hostPeerId) {
        super('multiplayer-host', settings, quizEngineInstance, localPlayerName);

        console.log(`[MultiplayerHostGame] Initializing. Settings:`, settings);
        this.hostPeerId = hostPeerId;
        this.difficulty = settings.difficulty || 'medium';
        
        // Host-specific state
        this.clientScores = new Map(); // Map<peerId, score|null> - Tracks client scores, null if not yet finished.
        this.clientsFinished = new Set(); // Set<peerId> - Tracks clients who sent CLIENT_FINISHED.
        this.hostFinished = false; // Tracks if the host has "finished" (logic might differ from client). For now, signifies host processed own answers.
        this.isGameOverBroadcast = false; // Prevent multiple GAME_OVER broadcasts.
        this.playersMap = new Map(); // Store the latest player data map here

        // Initialize host score in the map (score will be updated later if host plays)
        // We need a placeholder for the host to check completion correctly.
        this.clientScores.set(this.hostPeerId, null); 
        // Add host to initial player map
        this.playersMap.set(this.hostPeerId, { name: localPlayerName, isHost: true });
        
        this._registerHostListeners();
        console.log("[MultiplayerHostGame] Host Initialized.");
        // Call the renamed initialization method
        this.initializeHostGame();
    }

    /** [Host Only] Registers host-specific listeners for WebRTC messages and player events. @private */
    _registerHostListeners() {
        this._boundHandleWebRTCMessage_Host = this._handleWebRTCMessage_Host.bind(this);
        this._boundHandlePlayerLeft_Host = this._handlePlayerLeft_Host.bind(this);
        // Add listener for PlayerListUpdated
        this._boundHandlePlayerListUpdate = this._handlePlayerListUpdate.bind(this);

        // Listen for messages FROM clients
        eventBus.on(Events.WebRTC.MessageReceived, this._boundHandleWebRTCMessage_Host);
        // Listen for player disconnects
        eventBus.on(Events.Multiplayer.Common.PlayerLeft, this._boundHandlePlayerLeft_Host);
        // Listen for the event that provides the player map
        eventBus.on(Events.Multiplayer.Common.PlayerListUpdated, this._boundHandlePlayerListUpdate);
        console.log(`[MultiplayerHostGame] Registered host listeners.`);
    }

    /**
     * [Host Only] Handles the PlayerListUpdated event.
     * Stores the player map locally and updates score tracking.
     * @param {object} payload
     * @param {Map<string, PlayerData>} payload.players - The full map of players.
     * @private
     */
    _handlePlayerListUpdate({ players }) {
        if (!players) {
             console.warn("[MultiplayerHostGame] Received PlayerListUpdated event without players data.");
             return;
        }
        // Convert object to Map if needed
        const playersMap = players instanceof Map ? players : new Map(Object.entries(players));
        console.log(`[MultiplayerHostGame] Received PlayerListUpdated:`, playersMap); 
        this.playersMap = playersMap; // Store the latest player map
        this._initializeOrUpdatePlayerScoreTracking(); // Update score map based on new player list
    }

    /**
     * [Host Only] Initializes or updates the score map based on the locally stored playersMap.
     * Ensures only currently connected clients (plus host) are tracked.
     * Called internally after receiving PlayerListUpdated.
     * @private
     */
    _initializeOrUpdatePlayerScoreTracking() {
        const currentPeerIds = new Set(this.playersMap.keys());
        // Host should already be in playersMap from constructor if PlayerListUpdated includes host
        if (!currentPeerIds.has(this.hostPeerId)) {
             console.warn("[MultiplayerHostGame] Host peer ID not found in received PlayerListUpdated data.");
             currentPeerIds.add(this.hostPeerId); // Ensure host is tracked anyway
             if (!this.playersMap.has(this.hostPeerId)) { // Add to local map if missing
                 this.playersMap.set(this.hostPeerId, { name: this.localPlayerName || 'Host', isHost: true });
             }
        }

        // Add new players to score tracking
        currentPeerIds.forEach(peerId => {
            if (!this.clientScores.has(peerId)) {
                this.clientScores.set(peerId, null); 
                console.log(`[MultiplayerHostGame] Added player ${peerId} to score tracking.`);
            }
        });

        // Remove disconnected players from score tracking
        const clientIdsToRemove = [];
        this.clientScores.forEach((score, peerId) => {
            if (!currentPeerIds.has(peerId)) {
                clientIdsToRemove.push(peerId);
            }
        });
        clientIdsToRemove.forEach(peerId => {
            this.clientScores.delete(peerId);
            this.clientsFinished.delete(peerId); 
            console.log(`[MultiplayerHostGame] Removed disconnected player ${peerId} from score tracking.`);
        });

        console.log("[MultiplayerHostGame] Score tracking synchronized:", { scores: this.clientScores, finished: this.clientsFinished });
        this._hostCheckCompletion(); 
    }

     /** [Host Only] Handles messages received via WebRTC during the game phase. @private */
     _handleWebRTCMessage_Host({ msg, sender }) {
        if (this.isGameOverBroadcast) return; // Ignore messages after game over is sent

        if (!msg || typeof msg.type !== 'string') {
             console.warn(`[MultiplayerHostGame] Received invalid message structure from ${sender}. Ignoring.`, msg);
             if (msg && msg.type === null && this.clientScores.has(sender)) {
                 console.error(`[MultiplayerHostGame] Received NULL message type from known client ${sender}. Treating as CLIENT_LEFT.`);
                 this._hostHandleClientLeft(sender);
             }
             return;
         }

        const { type, payload } = msg;

        // Only process messages from clients we are tracking
        if (sender !== this.hostPeerId && !this.clientScores.has(sender)) { // Also check it's not the host sending to itself
            console.warn(`[MultiplayerHostGame] Ignoring message type '${type}' from untracked sender ${sender}`);
            return;
        }

        switch (type) {
            case MSG_TYPE.ANSWER_SUBMITTED:
                console.log(`[MultiplayerHostGame] Received answer submission from ${sender}:`, payload);
                break;

            case MSG_TYPE.CLIENT_FINISHED:
                this._hostHandleClientFinished({ sender, payload });
                break;

            case MSG_TYPE.CLIENT_LEFT:
                this._hostHandleClientLeft(sender);
                break;

            case MSG_TYPE.CLIENT_READY:
            case 'client_ready': // Keep fallback if needed based on client sending behavior
                console.log(`[MultiplayerHostGame] Late join: Received CLIENT_READY from ${sender}. Payload:`, payload);
                if (!this.clientScores.has(sender)) {
                    // Add the late joiner to score tracking
                    this.clientScores.set(sender, null);
                    this.playersMap.set(sender, { name: payload.name || sender, isHost: false });
                    console.log(`[MultiplayerHostGame] Added late joiner ${sender} to score tracking.`);
                }
                // Optionally, mark as ready or update player info
                // Send the current game state to the late joiner
                // For now, send the current question and scores (expand as needed)
                this._sendCurrentGameStateToLateJoiner(sender);
                break;

            default:
                console.log(`[MultiplayerHostGame] Ignoring unhandled message type '${type}' from ${sender}`);
        }
    }

    /**
     * [Host Only] Handles a client indicating they have finished the game.
     * @param {object} params
     * @param {string} params.sender - PeerJS ID of the client.
     * @param {object} params.payload - Payload containing the client's final score.
     * @param {number} params.payload.score - The final score.
     * @private
     */
    _hostHandleClientFinished({ sender, payload }) {
        if (this.isGameOverBroadcast || !this.clientScores.has(sender) || this.clientsFinished.has(sender)) {
            console.warn(`[MultiplayerHostGame] Ignoring CLIENT_FINISHED from ${sender}. Game over, unknown client, or already finished.`);
            return;
        }

        if (payload && typeof payload.score === 'number') {
            console.log(`[MultiplayerHostGame] Client ${sender} finished with score: ${payload.score}`);
            this.clientsFinished.add(sender);
            this.clientScores.set(sender, payload.score);
            
            // Broadcast updated scores immediately
            this._broadcastPlayerScores();
            
            // Check if game should end
            this._hostCheckCompletion();
        } else {
            console.warn(`[MultiplayerHostGame] Received invalid CLIENT_FINISHED payload from ${sender}`, payload);
        }
    }

    /**
     * [Host Only] Checks if the game completion conditions are met.
     * Game ends if the host is finished AND all currently tracked clients are finished.
     * @private
     */
    _hostCheckCompletion() {
        if (this.isGameOverBroadcast) return; // Already ended

        // Host must be finished (set hostFinished = true when host completes their part)
        // For now, let's assume host "finishes" instantly or doesn't play
        // TODO: Implement actual host finish condition if host plays
        this.hostFinished = true; 

        if (!this.hostFinished) {
            console.log("[MultiplayerHostGame] Host not finished yet, cannot check completion.");
            return; 
        }

        let allClientsFinished = true;
        let connectedClientCount = 0;
        this.clientScores.forEach((score, peerId) => {
            if (peerId !== this.hostPeerId) { // Exclude host from client check
                connectedClientCount++;
                if (!this.clientsFinished.has(peerId)) {
                    allClientsFinished = false;
                }
            }
        });

        console.log(`[MultiplayerHostGame] Checking completion: HostFinished=${this.hostFinished}, AllClientsFinished=${allClientsFinished}, ConnectedClients=${connectedClientCount}`);

        // Ensure we have scores for all connected clients before declaring game over
        // Check finished size against connected client count
        if (allClientsFinished && this.clientsFinished.size === connectedClientCount && connectedClientCount > 0) { // Ensure at least one client finished
            console.log("[MultiplayerHostGame] All conditions met. Ending game.");
            this.isGameOverBroadcast = true; // Prevent multiple broadcasts
            const finalResults = this._getFinalResults();
            
            // Broadcast GAME_OVER with final results
            eventBus.emit(Events.Multiplayer.Common.SendMessage, { 
                type: MSG_TYPE.GAME_OVER, 
                payload: finalResults 
            });
            
            // Finish the game locally for the host
            this.finishGame();
        } else {
             console.log("[MultiplayerHostGame] Game end conditions not yet met.");
        }
    }

    /**
     * [Host Only] Handles a player disconnecting during the game.
     * @param {object} payload
     * @param {string} payload.peerId - The PeerJS ID of the player who left.
     * @private
     */
    _handlePlayerLeft_Host({ peerId }) {
        console.log(`[MultiplayerHostGame] Player ${peerId} left during game.`);
        this._hostHandleClientLeft(peerId); 
    }

    /** 
     * [Host Only] Common logic for handling a client leaving or disconnecting.
     * Removes the client from score tracking and checks for game completion.
     * @param {string} peerId - The PeerJS ID of the client.
     * @private
     */
    _hostHandleClientLeft(peerId) {
        if (this.isGameOverBroadcast || peerId === this.hostPeerId) return; // Ignore if host or game over

        if (this.clientScores.has(peerId)) {
            console.log(`[MultiplayerHostGame] Removing leaving client ${peerId} from tracking.`);
            this.clientScores.delete(peerId);
            this.clientsFinished.delete(peerId); // Also remove from finished set
            
            // Broadcast updated scores (player removed)
            this._broadcastPlayerScores(); 
            
            // Check if removing this client triggers game completion
            this._hostCheckCompletion();
        } else {
            console.warn(`[MultiplayerHostGame] Received left signal for untracked peer ${peerId}`);
        }
    }

    /**
     * Broadcasts the current player scores to all clients via WebRTC.
     * Players Map is converted to a regular object for transmission.
     * @private
     * @event Events.Multiplayer.Common.SendMessage
     */
    _broadcastPlayerScores() {
        if (this.isGameOverBroadcast) return;

        // Convert Map to a serializable format (e.g., array of objects or plain object)
        const scoresPayload = {};
        this.clientScores.forEach((score, peerId) => {
            // Include player name if available from WebRTCManager? Or send separately?
            // For now, just send scores mapped by peerId.
            scoresPayload[peerId] = score; // Score can be null if not finished
        });

        console.log("[MultiplayerHostGame] Broadcasting scores:", scoresPayload);
        eventBus.emit(Events.Multiplayer.Common.SendMessage, {
            type: MSG_TYPE.H_PLAYER_SCORES_UPDATE,
            payload: scoresPayload
        });
        
        // Also update the host UI (e.g., player list component)
        // This event structure might need refinement
        eventBus.emit(Events.Game.ScoreUpdated, { scores: this.clientScores }); 
    }
    
    /**
     * [Host Only] Cleans up host-specific listeners.
     * @private
     */
     _cleanupHostListeners() {
        eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleWebRTCMessage_Host);
        eventBus.off(Events.Multiplayer.Common.PlayerLeft, this._boundHandlePlayerLeft_Host);
        // Unregister PlayerListUpdated listener
        eventBus.off(Events.Multiplayer.Common.PlayerListUpdated, this._boundHandlePlayerListUpdate);
        console.log("[MultiplayerHostGame] Cleaned up host listeners.");
    }

    // --- Overridden BaseGameMode Methods ---

    /** Starts the multiplayer game (Host). */
    /** 
     * Initializes the host-side game state but does not start gameplay for clients.
     * Sets up score tracking based on the initial player list (host only) and emits Game.Started locally.
     * Client game start is triggered by `startGameForClients`.
     */
    async initializeHostGame() {
        if (this.isStarted) {
            console.warn("[MultiplayerHostGame] initializeHostGame called but game already initialized.");
            return;
        }
        console.log("[MultiplayerHostGame] Initializing host game state...");
        this.isStarted = true; // Mark the host instance as active

        // Initialize with host only, assuming PlayerListUpdated will arrive soon with clients.
        const initialPlayers = new Map();
        initialPlayers.set(this.hostPeerId, { name: this.localPlayerName || 'Host', isHost: true });
        this.playersMap = initialPlayers; // Start with just the host in the map
        
        // Initialize score tracking with just the host
        this.clientScores.clear(); // Ensure clean map
        this.clientsFinished.clear();
        this.clientScores.set(this.hostPeerId, null); // Add host
        this._initializeOrUpdatePlayerScoreTracking(); // Ensure consistency

        // Emit Game Started event *locally* for the host instance
        eventBus.emit(Events.Game.Started, { mode: this.mode, settings: this.settings });
        console.log("[MultiplayerHostGame] Host Game Started event emitted locally.");
        
        // Do not broadcast GAME_START here. Host waits for explicit trigger.
        // Do not broadcast initial scores here yet, wait for PlayerListUpdated from Manager.
    }

    /**
     * [Host Only] Initiates the game start sequence: broadcast GAME_START with countdown duration,
     * start local countdown, and start host game logic after delay.
     * @event Events.Game.CountdownStart
     * @event Events.Multiplayer.Common.SendMessage
     */
    startGameSequence() {
        // Use a constant or configuration for duration
        const countdownDurationSec = 5;
        const startDelayMs = (countdownDurationSec * 1000) + 500; // Add small buffer

        console.log(`[MultiplayerHostGame] Starting game sequence with ${countdownDurationSec}s countdown...`);
        this.isStarting = true; // Flag to prevent multiple starts

        // 1. Emit CountdownStart locally for host UI
        eventBus.emit(Events.Game.CountdownStart, { duration: countdownDurationSec });

        // 2. Broadcast GAME_START with countdown duration payload
        console.log(`[MultiplayerHostGame] Broadcasting GAME_START with duration ${countdownDurationSec}s.`);
        eventBus.emit(Events.Multiplayer.Common.SendMessage, {
            type: MSG_TYPE.GAME_START,
            payload: { countdownDuration: countdownDurationSec }
        });

        // 3. Wait for countdown duration + buffer before starting host logic
        setTimeout(() => {
            if (!this.isStarting) {
                 console.log("[MultiplayerHostGame] Game start aborted during countdown.");
                 return; // Aborted?
            }
            this.isStarting = false;

            console.log("[MultiplayerHostGame] Countdown finished. Starting host game logic.");
            
            this.start(); 

        }, startDelayMs);
    }

    /** Finalizes the game (Host). */
    finishGame() {
        if (this.isFinished) return;
        console.log("[MultiplayerHostGame] Finishing game.");
        this.isFinished = true;
        
        const finalResults = this._getFinalResults();
        console.log("[MultiplayerHostGame] Final Results:", finalResults);
        
        // Ensure GAME_OVER was broadcast (might happen in _hostCheckCompletion)
        if (!this.isGameOverBroadcast) {
             console.warn("[MultiplayerHostGame] finishGame called but GAME_OVER not broadcast yet. Broadcasting now.");
             eventBus.emit(Events.Multiplayer.Common.SendMessage, {
                type: MSG_TYPE.GAME_OVER,
                payload: finalResults
            });
            this.isGameOverBroadcast = true;
        }

        // Emit the Game.Finished event with results
        eventBus.emit(Events.Game.Finished, { mode: this.mode, results: finalResults });
        
        this._cleanupListeners(); // General cleanup from BaseGameMode
        // No need to show end dialog directly - Coordinator handles this
    }

    /** Calculates final results (Host). Uses locally stored playersMap. */
    _getFinalResults() {
        console.log("[MultiplayerHostGame] Calculating final results from scores:", this.clientScores, "using player map:", this.playersMap);
        
        const scoreArray = Array.from(this.clientScores.entries())
            .map(([peerId, score]) => { 
                // Get player name from the locally stored playersMap
                const playerData = this.playersMap.get(peerId); 
                const name = playerData ? playerData.name : `Player_${peerId.substring(0,4)}`; // Use stored name or placeholder
                return { 
                    peerId: peerId, 
                    name: name, 
                    score: score === null ? 0 : score // Treat unfinished players as 0 score
                };
             })
            .sort((a, b) => b.score - a.score); // Sort descending

        return {
            rankings: scoreArray,
            mode: this.mode,
            settings: this.settings
            // Add any other relevant host-side summary data
        };
    }
    
    /** Cleans up listeners (Host). */
    _cleanupListeners() {
        super._cleanupListeners(); // Call base cleanup
        this._cleanupHostListeners(); // Clean up host-specific listeners
    }
    
    /** Host doesn't call nextQuestion in the same way. */
    nextQuestion() {
        // Host logic doesn't cycle through questions locally for gameplay.
        // It might track current question index for context, but doesn't present questions to itself.
        console.log("[MultiplayerHostGame] Host nextQuestion called - No local action taken.");
    }

    /**
     * Sends the current game state to a late joiner so they can catch up.
     * This includes the current question and the latest scores.
     * @param {string} peerId - The PeerJS ID of the late joining client.
     */
    _sendCurrentGameStateToLateJoiner(peerId) {
        // Example: send the current question and scores
        // You may need to expand this to include more state as needed
        if (!this.currentQuestion) {
            console.warn(`[MultiplayerHostGame] No current question to send to late joiner ${peerId}.`);
            return;
        }
        // Send the current question
        eventBus.emit(Events.Multiplayer.Common.SendMessage, {
            type: MSG_TYPE.NEXT_QUESTION,
            payload: this.currentQuestion,
            recipient: peerId
        });
        // Send the current scores
        const scoresPayload = {};
        this.clientScores.forEach((score, id) => {
            scoresPayload[id] = score;
        });
        eventBus.emit(Events.Multiplayer.Common.SendMessage, {
            type: MSG_TYPE.H_PLAYER_SCORES_UPDATE,
            payload: scoresPayload,
            recipient: peerId
        });
        // Optionally, send any other relevant state (e.g., time left, game settings)
        console.log(`[MultiplayerHostGame] Sent current game state to late joiner ${peerId}.`);
    }

    // --- Host starts its actual game logic here ---
    // Needs to be called after the countdown delay in startGameSequence
    start() {
         if (this.isStarted || this.isFinished) {
             console.warn("[MultiplayerHostGame] Start called but game already started or finished.");
             return;
         }
         console.log("[MultiplayerHostGame] Host logic started.");
         this.isStarted = true;
         // Emit Game Started locally
         eventBus.emit(Events.Game.Started, { mode: this.mode, settings: this.settings });
    }

    // Implement other necessary BaseGameMode methods or overrides if needed...
    // e.g., _calculateScore might not be used if host doesn't answer questions.
}

export default MultiplayerHostGame; 