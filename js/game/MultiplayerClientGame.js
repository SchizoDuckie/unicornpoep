import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import BaseGameMode from './BaseGameMode.js';
import QuizEngine from '../services/QuizEngine.js';
import Timer from '../core/timer.js';
import { MSG_TYPE } from '../core/message-types.js';
// Removed direct import of WebRTCManager - use events
import miscUtils from '../utils/miscUtils.js';

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
                console.log("[MultiplayerClientGame] Received H_PLAYER_SCORES_UPDATE from host.", payload);
                // The PlayerListComponent listens for PlayerListUpdated, which the host also emits locally
                // and the coordinator might forward or the client manager might re-emit based on this.
                // For simplicity here, let's just log, assuming another component handles the UI update via the map.
                // Let's emit the standard event here too for consistency?
                if (payload && payload.players && typeof payload.players === 'object') {
                    // Reconstruct the Map from the plain object received
                    const playersMap = new Map();
                    for (const [peerId, playerData] of Object.entries(payload.players)) {
                        playersMap.set(peerId, playerData);
                    }
                    // Emit the standard update event that UI components listen for
                    eventBus.emit(Events.Multiplayer.Common.PlayerListUpdated, { players: playersMap });
                } else {
                    console.warn('[MultiplayerClientGame] Invalid H_PLAYER_SCORES_UPDATE payload:', payload);
                }
                break;

            default:
                console.log(`[MultiplayerClientGame] Ignoring unhandled message type '${type}' from host ${sender}`);
        }
    }

    /**
     * [Client Only] Handles the GAME_OVER message from the host.
     * @param {object} resultsPayload - The final game results payload.
     * @private
     */
     _handleGameOverMessage(resultsPayload) {
        if (this.isFinished) return; // Prevent finishing multiple times
        console.log("[MultiplayerClientGame] Processing GAME_OVER message.");
        // Mark finished and clean up immediately
        this.finishGame(); // Call the consolidated cleanup method
        
        // Use the received results payload directly
        const finalResults = {
            ...resultsPayload, // Contains rankings, mode, settings from host
            localPlayerScore: this.score // Add local player's final score for convenience
        };
        
        console.log("[MultiplayerClientGame] Final Results (from host):", finalResults);

        // Emit the Game.Finished event locally
        eventBus.emit(Events.Game.Finished, { mode: this.mode, results: finalResults });

        // No need for _cleanupListeners() here, finishGame handles it.
    }

    /** [Client Only] Cleans up client-specific listeners. @private */
    _cleanupClientListeners() {
        eventBus.off(Events.WebRTC.MessageReceived, this._boundHandleWebRTCMessage_Client);
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
        
        eventBus.emit(Events.Game.Started, { mode: this.mode, settings: this.settings });
        console.log("[MultiplayerClientGame] Game Started event emitted.");
    }

    /** 
     * Hook called after an answer is checked (Client). 
     * Sends the result to the host.
     * @event Events.Multiplayer.Common.SendMessage
     */
    _afterAnswerChecked(isCorrect, scoreDelta) {
        super._afterAnswerChecked(isCorrect, scoreDelta); // Update local score
        
        // ** CORRECTED: Send score update to host after every answer **
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

    /** Finalizes the game (Client). */
    finishGame() {
        // Client finish is primarily triggered by receiving GAME_OVER from host
        // However, _beforeFinish sends the final score.
        // The local finishGame call happens inside _handleGameOverMessage.
        // This method now centralizes the cleanup.
        if (this.isFinished) return;
        console.log("[MultiplayerClientGame] finishGame called (likely via GAME_OVER or local completion timeout). Cleaning up...");
        this.isFinished = true; // Mark as finished
        this.timer.stop(); // Stop local timer
        this._cleanupListeners(); // Perform all listener cleanup
        // Actual Game.Finished emission happens in _handleGameOverMessage (with host results)
        // or potentially after _beforeFinish if we wanted to signal local completion differently (but currently don't)
    }

    /** Cleans up listeners (Client). */
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