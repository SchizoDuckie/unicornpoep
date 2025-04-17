import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

// Difficulty to Timer Duration mapping (in milliseconds)




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
     * Difficulty to Timer Duration mapping (in milliseconds)
     * @type {Object}
     * @property {number} easy - Duration for easy difficulty
     * @property {number} medium - Duration for medium difficulty
     * @property {number} hard - Duration for hard difficulty
     */
    static DIFFICULTY_DURATIONS_MS = {
        easy: 60000,
        medium: 30000,
        hard: 10000,
    }

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
            await this.quizEngine.loadQuestionsFromManager(this.settings.sheetIds, this.settings.difficulty);
            
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
     * Advances to the next question or finishes the game if complete.
     * Emits Events.Game.QuestionNew or calls finishGame().
     * @protected
     */
    nextQuestion() {
        if (this.isFinished) return;

        this._beforeNextQuestion(); // Hook for subclasses
        this.lastAnswerCorrect = null;
        const nextIndex = this.currentQuestionIndex + 1;

        // --- Rely ONLY on methods defined in QuizEngine ---
        const totalQuestions = this.quizEngine.getQuestionCount(); // Assumes this.quizEngine is a valid instance

        if (nextIndex >= totalQuestions) {
            console.log(`[${this.mode}] Reached end of questions (Index: ${nextIndex}, Total: ${totalQuestions}). Finishing game.`);
            this.finishGame();
        } else {
            try {
                const questionData = this.quizEngine.getQuestionData(nextIndex);
                if (!questionData) {
                     console.error(`[${this.mode}] Could not retrieve question data for index ${nextIndex}. Finishing game.`);
                     this.finishGame();
                     return; // Stop execution
                 }

                this.currentQuestionIndex = nextIndex;
                this.currentQuestion = questionData; // Store current question data

                console.log(`[${this.mode}] Presenting question ${this.currentQuestionIndex + 1}/${totalQuestions}`);

                // --- Rely ONLY on getShuffledAnswers ---
                const answers = this.quizEngine.getShuffledAnswers(this.currentQuestionIndex);
                // --- REMOVED FALLBACK LOGIC ---

                eventBus.emit(Events.Game.QuestionNew, {
                    questionIndex: this.currentQuestionIndex,
                    totalQuestions: totalQuestions,
                    questionData: {
                        question: questionData.question,
                        answers: answers // Use result directly
                    }
                });
                this._afterQuestionPresented(); // Hook for subclasses (e.g., start timer)
            } catch (error) {
                // Log the specific error from QuizEngine methods if they fail
                console.error(`[${this.mode}] Error during QuizEngine interaction in nextQuestion (Index: ${nextIndex}):`, error);
                this.finishGame(); // Finish game on error
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
            totalQuestions: this.quizEngine.getQuestionCount(),
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
        this._cleanupListeners();
        this.quizEngine = null; // Release reference
    }

        
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