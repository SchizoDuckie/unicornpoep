import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import BaseGameMode from './BaseGameMode.js';
import QuizEngine from '../services/QuizEngine.js';
import Timer from '../core/timer.js';
import { MSG_TYPE } from '../core/message-types.js';
// Removed direct import of WebRTCManager - use events
import miscUtils from '../utils/miscUtils.js';
import uiManager from '../ui/UIManager.js';
import Views from '../core/view-constants.js';

/**
 * Manages the state and logic for a multiplayer game session from the client's perspective.
 * Extends BaseGameMode.
 * - Initializes game with data received from the host.
 * - Handles local gameplay (questions, answers, timer) based on QuizEngine.
 * - Sends answers and finish status to the host.
 * - Receives game over / final results from the host.
 * @typedef {import('../services/WebRTCManager.js').PlayerData} PlayerData
 */
class MultiplayerClientGame extends BaseGameMode {
    /**
     * Creates an instance of MultiplayerClientGame.
     * @param {object} settings - Game settings received from host (currently just { difficulty }).
     * @param {QuizEngine} quizEngineInstance - An initialized QuizEngine instance with questions from host.
     * @param {string} localPlayerName - The name of the local player.
     * @param {string} hostPeerId - The PeerJS ID of the host to send messages to.
     */
    constructor(settings, quizEngineInstance, localPlayerName, hostPeerId) {
        super('multiplayer-client', settings, quizEngineInstance, localPlayerName);

        console.log(`[MultiplayerClientGame] Initializing with host data.`);
        this.hostPeerId = hostPeerId;
        this.difficulty = settings.difficulty || 'medium';
        this._hasEmittedLocalFinished = false; // Track if finished event was sent

        // Client needs a timer for gameplay
        const clientDurationMs = BaseGameMode.DIFFICULTY_DURATIONS_MS[this.difficulty] || BaseGameMode.DIFFICULTY_DURATIONS_MS.medium;
        this.timer = new Timer(clientDurationMs / 1000);
        
        this._registerClientListeners();
        this._registerTimerListeners(); // Register timer listeners for client gameplay

        console.log("[MultiplayerClientGame] Client Initialized.");
    }

    /** [Client Only] Registers client-specific listeners for host messages. @private */
    _registerClientListeners() {
        this._boundHandleWebRTCMessage_Client = this._handleWebRTCMessage_Client.bind(this);
        eventBus.on(Events.WebRTC.MessageReceived, this._boundHandleWebRTCMessage_Client);
        
        // Listen for the game over command event from the MultiplayerClientManager
        this._boundHandleGameOverMessage = this._handleGameOverMessage.bind(this);
        eventBus.on(Events.Multiplayer.Client.GameOverCommandReceived, this._boundHandleGameOverMessage);
        
        console.log(`[MultiplayerClientGame] Registered client message listeners.`);
    }

    /** [Client Only] Registers timer-specific event listeners. @private */
    _registerTimerListeners() {
        if (!this.timer) return;
        this._boundHandleTimerTick = this._handleTimerTick.bind(this);
        this._boundHandleTimeUp = this._handleTimeUp.bind(this);
        this.timer.on('tick', this._boundHandleTimerTick);
        this.timer.on('end', this._boundHandleTimeUp);
        console.log(`[MultiplayerClientGame] Registered timer listeners.`);
    }

    /** [Client Only] Handles timer ticks, emitting the TimeTick event. @private 
     * @event Events.Game.TimeTick
     */
    _handleTimerTick(remainingTimeMs) {
        if (this.isFinished) return;
        eventBus.emit(Events.Game.TimeTick, { remainingTimeMs: remainingTimeMs });
    }

    /** [Client Only] Handles the timer running out. @private 
     * @event Events.Game.TimeUp
     * @event Events.Game.AnswerChecked
     */
    _handleTimeUp() {
        if (this.isFinished || this.lastAnswerCorrect !== null) return; 

        const currentIndex = this.currentQuestionIndex;
        console.log(`[MultiplayerClientGame] Time's up for question ${currentIndex + 1}`);
        eventBus.emit(Events.Game.TimeUp);
        
        const correctAnswer = this.quizEngine.getCorrectAnswer(currentIndex);
        const scoreDelta = this._calculateScore(false); 

        this.lastAnswerCorrect = false; 

        eventBus.emit(Events.Game.AnswerChecked, {
            isCorrect: false,
            scoreDelta: scoreDelta,
            correctAnswer: correctAnswer,
            submittedAnswer: null 
        });
        this._afterAnswerChecked(false, scoreDelta); 
        
        setTimeout(() => { if (!this.isFinished) { this.nextQuestion(); } }, 1500);
    }

    /** 
     * [Client Only] Handles messages received from the host via WebRTC.
     * @param {object} params
     * @param {object} params.msg - The message object.
     * @param {string} params.sender - PeerJS ID of the sender (should be hostPeerId).
     * @private 
     */
    _handleWebRTCMessage_Client({ msg, sender }) {
        if (this.isFinished) return; // Ignore messages if game already finished locally

        if (sender !== this.hostPeerId) {
            console.warn(`[MultiplayerClientGame] Ignoring message from non-host sender: ${sender}`);
            return;
        }

        if (!msg || typeof msg.type !== 'string') {
             console.warn(`[MultiplayerClientGame] Received invalid message structure from host ${sender}. Ignoring.`, msg);
             return;
        }

        const { type, payload } = msg;

        switch (type) {
            case MSG_TYPE.GAME_START:
                 console.log("[MultiplayerClientGame] Received GAME_START from host.");
                 this.start(); // Trigger the actual start of gameplay
                 break;

            case MSG_TYPE.GAME_OVER:
                console.log("[MultiplayerClientGame] Received GAME_OVER from host.", payload);
                this._handleGameOverMessage(payload);
                break;

            case MSG_TYPE.H_PLAYER_SCORES_UPDATE:
                {
                    // Process the updated scores format which now includes player data
                    const receivedScores = payload || {};
                    console.log("[MultiplayerClientGame] Received player scores update:", receivedScores);
                    
                    // Convert the received scores to a format our UI can handle
                    const scoresMap = new Map();
                    Object.entries(receivedScores).forEach(([peerId, playerData]) => {
                        if (playerData) {
                            // Handle both old format (direct score) and new format (object with score property)
                            const score = typeof playerData === 'object' ? 
                                (playerData.score === null ? 0 : playerData.score) : 
                                (playerData === null ? 0 : playerData);
                            
                            console.log(`[MultiplayerClientGame] Processing score for ${peerId}: ${score} (from ${JSON.stringify(playerData)})`);
                            scoresMap.set(peerId, score);
                        }
                    });
                    
                    this.playerScores = scoresMap;
                    
                    // Log the final processed scores
                    console.log("[MultiplayerClientGame] Final processed scores:", Object.fromEntries(scoresMap));
                    
                    // Emit an event that PlayerListComponent listens to for updates
                    eventBus.emit(Events.Game.ScoreUpdated, { scores: scoresMap });
                    eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: receivedScores });
                }
                break;

            default:
                console.log(`[MultiplayerClientGame] Ignoring unhandled message type '${type}' from host ${sender}`);
        }
    }

    /**
     * [Client Only] Handles the GAME_OVER message from the host or the GameOverCommandReceived event.
     * @param {object} payload - The message payload or event data. Expected to contain `results` property.
     * @private
     * @event Events.Game.Finished Emitted locally after processing game over.
     */
     _handleGameOverMessage(payload) {
        if (this.isFinished) return; // Prevent finishing multiple times
        console.log("[MultiplayerClientGame] Processing GAME_OVER message or event.", payload);
        // Mark finished and clean up immediately
        this.finishGame(); // Call the consolidated cleanup method
        
        // Extract results from the payload (could be direct message or event data)
        const resultsPayload = payload && payload.results ? payload.results : payload;
        if (!resultsPayload) {
            console.error("[MultiplayerClientGame] Received GAME_OVER but payload is missing or invalid.", payload);
            // Potentially show a generic error dialog
            uiManager.showDialog(Views.ErrorDialog, { 
                title: 'Game Over Error', 
                message: 'Received incomplete game results from the host.' 
            });
            eventBus.emit(Events.Game.Finished, { mode: this.mode, results: null }); // Emit finish with null results
            return;
        }
        
        // Use the received results payload directly
        const finalResults = {
            ...resultsPayload, // Contains rankings, mode, settings from host
            localPlayerScore: this.score // Add local player's final score for convenience
        };
        
        console.log("[MultiplayerClientGame] Final Results (from host):", finalResults);

        // ---> MODIFIED: Use uiManager.showDialog <--- 
        console.log(`[MultiplayerClientGame] Requesting UIManager show Multiplayer End Dialog.`);
        uiManager.showDialog(Views.MultiplayerEndDialog, finalResults);
        // ---> END MODIFIED SECTION <--- 

        // Emit the Game.Finished event locally (Coordinator might use this for final cleanup)
        eventBus.emit(Events.Game.Finished, { mode: this.mode, results: finalResults });

        // No need for _cleanupListeners() here, finishGame handles it.
    }

    /** [Client Only] Cleans up client-specific listeners. @private */
    _cleanupClientListeners() {
        eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleWebRTCMessage_Client);
        // Unregister the game over command listener as well
        eventBus.off(Events.Multiplayer.Client.GameOverCommandReceived, this._boundHandleGameOverMessage);
        console.log("[MultiplayerClientGame] Cleaned up client listeners.");
    }
    
    /** [Client Only] Cleans up timer listeners. @private */
    _cleanupTimerListeners() {
        if (!this.timer) return;
        this.timer.off('tick', this._boundHandleTimerTick);
        this.timer.off('end', this._boundHandleTimeUp);
        console.log("[MultiplayerClientGame] Cleaned up timer listeners.");
    }

     // --- Overridden BaseGameMode Methods ---

    /** Starts the multiplayer game (Client). 
     * @event Events.Game.Started
     */
    async start() {
        if (this.isStarted || this.isFinished) {
             console.warn("[MultiplayerClientGame] Start called but game already started or finished.");
             return;
         }
        console.log("[MultiplayerClientGame] Starting game...");
        this.isStarted = true;
        // Client starts the timer and presents the first question locally.
        this.timer.start();
        this.nextQuestion(); // FIXED: Use the correct method name from BaseGameMode
        
        eventBus.emit(Events.Game.Started, { 
            mode: this.mode, 
            settings: this.settings, 
            timer: this.timer // Include the timer instance
        });
        console.log("[MultiplayerClientGame] Game Started event emitted.");
    }

    /** 
     * Hook called after an answer is checked (Client). 
     * Sends the result to the host.
     * @event Events.Multiplayer.Common.SendMessage
     */
    _afterAnswerChecked(isCorrect, scoreDelta) {
        super._afterAnswerChecked(isCorrect, scoreDelta); // Update local score
        
        // Send score update to host after every answer
        console.log(`[MultiplayerClientGame] Answer checked. New local score: ${this.score}. Sending update to host.`);
        try {
             eventBus.emit(Events.Multiplayer.Common.SendMessage, { 
                type: MSG_TYPE.C_SCORE_UPDATE,
                payload: { score: this.score },
                recipient: this.hostPeerId
            });
             // Note: The check for quiz completion and sending CLIENT_FINISHED 
             // happens in _beforeFinish now, triggered by BaseGameMode's standard flow
             // or _handleTimeUp when the last question times out.
             // This keeps the logic flow closer to BaseGameMode standards.
        } catch (error) {
            console.error("[MultiplayerClientGame] Error sending score update:", error);
            eventBus.emit(Events.System.ShowFeedback, { message: 'Error sending update to host.', level: 'warning' });
        }
    }

    /** Hook called before finishing the game (Client). 
     * @event Events.Multiplayer.Common.SendMessage
     */
    _beforeFinish() {
        super._beforeFinish(); // Includes stopping timer
        if (!this._hasEmittedLocalFinished) {
             // Send CLIENT_FINISHED message to host with final score
             // This confirms the client has completed all questions or timed out.
             console.log(`[MultiplayerClientGame] Sending CLIENT_FINISHED to host. Final Score: ${this.score}`);
             eventBus.emit(Events.Multiplayer.Common.SendMessage, { 
                type: MSG_TYPE.CLIENT_FINISHED,
                payload: { score: this.score },
                recipient: this.hostPeerId
            });
            this._hasEmittedLocalFinished = true;
            
            // Emit LocalPlayerFinished for coordinator/UI updates
             eventBus.emit(Events.Game.LocalPlayerFinished, { score: this.score });
        }
    }

    /**
     * Finalizes the game state, cleans up listeners, and stops the timer.
     * Emits the LocalPlayerFinished event BEFORE cleaning up.
     * @override
     */
    finishGame() {
        if (this.isFinished) return;
        console.log("[MultiplayerClientGame] finishGame called (likely via GAME_OVER or local completion timeout). Cleaning up...");

        // --- MOVED EVENT EMISSION HERE ---
        if (!this._hasEmittedLocalFinished) {
            console.log(`[MultiplayerClientGame] Emitting LocalPlayerFinished event. Score: ${this.score}`);
            eventBus.emit(Events.Game.LocalPlayerFinished, { score: this.score });
            
            // ---> ADDED: Send CLIENT_FINISHED message to host <--- 
            eventBus.emit(Events.Multiplayer.Common.SendMessage, { 
                type: MSG_TYPE.CLIENT_FINISHED, 
                payload: { score: this.score },
                recipient: this.hostPeerId // Ensure it's sent only to the host
            });
            
            this._hasEmittedLocalFinished = true;
        }
        // ---------------------------------

        this.isFinished = true; // Mark as finished *after* emitting local finish event
        this.timer.stop();
        this._cleanupListeners(); // Now cleanup listeners
        
        // Note: The final Game.Finished event for clients is typically triggered 
        // by receiving GAME_OVER from the host, handled in _handleGameOverMessage.
    }

    /** Cleans up all listeners (base, client, timer). @private @override */
    _cleanupListeners() {
        super._cleanupListeners(); // Call base cleanup
        this._cleanupClientListeners();
        this._cleanupTimerListeners();
    }

    /**
     * Overrides the BaseGameMode's nextQuestion method to add fallback for missing methods.
     * This ensures the game can continue even if the QuizEngine lacks expected methods.
     */
    nextQuestion() {
        super.nextQuestion(); // Revert to base implementation
    }
}

export default MultiplayerClientGame; 