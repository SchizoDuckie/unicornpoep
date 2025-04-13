import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


// REMOVED: Singleton import
// import QuizEngine from '../services/QuizEngine.js'; 

// --- Constants for scoring (moved from SinglePlayerGame) ---
const BASE_SCORE = 10;
const MAX_TIME_BONUS = 50;

/**
 * Provides the base structure and common logic for different game modes.
 * Handles interaction with an **injected QuizEngine instance**, basic game flow,
 * and common event emissions.
 * 
 * **Important:** This base class assumes subclasses (like SinglePlayerGame or MultiplayerGame)
 * will:
 * 1. Instantiate a `this.timer` object (e.g., using `core/timer.js`) in their constructor,
 *    setting its `initialDurationMs` based on game settings (like difficulty).
 * 2. Implement the necessary hooks (_beforeNextQuestion, _afterQuestionPresented, etc.)
 *    to correctly start, stop, and reset `this.timer` during the game flow.
 * 
 * The `_calculateScore` method relies on `this.timer.initialDurationMs` and
 * `this.timer.getElapsedTime()` to calculate time-based bonuses, indirectly
 * incorporating difficulty through the timer's configuration set by the subclass.
 */
class BaseGameMode {
    /**
     * @param {string} modeIdentifier - A string identifying the mode.
     * @param {object} settings - Game settings specific to the mode.
     * @param {QuizEngine} quizEngineInstance - An initialized QuizEngine instance.
     * @param {string} [playerName] - Optional player name.
     */
    constructor(modeIdentifier, settings, quizEngineInstance, playerName = 'Player') {
        if (!quizEngineInstance) {
             throw new Error("[BaseGameMode] Constructor requires a valid QuizEngine instance.");
        }
        console.log(`[BaseGameMode:${modeIdentifier}] Initializing with settings:`, settings, `Player: ${playerName}`);
        this.mode = modeIdentifier;
        this.settings = settings;
        this.playerName = playerName;
        this.quizEngine = quizEngineInstance; // Use the injected instance
        this.isFinished = false;
        this.lastAnswerCorrect = null; // Used for delaying next question after feedback
        this._boundHandleAnswerSubmitted = null; // Store bound listener
        this.currentQuestionIndex = -1; // Initialize index tracking
        this.score = 0; // +++ Initialize score +++
        this._nextQuestionTimeoutId = null; // ID for the delayed nextQuestion call

        this._registerBaseListeners();
    }

    /**
     * Registers listeners common to all game modes.
     * Subclasses should call super._registerBaseListeners() if they override this,
     * or provide their own specific listener registration.
     * @protected
     */
    _registerBaseListeners() {
        // Listen for answer submission from UI
        this._boundHandleAnswerSubmitted = this._handleAnswerSubmitted.bind(this);
        eventBus.on(Events.UI.GameArea.AnswerSubmitted, this._boundHandleAnswerSubmitted);
        console.log(`[BaseGameMode:${this.mode}] Registered base listeners.`);
    }

    /**
     * Starts the game by loading questions (using the injected engine's method) 
     * and presenting the first one.
     * Emits Game.Started on success or System.ErrorOccurred on failure.
     */
    async start() {
        console.log(`[BaseGameMode:${this.mode}] Starting game...`);
        try {
            // Load questions using the INSTANCE's specific loading method
            // Host will use loadQuestionsFromManager, Client instance is pre-loaded
            // We might need a more abstract `initializeEngine` method here
            // For now, assume the engine passed to constructor is ready
            if (typeof this.quizEngine.loadQuestionsFromManager === 'function' && this.settings.sheetIds) {
                 // If host-like settings and method exists, load via manager
                 await this.quizEngine.loadQuestionsFromManager(this.settings.sheetIds, this.settings.difficulty);
             }
            // If it's a client instance from createInstance, questions are already loaded.
            
            if (this.quizEngine.getQuestionCount() === 0) {
                throw new Error("Quiz engine has no questions loaded.");
            }
            this.isFinished = false;
            this.lastAnswerCorrect = null;
            // Emit game started event
            // Add total questions to settings if not present
            const gameSettings = { 
                 ...this.settings,
                 totalQuestions: this.quizEngine.getQuestionCount()
             };
            eventBus.emit(Events.Game.Started, { mode: this.mode, settings: gameSettings, role: 'player' });
            // Load the first question
            this.nextQuestion();
        } catch (error) {
            console.error(`[BaseGameMode:${this.mode}] Error starting game:`, error);
            eventBus.emit(Events.System.ErrorOccurred, {
                message: `Error starting ${this.mode} game: ${error.message}`,
                error,
                context: `${this.mode}-game-start`
            });
            this.finishGame(); // Ensure game ends if start fails
        }
    }

    /**
     * Handles moving to the next question or finishing the game.
     * Uses the injected this.quizEngine instance.
     */
    nextQuestion() {
        if (this.isFinished) return;
        this._beforeNextQuestion();
        this.lastAnswerCorrect = null;
        const nextIndex = this.currentQuestionIndex + 1;

        // Use the INSTANCE
        if (this.quizEngine.isQuizComplete(nextIndex)) {
            this.finishGame();
        } else {
            // Use the INSTANCE
            const questionData = this.quizEngine.getQuestionData(nextIndex);
            if (questionData) {
                this.currentQuestionIndex = nextIndex;
                // Use the INSTANCE
                const totalQuestions = this.quizEngine.getQuestionCount();
                console.log(`[BaseGameMode:${this.mode}] Presenting question ${this.currentQuestionIndex + 1}/${totalQuestions}`);
                eventBus.emit(Events.Game.QuestionNew, {
                    questionIndex: this.currentQuestionIndex,
                    totalQuestions: totalQuestions,
                    questionData: {
                        question: questionData.question,
                        // Use the INSTANCE
                        answers: this.quizEngine.getShuffledAnswers(this.currentQuestionIndex)
                    }
                });
                this._afterQuestionPresented();
            } else {
                console.error(`[BaseGameMode:${this.mode}] Could not retrieve question data for index ${nextIndex}`);
                this.finishGame();
            }
        }
    }

    /**
     * Handles the player submitting an answer. Checks the answer using the
     * injected this.quizEngine instance.
     * Emits Game.AnswerChecked, and triggers the next question sequence.
     * Subclasses can override _calculateScore and _afterAnswerChecked.
     * @param {object} payload
     * @param {any} payload.answer - The submitted answer.
     * @protected
     */
    _handleAnswerSubmitted(answer) {
        if (this.isFinished || this.lastAnswerCorrect !== null) {
            console.log(`[BaseGameMode:${this.mode}] Ignoring answer submission (finished or already answered).`);
            return; // Ignore if game is over or already processed
        }
        const currentIndex = this.currentQuestionIndex;
        if (currentIndex < 0) return; // Ignore if no question active

        console.log(`[BaseGameMode:${this.mode}] Answer submitted for question ${currentIndex + 1}:`, answer);
        this._beforeAnswerCheck();

        // Use the INSTANCE
        const checkResult = this.quizEngine.checkAnswer(currentIndex, answer.answer);
        this.lastAnswerCorrect = checkResult.isCorrect;
        const scoreDelta = this._calculateScore(checkResult.isCorrect);

        eventBus.emit(Events.Game.AnswerChecked, {
            isCorrect: checkResult.isCorrect,
            scoreDelta: scoreDelta,
            correctAnswer: checkResult.correctAnswer,
            submittedAnswer: answer
        });

        this._afterAnswerChecked(checkResult.isCorrect, scoreDelta);

        // Clear any pending timeout from a rapid previous answer (unlikely but safe)
        if (this._nextQuestionTimeoutId) {
            clearTimeout(this._nextQuestionTimeoutId);
            this._nextQuestionTimeoutId = null;
        }

        // Delay moving to the next question to allow feedback display
        // *** ALWAYS schedule this in the base class ***
        this._nextQuestionTimeoutId = setTimeout(() => {
            this._nextQuestionTimeoutId = null; // Clear the ID now that the timeout is running
            // Check if engine still exists, game isn't finished *now*, and an answer was processed
            if (this.quizEngine && !this.isFinished && this.lastAnswerCorrect !== null) {
                 this.nextQuestion();
            } else {
                 console.log(`[BaseGameMode:${this.mode}] Skipping nextQuestion call after delay (game finished or state invalid).`);
            }
        }, 1500); // Standard delay
    }

    /**
     * Finishes the game, calculates results using the injected this.quizEngine instance,
     * emits Game.Finished, and cleans up listeners.
     */
    finishGame() {
        if (this.isFinished) return;
        console.log(`[BaseGameMode:${this.mode}] Finishing game...`);
        this.isFinished = true;
        this._beforeFinish();

        // Use the INSTANCE for counts
        const score = this._getFinalResults({}).score ?? this.quizEngine.getCorrectCount() * BASE_SCORE;
        const isEligible = score > 0;

        const baseResults = {
            playerName: this.playerName,
            // Use the INSTANCE
            totalQuestions: this.quizEngine.getQuestionCount(),
            // Use the INSTANCE
            correctAnswers: this.quizEngine.getCorrectCount(),
            settings: this.settings,
            score: score,
            eligibleForHighscore: isEligible
        };

        const finalResults = this._getFinalResults(baseResults);

        console.log(`[BaseGameMode:${this.mode}] Final Results:`, finalResults);
        eventBus.emit(Events.Game.Finished, { mode: this.mode, results: finalResults });

        this._cleanupListeners();
    }

    /**
     * Cleans up event listeners registered by this base class.
     * Subclasses overriding this should call super._cleanupListeners().
     * @protected
     */
    _cleanupListeners() {
        if (this._boundHandleAnswerSubmitted) {
            eventBus.off(Events.UI.GameArea.AnswerSubmitted, this._boundHandleAnswerSubmitted);
            this._boundHandleAnswerSubmitted = null;
            console.log(`[BaseGameMode:${this.mode}] Cleaned up AnswerSubmitted listener.`);
        } else {
             console.log(`[BaseGameMode:${this.mode}] No stored AnswerSubmitted listener reference to clean up.`);
        }
        // Subclasses should remove their specific listeners here or in their own cleanup
    }

    /**
     * Destroys the game mode instance, ensuring cleanup.
     */
    destroy() {
        console.log(`[BaseGameMode:${this.mode}] Destroying instance.`);
        
        // --- Ensure listeners are always cleaned up --- 
        this._cleanupListeners();
        // --- End Ensure ---
        
        this.quizEngine = null; // Release reference
        // Any other subclass-specific cleanup should happen before/after super.destroy()
    }

    // --- Hooks for Subclasses --- 

    /** Hook called before checking the next question index. (e.g., stop timer) @protected */
    _beforeNextQuestion() { }

    /** Hook called after a new question is presented. (e.g., start timer) @protected */
    _afterQuestionPresented() { }

    /** Hook called before the submitted answer is checked. (e.g., stop timer) @protected */
    _beforeAnswerCheck() { }

    /**
     * Hook to calculate score delta for an answer. Base implementation provides time bonus.
     *
     * **How Scoring Works:**
     * - **Base Score:** You get 10 points for a correct answer.
     * - **Time Bonus:** You get up to 50 *extra* points based on how fast you answer.
     * - **Difficulty:** Difficulty (set by the specific game mode like SinglePlayerGame)
     *   determines the total time allowed per question (via `this.timer.initialDurationMs`).
     *   Answering quickly on a *harder* difficulty (less total time) gives a proportionally
     *   *larger* time bonus than answering in the same absolute time on an easier difficulty.
     *   The bonus is calculated based on the percentage of the allowed time remaining.
     *
     * @param {boolean} isCorrect - Whether the answer was correct.
     * @param {number} [elapsedMs] - Optional: The elapsed time in MS for score calculation (used by MP Host).
     *                              If not provided, the method attempts to use `this.timer.getElapsedTime()`.
     * @returns {number} The score change (BASE_SCORE + time bonus for correct, 0 otherwise).
     * @protected
     */
    _calculateScore(isCorrect, elapsedMs = null) {
        if (!isCorrect) {
            return 0;
        }

        let timeToUseMs = elapsedMs;
        if (timeToUseMs === null && this.timer && typeof this.timer.getElapsedTime === 'function') {
            timeToUseMs = this.timer.getElapsedTime();
        } else if (timeToUseMs === null) {
            console.log(`[BaseGameMode:${this.mode}] Score Calc: Correct! No timer/elapsed time found. Awarding base score.`);
            return BASE_SCORE;
        }

        if (this.timer && this.timer.durationMs > 0) { 
            const durationMs = this.timer.durationMs;

            if (durationMs > 0 && timeToUseMs >= 0) {
                 const elapsedSec = timeToUseMs / 1000;
                 const durationSec = durationMs / 1000;
                 const timeFactor = Math.max(0, 1 - (elapsedSec / durationSec));
                 const timeBonus = Math.round(MAX_TIME_BONUS * timeFactor);
                 const totalScoreDelta = BASE_SCORE + timeBonus;
                 console.log(`[BaseGameMode:${this.mode}] Score Calc: Correct! elapsed=${elapsedSec.toFixed(2)}s, duration=${durationSec}s, factor=${timeFactor.toFixed(2)}, bonus=${timeBonus}, totalDelta=${totalScoreDelta}`);
                 return totalScoreDelta;
            } else {
                 console.warn(`[BaseGameMode:${this.mode}] Score Calc: Correct, but durationMs (${durationMs}) or elapsedMs (${timeToUseMs}) invalid. Awarding base score.`);
                 return BASE_SCORE;
            }
        } else {
            console.log(`[BaseGameMode:${this.mode}] Score Calc: Correct! No timer or timer duration (durationMs) found. Awarding base score.`); 
            return BASE_SCORE;
        }
    }

    /**
     * Hook called after an answer has been checked and Game.AnswerChecked emitted.
     * @param {boolean} isCorrect - Whether the answer was correct.
     * @param {number} scoreDelta - The score change calculated by _calculateScore.
     * @protected
     */
    _afterAnswerChecked(isCorrect, scoreDelta) { 
        console.log("[Afteranswerchecked!]", arguments)
        // Update the total score
        if (scoreDelta > 0) {
            this.score += scoreDelta;
            console.log(`[BaseGameMode:${this.mode}] Score updated. New score: ${this.score} (Delta: ${scoreDelta})`);
            // Emit event for UI update
            eventBus.emit(Events.Game.ScoreUpdated, { 
                playerName: this.playerName,
                newScore: this.score, 
                delta: scoreDelta 
            });
        }
    }

    /** Hook called before the Game.Finished event is emitted. (e.g., stop timers) @protected */
    _beforeFinish() { }

    /**
     * Hook to allow subclasses to add mode-specific data to the final results object.
     * @param {object} baseResults - Results object containing common data.
     * @returns {object} The final results object.
     * @protected
     */
    _getFinalResults(baseResults) {
        return baseResults; // Base implementation returns results as is
    }

    /** Hook called after the game is finished and results are calculated/emitted. @protected */
    _afterFinish(finalResults) { }
}

export default BaseGameMode; 