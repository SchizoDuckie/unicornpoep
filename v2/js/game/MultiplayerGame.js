import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import BaseGameMode from './BaseGameMode.js';
import QuizEngine from '../services/QuizEngine.js'; // Import the class
import Timer from '../core/timer.js';
import miscUtils from '../utils/miscUtils.js';
import { MSG_TYPE } from '../core/message-types.js';

// ADD: Define constant locally
const DIFFICULTY_DURATIONS_MS = {
    easy: 60000,
    medium: 30000,
    hard: 10000, // Match SinglePlayerGame definition
};

/**
 * Manages the state and logic for a multiplayer game session.
 * Extends BaseGameMode and handles host/client differences.
 */
class MultiplayerGame extends BaseGameMode {
    /**
     * Creates an instance of MultiplayerGame.
     * @param {boolean} isHost - True if this instance is the host, false for client.
     * @param {string} localPlayerName - The name of the local player.
     * @param {object} gameData - Game data (Host: { sheetIds }, Client: { questionsData, difficulty }).
     * @param {string} difficulty - The game difficulty.
     * @param {string} peerId - The ID of the peer (Host ID for client, own ID for host).
     * @param {object} webRTCManagerInstance - Instance of WebRTCManager.
     */
    constructor(isHost, localPlayerName, gameData, difficulty, peerId, webRTCManagerInstance) {
        let quizEngineInstance;
        let settings;
        let modeIdentifier;

        if (isHost) {
            // --- Host Initialization ---
            modeIdentifier = 'multiplayer-host';
            settings = { sheetIds: gameData.sheetIds, difficulty: difficulty }; // Host uses sheetIds
            quizEngineInstance = QuizEngine.getInstance(); 
            
            super(modeIdentifier, settings, quizEngineInstance, localPlayerName);
            
            console.log(`[MultiplayerGame Host] Initializing. Settings:`, settings);
            this.isHost = true;
            this.settings = settings;
            this.webRTCManager = webRTCManagerInstance;
            this.difficulty = difficulty || 'normal';
            this.hostPeerId = peerId;
            this.clientsFinished = new Set(); // Tracks clients who sent FINISHED
            this.clientScores = new Map(); // Stores final scores from clients
            this.finishedClients = new Set(); // Host: Tracks peerIds of clients who sent CLIENT_FINISHED
            this.hostFinished = false; // +++ Host: Track if host local game is done +++
            this.isGameOverBroadcast = false; // +++ Host: Prevent multiple GAME_OVER broadcasts +++

            // +++ Initialize Timer for Host (needed for scoring _calculateScore) +++
            const hostDurationMs = DIFFICULTY_DURATIONS_MS[this.difficulty] || DIFFICULTY_DURATIONS_MS.medium;
            this.timer = new Timer(hostDurationMs);
            // Host doesn't need gameplay timer listeners, only the object for score calc.
            // --- End Host Timer Init ---
        
            // Initialize host score tracking IN THE MAP (used by _getFinalResults)
            // this.clientScores.set(this.hostPeerId, 0); // Start host score at 0 in map
            console.log("[MultiplayerGame Host] Initialized host player state.");
            
            this._registerHostListeners();
            
        } else {
            // --- Client Initialization ---
            modeIdentifier = 'multiplayer-client';
            settings = { difficulty: difficulty }; 
            
            if (!gameData || !gameData.questionsData) {
                throw new Error("[MultiplayerGame Client] Missing required host game data for engine creation.");
            }
            const hostGameData = { questionsData: gameData.questionsData, difficulty: difficulty };
            try {
                 quizEngineInstance = QuizEngine.createInstance(hostGameData);
            } catch (error) {   
                 console.error("[MultiplayerGame Client] Failed to create QuizEngine instance:", error);
                 throw new Error(`Failed to initialize client game engine: ${error.message}`); 
            }

            super(modeIdentifier, settings, quizEngineInstance, localPlayerName);
            
            console.log(`[MultiplayerGame Client] Initializing with received data.`);
            this.isHost = false;
            this.settings = settings;
            this.webRTCManager = webRTCManagerInstance;
            this.difficulty = difficulty || 'normal';
            this.hostPeerId = peerId;
            
            // Client needs a timer for gameplay flow
            const clientDurationMs = DIFFICULTY_DURATIONS_MS[this.difficulty] || DIFFICULTY_DURATIONS_MS.medium;
            this.timer = new Timer(clientDurationMs);
            this._registerTimerListeners(); // Client registers listeners
        }
    }

    // --- Timer methods copied from SinglePlayerGame for Client ---
    /** [Client Only] Registers timer-specific event listeners. @private */
    _registerTimerListeners() {
        if (this.isHost || !this.timer) return;
        this._boundHandleTimerTick = this._handleTimerTick.bind(this);
        this._boundHandleTimeUp = this._handleTimeUp.bind(this);
        this.timer.on('tick', this._boundHandleTimerTick);
        this.timer.on('end', this._boundHandleTimeUp);
        console.log(`[MultiplayerGame Client] Registered timer listeners.`);
    }
    /** [Client Only] Handles timer ticks, emitting the TimeTick event. @private */
    _handleTimerTick(remainingTime) {
        if (this.isHost || this.isFinished) return;
        eventBus.emit(Events.Game.TimeTick, { remainingTimeMs: remainingTime });
    }
    /** [Client Only] Handles the timer running out. @private */
    _handleTimeUp() {
        if (this.isHost || this.isFinished || this.lastAnswerCorrect !== null) return; // Ignore if game over or question answered
        
        const currentIndex = this.currentQuestionIndex;
        console.log(`[MultiplayerGame Client] Time's up for question ${currentIndex + 1}`);
        eventBus.emit(Events.Game.TimeUp);
        
        // Treat time up as incorrect - Use the injected QuizEngine instance
        const correctAnswer = this.quizEngine.getCorrectAnswer(currentIndex); // Use instance
        const checkResult = { isCorrect: false, correctAnswer: correctAnswer }; 
        const scoreDelta = this._calculateScore(false); // Uses inherited method

        // Set lastAnswerCorrect to prevent race condition with submit
        this.lastAnswerCorrect = false; 

        eventBus.emit(Events.Game.AnswerChecked, {
            isCorrect: false,
            scoreDelta: scoreDelta,
            correctAnswer: checkResult.correctAnswer,
            submittedAnswer: null // Indicate no answer was submitted
        });
        this._afterAnswerChecked(false, scoreDelta); // Update score via hook
        
        // Delay moving to the next question
        setTimeout(() => { if (!this.isFinished) { this.nextQuestion(); } }, 1500);
    }
    // --- End Timer Methods ---

    // --- REMOVED Client Helper Methods (_getClient* / _checkClientAnswer) ---
    // --- REMOVED Overrides for getCorrectAnswer, getShuffledAnswers ---

    // --- Host Specific Methods ---
    /** [Host Only] Registers host-specific listeners. @private */
    _registerHostListeners() {
        if (!this.isHost) return;
        this._boundHandleWebRTCMessage_Host = this._handleWebRTCMessage_Host.bind(this);
        this._boundHandlePlayerLeft_Host = this._handlePlayerLeft_Host.bind(this);
        this._boundHandlePlayerJoined_Host = this._handlePlayerJoined_Host.bind(this);
        this._boundHandlePlayerListUpdate_Host = this._handlePlayerListUpdate_Host.bind(this);

        eventBus.on(Events.WebRTC.MessageReceived, this._boundHandleWebRTCMessage_Host);
        eventBus.on(Events.Multiplayer.Common.PlayerLeft, this._boundHandlePlayerLeft_Host);
        eventBus.on(Events.Multiplayer.Common.PlayerJoined, this._boundHandlePlayerJoined_Host);
        eventBus.on(Events.Multiplayer.Common.PlayerListUpdated, this._boundHandlePlayerListUpdate_Host);
        console.log(`[MultiplayerGame Host] Registered host listeners.`);
    }
    /** [Host Only] Handles player list updates from WebRTCManager. @private */
    _handlePlayerListUpdate_Host({ players }) {
        if (!this.isHost) return;
        console.log(`[MultiplayerGame Host] Received PlayerListUpdated event. Updating internal state.`);
        this._initializePlayerState(players); // Use the existing state initializer
    }
    /** [Host Only] Initializes score map based on current player list. @private */
    _initializePlayerState(players) {
        if (!this.isHost) return;
        this.clientScores.clear();
        this.clientsFinished.clear();
        players.forEach((playerData, peerId) => {
            if (peerId !== this.hostPeerId) { 
                this.clientScores.set(peerId, null);
            }
        });
        console.log("[MultiplayerGame Host] Initial client state:", { scores: this.clientScores });
    }
     /** [Host Only] Handles messages received via WebRTC during the game phase. @private */
     _handleWebRTCMessage_Host({ msg, sender }) {
        if (!this.isHost || this.isGameOverBroadcast) return; // Only host processes during active game

        const { type, payload } = msg;
        // +++ DEBUG: Log received message type +++
        console.log(`[MultiplayerGame Host DEBUG] Received message. Type: '${type}' (typeof: ${typeof type}), Payload:`, payload, "Expected CLIENT_FINISHED:", MSG_TYPE.CLIENT_FINISHED);
        // --- END DEBUG ---
        
        // +++ MORE DEBUGGING: Check MSG_TYPE object just before switch +++
        console.log("[MultiplayerGame Host DEBUG] MSG_TYPE object before switch:", MSG_TYPE);
        console.log("[MultiplayerGame Host DEBUG] MSG_TYPE.CLIENT_FINISHED before switch:", MSG_TYPE?.CLIENT_FINISHED);
        // --- END MORE DEBUGGING ---

        switch (type) {
            case MSG_TYPE.ANSWER_SUBMITTED:
                // Handle client submitting an answer
                console.log(`[MultiplayerGame Host] Received answer from ${sender}:`, payload);
                // TODO: Store client answer/time? For now, we wait for CLIENT_FINISHED
                break;

            case MSG_TYPE.CLIENT_FINISHED:
                // +++ DEBUG: Confirm this case is matched +++
                console.log(`[MultiplayerGame Host DEBUG] Matched case for CLIENT_FINISHED. Type: '${type}', Expected: '${MSG_TYPE.CLIENT_FINISHED}'`);
                // --- END DEBUG ---
                // Handle client finishing their local quiz
                this._hostHandleClientFinished({ sender, payload });
                break;

            // Ignore other message types during active game phase for now
            default:
                // +++ DEBUG: Log why default is hit +++
                console.log(`[MultiplayerGame Host DEBUG] Hit DEFAULT case. Type: '${type}', Expected CLIENT_FINISHED: '${MSG_TYPE.CLIENT_FINISHED}'`);
                // --- END DEBUG ---
                console.log(`[MultiplayerGame Host] Ignoring non-game message type '${type}' from ${sender}`);
        }
    }
    /** [Host Only] Handles a client signaling they have finished. @private */
    _hostHandleClientFinished({ sender, payload }) {
        const hasSender = this.clientScores?.has(sender); // Use optional chaining for safety
        const isDuplicate = this.clientsFinished.has(sender);

        if (!this.isHost || !hasSender || isDuplicate) {
            // Log which condition failed
            console.warn(`[MultiplayerGame Host] Received CLIENT_FINISHED from ${sender}, but ignoring.`);
            if (!this.isHost) console.warn("  Reason: Instance is not host.");
            if (!hasSender) console.warn(`  Reason: Sender ${sender} not found in clientScores map. Current keys: ${this.clientScores ? Array.from(this.clientScores.keys()).join(', ') : 'undefined'}`);
            if (isDuplicate) console.warn(`  Reason: Sender ${sender} already in clientsFinished set.`);
            return;
        }
        const score = payload?.score ?? 0; // Default score to 0 if missing
        console.log(`[MultiplayerGame Host] Client ${sender} finished with score: ${score}`);
        this.clientScores.set(sender, score);
        this.clientsFinished.add(sender);
        this._hostCheckCompletion(); // Check if all clients are done
    }
    /** [Host Only] Checks if all connected clients AND the host have finished. */
    _hostCheckCompletion() {
        if (!this.isHost || this.isGameOverBroadcast) return; // Exit if not host or already sent GAME_OVER

        // Host marks itself as finished when its local finishGame is called
        if (this.isFinished && !this.hostFinished) {
            console.log("[MultiplayerGame Host Check] Host has marked itself as finished.");
            this.hostFinished = true;
        }

        // Get currently connected clients (excluding host)
        const connectedClients = this.webRTCManager.getConnectedPeerIds().filter(id => id !== this.hostPeerId);
        // Check if ALL currently connected clients have sent CLIENT_FINISHED
        const allClientsFinished = connectedClients.length > 0 && connectedClients.every(peerId => this.clientsFinished.has(peerId));

        console.log("[MultiplayerGame Host] Check Completion: Host Finished?", this.hostFinished);
        console.log("[MultiplayerGame Host] Check Completion: Finished Clients Set", this.clientsFinished);
        console.log("[MultiplayerGame Host] Check Completion: Connected Clients", connectedClients);

        // --- Trigger Game Over --- 
        if (this.hostFinished && allClientsFinished) {
            console.log("[MultiplayerGame Host] Host and all connected clients have finished! Calculating and broadcasting GAME_OVER.");
            
            this.isGameOverBroadcast = true; // Set flag to prevent re-entry

            // Calculate final results (NOW is the time)
            const finalResults = this._getFinalResults(); 
            console.log(`[MultiplayerGame Host] Final Host Results:`, finalResults);
            
            // Broadcast GAME_OVER *with* the results payload
            this.webRTCManager.broadcastMessage(MSG_TYPE.GAME_OVER, finalResults);
            
            // Now emit the local Game.Finished event for the host coordinator
            eventBus.emit(Events.Game.Finished, { mode: 'multiplayer-host', results: finalResults });

            // Host cleanup can happen via GameCoordinator reacting to Game.Finished
            // this._cleanupListeners(); 
        } else {
            console.log("[MultiplayerGame Host] Check Completion: Waiting for host or more clients to finish.");
        }
    }
    /** [Host Only] Handles a player joining mid-game (not fully supported). @private */
    _handlePlayerJoined_Host({ peerId, playerData }) {
        if (!this.isHost || this.isGameOver) return;
        console.log(`[MultiplayerGame Host] Player ${playerData.name} (${peerId}) joined mid-game. Adding to score tracking.`);
        if (peerId !== this.hostPeerId) {
            this.clientScores.set(peerId, null); // Add to score tracking, score TBD
            // Should the host send current game state? Complex.
            // For now, they just get tracked for the end.
        }
    }
    /** [Host Only] Handles a player leaving mid-game. @private */
    _handlePlayerLeft_Host({ peerId }) {
         if (!this.isHost || this.isGameOver) return;
         console.log(`[MultiplayerGame Host] Player ${peerId} left mid-game.`);
         if (this.clientScores.has(peerId)) {
            // Mark as finished to potentially trigger game end if they were last
            if (!this.clientsFinished.has(peerId)) {
                console.log(`[MultiplayerGame Host] Marking leaving player ${peerId} as finished.`);
                this.clientsFinished.add(peerId);
                 // Score remains whatever it was (null if never finished)
            }
             this._hostCheckCompletion();
         } else {
            console.warn(`[MultiplayerGame Host] Left player ${peerId} was not in score map.`);
         }
    }
     /** [Host Only] Cleans up host-specific listeners. @private */
     _cleanupHostListeners() {
        if (!this.isHost) return;
        if (this._boundHandleWebRTCMessage_Host) {
            eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleWebRTCMessage_Host);
            this._boundHandleWebRTCMessage_Host = null;
        }
        if (this._boundHandlePlayerLeft_Host) {
            eventBus.off(Events.Multiplayer.Common.PlayerLeft, this._boundHandlePlayerLeft_Host);
            this._boundHandlePlayerLeft_Host = null;
        }
         if (this._boundHandlePlayerJoined_Host) {
            eventBus.off(Events.Multiplayer.Common.PlayerJoined, this._boundHandlePlayerJoined_Host);
            this._boundHandlePlayerJoined_Host = null;
        }
        if (this._boundHandlePlayerListUpdate_Host) {
            eventBus.off(Events.Multiplayer.Common.PlayerListUpdated, this._boundHandlePlayerListUpdate_Host);
            this._boundHandlePlayerListUpdate_Host = null;
        }
        console.log("[MultiplayerGame Host] Cleaned up host listeners.");
    }
    // --- End Host Specific Methods ---

    // --- REMOVED Overrides for nextQuestion, _handleAnswerSubmitted ---
    // BaseGameMode methods will now work correctly using the injected this.quizEngine

    /** Starts the multiplayer game. */
    async start() {
        if (this.gameStarted) return;
        this.gameStarted = true;
        
        if (this.isHost) {
            // --- Host Start ---
            console.log("[MultiplayerGame Host] Starting game...");
            this.isGameOver = false; 
            // Initialize/reset player state based on current connections
            // State is now primarily managed via PlayerListUpdated events
            // this._initializePlayerState(this.webRTCManager.getPlayerList()); // REMOVED incorrect call
            
            try {
                console.log(`[MultiplayerGame Host] Loading questions into singleton engine via Manager...`);
                // Use the loadQuestionsFromManager method on the singleton instance
                await this.quizEngine.loadQuestionsFromManager(this.settings.sheetIds, this.difficulty);
                if (this.quizEngine.getQuestionCount() === 0) throw new Error("No questions loaded.");

                // +++ FIX: Initialize player state at game start +++
                console.log("[MultiplayerGame Host] Initializing player state based on current connections...");
                this._initializePlayerState(this.webRTCManager.getPlayerList()); // Use WebRTCManager's current player list
                // --- END FIX ---

            } catch (error) { 
                 console.error(`[MultiplayerGame Host] Error loading questions or initializing state:`, error);
                 eventBus.emit(Events.System.ErrorOccurred, { message: `Host failed to load questions: ${error.message}`, error });
                 this.webRTCManager.broadcastMessage(MSG_TYPE.ERROR, { message: 'Host failed to load questions.' });
                 // Clean up? For now, just stop.
                 this.finishGame(true); // Indicate error finish
                 return; 
             }

            const gameSettings = { ...this.settings, totalQuestions: this.quizEngine.getQuestionCount() };
            eventBus.emit(Events.Game.Started, { mode: 'multiplayer-host', settings: gameSettings, role: 'host' });
            console.log("[MultiplayerGame Host] Broadcasting GAME_START.");
            // --- DEBUG: Check webRTCManager instance before calling broadcast --- 
            console.log("[MultiplayerGame Host DEBUG] Checking this.webRTCManager:", this.webRTCManager);
            console.log("[MultiplayerGame Host DEBUG] Does it have broadcastMessage?", typeof this.webRTCManager?.broadcastMessage);
            // --- END DEBUG ---
            // Send GAME_START message to all clients
            this.webRTCManager.broadcastMessage(MSG_TYPE.GAME_START, {});
            
            // Start the game flow locally using BaseGameMode's nextQuestion
            this.nextQuestion(); 

        } else {
            // --- Client Start ---
            console.log("[MultiplayerGame Client] Starting game locally...");
            // QuizEngine instance was already created and populated in constructor
            try {
                if (this.quizEngine.getQuestionCount() === 0) {
                    throw new Error("Client QuizEngine instance has no questions.");
                }
                 console.log(`[MultiplayerGame Client] Verified engine instance. Count: ${this.quizEngine.getQuestionCount()}`);
                
                // Reset BaseGameMode state (handled in Base constructor mostly)
                this.isFinished = false;
                this.lastAnswerCorrect = null;
                this.currentQuestionIndex = -1;
                this.score = 0; // Ensure score starts at 0

                // Emit Game.Started locally for client UI transition
                 const gameSettings = { ...this.settings, totalQuestions: this.quizEngine.getQuestionCount() };
                eventBus.emit(Events.Game.Started, { 
                    mode: 'multiplayer-client',
                    settings: gameSettings, 
                    role: 'client' 
                });

                // Start the quiz loop using BaseGameMode's nextQuestion
                this.nextQuestion();

            } catch (error) {
                console.error("[MultiplayerGame Client] Error starting client game:", error);
                eventBus.emit(Events.System.ShowFeedback, { message: error.message || miscUtils.getTextTemplate('mpClientErrorGameStartFail'), level: 'error' });
                this.finishGame(true); // Finish locally on error
            }
        }
    }

    /**
     * Finishes the game. 
     * HOST: Marks itself finished and checks if all clients are done.
     * CLIENT: Emits LocalPlayerFinished.
     * @param {boolean} isFinalDestroy - Internal flag, true if called from destroy().
     */
    finishGame(isFinalDestroy = false) {
        if (this.isFinished) return;
        console.log(`[MultiplayerGame ${this.isHost ? 'Host' : 'Client'}] Finishing game...`);
        this.isFinished = true;
        this._beforeFinish(); // Hook (e.g., stop client timer)

        if (this.isHost) {
            // Host marks ITSELF as finished and checks if all clients are also done.
            // The actual end game logic (results calc, broadcast) happens in _hostCheckCompletion
            console.log("[MultiplayerGame Host] Host finished local questions. Checking completion status...");
            this._hostCheckCompletion(); 
        } else {
            // Client finishes its local quiz and notifies the coordinator
            console.log("[MultiplayerGame Client] Local quiz finished.");
            eventBus.emit(Events.Game.LocalPlayerFinished, { score: this.score });
            return; // <<< PREVENT BaseGameMode from emitting Game.Finished for client
        }

        // Host logic continues in _hostCheckCompletion...
    }

     /**
     * Hook called before finishing the game. Stops timer for client.
     * @protected
     * @override BaseGameMode._beforeFinish
     */
     _beforeFinish() {
         if (!this.isHost && this.timer) {
             this.timer.stop();
             console.log("[MultiplayerGame Client] Stopped timer before finish.");
         }
     }

    /**
     * Hook to assemble final results. Uses the correct quizEngine instance.
     * @returns {object} Final results structure.
     * @protected
     * @override BaseGameMode._getFinalResults
     */
    _getFinalResults() {
        const results = {
            winner: null,
            players: [],
            mode: 'multiplayer-host',
            difficulty: this.difficulty,
            gameName: this.settings?.sheetIds?.join(', ') || 'Multiplayer Game'
        };
        let highScore = -1;
        let winnerId = null;

        // Include host score - Use this.score from BaseGameMode
        results.players.push({
            id: this.hostPeerId,
            name: this.localPlayerName, 
            score: this.score,
            isHost: true 
        });
        if (this.score > highScore) {
            highScore = this.score;
            results.winner = this.localPlayerName;
            winnerId = this.hostPeerId;
        }

        // Include client scores
        this.clientScores.forEach((score, peerId) => {
            const clientResult = {
                id: peerId,
                name: this.webRTCManager.players.get(peerId)?.name || `Player_${peerId.slice(-4)}`,
                score: score,
                isHost: false
            };
            results.players.push(clientResult);

            if (score > highScore) {
                highScore = score;
                results.winner = clientResult.name;
                winnerId = peerId;
            }
        });

        // Sort players descending by score
        results.players.sort((a, b) => b.score - a.score);
        results.winnerId = winnerId;

        console.log("[MultiplayerGame Host] Calculated final results:", results);
        return results;
    }

    /** Cleans up listeners based on role. @override BaseGameMode._cleanupListeners */
    _cleanupListeners() {
        console.log(`[MultiplayerGame ${this.isHost ? 'Host' : 'Client'}] Cleaning up listeners...`);
        if (this.isHost) {
            this._cleanupHostListeners(); // Host cleans up its specific listeners
        } else {
            // Client cleans up only local game listeners (timer)
            if (this.timer) {
                if (this._boundHandleTimerTick) this.timer.off('tick', this._boundHandleTimerTick);
                if (this._boundHandleTimeUp) this.timer.off('end', this._boundHandleTimeUp);
                this._boundHandleTimerTick = null;
                this._boundHandleTimeUp = null;
            }
        }
        // BaseGameMode listeners are cleaned up by super.destroy()
    }

    /** Destroys the instance, cleaning up role-specific resources. @override BaseGameMode.destroy */
    destroy() {
        console.log(`[MultiplayerGame ${this.isHost ? 'Host' : 'Client'}] Destroying instance.`);
        if (this.timer) this.timer.stop(); // Stop timer if exists

        // --- Client: Notify host before disconnecting ---
        if (!this.isHost && this.webRTCManager) { // Null check
            try {
                console.log("[MultiplayerGame Client] Sending CLIENT_LEFT message to host before destroying.");
                this.webRTCManager.sendToHost(MSG_TYPE.CLIENT_LEFT, {});
            } catch (error) {
                console.warn("[MultiplayerGame Client] Error sending CLIENT_LEFT message:", error);
            }
        }
        // --- End Client Notification ---

        // Host-specific cleanup (like removing listeners, handled in _cleanupListeners)
        // if (this.isHost) { ... }

        // Close WebRTC connection
        if (this.webRTCManager) { // Null check
            this.webRTCManager.closeConnection();
        }

        // Nullify references
        this.quizEngine = null;
        this.webRTCManager = null;
        this.settings = null;
        this.clientScores = null;
        this.clientsFinished = null; // Corrected name from clientFinalScores

        console.log("[MultiplayerGame] Instance destroyed.");

        // Ensure base class cleanup runs (handles eventBus listeners etc.)
        super.destroy();
    }
} // End of MultiplayerGame class

export default MultiplayerGame;
