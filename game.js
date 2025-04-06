/**
 * Manages the state, logic, and flow for a SINGLE-PLAYER game session.
 * Handles loading questions, displaying game elements, managing timer (optional),
 * processing answers locally, and navigating between game states.
 */
class Game {
    /**
     * Initializes a new single-player Game instance.
     * @param {MainMenu} mainMenu - The central orchestrator instance.
     */
    constructor(mainMenu) {
        console.log("Initializing Base Game (Single-Player) - Accessing via MainMenu.");
        if (!mainMenu) {
            throw new Error("Game requires a MainMenu instance!");
        }
        this.mainMenu = mainMenu;

        // --- State ---
        this.selectedSheets = [];
        this.currentQuestions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.timer = null;
        this.isTestMode = false;
        this.difficulty = null;
        this.playerName = localStorage.getItem('unicornPoepPlayerName') || 'Speler 1';

        // Validate essential dependencies are available via the hub
        if (!this.mainMenu.questionsManager || !this.mainMenu.gameAreaController || !this.mainMenu.dialogController || !this.mainMenu.loadingController || !this.mainMenu.highscoresManager) {
            console.error("SP Game: Essential managers/controllers not found via MainMenu!");
            // Consider throwing an error that stops game creation
        }
    }

    /**
     * Loads the player name from localStorage.
     */
    loadPlayerName() {
        this.playerName = localStorage.getItem('unicornPoepPlayerName') || 'Speler 1';
        console.log("SP Game: Loaded player name:", this.playerName);
    }

    /**
     * Updates player name in state and localStorage.
     * @param {string} newName - The new player name.
     */
    updatePlayerName(newName) {
        const trimmedName = newName.trim();
        if (trimmedName && trimmedName !== this.playerName) {
            this.playerName = trimmedName;
            localStorage.setItem('unicornPoepPlayerName', trimmedName);
            console.log(`SP Game: Player name updated to: ${this.playerName}`);
        }
     }

    /**
     * Loads and shuffles questions for the selected sheets using QuestionsManager.
     * @async
     * @returns {Promise<void>}
     * @throws {Error} If questions cannot be loaded for the selected sheets.
     */
    async loadQuestionsForGame() {
        console.log("SP Game: Calling loadQuestionsForGame...");
        if (!this.mainMenu.questionsManager) {
            throw new Error("QuestionsManager not available via mainMenu.");
        }
        if (!this.selectedSheets || this.selectedSheets.length === 0) {
            throw new Error("No sheets selected to load questions from.");
        }

        try {
            // *** Use the new consolidated method in QuestionsManager ***
            this.currentQuestions = await this.mainMenu.questionsManager.getQuestionsForSheets(this.selectedSheets);

            // Shuffling remains the responsibility of the Game instance for the session
            this.shuffleQuestions(); // Operates on this.currentQuestions
            console.log(`SP Game: Loaded and shuffled ${this.currentQuestions.length} total questions.`);

        } catch (error) {
             console.error("SP Game: Error loading questions via QuestionsManager:", error);
             this.mainMenu.dialogController.showError(`Fout bij laden vragen: ${error.message}`);
             this.currentQuestions = []; // Ensure state is clean on error
            throw error; // Re-throw to be caught by startNewGame
        }
    }

    /** Shuffles the `currentQuestions` array in place. */
    shuffleQuestions() {
        // Ensure we are shuffling the correct array
        if (this.currentQuestions && this.currentQuestions.length > 0) {
            this.shuffleArray(this.currentQuestions);
            console.log("SP Game: Shuffled questions.");
        } else {
             console.warn("SP Game: Attempted to shuffle an empty questions array.");
        }
    }

    /**
     * Utility function to shuffle an array in place using Fisher-Yates algorithm.
     * @param {Array<any>} array - The array to shuffle.
     * @returns {Array<any>} The shuffled array (same instance).
     */
    shuffleArray(array) {
       for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Generates shuffled answer options for a given question.
     * @param {object} currentQuestion - The question object { question: string, answer: string }.
     * @returns {string[]} An array of 4 shuffled answer options.
     */
    getShuffledAnswers(currentQuestion) {
        const correctAnswer = currentQuestion.answer;
        const allAnswersInSet = this.currentQuestions.map(q => q.answer).filter(ans => ans !== undefined && ans !== null);
        const uniqueAnswersInSet = [...new Set(allAnswersInSet)];

        const incorrectOptions = uniqueAnswersInSet.filter(ans => ans !== correctAnswer);
        this.shuffleArray(incorrectOptions);

        let selectedIncorrect = incorrectOptions.slice(0, 3);

        let placeholderIndex = 1;
        while (selectedIncorrect.length < 3) {
            const placeholder = `Optie ${placeholderIndex++}`;
            if (placeholder !== correctAnswer && !selectedIncorrect.includes(placeholder)) {
                selectedIncorrect.push(placeholder);
            }
        }

        const finalAnswers = [correctAnswer, ...selectedIncorrect];
        const answersToShuffle = finalAnswers.slice(0, 4);
        while (answersToShuffle.length < 4) {
             answersToShuffle.push(`--- ${answersToShuffle.length + 1} ---`);
         }

        return this.shuffleArray(answersToShuffle);
    }

    /**
     * Starts a new single-player game session.
     * @async
     * @param {string[]} sheetKeys - An array of sheet keys/names to include.
     * @param {string|null} difficulty - The selected difficulty ('easy', 'medium', 'hard') or null for practice.
     * @returns {Promise<void>}
     */
    async startNewGame(sheetKeys, difficulty = null) {
        console.log(`SP Game: Starting new game. Sheets: ${sheetKeys}, Difficulty: ${difficulty}`);
        this.resetGameState();
        this.selectedSheets = sheetKeys;
        this.difficulty = difficulty;
        this.isPracticeMode = (difficulty === null);
        this.isTestMode = !this.isPracticeMode;

        this.loadPlayerName();

        const ctrl = this.mainMenu.gameAreaController;
        ctrl.updatePlayerNameDisplay(this.playerName);

        if (this.isTestMode) {
            this.timer = new ScoreTimer(this.difficulty);
            console.log(`SP Game: Initialized ScoreTimer for difficulty '${this.difficulty}'. Effective duration: ${this.timer.duration}ms`);
        } else {
            this.timer = null;
            console.log("SP Game: Practice mode, timer not initialized.");
        }

        try {
            await this.loadQuestionsForGame();
            if (this.currentQuestions.length === 0) {
                 throw new Error("No questions were loaded.");
             }

            this.currentQuestionIndex = 0;
            this.gameActive = true;

            ctrl.prepareSinglePlayerUI();
            ctrl.show();
            ctrl.showGameCoreElements();

            this.displayCurrentQuestion();

        } catch (error) {
            console.error("SP Game: Error caught within startNewGame:", error.message || error);
            this.gameActive = false;
            this.resetGameState();
            // Ensure mainMenu is available before calling showView
            if (this.mainMenu) {
                this.mainMenu.showView('mainMenu');
            } else {
                 console.error("SP Game: Cannot navigate back to main menu, mainMenu reference is missing.");
                 // Potentially show a generic error message if DialogController is available
                 this.mainMenu.dialogController.showErrorDialog("Kon niet terugkeren naar hoofdmenu.");
            }
        }
    }

    /** Displays the current question and answers via GameAreaController */
    displayCurrentQuestion() {
         console.log(`SP Game: Displaying question ${this.currentQuestionIndex + 1}/${this.currentQuestions.length}`);
        if (!this.gameActive || !this.currentQuestions || this.currentQuestionIndex >= this.currentQuestions.length) {
             console.log("SP Game: No more questions left, questions array empty, or game not active.");
             if (this.gameActive) this.endGame(); // Only end game if it was active
             return;
        }
        const currentQuestion = this.currentQuestions[this.currentQuestionIndex];
        if (!currentQuestion || typeof currentQuestion.question === 'undefined' || typeof currentQuestion.answer === 'undefined') {
            console.error("SP Game: Invalid question object found:", currentQuestion);
            this.nextQuestion(); // Skip invalid question
            return;
        }

        const answers = this.getShuffledAnswers(currentQuestion);

        const ctrl = this.mainMenu.gameAreaController;
        // Ensure controller exists before using it
        if (!ctrl) {
            console.error("SP Game: GameAreaController not available via mainMenu in displayCurrentQuestion.");
            this.endGame(); // Cannot proceed without UI controller
            return;
        }

        ctrl.displayQuestion(currentQuestion.question);
        ctrl.displayAnswers(answers);
        ctrl.updateProgress(this.currentQuestionIndex + 1, this.currentQuestions.length);
        ctrl.enableAnswers();
        ctrl.hideNextButton();
        ctrl.hideWaitingUi(); // Should already be hidden by resetUI, but belt-and-suspenders
        // ctrl.showGameElements(); // Let's ensure game elements are visible here as well

        if (this.timer) {
            this.timer.stop();

            // *** REVERT: Calculate initial seconds from ms for display ***
            const initialSeconds = Math.ceil(this.timer.durationMs / 1000);
            console.log(`SP Game: Setting initial timer display to ${initialSeconds} seconds (from ${this.timer.durationMs}ms)`);
            ctrl.updateTimerDisplay(initialSeconds); // Pass seconds

            console.log(`SP Game: Starting timer with duration ${this.timer.durationMs}ms`);
            this.timer.start(this.onTick.bind(this));
        }
    }

    /** Handles the player's selection of an answer via GameAreaController */
    handleAnswerSelection(selectedAnswer, event) {
        const ctrl = this.mainMenu.gameAreaController;
        if (!ctrl.areAnswersEnabled()) return;

        // Only stop the timer if it exists (i.e., in test mode)
        if (this.timer) {
            this.timer.stop();
        }

        ctrl.disableAnswers();

        const currentQuestion = this.currentQuestions[this.currentQuestionIndex];
        if (!currentQuestion) {
            console.error("SP Game: Missing current question during answer handling.");
            this.endGame();
            return;
        }

        const isCorrect = selectedAnswer === currentQuestion.answer;

        ctrl.highlightCorrectAnswer(currentQuestion.answer);
        if (selectedAnswer !== null && !isCorrect) {
             ctrl.highlightWrongAnswer(selectedAnswer);
        }

        if (isCorrect) {
             let scoreIncrement = 0;
             if (this.isTestMode) {
                 scoreIncrement = this.timer ? this.timer.calculateScore(this.difficulty) : 10;
            this.score += scoreIncrement;
                 ctrl.updateScore(this.score);
             }
             if (event && this.mainMenu.gameAreaController) {
                this.mainMenu.gameAreaController.showConfetti(scoreIncrement > 0 ? scoreIncrement * 2 : 30, event);
             }
        } else {
             if (event && this.mainMenu.gameAreaController) {
                this.mainMenu.gameAreaController.showBadConfetti(15);
             }
        }
        // Explicitly call, assuming ctrl should exist here
        if (ctrl) {
            ctrl.showNextButton();
        } else {
            console.error("Game.handleAnswerSelection: ctrl (GameAreaController) was null/undefined when trying to show next button.");
        }
    }

    /** Proceeds to the next question or ends the game */
    nextQuestion() {
        console.log(`SP nextQuestion: Advancing locally from index ${this.currentQuestionIndex}`);
        this.currentQuestionIndex++;
        this.mainMenu.gameAreaController.resetAnswerHighlights(); // Reset highlights before showing next
        this.displayCurrentQuestion();
    }

    /**
     * Called when the local user clicks the "Next" button.
     * Delegates to nextQuestion().
     */
     proceedToNextQuestion() {
          this.nextQuestion();
     }

    /** Called by the ScoreTimer instance on each tick */
    onTick(remainingTimeMillis) {
        const ctrl = this.mainMenu.gameAreaController;
        if (!ctrl) {
             this.timer.stop();
             return;
        }
        // *** REVERT: Calculate seconds for display ***
        const remainingSeconds = Math.max(0, Math.ceil(remainingTimeMillis / 1000));
        ctrl.updateTimerDisplay(remainingSeconds); // Pass seconds

        if (remainingTimeMillis <= 0 && ctrl.areAnswersEnabled()) {
             console.log("SP Game: Time ran out! Handling answer as null.");
             this.handleAnswerSelection(null, null);
        }
    }

    /** Ends the single-player game session */
    async endGame() {
        console.log("SP Game: Ending game.");
        // Only stop timer if it exists (practice mode has no timer)
        if (this.timer) {
            this.timer.stop();
        }
        // REMOVED . - Expect mainMenu and gameAreaController to exist
        this.mainMenu.gameAreaController.disableAnswers();
        this.gameActive = false;

        // Removed early return for practice mode. Both modes now show end dialog.
        if (!this.isTestMode) {
            console.log("SP Game: Practice mode finished. Proceeding to end dialog.");
        }

        // REMOVED . - Expect mainMenu, highscoresManager, and dialogController to exist
        const hsManager = this.mainMenu.highscoresManager;
        const dialogCtrl = this.mainMenu.dialogController;

        // Pre-checks (kept for runtime verification as requested earlier, but without optional chaining)
        if (!hsManager || !(hsManager instanceof HighscoresManager)) {
            const errorMsg = "Critical Error: HighscoresManager instance is missing or not the correct type in endGame.";
            console.error(errorMsg, "Instance received:", hsManager);
            // REMOVED . - Expect dialogCtrl to exist if hsManager checks passed
            dialogCtrl.showError(errorMsg);
            this.backToMainMenu();
            return; // Stop execution
        }

        if (typeof hsManager.isNewHighScore !== 'function') {
            const errorMsg = "Critical Error: HighscoresManager instance is valid, but 'isNewHighScore' method is missing at runtime.";
            console.error(errorMsg, "Instance prototype:", Object.getPrototypeOf(hsManager));
            // REMOVED . - Expect dialogCtrl to exist if hsManager checks passed
            dialogCtrl.showError(errorMsg);
            this.backToMainMenu();
            return; // Stop execution
        }

        try {
             // Check dialogCtrl exists
             if (!dialogCtrl) {
                console.error("SP Game: DialogController missing in endGame.");
                this.backToMainMenu();
                return;
             }

             if (this.isTestMode) {
                 // --- Test Mode Logic --- 
                 if (typeof hsManager.isNewHighScore !== 'function') {
                     throw new Error("HighscoresManager 'isNewHighScore' method missing.");
                 }
                 const isNew = hsManager.isNewHighScore(
                     this.selectedSheets.join(',') || 'Onbekend',
                     this.difficulty,
                     this.score
                 );

                 // Use a dedicated method for test end dialog
                 if (typeof dialogCtrl.showTestEndDialog === 'function') {
                     dialogCtrl.showTestEndDialog(this.score, isNew);
                 } else {
                     console.error("SP Game: DialogController 'showTestEndDialog' method missing.");
                     this.backToMainMenu();
                 }
             } else {
                 // --- Practice Mode Logic --- 
                 if (typeof dialogCtrl.showPracticeEndDialog === 'function') {
                     dialogCtrl.showPracticeEndDialog();
                 } else {
                     console.error("SP Game: DialogController 'showPracticeEndDialog' method missing.");
                     this.backToMainMenu();
                 }
             }
        } catch (error) {
             console.error("SP Game: Error during end game score/dialog processing:", error);
             // Attempt to show error using the base showError if specific dialog methods failed
             if (dialogCtrl && typeof dialogCtrl.showError === 'function') {
                 dialogCtrl.showError(`Fout bij verwerken einde spel: ${error.message}`);
             } else {
                  console.error("SP Game: Cannot show error dialog, controller missing.");
             }
             this.backToMainMenu(); // Go back to menu on error
        }
    }

    /** Navigates back to main menu via the central controller */
    backToMainMenu() {
        console.log("SP Game: Requesting navigation to main menu.");
        this.timer.stop(); // Keep for timer
        this.resetGameState();
        // REMOVED . - Expect mainMenu to exist
        this.mainMenu.showView('mainMenu');
        // Removed the defensive fallback block that tried window access
    }

    /** Resets the internal game state */
    resetGameState() {
        console.log('SP Game: Resetting state');
        this.gameActive = false;
        // Only stop the timer if it exists
        if (this.timer) {
            this.timer.stop();
        }
        this.timer = null;
        this.selectedSheets = [];
        this.currentQuestions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.isTestMode = false;
        this.isPracticeMode = false;
        this.difficulty = null;
        // REMOVED . - Expect mainMenu and gameAreaController to exist
        this.mainMenu.gameAreaController.resetUI();
    }

    /**
     * Saves the highscore. Called by DialogController event listener.
     * @param {string} playerNameInput - The name entered by the user in the dialog.
     * @returns {Promise<void>} A promise that resolves on success, rejects on failure.
     * @async - Keep async signature even if addScore is sync, for potential future changes.
     */
    async saveHighscore(playerNameInput) {
        const nameToSave = playerNameInput.trim() || this.playerName; // Allow . for standard JS method
        if (!nameToSave) {
            console.warn("SP Game: Attempted to save high score with no name.");
            this.mainMenu.toastNotification.show("Voer een naam in om de score op te slaan.", 4000);
            return Promise.reject(new Error("Player name is required.")); // Indicate failure
        }
        this.updatePlayerName(nameToSave); // Update name synchronously

        if (!this.mainMenu.highscoresManager) {
             const errorMsg = "SP Game: HighscoresManager not available, cannot save score.";
             console.error(errorMsg);
             this.mainMenu.toastNotification.show("Fout: Kan score niet opslaan (interne fout).", 5000);
             return Promise.reject(new Error(errorMsg)); // Indicate failure
        }

        if (this.isTestMode && this.difficulty) {
            try {
                 console.log(`SP Game: Attempting to save score: P='${this.playerName}', S='${this.score}', D='${this.difficulty}'`);
                 // Although addScore uses localStorage (sync), treat it as potentially async
                 await this.mainMenu.highscoresManager.addScore(
                     this.selectedSheets.join(',') || 'Onbekend',
                     this.playerName,
                     this.score,
                     false,
                     this.difficulty
                 );
                 // Resolve promise on successful save attempt (no error thrown)
                 return Promise.resolve();
            } catch (error) {
                 console.error("SP Game: Error saving high score:", error);
                 this.mainMenu.toastNotification.show("Fout bij opslaan highscore.", 5000);
                 return Promise.reject(error); // Indicate failure by rejecting
            }
        } else {
            console.warn("SP Game: Attempted to save score outside of test mode or without difficulty.");
            return Promise.resolve(); // Resolve because no save action was needed/attempted
        }
        // REMOVED this.backToMainMenu(); - Let the dialog handler manage navigation
    }

    /**
     * Stops the current single-player game session prematurely.
     * Performs cleanup and navigates back to the main menu without saving scores.
     */
    stopGame() {
        console.log("SP Game: Stopping game via stop button.");
        // Only stop timer if it exists
        if (this.timer) {
            this.timer.stop();
        }
        this.resetGameState(); // Reset state and UI
        // Navigate first
        this.mainMenu.showView('mainMenu', 'backward');
        // *** Call MainMenu cleanup AFTER navigation ***
        this.mainMenu._handleEndOfGameCleanup();
    }

    /** Restarts the current game configuration. Called by DialogController. */
    restartGame() {
        console.log("SP Game: Restarting game.");
        this.startNewGame(this.selectedSheets, this.difficulty);
        // REMOVED . - Expect mainMenu to exist
        this.mainMenu.showView('gameArea');
    }

    /** Shows multiplayer choice screen - DELEGATES TO MAIN MENU CONTROLLER */
    showMultiplayerChoice() {
        console.log("Game: Multiplayer selected. Triggering MP initialization via MainMenuController.");
        // REMOVED . - Expect mainMenu to exist
        this.mainMenu.startMultiplayer(MultiplayerModes.CHOICE);
    }

    /**
     * Cleans up the game state and resources.
     * Currently delegates to resetGameState.
     */
    cleanup() {
        console.log("SP Game: cleanup() called. Delegating to resetGameState.");
        this.resetGameState();
    }
}

// NO initialization here anymore, move to bottom of index.html

