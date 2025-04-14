import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import BaseGameMode from './BaseGameMode.js';
import QuizEngine from '../services/QuizEngine.js'; // Import the class
import Timer from '../core/timer.js';
import miscUtils from '../utils/miscUtils.js';
import { MSG_TYPE } from '../core/message-types.js';
import webRTCManager from '../services/WebRTCManager.js'; // Import singleton
import highscoreManager from '../services/HighscoreManager.js';

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
            this.localPlayerName = localPlayerName;
            this.clientsFinished = new Set(); // Tracks clients who sent FINISHED
            this.clientScores = new Map(); // Stores final scores from clients
            this.finishedClients = new Set(); // Host: Tracks peerIds of clients who sent CLIENT_FINISHED
            this.hostFinished = false; // +++ Host: Track if host local game is done +++
            this.isGameOverBroadcast = false; // +++ Host: Prevent multiple GAME_OVER broadcasts +++
            this._hasEmittedLocalFinished = false; // Add flag to track LocalPlayerFinished emission

            // +++ Initialize Timer for Host (needed for scoring _calculateScore) +++
            const hostDurationMs = BaseGameMode.DIFFICULTY_DURATIONS_MS[this.difficulty] || BaseGameMode.DIFFICULTY_DURATIONS_MS.medium;
            this.timer = new Timer(hostDurationMs / 1000);
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
            const clientDurationMs = BaseGameMode.DIFFICULTY_DURATIONS_MS[this.difficulty] || BaseGameMode.DIFFICULTY_DURATIONS_MS.medium;
            this.timer = new Timer(clientDurationMs / 1000);
            this._registerTimerListeners(); // Client registers listeners
            this._registerClientListeners(); // <-- ADDED: Register client message listeners
            this._boundHandleStartGameLogic = this._handleStartGameLogic.bind(this); // +++ NEW BIND +++
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

        eventBus.on(Events.WebRTC.MessageReceived, this._boundHandleWebRTCMessage_Host);
        eventBus.on(Events.Multiplayer.Common.PlayerLeft, this._boundHandlePlayerLeft_Host);
        console.log(`[MultiplayerGame Host] Registered host listeners (Removed PlayerJoined & PlayerListUpdate listeners).`);
    }
    /**
     * [Host Only] Initializes or updates the score map based on the current player list.
     * Ensures only currently connected clients are tracked for scoring.
     * DOES NOT reset the clientsFinished set.
     * @param {Map<string, PlayerData>} players - The current map of players from WebRTCManager.
     * @private
     */
    _initializePlayerState(players) {
        if (!this.isHost) return;

        // --- Keep track of scores for CURRENTLY connected clients ---
        const currentClientIds = new Set();
        players.forEach((playerData, peerId) => {
            if (peerId !== this.hostPeerId) {
                currentClientIds.add(peerId);
                // Add client to scores map if not already present (initialize score to null)
                if (!this.clientScores.has(peerId)) {
                    this.clientScores.set(peerId, null);
                }
            }
        });

        // --- Remove scores for clients who are no longer connected ---
        const clientIdsToRemove = [];
        this.clientScores.forEach((score, peerId) => {
            if (!currentClientIds.has(peerId)) {
                clientIdsToRemove.push(peerId);
            }
        });
        clientIdsToRemove.forEach(peerId => {
            this.clientScores.delete(peerId);
            // NOTE: We do NOT remove from clientsFinished here. If they finished
            // before disconnecting, their state should persist for game end check.
        });

        // --- DO NOT CLEAR clientsFinished HERE ---
        // this.clientsFinished.clear(); // REMOVED THIS LINE

        console.log("[MultiplayerGame Host] Client state synchronized:", { scores: this.clientScores, finished: this.clientsFinished });
    }
     /** [Host Only] Handles messages received via WebRTC during the game phase. @private */
     _handleWebRTCMessage_Host({ msg, sender }) {
        if (!this.isHost || this.isGameOverBroadcast) return; // Only host processes during active game

        // Defensive check for message structure
        if (!msg || typeof msg.type !== 'string' || !msg.type) {
             console.warn(`[MultiplayerGame Host] Received invalid message structure from ${sender}. Ignoring.`, msg);
             // Specifically check if type is null and log the sender if it's the problematic case
             if (msg && msg.type === null && this.clientScores?.has(sender)) {
                 console.error(`[MultiplayerGame Host] Received NULL message type from known client ${sender}. Treating as CLIENT_LEFT.`);
                 // Treat null type from a known client during game as them leaving
                 this._hostHandleClientLeft(sender);
             }
             return;
         }

        const { type, payload } = msg;
        // console.log(`[MultiplayerGame Host DEBUG] Received message. Type: '${type}', Payload:`, payload); // Reduce noise

        switch (type) {
            case MSG_TYPE.C_SCORE_UPDATE:
                if (payload && typeof payload.score === 'number') {
                    console.log(`[MultiplayerGame Host] Received score update from ${sender}. Score: ${payload.score}`);
                    if (this.clientScores.has(sender)) {
                        this.clientScores.set(sender, payload.score);
                        // Broadcast updated scores to everyone
                        this._broadcastPlayerScores();
                    } else {
                         console.warn(`[MultiplayerGame Host] Received score update from unknown sender ${sender}`);
                    }
                } else {
                     console.warn(`[MultiplayerGame Host] Received invalid C_SCORE_UPDATE payload from ${sender}`, payload);
                }
                break;

            case MSG_TYPE.ANSWER_SUBMITTED:
                // Handle client submitting an answer
                console.log(`[MultiplayerGame Host] Received answer from ${sender}:`, payload);
                // TODO: Store client answer/time? For now, we wait for CLIENT_FINISHED
                break;

            case MSG_TYPE.CLIENT_FINISHED:
                console.log(`[MultiplayerGame Host DEBUG] Matched case for CLIENT_FINISHED.`);
                this._hostHandleClientFinished({ sender, payload });
                break;

            case MSG_TYPE.CLIENT_LEFT:
                console.log(`[MultiplayerGame Host DEBUG] Matched case for CLIENT_LEFT from ${sender}.`);
                this._hostHandleClientLeft(sender); // Use a dedicated handler
                break;

            default:
                console.log(`[MultiplayerGame Host DEBUG] Hit DEFAULT case. Type: '${type}', Expected CLIENT_FINISHED: '${MSG_TYPE.CLIENT_FINISHED}'`);
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
            console.log("[MultiplayerGame Host] Host and all connected clients have finished!");
            
            this.isGameOverBroadcast = true; // Set flag to prevent re-entry

            // Calculate final results (NOW is the time)
            const finalResults = this._getFinalResults(); 
            console.log(`[MultiplayerGame Host] Final Host Results:`, finalResults);
            
            // --- ADDED: Handle Host End Game Logic BEFORE emitting final events ---
            // 1. Save Winner Highscore
            if (finalResults && finalResults.winner && finalResults.winner.score > 0) {
                const winner = finalResults.winner;
                console.log(`[MultiplayerGame Host] Attempting to save highscore for winner ${winner.name}: ${winner.score}`);
                try {
                    highscoreManager.addHighscore(
                        winner.name,
                        winner.score,
                        finalResults.gameName || 'Multiplayer Game',
                        'multiplayer',
                        finalResults.difficulty || 'unknown'
                    );
                    console.log("[MultiplayerGame Host] Highscore save request sent.");
                } catch (error) {
                     console.error(`[MultiplayerGame Host] Error saving highscore:`, error);
                     eventBus.emit(Events.System.ShowFeedback, { message: miscUtils.getTextTemplate('hsSaveErrorGeneric') || 'Failed to save score.', level: 'error' });
                }
            } else {
                console.log("[MultiplayerGame Host] No single winner or score is 0. No highscore saved.");
            }

            // 2. Emit Navigation Event for Host Dialog BEFORE broadcasting
            console.log("[MultiplayerGame Host] Requesting UIManager show Multiplayer End Dialog.");
            eventBus.emit(Events.Navigation.ShowView, {
                viewName: Views.MultiplayerEndDialog,
                data: finalResults
            });
            
            // 3. Broadcast GAME_OVER *with* the results payload AFTER showing host dialog
            this.webRTCManager.broadcastMessage(MSG_TYPE.GAME_OVER, finalResults);
            console.log("[MultiplayerGame Host] Broadcasted GAME_OVER.");

            // 4. Emit the local Game.Finished event for the host (Coordinator handles cleanup)
            eventBus.emit(Events.Game.Finished, { mode: 'multiplayer-host', results: finalResults });

        } else {
            console.log("[MultiplayerGame Host] Check Completion: Waiting for host or more clients to finish.");
            // If host is finished but not all clients are, show waiting UI
            if (this.hostFinished && !allClientsFinished) {
                 console.log("[MultiplayerGame Host] Host finished, but waiting for clients. Emitting HostWaiting event.");
                 // Emit event for GameCoordinator to handle UI update
                 eventBus.emit(Events.Multiplayer.HostWaiting, { messageKey: 'mpHostWaitOthers' });
            }
        }
    }
    /** [Host Only] Handles a player leaving mid-game (via PlayerLeft event from WebRTCManager). @private */
    _handlePlayerLeft_Host({ peerId }) {
         if (!this.isHost || this.isGameOver || this.isGameOverBroadcast) return; // Existing checks
         console.log(`[MultiplayerGame Host] Player ${peerId} left mid-game (detected via PlayerLeft event).`);
         // Delegate to the common handler
         this._hostHandleClientLeft(peerId);
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
        console.log("[MultiplayerGame Host] Cleaned up host listeners (Removed PlayerJoined & PlayerListUpdate).");
    }
    // --- End Host Specific Methods ---

    /**
     * Override nextQuestion for Client behavior.
     * Prevents the client from calling finishGame locally when questions run out.
     * The client's game end is dictated solely by the host sending GAME_OVER.
     * @override BaseGameMode.nextQuestion 
     */
    nextQuestion() {
        if (this.isFinished) return;
        
        const nextIndex = this.currentQuestionIndex + 1;

        // --- Client Specific Check --- 
        if (!this.isHost && this.quizEngine.isQuizComplete(nextIndex)) {
            console.log(`[MultiplayerGame Client] Reached end of local questions (Index: ${nextIndex}). Waiting for host GAME_OVER.`);
            // DO NOT call finishGame(). The LocalPlayerFinished event was already emitted
            // after the last answer was processed in _handleAnswerSubmitted.
            // The game remains active, waiting for the host.
            return; // Stop further processing for the client here.
        }
        // --- End Client Specific Check ---

        // If it's the host OR (it's the client AND quiz is NOT complete), proceed with BaseGameMode logic.
        super.nextQuestion(); 
    }

    /** Starts the multiplayer game. */
    async start() {
        if (this.gameStarted) return;
        this.gameStarted = true;

        if (this.isHost) {
            console.log(`[MultiplayerGame Host] Starting core game logic and broadcasting signal...`);
            // Host starts its game logic preparation immediately
            await this._startGameAfterCountdown(); 
            // Host tells clients to start their logic
            this.webRTCManager.broadcastMessage(MSG_TYPE.H_START_GAME_LOGIC, {});
        } else {
            // Client sets up listener for the host's signal to start the game logic
            console.log("[MultiplayerGame Client] Waiting for H_START_GAME_LOGIC signal from host...");
            eventBus.on(Events.WebRTC.MessageReceived, this._boundHandleStartGameLogic);

            // Safety timeout remains useful
            this._startGameLogicTimeout = setTimeout(() => {
                console.warn("[MultiplayerGame Client] Did not receive H_START_GAME_LOGIC from host within 10 seconds. Starting game logic anyway.");
                eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleStartGameLogic);
                // +++ Trigger countdown here in timeout case +++
                console.log("[MultiplayerGame Client TIMEOUT] Triggering countdown locally.");
                eventBus.emit(Events.Game.CountdownStart, { duration: 5 }); 
                this._startGameAfterCountdown();
            }, 10000); 
        }
    }

    /** [Client Only] Handles the H_START_GAME_LOGIC message from the host. */
    _handleStartGameLogic({ msg, sender }) {
        if (this.isHost || msg.type !== MSG_TYPE.H_START_GAME_LOGIC || sender !== this.hostPeerId) {
            return;
        }
        console.log("[MultiplayerGame Client] Received H_START_GAME_LOGIC from host. Starting game logic.");
        clearTimeout(this._startGameLogicTimeout); 
        eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleStartGameLogic);

        // +++ Trigger countdown HERE on receiving signal +++
        console.log("[MultiplayerGame Client] Triggering countdown locally.");
        eventBus.emit(Events.Game.CountdownStart, { duration: 5 }); 

        // Now start the client's game logic preparation
        this._startGameAfterCountdown();
    }

    /** Internal method to start the game after countdown completes */
    async _startGameAfterCountdown() {
        
        if (this.isHost) {
            // --- Host Start ---            
            try {
                console.log(`[MultiplayerGame Host] Loading questions into singleton engine via Manager...`);
                await this.quizEngine.loadQuestionsFromManager(this.settings.sheetIds, this.difficulty);
                await new Promise(resolve => setTimeout(resolve, 500));
                const questionCount = this.quizEngine.getQuestionCount();
                console.log(`[MultiplayerGame Host] Questions loaded. Count: ${questionCount}`);
                if (!this.quizEngine || questionCount === 0) throw new Error("No questions loaded.");
                console.log("[MultiplayerGame Host] Initializing player state based on current connections...");
                this._initializePlayerState(this.webRTCManager.getPlayerList());

            } catch (error) {
                 console.error(`[MultiplayerGame Host] Error loading questions or initializing state:`, error);
                 eventBus.emit(Events.System.ErrorOccurred, { message: `Host failed to load questions: ${error.message}`, error });
                 this.webRTCManager.broadcastMessage(MSG_TYPE.ERROR, { message: 'Host failed to load questions.' });
                 this.finishGame(true);
                 return;
             }

            const gameSettings = { ...this.settings, totalQuestions: this.quizEngine.getQuestionCount() };
            eventBus.emit(Events.Game.Started, { mode: 'multiplayer-host', settings: gameSettings, role: 'host' });
            console.log("[MultiplayerGame Host] Broadcasting GAME_START (redundant). Core logic started.");
            this.webRTCManager.broadcastMessage(MSG_TYPE.GAME_START, {});
            
            // +++ Trigger countdown HERE for host +++
            console.log("[MultiplayerGame Host] Triggering countdown locally.");
            eventBus.emit(Events.Game.CountdownStart, { duration: 5 }); 

            // Start the game flow locally
            this.nextQuestion();

        } else {
            // --- Client Start (triggered by _handleStartGameLogic) ---
            console.log("[MultiplayerGame Client] Starting game setup locally...");
            try {
                 if (this.quizEngine.getQuestionCount() === 0) throw new Error("Client QuizEngine instance has no questions.");
                 console.log(`[MultiplayerGame Client] Verified engine instance. Count: ${this.quizEngine.getQuestionCount()}`);
                 this.isFinished = false;
                 this.lastAnswerCorrect = null;
                 this.currentQuestionIndex = -1;
                 this.score = 0;
                 const gameSettings = { ...this.settings, totalQuestions: this.quizEngine.getQuestionCount() };
                 eventBus.emit(Events.Game.Started, {
                     mode: 'multiplayer-client',
                     settings: gameSettings,
                     role: 'client'
                 });
                // Start the quiz loop
                this.nextQuestion();

            } catch (error) {
                 console.error("[MultiplayerGame Client] Error starting client game:", error);
                 eventBus.emit(Events.System.ShowFeedback, { message: error.message || miscUtils.getTextTemplate('mpClientErrorGameStartFail'), level: 'error' });
                 this.finishGame(true);
            }
        }
    }

    /**
     * Hook called after an answer has been checked.
     * If this is the client, send score update to host.
     * If client finished last question, send CLIENT_FINISHED.
     * If host, broadcast updated scores.
     * @param {boolean} isCorrect - Whether the answer was correct.
     * @param {number} scoreDelta - The score change calculated by _calculateScore.
     * @override BaseGameMode._afterAnswerChecked
     * @protected
     */
    _afterAnswerChecked(isCorrect, scoreDelta) {
        // Call parent method first to update score etc.
        super._afterAnswerChecked(isCorrect, scoreDelta);

        if (this.isHost) {
            // --- Host Specific Logic ---
            console.log(`[MultiplayerGame Host] Host score updated to: ${this.score}. Broadcasting scores.`);
            // Broadcast updated scores after host answers
            this._broadcastPlayerScores();

        } else {
            // --- Client Specific Logic ---
            console.log(`[MultiplayerGame Client] Score updated to ${this.score}. Sending update to host.`);
            try {
                // Send the score update immediately
                this.webRTCManager.sendToHost(MSG_TYPE.C_SCORE_UPDATE, { score: this.score });

                // Check if the quiz is now complete (currentQuestionIndex is the one just answered)
                const nextIndex = this.currentQuestionIndex + 1;
                if (this.quizEngine.isQuizComplete(nextIndex)) {
                    console.log(`[MultiplayerGame Client] Finished last question (${nextIndex}). Sending CLIENT_FINISHED to host with score: ${this.score}`);
                    
                    // *** Cancel the BaseGameMode's pending nextQuestion call ***
                    if (this._nextQuestionTimeoutId) {
                        console.log(`[MultiplayerGame Client] Cancelling pending BaseGameMode nextQuestion timeout.`);
                        clearTimeout(this._nextQuestionTimeoutId);
                        this._nextQuestionTimeoutId = null;
                    }
                    
                    // Send CLIENT_FINISHED *in addition* to the final score update
                    this.webRTCManager.sendToHost(MSG_TYPE.CLIENT_FINISHED, { score: this.score });
                    // Emit local event AFTER sending messages
                    eventBus.emit(Events.Game.LocalPlayerFinished, { score: this.score });
                }
            } catch (error) {
                console.error("[MultiplayerGame Client] Error sending score update or finished message:", error);
                eventBus.emit(Events.System.ShowFeedback, { message: 'Error sending update to host.', level: 'warning' });
            }
            // Note: nextQuestion() will still be called by BaseGameMode's timeout unless cancelled above.
        }
    }

    /**
     * Finishes the game, calculates final results, and emits Game.Finished.
     * @param {boolean} [isFinalDestroy=false] - Internal flag to prevent recursion during destroy.
     * @override BaseGameMode.finishGame
     */
    finishGame(isFinalDestroy = false) {
        // --- Client should NOT finish locally --- 
        if (!this.isHost) {
             console.log("[MultiplayerGame Client] finishGame called, but ignoring as client game end is dictated by host GAME_OVER.");
             // Client game state/timer might be stopped elsewhere (e.g., _beforeFinish if needed, or upon receiving GAME_OVER)
             
             // ENHANCED: Make sure we emit the LocalPlayerFinished event for clients
             if (!this._hasEmittedLocalFinished) {
                 console.log("[MultiplayerGame Client] Ensuring LocalPlayerFinished event is emitted");
                 this._beforeFinish(); // Includes stopping timer
                 
                 // Emit the local finished event with explicit logging
                 console.log("[MultiplayerGame Client] Emitting Events.Game.LocalPlayerFinished with score:", this.score);
                 eventBus.emit(Events.Game.LocalPlayerFinished, { score: this.score });
                 
                 // Flag to prevent duplicate emissions
                 this._hasEmittedLocalFinished = true;
             }
             return; 
         }
         // --- End Client Check ---

        console.log(`[MultiplayerGame Host] Finishing game...`);
        if (this.isFinished && !isFinalDestroy) {
            console.warn(`[MultiplayerGame Host] finishGame called, but already finished.`);
            return;
        }
        this.isFinished = true;

        if (this.isHost) {
            // --- HOST FINISH --- 
            console.log("[MultiplayerGame Host] Host finished local questions. Checking completion status...");
            // Stop timer immediately for host
            this._beforeFinish(); // Includes stopping timer
            // Mark host as done and check if game should end
            // This will handle broadcasting GAME_OVER and emitting Game.Finished *only* when everyone is done.
            this._hostCheckCompletion(); 
            // DO NOT emit Game.Finished here. _hostCheckCompletion will do it when appropriate.
            
        } else {
            // --- CLIENT FINISH --- 
            console.log("[MultiplayerGame Client] Local quiz finished.");
            // Stop timer for client
            this._beforeFinish(); // Includes stopping timer
            
            // Client emits LOCAL finish event with more explicit logging
            console.log("[MultiplayerGame Client] Emitting Events.Game.LocalPlayerFinished with score:", this.score);
            eventBus.emit(Events.Game.LocalPlayerFinished, { score: this.score });
            
            // Flag to prevent duplicate emissions
            this._hasEmittedLocalFinished = true;
            
            // DO NOT emit Game.Finished here. Client waits for GAME_OVER message.
            // The client's activeGame instance remains until GAME_OVER triggers Coordinator cleanup.
        }
    }

    /** Actions performed just before finishing (e.g., stop timers). @override */
    _beforeFinish() {
        if (this.timer) {
            console.log(`[MultiplayerGame ${this.isHost ? 'Host' : 'Client'}] Stopped timer before finish.`);
            this.timer.stop();
        }
        // Add any other pre-finish cleanup common to both roles
    }

    /** Calculates final results based on role. @override */
    _getFinalResults() {
        if (this.isHost) {
            // Host aggregates scores
            const finalScores = new Map();
            // +++ Get the authoritative player list from WebRTCManager +++
            const playersMap = this.webRTCManager.getPlayerList(); 
            
            // +++ FIX: Add host score using localPlayerName +++
            finalScores.set(this.hostPeerId, { name: this.localPlayerName || 'Host', score: this.score });
            
            // Add client scores (use names from WebRTCManager's player list)
            this.clientScores.forEach((clientScore, peerId) => {
                 // +++ Use the fetched playersMap +++
                 const playerData = playersMap.get(peerId); 
                 const name = playerData ? playerData.name : 'Unknown'; // Use name from the map
                 finalScores.set(peerId, { name: name, score: clientScore ?? 0 });
            });

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
                const winners = rankedPlayers.filter(p => p.score === topScore);
                if (winners.length === 1) {
                    winner = winners[0]; // Assign if single winner
                }
            }
            
            // Get game name from settings (likely sheet IDs)
            const gameName = Array.isArray(this.settings?.sheetIds) 
                               ? this.settings.sheetIds.join(', ') 
                               : 'Unknown Game';

            return {
                winner: winner, // Can be null for ties
                players: rankedPlayers, // Array of { rank, peerId, name, score }
                mode: 'multiplayer-host',
                difficulty: this.settings?.difficulty || 'unknown',
                gameName: gameName,
                timestamp: Date.now(),
                winnerId: winner ? winner.peerId : null
            };
        } else {
            // Client doesn't calculate, receives results from host
            return { 
                score: this.score, // Client only knows its own final score
                mode: 'multiplayer-client'
            };
        }
    }

    /** Cleans up listeners based on role. @override BaseGameMode._cleanupListeners */
    _cleanupListeners() {
        console.log(`[MultiplayerGame ${this.isHost ? 'Host' : 'Client'}] Cleaning up listeners...`);
        if (this.isHost) {
            this._cleanupHostListeners(); // Host cleans up its specific listeners
        } else {
            // Client cleanup
            if (this.timer) {
                if (this._boundHandleTimerTick) this.timer.off('tick', this._boundHandleTimerTick);
                if (this._boundHandleTimeUp) this.timer.off('end', this._boundHandleTimeUp);
                this._boundHandleTimerTick = null;
                this._boundHandleTimeUp = null;
            }
            // +++ NEW: Clean up start game logic listener +++
            if (this._boundHandleStartGameLogic) {
                eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleStartGameLogic);
                this._boundHandleStartGameLogic = null;
            }
            // +++ NEW: Clear safety timeout +++
            clearTimeout(this._startGameLogicTimeout);
        }
        // BaseGameMode listeners are cleaned up by super.destroy()
    }

    /** Destroys the instance, cleaning up role-specific resources. @override BaseGameMode.destroy */
    destroy() {
        console.log(`[MultiplayerGame ${this.isHost ? 'Host' : 'Client'}] Destroying instance.`);
        if (this.timer) this.timer.stop(); // Stop timer if exists

        // --- Client: Notify host if leaving ---
        if (!this.isHost && this.webRTCManager && this.webRTCManager.hostConnection) {
            try {
                console.log("[MultiplayerGame Client] Sending CLIENT_LEFT message to host before destroying.");
                const messageTypeToSend = MSG_TYPE.CLIENT_LEFT;
                this.webRTCManager.sendToHost(messageTypeToSend, {});
            } catch (error) {
                console.warn("[MultiplayerGame Client] Error sending CLIENT_LEFT message during destroy:", error);
            }
        }

        // --- Ensure Multiplayer-specific listeners are cleaned up --- 
        this._cleanupListeners();
        // --- End Ensure --- 

        // Nullify references for this instance
        this.quizEngine = null;
        this.settings = null;
        this.clientScores = null;
        this.clientsFinished = null;

        console.log("[MultiplayerGame] Instance destroyed.");

        // Base class cleanup runs last (it calls its own _cleanupListeners now)
        super.destroy();
    }

    /** [Client Only] Stop timer before checking the answer. @override @protected */
    _beforeAnswerCheck() {
        // Only clients have an active gameplay timer that needs stopping here.
        if (!this.isHost && this.timer) {
            this.timer.stop();
            // console.log("[MultiplayerGame Client] Stopped timer before answer check."); // Optional: Add log if needed
        }
        // Assuming BaseGameMode._beforeAnswerCheck does nothing critical or doesn't exist.
        // If it might, add: super._beforeAnswerCheck?.();
    }

    /** [Client Only] Stop timer before moving to the next question. @override @protected */
    _beforeNextQuestion() {
        if (!this.isHost && this.timer) {
            this.timer.stop();
            // console.log("[MultiplayerGame Client] Stopped timer before next question."); // Optional
        }
    }

    /** [Client Only] Reset and start timer after a new question is presented. @override @protected */
    _afterQuestionPresented() {
        if (!this.isHost && this.timer) {
            this.timer.reset();
            this.timer.start();
            // console.log("[MultiplayerGame Client] Reset and started timer after question presented."); // Optional
        }
    }

    /**
     * [Host Only] Handles explicit CLIENT_LEFT message or implicit leave detection.
     * Marks the client as finished, broadcasts updated scores, and checks game completion.
     * @param {string} peerId - The ID of the client who left.
     * @private
     */
    _hostHandleClientLeft(peerId) {
        if (!this.isHost || this.isGameOverBroadcast) return;
        console.log(`[MultiplayerGame Host] Handling client left: ${peerId}`);

        if (this.clientScores.has(peerId)) {
            let needsScoreBroadcast = false;
            if (!this.clientsFinished.has(peerId)) {
                console.log(`[MultiplayerGame Host] Marking leaving player ${peerId} as finished.`);
                this.clientsFinished.add(peerId);
                // If they hadn't finished, their score might be inaccurate, set to 0? Or keep last known?
                // Let's keep the last known score for now, or set to 0 if it was null.
                if (this.clientScores.get(peerId) === null) {
                    this.clientScores.set(peerId, 0);
                    needsScoreBroadcast = true; // Score changed from null to 0
                }
            }
            // Broadcast scores immediately IF the score changed or just to reflect player gone?
            // Let's broadcast to ensure list is updated everywhere with latest scores/player status
            this._broadcastPlayerScores();

            // Update UI & show feedback (moved from _handlePlayerLeft_Host which might not fire reliably)
            // This is somewhat redundant now if _broadcastPlayerScores triggers PlayerListUpdate
            // Let's comment out the direct UI update here and rely on the score broadcast.
            // this._updateUiOnPlayerLeave(peerId);

             // Check completion AFTER broadcasting scores
             this._hostCheckCompletion();

        } else {
            console.warn(`[MultiplayerGame Host] Client ${peerId} left, but was not in the tracked clientScores map.`);
            // Still broadcast scores so other clients see the player is gone
            this._broadcastPlayerScores();
        }
    }

    /**
     * [Host Only] Constructs the current player score data, emits it locally for the host's UI,
     * and broadcasts it to clients.
     * @private
     */
    _broadcastPlayerScores() {
        if (!this.isHost || this.isGameOverBroadcast || !this.webRTCManager) {
            console.warn("[MultiplayerGame Host] Skipping score broadcast (not host, game over, or no WebRTCManager).");
            return;
        }

        console.log("[MultiplayerGame Host] Constructing and broadcasting updated player scores...");
        const playerScoresMap = new Map();

        // 1. Get the current authoritative player list from WebRTCManager
        const currentPlayers = this.webRTCManager.getPlayerList();
        if (!currentPlayers) {
            console.error("[MultiplayerGame Host] Cannot broadcast scores: Failed to get player list from WebRTCManager.");
            return;
        }

        // 2. Iterate through the authoritative list to build the payload map
        currentPlayers.forEach((playerData, peerId) => {
            let score = 0;
            let name = playerData.name || 'Player'; // Use name from WebRTC list
            const isHostPlayer = (peerId === this.hostPeerId);

            if (isHostPlayer) {
                score = this.score; // Host's own score
                name = this.localPlayerName || name; // Use specific host name if available
            } else {
                // Get score from internal tracking, default to 0
                score = this.clientScores?.get(peerId) ?? 0;
            }

            playerScoresMap.set(peerId, {
                name: name,
                score: score,
                isHost: isHostPlayer
            });
        });

        // --- ADDED: Emit Locally for Host UI ---
        // Emit the standard update event so the host's PlayerListComponent updates itself
        console.log("[MultiplayerGame Host] Emitting PlayerListUpdated locally for host UI.");
        eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: playerScoresMap });
        // --- END ADDED ---

        // 3. Convert Map to plain object for sending via JSON
        const payloadObject = {};
        playerScoresMap.forEach((data, peerId) => {
            payloadObject[peerId] = data;
        });


        // 4. Broadcast the update to clients
        try {
            // Exclude self (host) from broadcast if desired, but sending to self is usually harmless
            // this.webRTCManager.broadcastMessage(MSG_TYPE.H_PLAYER_SCORES_UPDATE, { players: payloadObject }, [this.hostPeerId]); // Example: Exclude host
            this.webRTCManager.broadcastMessage(MSG_TYPE.H_PLAYER_SCORES_UPDATE, { players: payloadObject }); // Send to all including self (simpler)
            console.log("[MultiplayerGame Host] Broadcast H_PLAYER_SCORES_UPDATE with data:", payloadObject);
        } catch (broadcastError) {
            console.error("[MultiplayerGame Host] Error broadcasting player scores:", broadcastError);
        }
    }

    // --- Client Specific Methods ---
    /** [Client Only] Registers client-specific listeners. @private */
    _registerClientListeners() {
        if (this.isHost) return;
        this._boundHandleWebRTCMessage_Client = this._handleWebRTCMessage_Client.bind(this);
        eventBus.on(Events.WebRTC.MessageReceived, this._boundHandleWebRTCMessage_Client);
        console.log(`[MultiplayerGame Client] Registered client message listener.`);
    }

    /** [Client Only] Handles messages received via WebRTC. @private */
    _handleWebRTCMessage_Client({ msg, sender }) {
        if (this.isHost || this.isFinished) return; // Only client processes, ignore if already finished
        if (!msg || !msg.type || sender !== this.hostPeerId) return; // Ignore invalid or non-host messages

        const { type, payload } = msg;

        switch (type) {
            case MSG_TYPE.GAME_OVER:
                console.log(`[MultiplayerGame Client] Received GAME_OVER from host. Payload:`, payload);
                this._handleGameOverMessage(payload);
                break;

            case MSG_TYPE.H_PLAYER_SCORES_UPDATE:
                 // Handle score updates if needed by the client UI during the game
                 // This is already handled by PlayerListComponent listening to PlayerListUpdated
                 // console.log(`[MultiplayerGame Client] Received score update:`, payload);
                 break;

            // Handle other host->client messages if needed

            default:
                 // console.log(`[MultiplayerGame Client] Ignoring message type '${type}' from host.`);
                 break;
        }
    }

     /** [Client Only] Handles the GAME_OVER message from the host. @private */
     _handleGameOverMessage(resultsPayload) {
        if (this.isHost || this.isFinished) return; // Prevent double processing
        console.log("[MultiplayerGame Client] Processing GAME_OVER.");

        // Stop timers before showing dialog
        this._beforeFinish(); 
        
        // 1. Emit Navigation Event for Client Dialog FIRST
        console.log("[MultiplayerGame Client] Requesting UIManager show Multiplayer End Dialog.");
        eventBus.emit(Events.Navigation.ShowView, {
            viewName: Views.MultiplayerEndDialog,
            data: resultsPayload // Pass the results received from the host
        });
        
        // 2. Mark as finished AFTER showing dialog
        this.isFinished = true;

        // 3. Emit the local Game.Finished event (Coordinator handles cleanup)
        eventBus.emit(Events.Game.Finished, { 
            mode: 'multiplayer-client', 
            results: { score: this.score, ...resultsPayload }
        });

        // 4. Cleanup client listeners AFTER handling message and navigation
        this._cleanupListeners();
     }

     /** [Client Only] Cleans up client-specific listeners. @private */
     _cleanupClientListeners() {
         if (this.isHost) return;
         if (this._boundHandleWebRTCMessage_Client) {
             eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleWebRTCMessage_Client);
             this._boundHandleWebRTCMessage_Client = null;
             console.log(`[MultiplayerGame Client] Cleaned up client message listener.`);
         }
         // Also clean up timer listeners
         if (this.timer) {
            if (this._boundHandleTimerTick) this.timer.off('tick', this._boundHandleTimerTick);
            if (this._boundHandleTimeUp) this.timer.off('end', this._boundHandleTimeUp);
            this._boundHandleTimerTick = null;
            this._boundHandleTimeUp = null;
            console.log(`[MultiplayerGame Client] Cleaned up client timer listeners.`);
         }
         if (this._boundHandleStartGameLogic) {
            eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleStartGameLogic);
            this._boundHandleStartGameLogic = null;
            console.log(`[MultiplayerGame Client] Cleaned up start game logic listener.`);
         }
         clearTimeout(this._startGameLogicTimeout);
     }
    // --- End Client Specific Methods ---
} // End of MultiplayerGame class

export default MultiplayerGame;
