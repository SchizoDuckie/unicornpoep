import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import QuizEngine from '../services/QuizEngine.js';
import webRTCManager from '../services/WebRTCManager.js'; // Corrected Path & Case
import Timer from '../core/timer.js';
import miscUtils from '../utils/miscUtils.js'; // Changed to default import

// Message types sent BY THE HOST
const MSG_TYPE = {
    GAME_START: 'game_start', // Host -> Clients: Signal game start
    QUESTION_NEXT: 'question_new', // Host -> Clients: contains new question data (Renamed for consistency)
    ANSWER_RESULT: 'answer_result', // Host -> Clients: contains correctness, correct answer, scores
    GAME_OVER: 'game_over', // Host -> Clients: contains final results
    PLAYER_UPDATE: 'player_update', // Host -> Clients: e.g., score updates mid-game
    TIMER_TICK: 'timer_tick', // Host -> Clients: broadcast current time
    TIMER_UP: 'timer_up', // Host -> Clients: signal time ran out
    ERROR: 'error', // Host -> Clients: signal an error occurred
    FEEDBACK: 'feedback', // Host -> Clients: request showing feedback
    PLAYER_JOINED: 'player_joined', // Host -> Clients: new player notification
    PLAYER_LEFT: 'player_left', // Host -> Clients: player departure notification
    PLAYER_LIST_UPDATE: 'player_list_update', // Host -> Clients: full player list refresh
};

/**
 * Manages the state and logic for a multiplayer game session HOST.
 * Handles communication via WebRTCManager to clients.
 */
class MultiplayerGame {
    /**
     * Creates a multiplayer game host instance.
     * @param {object} settings - Game settings (sheetIds, difficulty).
     * @param {string} localPlayerName - Name of the local player (host).
     */
    constructor(settings, localPlayerName) {
        // Note: Removed isHost parameter, this class now assumes host role.
        console.log(`[MultiplayerGame Host] Initializing.`, { settings, localPlayerName });
        this.settings = settings;
        this.localPlayerName = localPlayerName;
        this.quizEngine = QuizEngine;
        this.timer = new Timer(30000); // Host controls timer (using ms now)
        this.playerScores = new Map(); // Map<peerId, number>
        this.playerFinished = new Map(); // Map<peerId, boolean> - Tracks players who answered current question
        this.playerAnswers = new Map(); // Map<peerId, any> - Stores submitted answers for the current question
        this.isGameOver = false;
        this._questionStartTime = null; // Timestamp when the current question was sent

        // Get initial player list from WebRTCManager - ensure host is included
        this._initializePlayerState(webRTCManager.getPlayerList());

        this._registerListeners();
    }

    /** Initialize scores based on current player list. @private */
    _initializePlayerState(players) {
        this.playerScores.clear();
        this.playerFinished.clear();
        // Ensure host is in the list if not already added by WebRTCManager init
        const hostId = webRTCManager.getMyPeerId();
        if (hostId && !players.has(hostId)) {
             console.warn("[MultiplayerGame Host] Host ID not found in initial player list from WebRTCManager. Adding.");
             // Assuming WebRTCManager stores { name: string } in playerData
             players.set(hostId, { name: this.localPlayerName });
        }

        players.forEach((playerData, peerId) => {
            this.playerScores.set(peerId, 0);
            this.playerFinished.set(peerId, false); // Reset finished status
        });
         console.log("[MultiplayerGame Host] Initial player state:", { scores: this.playerScores, finished: this.playerFinished });
    }

    /** Registers internal and external event listeners. @private */
    _registerListeners() {
        // Listen for WebRTC messages (filtered by game context)
        this._boundHandleWebRTCMessage = this._handleWebRTCMessage.bind(this); // Store bound reference
        eventBus.on(Events.WebRTC.MessageReceived, this._boundHandleWebRTCMessage);

        // Listen for player disconnections
        this._boundHandlePlayerLeft = this._handlePlayerLeft.bind(this); // Store bound reference
        eventBus.on(Events.Multiplayer.Common.PlayerLeft, this._boundHandlePlayerLeft);

        // Listen for players joining (if game setup allows joining mid-game, otherwise handled by lobby)
        this._boundHandlePlayerJoined = this._handlePlayerJoined.bind(this); // Store bound reference
        eventBus.on(Events.Multiplayer.Common.PlayerJoined, this._boundHandlePlayerJoined);

        // Host listens to timer
        this._boundHostHandleTimerTick = this._hostHandleTimerTick.bind(this); // Store bound reference
        this.timer.on('tick', this._boundHostHandleTimerTick);
        this._boundHostHandleTimeUp = this._hostHandleTimeUp.bind(this); // Store bound reference
        this.timer.on('end', this._boundHostHandleTimeUp);

        // Host listens for local UI answer submission (if host plays along)
        // eventBus.on(Events.UI.GameArea.AnswerSubmitted, this._hostHandleSelfAnswerSubmitted.bind(this)); // Optional: if host can play
        // Removed client listener
    }

    /** Starts the multiplayer game (Host only). */
    async start() {
        console.log("[MultiplayerGame Host] Starting game...");
        try {
            await this.quizEngine.loadQuestions(this.settings.sheetIds, this.settings.difficulty);
            if (this.quizEngine.getQuestionCount() === 0) {
                throw new Error("No questions loaded for the selected sheets/difficulty.");
            }
            this.isGameOver = false;

            // Ensure initial state is set correctly before broadcasting start
            // Re-initialize state based on the *current* list right before starting
            this._initializePlayerState(webRTCManager.getPlayerList());

            // Emit Game.Started locally for host UI
            eventBus.emit(Events.Game.Started, { mode: 'multiplayer', settings: this.settings, role: 'host' });

            // Broadcast GAME_START to all clients
            webRTCManager.broadcastMessage(MSG_TYPE.GAME_START, {
                settings: this.settings,
                players: Object.fromEntries(webRTCManager.getPlayerList()) // Send initial player list
            });

            // Start the first question after a short delay
            setTimeout(() => this._hostNextQuestion(), 1000);

        } catch (error) {
            console.error("[MultiplayerGame Host] Error starting game:", error);
            const errorMessage = `Host error starting game: ${error.message}`;
            eventBus.emit(Events.System.ErrorOccurred, {
                message: errorMessage,
                error,
                context: 'MultiplayerGame.start' // More specific context
            });
            // Broadcast error to clients
            webRTCManager.broadcastMessage(MSG_TYPE.ERROR, { message: errorMessage, context: 'game-start' });
            this.finishGame(); // Attempt to cleanup/notify if possible
            webRTCManager.closeAllConnections(); // Close connections on fatal start error
        }
    }

    // --- Host Logic ---

    /** [Host] Moves to the next question or ends the game. @private */
    _hostNextQuestion() {
        if (this.isGameOver) return;

        this.timer.stop();
        const nextIndex = this.quizEngine.currentQuestionIndex + 1;

        if (this.quizEngine.isQuizComplete(nextIndex)) {
            this.finishGame();
            return;
        }

        // Clear previous answers before loading next question
        this.playerAnswers.clear();
        this.playerFinished.clear(); // Reset finished status for new question


        const questionData = this.quizEngine.getCurrentQuestion(nextIndex); // Advances internal index
        if (questionData) {
             const currentQuestionIndex = this.quizEngine.currentQuestionIndex;
             const totalQuestions = this.quizEngine.getQuestionCount();
             const answers = this.quizEngine.getShuffledAnswers(currentQuestionIndex); // Use current index
            console.log(`[MultiplayerGame Host] Presenting question ${currentQuestionIndex + 1}/${totalQuestions}`);

            const payload = {
                questionIndex: currentQuestionIndex,
                totalQuestions: totalQuestions,
                questionData: {
                    question: questionData.question,
                    answers: answers // Use shuffled answers
                }
            };

            // Emit locally for host UI
            eventBus.emit(Events.Game.QuestionNew, payload);
            // Broadcast to clients
            webRTCManager.broadcastMessage(MSG_TYPE.QUESTION_NEXT, payload);

            // Record question start time for scoring
            this._questionStartTime = Date.now();

            // Reset local state for host (if playing)
            // this._resetLocalSubmissionState(); // If host plays along

            // Start timer (ensure using milliseconds)
            this.timer.reset(); // Reset to initial duration (e.g., 30000ms)
            this.timer.start();
            // Broadcast initial tick immediately?
            this._hostHandleTimerTick(this.timer.duration); // Send initial time
        } else {
            const errorMessage = `Host error: Could not retrieve question data for index ${this.quizEngine.currentQuestionIndex}`;
            console.error(`[MultiplayerGame Host] ${errorMessage}`);
             // Broadcast error?
             webRTCManager.broadcastMessage(MSG_TYPE.ERROR, { message: errorMessage, context: 'next-question' });
             eventBus.emit(Events.System.ErrorOccurred, { // Also emit locally
                message: errorMessage,
                context: 'MultiplayerGame._hostNextQuestion'
             });
            this.finishGame();
        }
    }

     /** [Host] Handles timer ticks - broadcasts remaining time. @private */
    _hostHandleTimerTick(remainingTimeMs) {
        const payload = { remainingTime: remainingTimeMs };
        // Emit locally for host UI
        eventBus.emit(Events.Game.TimeTick, payload);
        // Broadcast to clients
        webRTCManager.broadcastMessage(MSG_TYPE.TIMER_TICK, payload);
    }

    /** [Host] Handles timer running out. Checks answers received so far. @private */
    _hostHandleTimeUp() {
        if (this.isGameOver) return;
        const currentIndex = this.quizEngine.currentQuestionIndex;
        console.log(`[MultiplayerGame Host] Time's up for question ${currentIndex + 1}`);

        // Emit locally
        eventBus.emit(Events.Game.TimeUp);
        // Broadcast to clients
        webRTCManager.broadcastMessage(MSG_TYPE.TIMER_UP, {}); // Simple signal

        // Process results for everyone (those who answered + those who didn't)
        this._hostProcessRoundResults(true); // Indicate timedOut = true

        // Move to next question after a delay
        setTimeout(() => this._hostNextQuestion(), 3000); // Longer delay after time out/results display
    }

    /**
     * [Host] Processes and broadcasts results for the current round.
     * Called either when time runs out or all players have answered.
     * @param {boolean} timedOut - Whether the round ended due to timeout.
     * @private
     */
    _hostProcessRoundResults(timedOut = false) {
        const currentIndex = this.quizEngine.currentQuestionIndex;
        if (currentIndex < 0) return; // No question active

        const correctAnswer = this.quizEngine.getCorrectAnswer(currentIndex);
        const resultsPayload = {
            questionIndex: currentIndex,
            isCorrect: {}, // Map<peerId, boolean>
            scoreDelta: {}, // Map<peerId, number>
            totalScores: {}, // Map<peerId, number>
            correctAnswer: correctAnswer,
            timedOut: timedOut
        };

        // Iterate over all players known at the start of the round (or current connected?)
        // Use webRTCManager.getPlayerList() to include anyone currently connected.
        const currentPlayers = webRTCManager.getPlayerList();
        currentPlayers.forEach((playerData, peerId) => {
            const answerData = this.playerAnswers.get(peerId); // Get stored answer { answer: any, receivedTime: number }
            let isCorrect = false;
            let scoreDelta = 0;

            if (answerData) {
                // Player submitted an answer
                isCorrect = (answerData.answer === correctAnswer);
                if (isCorrect) {
                    // Calculate elapsed time based on when host received answer
                    const elapsedMs = answerData.receivedTime - this._questionStartTime;
                    // Calculate score using base method with specific elapsed time
                    scoreDelta = this._calculateScore(true, elapsedMs);
                }
            } else {
                // Player did not submit an answer (timed out or disconnected before answering)
                isCorrect = false;
                scoreDelta = 0;
            }

            // Update player score (only add if correct)
            const currentScore = this.playerScores.get(peerId) || 0;
            const newTotalScore = currentScore + scoreDelta;
            this.playerScores.set(peerId, newTotalScore);

            // Store results for payload
            resultsPayload.isCorrect[peerId] = isCorrect;
            resultsPayload.scoreDelta[peerId] = scoreDelta;
            resultsPayload.totalScores[peerId] = newTotalScore;
        });

        console.log("[MultiplayerGame Host] Broadcasting round results:", resultsPayload);

        // Emit locally for Host UI update (showing all results)
         const hostId = webRTCManager.getMyPeerId(); // Get current host ID
         eventBus.emit(Events.Game.AnswerChecked, {
             // Host's own result (if playing, need to handle - assuming not playing for now)
             isCorrect: resultsPayload.isCorrect[hostId] ?? false, // Use nullish coalescing
             scoreDelta: resultsPayload.scoreDelta[hostId] ?? 0,
             correctAnswer: correctAnswer,
             submittedAnswer: this.playerAnswers.get(hostId), // Host's submitted answer (will be undefined if host isn't playing/submitting)
             timedOut: timedOut,
             allResults: resultsPayload // Include results for all players
         });

        // Broadcast results to all clients
        webRTCManager.broadcastMessage(MSG_TYPE.ANSWER_RESULT, resultsPayload);

        // Reset answers for next round
        // Moved clear to _hostNextQuestion start
    }


    /** [Host] Handles an answer submitted by a client. @private */
    _hostHandleAnswerSubmitted(senderPeerId, submittedPayload) {
        const currentIndex = this.quizEngine.currentQuestionIndex;
        const submittedAnswer = submittedPayload?.answer;
        const questionIndexReceived = submittedPayload?.questionIndex;

        if (this.isGameOver || currentIndex < 0 || submittedAnswer === undefined || questionIndexReceived !== currentIndex) {
            console.warn(`[MultiplayerGame Host] Ignoring invalid/stale answer from ${senderPeerId}`, { currentIndex, questionIndexReceived, submittedPayload });
            return;
        }

        // Check if player already submitted for this question
        if (this.playerAnswers.has(senderPeerId)) {
            console.warn(`[MultiplayerGame Host] Player ${senderPeerId} already submitted an answer for question ${currentIndex + 1}. Ignoring.`);
            return;
        }

        console.log(`[MultiplayerGame Host] Received answer from ${senderPeerId} for Q${currentIndex + 1}:`, submittedAnswer);

        // Store the answer temporarily
        const receivedTime = Date.now();
        this.playerAnswers.set(senderPeerId, { answer: submittedAnswer, receivedTime: receivedTime });
        this.playerFinished.set(senderPeerId, true);

        // Do NOT calculate/broadcast individual results here. Wait for time up or all players finished.

        // Check if all connected players have answered
        if (this._hostCheckAllPlayersAnswered()) {
             console.log(`[MultiplayerGame Host] All players answered Q${currentIndex + 1}. Processing results early.`);
             this.timer.stop(); // Stop the timer early
             this._hostProcessRoundResults(false); // Process results, not timed out
             // Move to next question after delay
             setTimeout(() => this._hostNextQuestion(), 3000);
        }
    }

    /** [Host] Checks if all currently connected players have submitted an answer. @private */
    _hostCheckAllPlayersAnswered() {
        const currentPlayers = webRTCManager.getConnectedPeerIds(); // Get IDs of currently connected clients + host
        if (currentPlayers.length === 0) return false; // No players connected, can't all have answered

        // Check if every connected player ID is in the playerAnswers map for this round
        return currentPlayers.every(peerId => this.playerAnswers.has(peerId));
    }


    /** [Host] Finishes the game and broadcasts results. */
    finishGame() {
        if (this.isGameOver) return;
        console.log(`[MultiplayerGame Host] Finishing game...`);
        this.isGameOver = true;
        this.timer.stop();

        // Ensure final scores are calculated if the last action wasn't _hostProcessRoundResults
        // (e.g., game ended by command or error, not natural completion)
        // For simplicity, assume scores are up-to-date or calculate final standings here if needed.

        const finalResults = {
            scores: Object.fromEntries(this.playerScores), // Convert Map to object for serialization
            rankings: this._calculateRankings(),
            // Add any other relevant host-calculated final data
        };
        console.log("[MultiplayerGame Host] Broadcasting GAME_OVER:", finalResults);
        webRTCManager.broadcastMessage(MSG_TYPE.GAME_OVER, finalResults);
            // Emit locally for host UI
            eventBus.emit(Events.Game.Finished, { mode: 'multiplayer', results: finalResults, role: 'host' });
        // Client logic removed

        this._cleanupListeners();
        // Consider closing connections after a delay? Or leave that to UI interaction.
    }

     /** [Host] Calculates final rankings based on scores. @private */
     _calculateRankings() {
         const playerList = webRTCManager.getPlayerList(); // Get names etc.
         return Array.from(this.playerScores.entries())
             .map(([peerId, score]) => ({
                 peerId,
                 name: playerList.get(peerId)?.name || peerId, // Get name from playerList
                 score,
             }))
             .sort((a, b) => b.score - a.score); // Sort descending by score
     }


    // --- Client Logic Removed ---
    // _clientHandleGameStart removed
    // _clientHandleQuestionNext removed
    // _clientHandleAnswerSubmitted removed
    // _clientHandleAnswerResult removed
    // _clientHandleGameOver removed
    // _clientHandlePlayerUpdate removed


    // --- Common Logic & Cleanup ---

    /** Handles WebRTC messages received via the event bus. @private */
    _handleWebRTCMessage({ msg, sender }) { // Renamed parameters for clarity
        // Ensure message has type and payload structure
        const type = msg?.type;
        const payload = msg?.payload;

        console.debug(`[MultiplayerGame Host] Received message type ${type} from ${sender}`, payload);
        if (this.isGameOver) return; // Ignore messages after game over (except maybe specific ones?)

        // Host handles messages from clients
        switch (type) {
            case 'answer_submitted': // This is the primary message type host expects from clients during game
                // Ensure payload exists and contains necessary fields
                if (payload && payload.answer !== undefined && payload.questionIndex !== undefined) {
                    this._hostHandleAnswerSubmitted(sender, payload);
                } else {
                    console.warn(`[MultiplayerGame Host] Received malformed 'answer_submitted' from ${sender}`, payload);
                }
                break;
            // Add cases for other client->host messages if needed (e.g., PLAYER_READY, PING?)
            default:
                console.log(`[MultiplayerGame Host] Received unhandled/unexpected message type: ${type} from ${sender}`);
        }
        // Client message handling logic removed
    }

     /** [Host] Handles a player joining mid-game (if allowed). @private */
    _handlePlayerJoined({ peerId, playerData }) {
        if (this.isGameOver) return;
        console.log(`[MultiplayerGame Host] Player ${playerData?.name || 'Unknown'} (${peerId}) joined.`); // Safer access to name
        // Add player to score tracking if not already present (e.g., joined late)
        if (!this.playerScores.has(peerId)) {
            this.playerScores.set(peerId, 0);
            this.playerFinished.set(peerId, false); // Mark as not finished for current question
            // Broadcast update? Potentially handled by PlayerListUpdated from WebRTCManager
            this._broadcastPlayerListUpdate(); // Send updated list
        } else {
            // Player might be rejoining? Update their data? For now, just log.
             console.log(`[MultiplayerGame Host] Player ${peerId} re-joined or already exists.`);
             // Ensure player list is accurate
             this._broadcastPlayerListUpdate();
        }
    }


    /** Handles a player leaving mid-game. @private */
    _handlePlayerLeft({ peerId }) {
         console.log(`[MultiplayerGame Host] Handling PlayerLeft event for peer: ${peerId}`);
         // Keep score for final results? Or remove completely? Let's keep for now.
         // this.playerScores.delete(peerId);
         this.playerFinished.delete(peerId); // Remove from current round tracking
         this.playerAnswers.delete(peerId);

         // Optional: Check if remaining players have all answered
         // Ensure game isn't over and a question is active
         if (!this.isGameOver && this.quizEngine.currentQuestionIndex >= 0) {
            // Check if the leaver was the *only* one left who hadn't answered
            const allAnsweredNow = this._hostCheckAllPlayersAnswered(); // Re-check after removing leaver's answer data
             if (allAnsweredNow && webRTCManager.getConnectedPeerIds().length > 0) { // Check if anyone is left
                 console.log(`[MultiplayerGame Host] Player left, remaining players have answered Q${this.quizEngine.currentQuestionIndex + 1}. Processing results early.`);
                 this.timer.stop(); // Stop the timer
                 this._hostProcessRoundResults(false);
                 setTimeout(() => this._hostNextQuestion(), 3000);
             } else if (!this.isGameOver) { // Check isGameOver again in case finishGame was called
                 // Broadcast updated player list if game hasn't ended and results weren't just processed
                 this._broadcastPlayerListUpdate();
             }
         } else if (!this.isGameOver) {
            // Broadcast player list update if game not over (e.g., player left before first question)
            this._broadcastPlayerListUpdate();
         }
         // Client UI update handled by PlayerListUpdated from WebRTCManager
    }

    /** [Host] Broadcasts the current full player list. @private */
    _broadcastPlayerListUpdate() {
        const currentPlayers = webRTCManager.getPlayerList();
        console.log("[MultiplayerGame Host] Broadcasting Player List Update:", currentPlayers);
        webRTCManager.broadcastMessage(MSG_TYPE.PLAYER_LIST_UPDATE, {
             players: Object.fromEntries(currentPlayers) // Send as object
         });
    }

    // Removed _resetLocalSubmissionState as it was client-focused

    /** Removes event listeners. @private */
    _cleanupListeners() {
         console.log("[MultiplayerGame Host] Cleaning up listeners.");
         // Use stored bound references for removal
         eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleWebRTCMessage);
         eventBus.off(Events.Multiplayer.Common.PlayerLeft, this._boundHandlePlayerLeft);
         eventBus.off(Events.Multiplayer.Common.PlayerJoined, this._boundHandlePlayerJoined);

         // Host listeners
         this.timer.off('tick', this._boundHostHandleTimerTick);
         this.timer.off('end', this._boundHostHandleTimeUp);
         // eventBus.off(Events.UI.GameArea.AnswerSubmitted, this._hostHandleSelfAnswerSubmitted); // If host plays

         // Nullify bound references after removing listeners
         this._boundHandleWebRTCMessage = null;
         this._boundHandlePlayerLeft = null;
         this._boundHandlePlayerJoined = null;
         this._boundHostHandleTimerTick = null;
         this._boundHostHandleTimeUp = null;
    }

    /** Call this when the game instance is no longer needed. */
    destroy() {
        console.log("[MultiplayerGame Host] Destroying game instance.");
        if (!this.isGameOver) {
             this.finishGame(); // Ensure game ends gracefully if destroyed early
        }
        this.timer.stop(); // Ensure timer is stopped
        this._cleanupListeners();
        // Release references
        this.quizEngine = null;
        this.timer = null;
        this.playerScores = null;
        this.playerFinished = null;
        this.playerAnswers = null;
    }
}

export default MultiplayerGame; 