import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

import BaseGameMode from './BaseGameMode.js';
import QuizEngine from '../services/QuizEngine.js';
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
 * Extends BaseGameMode, adding timer and scoring functionality.
 */
class SinglePlayerGame extends BaseGameMode {
    /**
     * Creates a single-player game instance.
     * @param {object} settings - Game settings.
     * @param {QuizEngine} quizEngineInstance - The QuizEngine instance to use.
     * @param {string} playerName - The name of the player.
     */
    constructor(settings, quizEngineInstance, playerName) {
        // Pass the QuizEngine instance to BaseGameMode constructor
        super('single', settings, quizEngineInstance, playerName);
        console.log(`[SinglePlayerGame] Initialized for player: ${playerName}, difficulty: ${settings.difficulty}`);

        // Determine timer duration based on difficulty
        this.difficulty = settings.difficulty || 'medium';
        const durationMs = DIFFICULTY_DURATIONS_MS[this.difficulty] || DIFFICULTY_DURATIONS_MS.medium;
        
        
        this.timer = new Timer(durationMs / 1000); 
        this.score = 0; // Score managed by BaseGameMode now via _afterAnswerChecked hook

        // Register timer-specific listeners IN ADDITION to base listeners
        this._registerTimerListeners();
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
        // Use the index tracked by the BaseGameMode instance
        const currentIndex = this.currentQuestionIndex; 
        console.log(`[SinglePlayerGame] Time's up for question ${currentIndex + 1}`);
        eventBus.emit(Events.Game.TimeUp);

        // Treat time up as an incorrect answer
        this.lastAnswerCorrect = false; // Mark as answered (incorrectly)
        // Get correct answer using the correct index
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