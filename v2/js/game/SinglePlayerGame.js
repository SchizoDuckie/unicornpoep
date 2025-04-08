import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

import BaseGameMode from './BaseGameMode.js';
import Timer from '../core/timer.js';

// Difficulty to Timer Duration mapping (in milliseconds)
const DIFFICULTY_DURATIONS_MS = {
    easy: 60000,
    medium: 30000,
    hard: 10000,
};

// Constants for scoring
const BASE_SCORE = 10;
const MAX_TIME_BONUS = 50;

/**
 * Manages the state and logic for a single-player game session.
 * Extends BaseGameMode, adding timer and scoring functionality based on V1 logic.
 */
class SinglePlayerGame extends BaseGameMode {
    /**
     * Creates a single-player game instance.
     * @param {object} settings - Game settings.
     * @param {string[]} settings.sheetIds - Array of sheet IDs to use.
     * @param {'easy'|'medium'|'hard'|string} settings.difficulty - Difficulty level.
     * @param {string} playerName - The name of the player.
     */
    constructor(settings, playerName) {
        // Call BaseGameMode constructor with 'single' identifier and player name
        super('single', settings, playerName);
        console.log(`[SinglePlayerGame] Initialized for player: ${playerName}, difficulty: ${settings.difficulty}`);

        // Determine timer duration based on difficulty
        this.difficulty = settings.difficulty || 'medium'; // Default to medium if undefined
        const durationMs = DIFFICULTY_DURATIONS_MS[this.difficulty] || DIFFICULTY_DURATIONS_MS.medium;
        const durationSeconds = durationMs / 1000; // Convert MS to Seconds for Timer constructor

        // Pass duration in SECONDS to the Timer constructor
        this.timer = new Timer(durationSeconds); 
        this.score = 0;

        // Register timer-specific listeners IN ADDITION to base listeners
        this._registerTimerListeners();
        // Note: BaseGameMode constructor already called _registerBaseListeners
    }

    /** Registers timer-specific event listeners. @private */
    _registerTimerListeners() {
        this._boundHandleTimerTick = this._handleTimerTick.bind(this);
        this._boundHandleTimeUp = this._handleTimeUp.bind(this);
        this.timer.on('tick', this._boundHandleTimerTick);
        this.timer.on('end', this._boundHandleTimeUp);
        console.log(`[SinglePlayerGame] Registered timer listeners.`);
    }

    /** Handles timer ticks, emitting the TimeTick event. @private */
    _handleTimerTick(remainingTime) {
        eventBus.emit(Events.Game.TimeTick, { remainingTimeMs: remainingTime });
    }

    /**
     * Handles the timer running out for a question.
     * Emits TimeUp, treats as incorrect answer, and moves to next question.
     * @private
     */
    _handleTimeUp() {
        if (this.isFinished) return;
        const currentIndex = this.quizEngine.currentQuestionIndex;
        console.log(`[SinglePlayerGame] Time's up for question ${currentIndex + 1}`);
        eventBus.emit(Events.Game.TimeUp);

        // Treat time up as an incorrect answer
        this.lastAnswerCorrect = false; // Mark as answered (incorrectly)
        const correctAnswer = this.quizEngine.getCorrectAnswer(currentIndex);
        const scoreDelta = this._calculateScore(false); // Score delta is 0

        eventBus.emit(Events.Game.AnswerChecked, {
            isCorrect: false,
            scoreDelta: scoreDelta,
            correctAnswer: correctAnswer,
            submittedAnswer: null // Indicate time out
        });

        this._afterAnswerChecked(false, scoreDelta); // Update score (if needed, though delta is 0)

        // Automatically move to the next question after a short delay
        setTimeout(() => {
            if (!this.isFinished && this.lastAnswerCorrect !== null) {
                 this.nextQuestion();
            }
        }, 1500); // Delay to allow user to see result
    }

    // --- Implement BaseGameMode Hooks ---

    /** Stop timer before moving to the next question. @override @protected */
    _beforeNextQuestion() {
        this.timer.stop();
    }

    /** Reset and start timer after a new question is presented. @override @protected */
    _afterQuestionPresented() {
        this.timer.reset();
        this.timer.start();
    }

    /** Stop timer when an answer is submitted. @override @protected */
    _beforeAnswerCheck() {
        this.timer.stop();
    }

    /**
     * Update total score and emit ScoreUpdated event after answer check.
     * @override
     * @param {boolean} isCorrect - Whether the answer was correct.
     * @param {number} scoreDelta - The score change.
     * @protected
     */
    _afterAnswerChecked(isCorrect, scoreDelta) {
        this.score += scoreDelta;
        eventBus.emit(Events.Game.ScoreUpdated, { totalScore: this.score });
    }

    /** Stop timer before finishing the game. @override @protected */
    _beforeFinish() {
        this.timer.stop();
    }

    /**
     * Add the final score to the results object.
     * @override
     * @param {object} baseResults - Results from BaseGameMode.
     * @returns {object} The final results object including the score.
     * @protected
     */
    _getFinalResults(baseResults) {
        // Call super._getFinalResults if BaseGameMode might add things later
        // const results = super._getFinalResults(baseResults);
        return {
            ...baseResults, // Include base results (player, counts, settings)
            score: this.score // Add the final score
        };
    }

    /**
     * Cleans up base listeners and timer listeners.
     * @override
     * @protected
     */
    _cleanupListeners() {
        super._cleanupListeners(); // Clean up base listeners (AnswerSubmitted)

        // Clean up timer listeners
        if (this.timer) {
            if (this._boundHandleTimerTick) {
                this.timer.off('tick', this._boundHandleTimerTick);
                this._boundHandleTimerTick = null;
            }
            if (this._boundHandleTimeUp) {
                this.timer.off('end', this._boundHandleTimeUp);
                 this._boundHandleTimeUp = null;
            }
        }
         console.log("[SinglePlayerGame] Cleaned up timer listeners.");
    }

    /**
     * Destroys the game instance, ensuring timers are stopped and listeners cleaned.
     * @override
     */
    destroy() {
        console.log("[SinglePlayerGame] Destroying instance.");
        if (this.timer) {
            this.timer.stop(); // Ensure timer is stopped
        }
        super.destroy(); // Calls finishGame, base cleanup, nulls quizEngine
        this.timer = null; // Release timer reference
    }
}

export default SinglePlayerGame; 