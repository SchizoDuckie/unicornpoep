import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

import BaseGameMode from './BaseGameMode.js';
import QuizEngine from '../services/QuizEngine.js';
import Timer from '../core/timer.js';
import highscoreManager from '../services/HighscoreManager.js';


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
     * @param {string} [mode='single'] - The game mode ('single' or 'practice').
     */
    constructor(settings, quizEngineInstance, playerName, mode = 'single') {
        // Pass the QuizEngine instance and mode to BaseGameMode constructor
        super(mode, settings, quizEngineInstance, playerName);
        console.log(`[SinglePlayerGame] Initialized for player: ${playerName}, mode: ${mode}, difficulty: ${settings.difficulty}`);

        // Store Highscore Manager
        this.highscoreManager = highscoreManager;

        // Determine timer duration based on difficulty
        this.difficulty = settings.difficulty || 'medium';
        const durationMs = BaseGameMode.DIFFICULTY_DURATIONS_MS[this.difficulty] || BaseGameMode.DIFFICULTY_DURATIONS_MS.medium;
        
        
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

    /** Handles timer ticks, emitting the TimeTick event. @private 
     * @event Events.Game.TimeTick
     */
    _handleTimerTick(remainingTime) {
        eventBus.emit(Events.Game.TimeTick, { remainingTimeMs: remainingTime });
    }

    /**
     * Handles the timer running out for a question.
     * Emits TimeUp, treats as incorrect answer, and moves to next question.
     * @private
     * @event Events.Game.TimeUp
     * @event Events.Game.AnswerChecked
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

    // --- ADDED: Override BaseGameMode hooks for Timer Control --- 

    /** Stop timer before moving to the next question. */
    _beforeNextQuestion() {
        // --- PRACTICE MODE: Don't interact with timer --- 
        if (this.mode !== 'practice') {
            this.timer.stop();
        }
    }

    /** Reset and start timer after a new question is presented. */
    _afterQuestionPresented() {
        // --- PRACTICE MODE: Don't interact with timer --- 
        if (this.mode !== 'practice') {
            this.timer.reset();
            this.timer.start();
        }
    }

    /** Stop timer when an answer is submitted. */
    _beforeAnswerCheck() {
        // --- PRACTICE MODE: Don't interact with timer --- 
        if (this.mode !== 'practice') {
            this.timer.stop();
        }
    }

    /** Stop timer before finishing the game. */
    _beforeFinish() {
        // --- PRACTICE MODE: Don't interact with timer --- 
        if (this.mode !== 'practice') {
            this.timer.stop();
        }
    }

    // --- End Overridden Hooks --- 

    /**
     * Add the final score to the results object.
     * @override
     * @param {object} baseResults - Results from BaseGameMode.
     * @returns {object} The final results object including the score.
     * @protected
     */
    _getFinalResults(baseResults) {
        // 1. Generate Game Name
        const gameName = this.settings.sheetIds && this.settings.sheetIds.length > 0
            ? this.settings.sheetIds.join(', ')
            : "Onbekende Oefening"; 

        // 2. Check Highscore Eligibility - **DISABLE FOR PRACTICE MODE**
        let isEligible = false;
        if (this.mode !== 'practice') { // Only check if NOT practice mode
            try {
                const scoreToCheck = this.score; // Use the current score
                if (typeof this.highscoreManager.isNewHighScore === 'function') {
                     isEligible = this.highscoreManager.isNewHighScore(
                         gameName,
                         this.difficulty,
                         scoreToCheck
                     );
                } else {
                    console.error("[SinglePlayerGame] HighscoreManager or isNewHighScore method missing!");
                }
            } catch (error) {
                 console.error("[SinglePlayerGame] Error checking highscore eligibility:", error);
            }
        }

        // 3. Construct final results, merging with base and adding single-player specific data
        return {
            ...baseResults, // Include base results (player, counts, settings)
            score: this.score, // Ensure final score is included
            gameName: gameName,
            difficulty: this.difficulty,
            eligibleForHighscore: isEligible, // Will be false if mode is 'practice'
            mode: this.mode // Explicitly set mode for clarity in results payload
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

    /**
     * Overrides BaseGameMode.finishGame to handle single-player specific logic
     * (highscore eligibility check) and emit the navigation event for its end dialog.
     * @override
     * @event Events.Navigation.ShowView
     */
    finishGame() {
        if (this.isFinished) return;
        console.log(`[SinglePlayerGame] Finishing game...`);
        
        // BaseGameMode.finishGame now handles calculating results via _getFinalResults
        super.finishGame(); 
    }
}

export default SinglePlayerGame; 