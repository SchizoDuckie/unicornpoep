import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import BaseGameMode from './BaseGameMode.js';
import QuizEngine from '../services/QuizEngine.js';
import { MSG_TYPE } from '../core/message-types.js';
// Removed direct import of WebRTCManager - use events
import miscUtils from '../utils/miscUtils.js';
import Timer from '../core/timer.js';
import Views from '../core/view-constants.js';

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
        this.hostFinished = false; // Tracks if the host has "finished" answering questions
        this.clientAnswersThisRound = new Map(); // Track client answers for current question
        this.isGameOverBroadcast = false; // Prevent multiple GAME_OVER broadcasts.
        this.playersMap = new Map(); // Store the latest player data map here

        // *** ADD TIMER INITIALIZATION FOR HOST GAMEPLAY ***
        const hostDurationMs = BaseGameMode.DIFFICULTY_DURATIONS_MS[this.difficulty] || BaseGameMode.DIFFICULTY_DURATIONS_MS.medium;
        this.timer = new Timer(hostDurationMs / 1000);

        // Initialize host score in the map (score will be updated later if host plays)
        // We need a placeholder for the host to check completion correctly.
        this.clientScores.set(this.hostPeerId, null); 
        // Add host to initial player map
        this.playersMap.set(this.hostPeerId, { name: localPlayerName, isHost: true });
        
        this._registerHostListeners();
        // *** REGISTER TIMER LISTENERS ***
        this._registerTimerListeners(); 

        console.log("[MultiplayerHostGame] Host Initialized.");
        // Call the renamed initialization method
        this.initializeHostGame();

        // Add a listener for Game.ScoreUpdated in the host to update clientScores
        eventBus.on(Events.Game.ScoreUpdated, (data) => {
            if (data.playerName === this.localPlayerName) {
                this.clientScores.set(this.hostPeerId, data.newScore);
                this._broadcastPlayerScores();
            }
        });
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
                // console.log(`[MultiplayerHostGame] Received answer submission from ${sender}:`, payload);
                // Host might need to process this if it tracks individual answers, 
                // but currently relies on CLIENT_FINISHED with final score.
                // ** Implementing inline answer verification and scoring **
                if (this.isGameOverBroadcast || !this.clientScores.has(sender)) {
                    console.warn(`[MultiplayerHostGame] Ignoring ANSWER_SUBMITTED from ${sender}. Game over or unknown client.`);
                    // return; // Allow fallthrough or break depending on desired behavior
                } else if (!payload || typeof payload.questionIndex !== 'number' || typeof payload.answer === 'undefined') {
                    console.warn(`[MultiplayerHostGame] Received invalid ANSWER_SUBMITTED payload from ${sender}`, payload);
                    // return;
                } else {
                    const { answer, questionIndex } = payload;

                    // Check if answer is for the current question
                    if (questionIndex !== this.currentQuestionIndex) {
                        console.log(`[MultiplayerHostGame] Ignoring ANSWER_SUBMITTED from ${sender} for Q${questionIndex + 1}. Host is on Q${this.currentQuestionIndex + 1}.`);
                    // Check if client already answered this question
                    } else if (this.clientAnswersThisRound.has(sender)) {
                        console.log(`[MultiplayerHostGame] Ignoring duplicate ANSWER_SUBMITTED from ${sender} for Q${questionIndex + 1}.`);
                    } else {
                        // Mark as answered for this round immediately
                        this.clientAnswersThisRound.set(sender, true);

                        // Verify the answer
                        const isCorrect = this.quizEngine.checkAnswer(questionIndex, answer);
                        const scoreDelta = isCorrect ? POINTS_PER_CORRECT_ANSWER : 0;
                        const currentScore = this.clientScores.get(sender) || 0;
                        const newScore = currentScore + scoreDelta;

                        console.log(`[MultiplayerHostGame] Client ${sender} answered Q${questionIndex + 1}: ${answer}. Correct: ${isCorrect}. Score: ${currentScore} -> ${newScore}`);

                        // Update the host's score map
                        this.clientScores.set(sender, newScore);

                        // Emit event locally for potential host logic (e.g., check if all players answered)
                        eventBus.emit(Events.Multiplayer.Host.PlayerAnswered, { 
                            sender: sender, 
                            questionIndex: questionIndex, 
                            isCorrect: isCorrect, 
                            scoreDelta: scoreDelta, 
                            newScore: newScore 
                        });

                        // Broadcast updated scores to all clients
                        this._broadcastPlayerScores();

                        // TODO: Optionally, check here if all connected clients have answered this question.
                    }
                }
                // ** REMOVED break; - Logic is now inline **
                break; // Keep break to avoid fallthrough

            case MSG_TYPE.CLIENT_FINISHED:
                console.log(`[MultiplayerHostGame] Received CLIENT_FINISHED from ${sender}. Payload:`, payload);
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

            // Restore the correct case for C_SCORE_UPDATE
            case MSG_TYPE.C_SCORE_UPDATE:
                this._hostHandleClientScoreUpdate({ sender, payload });
                break;

            default:
                // Log unhandled message types during game phase for debugging
                if (sender !== this.hostPeerId) { // Avoid logging host's own potential loopback messages
                    console.log(`[MultiplayerHostGame] Ignoring unhandled message type '${type}' from ${sender}`);
                }
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

        // Instead of automatically setting hostFinished to true, check if host actually finished all questions
        // hostFinished should be set when host completes all questions, not here
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
            
            // Make sure all scores are updated one final time before ending
            this.clientScores.set(this.hostPeerId, this.score);
            this._broadcastPlayerScores();
            
            // Mark as game over to prevent further score broadcasts
            this.isGameOverBroadcast = true; // Prevent multiple broadcasts
            
            // Get final results with updated scores
            const finalResults = this._getFinalResults();
            
            // Broadcast H_COMMAND_GAME_OVER with final results
            eventBus.emit(Events.Multiplayer.Common.SendMessage, { 
                type: MSG_TYPE.H_COMMAND_GAME_OVER,
                payload: finalResults 
            });
            
            // Finish the game locally for the host
            this.finishGame(finalResults);
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
        if (this.isGameOverBroadcast || this.isFinished) {
            console.log("[MultiplayerHostGame] Game is over, skipping score broadcast");
            return;
        }

        // Prevent consecutive broadcasts within a short time window
        const now = Date.now();
        if (this._lastBroadcastTime && (now - this._lastBroadcastTime < 100)) { // 100ms throttle
            console.log("[MultiplayerHostGame] Throttling score broadcast - too frequent");
            return;
        }
        this._lastBroadcastTime = now;

        // Create a standardized payload that includes score and player information
        const scoresPayload = {};
        this.clientScores.forEach((score, peerId) => {
            // Get player name if available
            const playerData = this.playersMap.get(peerId);
            const playerName = playerData ? playerData.name : `Player_${peerId.substring(0,4)}`;
            
            scoresPayload[peerId] = {
                score: score === null ? 0 : score, // Convert null to 0 for display
                name: playerName,
                isHost: peerId === this.hostPeerId
            };
        });

        console.log("[MultiplayerHostGame] Broadcasting scores:", scoresPayload);
        
        // DEBUG: Log all connections before broadcast
        console.log(`[MultiplayerHostGame] Active connections before broadcast:`, 
            Array.from(this.connections?.keys() || []).join(', '));
        
        eventBus.emit(Events.Multiplayer.Common.SendMessage, {
            type: MSG_TYPE.H_PLAYER_SCORES_UPDATE,
            payload: scoresPayload // Send object with player data and scores
        });
        
        // Also emit local event for host UI updates
        eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: scoresPayload });
        
        console.log("[MultiplayerHostGame] Score broadcast completed");
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

        console.log("[MultiplayerHostGame] Host Game Initialized (state set, no Game.Started event yet).");
        
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
    finishGame(finalResults) {
        if (this.isFinished) return;
        console.log("[MultiplayerHostGame] Finishing game.");
        
        console.log("[MultiplayerHostGame] Final Results:", finalResults);
        
        // Ensure GAME_OVER was broadcast (might happen in _hostCheckCompletion)
        if (!this.isGameOverBroadcast) {
             console.warn("[MultiplayerHostGame] finishGame called but GAME_OVER not broadcast yet. Broadcasting now.");
             eventBus.emit(Events.Multiplayer.Common.SendMessage, {
                type: MSG_TYPE.GAME_OVER,
                payload: finalResults
            });
             this.isGameOverBroadcast = true; // Mark as broadcast
        }

        // Call super.finishGame FIRST to ensure base class logic (including event emission) runs
        super.finishGame(finalResults); 

        // Now mark as finished and cleanup host-specific things
        this.isFinished = true; 
        this.timer.stop(); 
        this._cleanupListeners(); // Cleanup host listeners AFTER base finish
    }

    /** Calculates final results (Host). Relies on internally synchronized player data. */
    _getFinalResults() {
        // --- REWRITTEN to use internal state ONLY --- 
        console.log(`[MultiplayerHostGame] Calculating final results... Host score: ${this.score}, Client Scores:`, this.clientScores, "Player Map:", this.playersMap);
        
        const finalScores = new Map();

        // Build map using internal clientScores and playersMap
        this.clientScores.forEach((score, peerId) => {
            const playerData = this.playersMap.get(peerId);
            const name = playerData ? playerData.name : `Player_${peerId.substring(0,4)}`; // Use name from internal map
            const finalScore = (peerId === this.hostPeerId) ? this.score : (score ?? 0); // Use host's final score or client score
            finalScores.set(peerId, { name: name, score: finalScore });
        });

        // Ensure host is included if somehow missing from clientScores keys (shouldn't happen)
        if (!finalScores.has(this.hostPeerId)) {
             console.warn("[MultiplayerHostGame] Host missing from clientScores map during final results, adding manually.");
             const hostName = this.playersMap.get(this.hostPeerId)?.name || this.localPlayerName || 'Host';
             finalScores.set(this.hostPeerId, { name: hostName, score: this.score });
        }
        
        // Basic ranking (sort by score descending)
        const rankedPlayers = Array.from(finalScores.entries())
            .sort(([, a], [, b]) => b.score - a.score)
            .map(([peerId, data], index) => ({ 
                rank: index + 1, 
                peerId: peerId, 
                name: data.name, 
                score: data.score 
            }));
        
        // Determine winner (handle ties - winner is null if highest scores are equal)
        let winner = null;
        if (rankedPlayers.length > 0) {
            const topScore = rankedPlayers[0].score;
            // Ensure score is a number before comparison
            if (typeof topScore === 'number') {
                const winners = rankedPlayers.filter(p => p.score === topScore);
                if (winners.length === 1) {
                    winner = winners[0]; // Assign if single winner
                }
            } else {
                 console.warn("[MultiplayerHostGame] Top score was not a number, cannot determine winner.", {topScore});
            }
        }
        
        // Get game name from settings (likely sheet IDs)
        const gameName = Array.isArray(this.settings?.sheetIds) 
                           ? this.settings.sheetIds.join(', ') 
                           : 'Unknown Game';

        const finalResultsObject = {
            winner: winner, // Can be null for ties
            players: rankedPlayers, // Array of { rank, peerId, name, score }
            mode: 'multiplayer-host',
            difficulty: this.settings?.difficulty || 'unknown',
            gameName: gameName,
            timestamp: Date.now(),
            winnerId: winner ? winner.peerId : null // ID of winner or null
        };
        
        console.log("[MultiplayerHostGame] Final results calculated using internal state:", finalResultsObject);
        return finalResultsObject;
        // --- END REWRITE (Internal State) --- 
    }
    
    /** Cleans up listeners (Host). */
    _cleanupListeners() {
        super._cleanupListeners(); // Call base cleanup
        this._cleanupHostListeners(); // Clean up host-specific listeners
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
         if (this.isFinished) { 
             console.warn("[MultiplayerHostGame] Start called but game already finished.");
             return;
         }
         console.log("[MultiplayerHostGame] Host logic started (post-countdown).");
         
         // *** MODIFIED: Add timer instance to payload ***
         eventBus.emit(Events.Game.Started, {
             mode: this.mode,
             settings: this.settings,
             timer: this.timer // Include the timer instance
         });
         console.log("[MultiplayerHostGame] Game Started event emitted (post-countdown).");

         // *** START TIMER FOR HOST ***
         if (this.timer) {
            this.timer.start();
         } else {
            console.error("[MultiplayerHostGame] Cannot start timer in start() - timer not initialized!");
         }

         // *** CALL OUR OVERRIDDEN nextQuestion method instead of the base one ***
         this.nextQuestion(); 
    }

    // Implement other necessary BaseGameMode methods or overrides if needed...
    // e.g., _calculateScore might not be used if host doesn't answer questions.

    // Ensure no overrides for _beforeNextQuestion, _afterQuestionPresented, _beforeFinish ...

    // *** ADD TIMER LISTENER REGISTRATION METHOD ***
    /** [Host Only] Registers timer-specific event listeners. @private */
    _registerTimerListeners() {
        if (!this.timer) return;
        this._boundHandleTimerTick = this._handleTimerTick.bind(this);
        this._boundHandleTimeUp = this._handleTimeUp.bind(this);
        this.timer.on('tick', this._boundHandleTimerTick);
        this.timer.on('end', this._boundHandleTimeUp);
        console.log(`[MultiplayerHostGame] Registered timer listeners.`);
    }

    // *** ADD TIMER EVENT HANDLERS ***
    /** [Host Only] Handles timer ticks, emitting the TimeTick event. @private */
    _handleTimerTick(remainingTimeMs) {
        if (this.isFinished) return;
        eventBus.emit(Events.Game.TimeTick, { remainingTimeMs: remainingTimeMs });
    }

    /**
     * [Host Only] Handles the timer running out. 
     * @private
     */
    _handleTimeUp() {
        if (this.isFinished || this.lastAnswerCorrect !== null) return; 
        const currentIndex = this.currentQuestionIndex;
        console.log(`[MultiplayerHostGame] Time's up for question ${currentIndex + 1}`);
        eventBus.emit(Events.Game.TimeUp);
        const correctAnswer = this.quizEngine.getCorrectAnswer(currentIndex);
        const scoreDelta = this._calculateScore(false); 
        this.lastAnswerCorrect = false; 
        eventBus.emit(Events.Game.AnswerChecked, {
            isCorrect: false, scoreDelta: scoreDelta,
            correctAnswer: correctAnswer, submittedAnswer: null 
        });
        this._afterAnswerChecked(false, scoreDelta); // Update host score
        
        // After host answer is checked, continue with the next question
        // If this is the last question, it will trigger hostFinished = true in our overridden nextQuestion
        setTimeout(() => { 
            if (!this.isFinished) { 
                this.nextQuestion(); 
            } 
        }, 1500); 
    }

    /**
     * Handles the C_SCORE_UPDATE message from a client.
     * Updates the score for the specific client and broadcasts the updated scores.
     * @param {object} params - Parameters object.
     * @param {string} params.sender - The peer ID of the client sending the update.
     * @param {any} params.payload - The message payload (expected to be the client's current score).
     * @private
     */
    _hostHandleClientScoreUpdate({ sender, payload }) {
        if (this.clientScores.has(sender)) {
            // Extract score from payload, which could be directly a number or an object with a score property
            let score;
            if (typeof payload === 'number') {
                score = payload;
            } else if (payload && typeof payload === 'object' && 'score' in payload) {
                score = payload.score;
            } else {
                score = parseInt(payload, 10);
            }

            if (!isNaN(score)) {
                console.log(`[MultiplayerHostGame] Received score update from ${sender}: ${score}`);
                this.clientScores.set(sender, score);
                // Broadcast the updated scores to all clients immediately
                this._broadcastPlayerScores();
            } else {
                console.warn(`[MultiplayerHostGame] Received invalid score payload from ${sender}:`, payload);
            }
        } else {
            console.warn(`[MultiplayerHostGame] Received score update from unknown sender: ${sender}`);
        }
    }

    /**
     * Updates scores and checks game status after an answer is processed.
     * @param {boolean} isCorrect - Whether the answer was correct.
     * @param {number} scoreDelta - The amount to adjust the score by.
     */
    _afterAnswerChecked(isCorrect, scoreDelta) {
        super._afterAnswerChecked(isCorrect, scoreDelta); 
        
        // Prevent updates after the game is over
        if (this.isGameOverBroadcast || this.isFinished) {
            console.log("[MultiplayerHostGame] Game is over, skipping _afterAnswerChecked updates");
            return;
        }
        
        // Update host's own score in clientScores map
        if (this.hostPeerId) {
            // Ensure the host's score is in the clientScores map
            this.clientScores.set(this.hostPeerId, this.score);
            console.log(`[MultiplayerHostGame] Updated host's own score: ${this.score}`);
            
            // Broadcast updated scores to all clients immediately
            // Remove the setTimeout to prevent timing issues
            if (!this.isGameOverBroadcast && !this.isFinished) {
                this._broadcastPlayerScores();
            }
        } else {
            console.warn("[MultiplayerHostGame] Cannot update host score in clientScores: hostPeerId not set");
        }
    }

    /**
     * Overrides the nextQuestion method from BaseGameMode to check for host game completion.
     * If the host has no more questions, it sets hostFinished but doesn't end the game yet.
     */
    nextQuestion() {
        if (this.isFinished) return;

        this._beforeNextQuestion(); // Hook for subclasses
        this.lastAnswerCorrect = null;
        const nextIndex = this.currentQuestionIndex + 1;

        // Get total questions from the quiz engine
        const totalQuestions = this.quizEngine.getQuestionCount();

        if (nextIndex >= totalQuestions) {
            console.log(`[${this.mode}] Host reached end of questions (Index: ${nextIndex}, Total: ${totalQuestions}).`);
            
            // Instead of immediately ending the game, mark host as finished
            // and check if all clients are finished as well
            this.hostFinished = true;
            this.clientScores.set(this.hostPeerId, this.score);
            
            // Update scores and broadcast to clients
            this._broadcastPlayerScores();
            
            // --- MODIFIED: Don't check completion yet, just signal host is waiting ---
            console.log(`[${this.mode}] Host finished. Emitting HostWaiting event.`);
            eventBus.emit(Events.Multiplayer.Host.HostWaiting, { 
                // Optional payload: could include list of clients still playing
                waitingFor: Array.from(this.clientScores.keys()).filter(id => 
                    id !== this.hostPeerId && !this.clientsFinished.has(id)
                )
            });
            // REMOVED: this._hostCheckCompletion(); 
            // Completion check will now only happen when a client finishes or leaves.
            // --- END MODIFICATION ---
        } else {
            // Continue with normal question flow
            try {
                const questionData = this.quizEngine.getQuestionData(nextIndex);
                if (!questionData) {
                     console.error(`[${this.mode}] Could not retrieve question data for index ${nextIndex}. Marking host as finished.`);
                     this.hostFinished = true;
                     this._hostCheckCompletion();
                     return;
                }

                this.currentQuestionIndex = nextIndex;
                this.currentQuestion = questionData;

                console.log(`[${this.mode}] Presenting question ${this.currentQuestionIndex + 1}/${totalQuestions}`);

                const answers = this.quizEngine.getShuffledAnswers(this.currentQuestionIndex);

                eventBus.emit(Events.Game.QuestionNew, {
                    questionIndex: this.currentQuestionIndex,
                    totalQuestions: totalQuestions,
                    questionData: {
                        question: questionData.question,
                        answers: answers
                    }
                });
                this._afterQuestionPresented();
            } catch (error) {
                console.error(`[${this.mode}] Error during QuizEngine interaction in nextQuestion (Index: ${nextIndex}):`, error);
                this.hostFinished = true; // Mark host as finished on error
                this._hostCheckCompletion(); // Check if we should end the game
            }
        }
    }
}

export default MultiplayerHostGame; 