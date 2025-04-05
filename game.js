/**
 * Manages the overall game state, logic, and flow. Coordinates controllers.
 * Controllers manage UI visibility via '.hidden' class.
 */
class Game {
    /**
     * Initializes a new Game instance and its controllers.
     */
    constructor() {
        this.selectedSheets = [];
        this.currentQuestions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.opponentScore = 0;
        this.timer = null;
        this.isTestMode = false;
        this.isMultiplayer = false;
        this.difficulty = null;
        this.config = null;
        this.questionsManager = null;
        this.highscoresManager = new HighscoresManager();
        this.webRTCManager = null;
        this.playerName = localStorage.getItem('unicornPoepPlayerName') || 'Speler 1';
        this.opponentName = null;
        this.isHost = false;
        this.sheetNames = [];
        this.wasMultiplayer = false;

        // --- Controllers ---
        this.loadingController = new LoadingController();
        this.mainMenuController = new MainMenuController(this);
        this.gameAreaController = new GameAreaController(this);
        this.multiplayerController = new MultiplayerController(this);
        this.highscoresController = new HighscoresController(this);
        this.customQuestionsController = new CustomQuestionsController(this);
        this.aboutController = new AboutController(this);
        this.dialogController = new DialogController(this); // Manages <dialog> elements, not .hidden class

        // Initial UI state managed by controllers adding '.hidden'
        this.loadingController.show(); // Show loader first
        // Others start hidden via their constructors calling hide() or assuming HTML has .hidden
    }

    /**
     * Starts the game: loads config, questions, highscores, then shows main menu.
     * @async
     */
    async start() {
        // Show loading indicator (already done in constructor)
        // this.loadingController.show(); // redundant

        await this.loadConfig();
        this.questionsManager = new QuestionsManager();
        await this.questionsManager.init(this.config?.sheets || []);
        await this.questionsManager.waitForInitialisation();
        await this.preloadData();

        this.loadingController.hide(); // Hide loader
        this.mainMenuController.setSheetNames(this.sheetNames);

        // Check for join code in URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const joinCode = urlParams.get('join');

        if (joinCode && /^[0-9]{6}$/.test(joinCode)) {
            console.log("Join code found in URL:", joinCode);
            this.autoJoinMultiplayer(joinCode);
        } else {
            this.mainMenuController.show(); // Show main menu normally
        }
    }

    /**
     * Loads the game configuration from config.json.
     * @async
     */
    async loadConfig() {
        try {
            const response = await fetch('./config.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.config = await response.json();
        } catch (error) {
            console.error("Error loading config: ", error);
            this.dialogController.showError("Kon configuratie niet laden. Probeer de pagina te vernieuwen.");
            this.config = { sheets: [] }; // Default empty
        }
    }

    /**
     * Preloads sheet names and initializes highscores manager.
     * @async
     */
    async preloadData() {
        try {
            if (this.questionsManager) {
                this.sheetNames = this.questionsManager.listSheets();
            } else {
                this.sheetNames = [];
                console.error("QuestionsManager not available for preloading data.");
            }
        } catch (error) {
            console.error("Error preloading data: ", error);
        }
    }

    /**
     * Prepares and starts a single-player game session.
     * @param {string[]} selectedSheets - Array of chosen sheet names.
     * @param {string|null} difficulty - Selected difficulty or null for practice.
     * @async
     */
    async startNewGame(selectedSheets, difficulty) {
        this.resetGameState();
        this.mainMenuController.hide();
        this.selectedSheets = selectedSheets;
        this.difficulty = difficulty;
        this.isTestMode = difficulty !== null;
        this.isMultiplayer = false;

        try {
            await this.loadQuestionsForGame(); // Shows/hides loading indicator
            this.shuffleQuestions();

            this.gameAreaController.prepareSinglePlayerUI(); // Sets up score/timer visibility
            this.gameAreaController.show(); // Makes game area visible

            if (this.isTestMode) {
                this.timer = new ScoreTimer(difficulty);
                this.gameAreaController.updateScore(this.score); // Show initial score 0
            }

            this.displayCurrentQuestion();
        } catch (error) {
             console.error("Failed to start new game:", error.message);
             // Error handled within loadQuestionsForGame (alert + backToMainMenu)
        }
    }

    /**
     * Prepares and starts the hosting process for a multiplayer game.
     * @param {string[]} selectedSheets - Array of chosen sheet names.
     * @param {string} difficulty - Selected difficulty.
     * @async
     */
    async startMultiplayerHost(selectedSheets, difficulty) {
        this.resetGameState();
        this.isMultiplayer = true;
        this.isHost = true;
        this.selectedSheets = selectedSheets;
        this.difficulty = difficulty;
        this.isTestMode = true; // Multiplayer uses timer/score
        this.wasMultiplayer = true;

        try {
            await this.loadQuestionsForGame(); // Shows/hides loading indicator
            this.shuffleQuestions();

            this.webRTCManager = new WebRTCManager(this);
            const connectionCode = await this.webRTCManager.initializeAsHost();

            this.mainMenuController.hide();
            this.multiplayerController.showHostWaitingScreen(connectionCode); // Shows host UI

        } catch (error) {
            console.error("Failed to start multiplayer host:", error);
            let errorMsg = "Kon multiplayer spel niet starten";
            if (error?.message?.includes("No questions")) {
                 errorMsg = "Kon geen vragen laden voor selectie.";
                 this.backToMainMenu(); // Go back if no questions
                 return; // Exit early
            } else if (error?.message) {
                 errorMsg += `: ${error.message}`;
            }
            this.dialogController.showError(errorMsg);
            this.backToMainMenu();
        }
    }

    /**
     * Initiates the process for a player to join an existing multiplayer game.
     * Shows the UI for entering the connection code after ensuring a player name exists.
     */
    async startMultiplayerJoin() {
        console.log("Starting multiplayer join process...");
        this.hideMainMenu();
        this.hideGameArea();
        this.hideNavigation(); // Keep this to hide the top stop button

        // Check if player name exists
        if (!this.playerName || !this.playerName.trim()) {
            console.log("Player name missing, prompting user.");
            const name = await this.dialogController.promptForPlayerName();
            if (name) {
                this.updatePlayerName(name); // Update state and localStorage
            } else {
                console.log("Name prompt cancelled or failed. Aborting join.");
                this.backToMainMenu(); // Go back if no name provided
                return; // Stop execution
            }
        }

        // Now that we have a name, show the join screen
        // Initialize WebRTC *before* showing join screen? Or defer until code submission?
        // Let's initialize it here for simplicity in this example.
        if (!this.webRTCManager) {
             this.webRTCManager = new WebRTCManager(this); // Initialize manager for client
        }
        this.multiplayerController.showJoinScreen(); // Show the screen to enter code
    }

    /**
     * Attempts to connect to a multiplayer game using a connection code.
     * Called by MultiplayerController.
     * @param {string} code - The 6-digit connection code.
     * @async
     */
    async connectToMultiplayerGame(code) {
        if (!this.webRTCManager) {
            console.error("WebRTCManager not initialized for joining player.");
             this.multiplayerController.showJoinError("Interne fout (WebRTC).");
            return;
        }
        try {
            // showConnectingMessage is called by submitCode in MultiplayerController
            // this.multiplayerController.showConnectingMessage();
            await this.webRTCManager.connectToHost(code);
            // Success handled by handleConnectionEstablished

        } catch (error) {
            console.error("Failed to connect to host:", error);
            let errorMsg = "Verbinding mislukt. Controleer de code of probeer opnieuw.";
            if (error.message?.includes("Could not connect to peer")) {
                errorMsg = "Kon geen verbinding maken. Controleer de code of probeer later opnieuw.";
            } else if (error.message?.includes("timed out")) {
                 errorMsg = "Verbinding time-out. Probeer opnieuw.";
            } else if (error.message) {
                 errorMsg += ` (${error.message})`;
            }
            this.multiplayerController.showJoinError(errorMsg); // Shows error on join screen

            if (this.webRTCManager) {
                this.webRTCManager.cleanup();
                this.webRTCManager = null;
            }
        }
    }

    /**
     * Loads questions from selected sheets into `currentQuestions`. Shows loading indicator.
     * @async
     * @throws {Error} If no questions could be loaded.
     */
    async loadQuestionsForGame() {
        this.currentQuestions = [];
        this.loadingController.show(); // Show loader
        try {
            const loadPromises = this.selectedSheets.map(async (sheetName) => {
                try {
                    const questions = await this.questionsManager.readSheet(sheetName);
                    return questions;
                } catch (error) {
                    console.error(`Error loading sheet "${sheetName}":`, error);
                    return [];
                }
            });

            const results = await Promise.all(loadPromises);
            this.currentQuestions = results.flat();

        } catch(error) {
             console.error("Error during question loading process:", error);
        } finally {
            this.loadingController.hide(); // Hide loader regardless of outcome
        }

        if (this.currentQuestions.length === 0) {
             console.error("No questions loaded!");
             alert("Kon geen vragen laden. Kies iets anders of controleer je lijsten.");
             this.backToMainMenu(); // Navigate back
             throw new Error("No questions were loaded for the selected sheets.");
        }
    }

    /**
     * Shuffles the `currentQuestions` array in place.
     */
    shuffleQuestions() {
        for (let i = this.currentQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.currentQuestions[i], this.currentQuestions[j]] = [this.currentQuestions[j], this.currentQuestions[i]];
        }
    }

    // --- WebRTC Callbacks ---

    /** Handles the establishment of a WebRTC connection. */
    handleConnectionEstablished() {
        this.multiplayerController.hideAll(); // Hide connection UI

        if (this.webRTCManager) {
            this.webRTCManager.sendMessage({ type: 'playerInfo', name: this.playerName });
        }

        if (this.isHost) {
            console.log("Host sending game setup data");
            if (this.webRTCManager) {
                this.webRTCManager.sendMessage({
                    type: 'gameSetup',
                    questions: this.currentQuestions,
                    currentIndex: this.currentQuestionIndex,
                    difficulty: this.difficulty,
                    hostName: this.playerName
                });
            }
            this.prepareMultiplayerGameUI(); // Setup game area for host
            this.displayCurrentQuestion(); // Show first question
        } else {
             console.log("Client waiting for game setup data");
             this.multiplayerController.showWaitingMessage("Wachten op spelgegevens..."); // Show waiting msg
        }
    }

    /** Handles receiving game setup data from the host. */
    handleGameSetup(data) {
        if (this.isHost) return; // Only clients

        console.log("Client received game setup");
        this.multiplayerController.hideAll(); // Hide waiting message

        this.currentQuestions = data.questions || [];
        this.currentQuestionIndex = data.currentIndex || 0;
        this.difficulty = data.difficulty;
        this.opponentName = data.hostName || 'Speler 1';
        this.isTestMode = true; // Multiplayer is always test mode

        this.prepareMultiplayerGameUI(); // Setup game area for client
        this.displayCurrentQuestion(); // Show first question
    }

    /** Handles receiving player info (name) from the opponent. */
    handlePlayerInfo(data) {
        if (!data || !data.name || data.name === this.playerName) return;

        this.opponentName = data.name;
        console.log(`Opponent name set to: ${this.opponentName}`);

        if(this.gameAreaController.isVisible()) {
             this.gameAreaController.updatePlayerNames(this.playerName, this.opponentName);
             // Optionally update opponent score display if needed, although score msg handles it
             // this.gameAreaController.updateOpponentScore(this.opponentScore);
        }
    }

    /** Prepares the UI elements specific to a multiplayer game. */
    prepareMultiplayerGameUI() {
        this.multiplayerController.hideAll(); // Ensure connection UI is hidden
        this.gameAreaController.prepareMultiplayerUI(this.playerName, this.opponentName || (this.isHost ? 'Speler 2' : 'Speler 1'));
        this.gameAreaController.show(); // Show game area
        this.gameAreaController.updateScore(this.score);
        this.gameAreaController.updateOpponentScore(this.opponentScore);

        if (this.difficulty) {
             this.timer = new ScoreTimer(this.difficulty);
             // updateTimer will handle visibility based on timer presence
        } else {
             console.warn("Multiplayer started without difficulty.");
             this.timer = null;
             // Ensure timer element is hidden if no timer object exists
             if (this.gameAreaController.timerElement) {
                 this.gameAreaController.timerElement.classList.add('hidden');
             }
        }
    }

    // --- Gameplay Logic ---

    /** Displays the current question and answers. */
    displayCurrentQuestion() {
        if (!this.currentQuestions || this.currentQuestions.length === 0 || this.currentQuestionIndex >= this.currentQuestions.length) {
             console.warn("Attempted to display question with invalid state.");
             this.endGame();
             return;
        }
        const currentQuestion = this.currentQuestions[this.currentQuestionIndex];
        if (!currentQuestion) {
             console.error("Current question object is undefined at index:", this.currentQuestionIndex);
             this.endGame(); return;
        }
        const answers = this.getShuffledAnswers(currentQuestion);

        this.gameAreaController.displayQuestion(currentQuestion.question);
        this.gameAreaController.displayAnswers(answers);
        this.gameAreaController.updateProgress(this.currentQuestionIndex + 1, this.currentQuestions.length);
        this.gameAreaController.enableAnswers();
        this.gameAreaController.hideNextButton(); // Hide until answer selected

        if (this.isTestMode && this.timer) {
            this.timer.start((remainingTime) => {
                this.gameAreaController.updateTimer(remainingTime); // Handles visibility and text
                 if (remainingTime <= 0 && this.gameAreaController.areAnswersEnabled()) {
                     console.log("Time ran out!");
                     this.handleAnswerSelection(null, null); // Treat as wrong
                 }
            });
        } else if (this.isTestMode && !this.timer) {
             // Ensure timer element is hidden if no timer object
             if (this.gameAreaController.timerElement) {
                this.gameAreaController.timerElement.classList.add('hidden');
             }
        }
    }

    /** Generates a shuffled list of 4 answers. */
    getShuffledAnswers(currentQuestion) {
        const correctAnswer = currentQuestion.answer;
        // Ensure allUniqueAnswers contains only defined, non-null values before filtering
        const allUniqueAnswers = [...new Set(this.currentQuestions.map(q => q.answer).filter(ans => ans !== undefined && ans !== null))];
        const incorrectOptions = allUniqueAnswers.filter(ans => ans !== correctAnswer);
        this.shuffleArray(incorrectOptions);
        let selectedIncorrect = incorrectOptions.slice(0, 3);

        // Generate unique placeholders if needed
        let placeholderIndex = 1;
        while (selectedIncorrect.length < 3) {
             const placeholder = `Optie ${placeholderIndex++}`;
             // Ensure placeholder doesn't accidentally match the correct answer or other placeholders
             if (placeholder !== correctAnswer && !selectedIncorrect.includes(placeholder)) {
                 selectedIncorrect.push(placeholder);
             } else {
                 // If placeholder conflicts, try next index immediately (rare case)
                 placeholderIndex++;
             }
        }

        const finalAnswers = [correctAnswer, ...selectedIncorrect];
        // Ensure exactly 4 answers, trimming or padding if necessary
        while (finalAnswers.length > 4) finalAnswers.pop();
        while (finalAnswers.length < 4) {
             const extraPlaceholder = `Extra ${finalAnswers.length + 1}`;
             if (extraPlaceholder !== correctAnswer && !finalAnswers.includes(extraPlaceholder)) {
                 finalAnswers.push(extraPlaceholder);
             } else {
                 // If placeholder conflicts, just add generic - this is unlikely with few initial answers
                 finalAnswers.push(`---`);
             }
        }

        return this.shuffleArray(finalAnswers);
    }


    /** Utility to shuffle an array in place. */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /** Handles the player's selection of an answer. */
    handleAnswerSelection(selectedAnswer, event) {
        if (!this.gameAreaController.areAnswersEnabled()) return;

        if (this.timer) this.timer.stop();
        this.gameAreaController.disableAnswers();

        const currentQuestion = this.currentQuestions?.[this.currentQuestionIndex];
        if (!currentQuestion) {
            console.error("Answer selected but current question is invalid.");
            this.endGame(); return;
        }
        const isCorrect = selectedAnswer === currentQuestion.answer;

        this.gameAreaController.highlightCorrectAnswer(currentQuestion.answer);
        if (selectedAnswer !== null && !isCorrect) {
            this.gameAreaController.highlightWrongAnswer(selectedAnswer);
        }

        let scoreIncrement = 0;
        if (isCorrect) {
            // Use current difficulty to calculate score
            scoreIncrement = (this.isTestMode && this.timer) ? this.timer.calculateScore(this.difficulty) : (this.isTestMode ? 10 : 0);
            this.score += scoreIncrement;

            if (this.isMultiplayer) {
                 this.gameAreaController.updateScore(this.score);
                 if (this.webRTCManager) this.webRTCManager.sendMessage({ type: 'score', score: this.score, playerName: this.playerName });
            } else if (this.isTestMode) {
                 this.gameAreaController.updateScore(this.score);
            }
            if (event) this.gameAreaController.showConfetti(scoreIncrement > 0 ? scoreIncrement * 2 : 30, event);
        } else {
             if (event) this.gameAreaController.showBadConfetti(15);
        }

        if (this.isMultiplayer && this.webRTCManager) {
            this.webRTCManager.sendMessage({ type: 'answer', answer: selectedAnswer, isCorrect: isCorrect });
        }

        // Show next button after a delay
        this.gameAreaController.showNextButton();
    }

    /** Handles receiving the opponent's answer. */
    handleOpponentAnswer(data) {
        console.log(`Opponent answered (Correct: ${data.isCorrect})`);
        // Score updates via 'score' message. Visual feedback could be added here.
    }

    /** Handles receiving an opponent's score update. */
    handleOpponentScoreUpdate(data) {
         if (!this.isMultiplayer) return;
        this.opponentScore = data.score;
        // Ensure opponent name is updated if received via score message
        if (!this.opponentName && data.playerName && data.playerName !== this.playerName) {
            this.opponentName = data.playerName;
            this.gameAreaController.updatePlayerNames(this.playerName, this.opponentName);
        }
        this.gameAreaController.updateOpponentScore(this.opponentScore); // Updates display + animation
        this.gameAreaController.showMiniConfettiForOpponent();
    }

    /** Proceeds to the next question or ends the game. */
    nextQuestion() {
        this.currentQuestionIndex++;
        if (this.currentQuestions && this.currentQuestionIndex < this.currentQuestions.length) {
            this.gameAreaController.resetAnswerHighlights();
            this.displayCurrentQuestion();
        } else {
            this.endGame();
        }
    }

    /** Ends the current game session and shows results. */
    async endGame(locallyInitiated = true) {
        console.log(`Ending game... Multiplayer: ${this.isMultiplayer}, Locally Initiated: ${locallyInitiated}`);
        this.timer?.stop();
        //this.gameAreaController?.hideTimer(); // Maybe hide timer specifically

        if (this.isMultiplayer) {
            if (locallyInitiated) {
                 // This player finished the questions or ran out of time
                 console.log("Local player initiated game end. Sending gameEnd message.");

                 // Ensure scores are up-to-date (opponent score might need final update)
                 // Assuming opponent score is tracked via 'stateUpdate' or 'answerResult' messages
                 const finalHostScore = this.isHost ? this.score : this.opponentScore;
                 const finalClientScore = this.isHost ? this.opponentScore : this.score;
                 const finalHostName = this.isHost ? this.playerName : this.opponentName;
                 const finalClientName = this.isHost ? this.opponentName : this.playerName;

                 // Send final game state
                 const gameEndMessage = {
                     type: 'gameEnd',
                     hostScore: finalHostScore,
                     clientScore: finalClientScore,
                     hostName: finalHostName,
                     clientName: finalClientName,
                 };
                 this.webRTCManager?.sendMessage(gameEndMessage);
                 console.log("Sent gameEnd message:", gameEndMessage);

                 // Determine winner locally
                 const winnerName = finalHostScore >= finalClientScore ? finalHostName : finalClientName;
                 const winnerScore = Math.max(finalHostScore, finalClientScore);

                 // Show the end dialog immediately for the local player
                 this.dialogController.showMultiplayerEndDialog(
                     finalHostName, finalHostScore,
                     finalClientName, finalClientScore
                 );

                 // Save winner's score to highscores
                 this.highscoresManager.addScore(
                     this.selectedSheets.join(','), // Assuming key format
                     this.difficulty,
                     winnerName,
                     winnerScore
                 );

                 // DO NOT call cleanupMultiplayer here. Dialog handles return to menu.

            } else {
                // Game end was triggered by receiving a 'gameEnd' message.
                // The logic is handled within handleMultiplayerMessage case 'gameEnd'.
                 console.log("Game end triggered by remote 'gameEnd' message.");
                 // Ensure any local UI elements indicating active game are hidden
                 this.gameAreaController?.hide(); // Hide the game area as the dialog takes over
            }

        } else {
            // Single player game end logic
            console.log("Ending single player game.");
            this.gameAreaController?.hide();
            const scoreAchieved = this.highscoresManager.addScore(
                 this.selectedSheets.join(','), // Use appropriate key
                 this.difficulty,
                 this.playerName,
                 this.score
            );
            this.dialogController.showEndOfGameDialog(this.score, scoreAchieved);
            this.resetGameState(); // Reset for single player
        }
        // Common cleanup for any game end? Maybe not here.
    }

    /**
     * Cleans up multiplayer-specific resources and state.
     * @param {boolean} [userInitiated=false] - If the cleanup was directly triggered by user action (like back button).
     */
    cleanupMultiplayer(userInitiated = false) {
        console.log(`cleanupMultiplayer called, userInitiated: ${userInitiated}, wasMultiplayer: ${this.isMultiplayer}`);
        if (this.isMultiplayer || this.webRTCManager?.isActive()) { // Check if cleanup is needed
            this.webRTCManager?.cleanup();
            this.isMultiplayer = false;
            this.opponentName = '';
            this.opponentScore = 0;
            // Optionally hide multiplayer-specific UI if not already handled
            this.multiplayerController?.hideAll();
             console.log("Multiplayer cleanup complete.");
        } else {
            console.log("Skipping multiplayer cleanup, not active.");
        }
    }

    /** Resets game state for new game or returning to menu. */
    resetGameState() {
        console.log('Resetting game state');
        if (this.timer) { this.timer.stop(); this.timer = null; }
        // Ensure multiplayer cleanup happens if necessary
        if (this.isMultiplayer || this.webRTCManager) { this.cleanupMultiplayer(false); }

        // Reset core game variables
        this.selectedSheets = [];
        this.currentQuestions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.opponentScore = 0;
        this.isTestMode = false;
        // isMultiplayer is reset within cleanupMultiplayer
        this.difficulty = null;
        this.opponentName = null;
        // isHost is reset within cleanupMultiplayer
        this.wasMultiplayer = false; // Reset flag here after potential use

        // Reset UI elements via controllers
        this.gameAreaController.resetUI();
        this.multiplayerController.hideAll();
        this.dialogController.hideAll(); // Close any open dialogs
    }

    /**
     * Fetches the latest list of sheet names (predefined + custom) and updates the Main Menu UI.
     * Should be called after custom sheets are added or removed.
     * @async
     */
    async refreshAvailableSheets() {
        if (this.questionsManager) {
            try {
                // Fetch the combined list of predefined and custom sheets
                this.sheetNames = this.questionsManager.listSheets();
                // Update the main menu controller with the new list
                this.mainMenuController.setSheetNames(this.sheetNames);
                console.log("Refreshed available sheets in main menu.");
            } catch (error) {
                console.error("Error refreshing available sheets:", error);
                // Optionally show an error to the user
            }
        } else {
            console.error("QuestionsManager not available to refresh sheets.");
        }
    }

    // --- Highscore Logic ---

    /** Navigates to the highscores view. @async */
    async viewHighscores() {
        // Hide all other views
        this.mainMenuController.hide(); this.gameAreaController.hide();
        this.multiplayerController.hideAll(); this.customQuestionsController.hide();
        this.aboutController.hide(); this.dialogController.hideAll();
        // Show highscores view
        this.highscoresController.show();
    }

    /** Saves score after a game ends. */
    async saveHighscore(playerNameInput) {
        const finalPlayerName = playerNameInput.trim() || this.playerName;
        if (!finalPlayerName) { alert("Voer een naam in."); return; }
        if (finalPlayerName !== this.playerName) { this.updatePlayerName(finalPlayerName); }

        if (!this.highscoresManager) {
            console.error("HighscoresManager not init.");
            this.dialogController.hideAll(); this.backToMainMenu(); return;
        }

        // Capture context *before* potential state resets
        const sheetKey = this.selectedSheets.join(', ') || 'Onbekend';
        const scoreToSave = this.score;
        const difficultyContext = this.difficulty;
        const multiplayerContext = this.wasMultiplayer; // Use the flag set during cleanup/end

        this.dialogController.hideAll(); // Hide dialog

        try {
             // Determine if score should be saved (test mode or multiplayer, score > 0)
             const canSave = (this.isTestMode || multiplayerContext) && scoreToSave > 0;

             if (canSave) {
                 await this.highscoresManager.addScore(sheetKey, this.playerName, scoreToSave, multiplayerContext, difficultyContext);
                 console.log(`Highscore saved for ${this.playerName} on ${sheetKey}`);
                 // Navigate to highscores after saving
                 this.viewHighscores();
             } else {
                 console.log("Score not saved (practice/zero/state mismatch).");
                 // Go back to main menu if score wasn't saved
                 this.backToMainMenu();
             }
        } catch(error) {
             console.error("Error saving highscore:", error);
             alert(`Kon score niet opslaan: ${error.message}`);
             this.backToMainMenu(); // Go back on error
        } finally {
            // Reset score/state *after* potential navigation or async operation
             this.score = 0; this.opponentScore = 0;
             this.wasMultiplayer = false; // Reset flag after use
             // Other game state reset happens in backToMainMenu or startNewGame
        }
    }

    /** Restarts the game selection process from end-game dialog. */
    restartGame() {
        this.dialogController.hideAll();
        this.backToMainMenu(); // Go back to menu to allow new selection
    }

     /** Goes back to the main menu, resetting state and UI. */
     backToMainMenu() {
        console.log("Returning to main menu...");
        this.timer?.stop();

        // Always hide controllers that should not be visible on main menu
        this.gameAreaController?.hide();
        this.dialogController?.hideAll(); // Hide any open dialogs
        this.highscoresController?.hide();
        this.customQuestionsController?.hide();
        this.aboutController?.hide();
        this.loadingController?.hide();

        // Cleanup multiplayer IF it was active
        if (this.isMultiplayer) { // Check the flag
             console.log("Performing multiplayer cleanup before showing main menu.");
             this.cleanupMultiplayer(true); // User initiated return to menu
        }

        // Reset general game state AFTER potential cleanup
        this.resetGameState();

        // Show the main menu
        this.mainMenuController?.show();
        console.log("Main menu shown.");
     }

     // --- Other Menu Actions ---

     /** Shows screen to manage custom questions. */
     showCustomQuestions() { this.mainMenuController.hide(); this.customQuestionsController.show(); }
     /** Shows the about screen. */
     showAbout() { this.mainMenuController.hide(); this.aboutController.show(); }
     /** Shows multiplayer host/join choice screen. */
     showMultiplayerChoice() { this.mainMenuController.hide(); this.multiplayerController.showChoiceScreen(this.playerName); }

     /** Updates player's name in state and localStorage. */
     updatePlayerName(newName) {
         newName = newName.trim();
         if (newName?.length > 0) {
             this.playerName = newName;
             localStorage.setItem('unicornPoepPlayerName', this.playerName);
             console.log("Player name updated to:", this.playerName);
         } else {
             console.warn("Attempted to update player name with empty value.");
         }
     }

     /** 
      * Automatically navigates to the join screen and attempts connection.
      * Called when a join code is found in the URL. Ensures player name exists first.
      * @param {string} code - The 6-digit join code.
      */
     async autoJoinMultiplayer(code) {
         console.log("[autoJoin] Starting...");
         // Read the name fresh from storage *inside* this function
         let currentNameInStorage = localStorage.getItem('unicornPoepPlayerName');
         // Check if storage name is absent, empty/whitespace, or the default fallback
         let needsPrompt = !currentNameInStorage || !currentNameInStorage.trim() || currentNameInStorage.trim() === 'Speler 1';

         console.log(`[autoJoin] Name in storage: '${currentNameInStorage}'. Needs prompt: ${needsPrompt}. Current game state name: '${this.playerName}'`);

         if (needsPrompt) {
             console.log("[autoJoin] Prompting for player name...");
             let nameFromPrompt = null;
             try {
                 nameFromPrompt = await this.dialogController.promptForPlayerName();
                 console.log("[autoJoin] Prompt resolved with:", nameFromPrompt);
             } catch (error) {
                 console.error("[autoJoin] Error during promptForPlayerName:", error);
                 // Treat error as cancellation
                 nameFromPrompt = null; 
             }

             if (nameFromPrompt) {
                 // Explicitly update using the name from the prompt
                 this.updatePlayerName(nameFromPrompt); 
                 console.log("[autoJoin] Player name updated from prompt to:", this.playerName);
             } else {
                 console.log("[autoJoin] Name prompt cancelled or failed. Aborting auto-join.");
                 this.mainMenuController.show(); // Show main menu as fallback
                 return; // *** CRITICAL: Ensure execution stops here ***
             }
         } else {
             // If prompt wasn't needed, ensure the game state matches the valid storage name
             const validName = currentNameInStorage.trim();
             if (this.playerName !== validName) {
                  console.warn(`[autoJoin] Game state name ('${this.playerName}') differs from valid storage name ('${validName}'). Updating state.`);
                  // Update using the valid name from storage
                  this.updatePlayerName(validName); 
             }
             console.log("[autoJoin] Using existing valid player name:", this.playerName);
         }

         // --- If we reach here, we should have a valid playerName ---
         console.log("[autoJoin] Proceeding with connection. Final name:", this.playerName);

         // Hide main menu if it was shown momentarily
         this.mainMenuController.hide();
         this.gameAreaController.hide(); // Ensure game area isn't visible
         this.hideNavigation(); // Hide top stop button

         // Initialize WebRTC manager if it doesn't exist
         if (!this.webRTCManager) {
             console.log("[autoJoin] Initializing WebRTCManager...");
             this.webRTCManager = new WebRTCManager(this);
         }

         // Show connecting message *before* trying to connect
         console.log("[autoJoin] Showing connecting message...");
         this.multiplayerController.showConnectingMessage();

         // Attempt connection (connectToMultiplayerGame handles errors/success UI)
         console.log("[autoJoin] Attempting connection to host with code:", code);
         await this.connectToMultiplayerGame(code);
         console.log("[autoJoin] connectToMultiplayerGame finished.");
     }

    /**
     * Hides the main game navigation elements (like score, timer, stop button).
     * Assumes elements with IDs like 'gameNavigation' and 'exitGame'.
     */
    hideNavigation() {
        const gameNav = document.getElementById('gameNavigation');
        const exitGame = document.getElementById('exitGame');
        gameNav?.classList.add('hidden');
        exitGame?.classList.add('hidden');
    }

    /**
     * Handles messages received via WebRTC.
     * @param {any} data - The received data.
     */
    handleMultiplayerMessage(data) {
        console.log('Received message:', data);
        switch (data.type) {
            // ... other cases (question, answer, etc.) ...

            case 'stateUpdate': // Assuming state updates include opponent name/score
                this.opponentName = data.playerName || 'Opponent';
                this.opponentScore = data.score ?? this.opponentScore; // Use nullish coalescing
                this.gameAreaController?.updateOpponentScore(this.opponentScore); // Update UI if needed
                break;

            case 'answerResult': // Client receives result from Host
                if (!this.isHost) {
                    this.score = data.yourScore; // Host calculates and sends score back
                    this.opponentScore = data.opponentScore; // Host also sends its own score
                    this.gameAreaController?.updateScore(this.score);
                    this.gameAreaController?.updateOpponentScore(this.opponentScore);
                    // Potentially check if game should end based on received state
                    if(data.gameShouldEnd) {
                        // Host determined game end based on client's answer
                        // The host will send 'gameEnd' separately. Wait for it.
                        console.log("Host indicated game should end. Waiting for gameEnd message.");
                    }
                }
                break;

            case 'gameEnd':
                // Received message that the game ended (sent by the winner)
                console.log("Received gameEnd message.");
                this.isMultiplayer = true; // Ensure flag is set
                this.opponentScore = this.isHost ? data.clientScore : data.hostScore;
                this.score = this.isHost ? data.hostScore : data.clientScore; // Ensure local score is correct too
                this.opponentName = this.isHost ? data.clientName : data.hostName;

                // Determine winner based on received data
                const winnerName = data.hostScore >= data.clientScore ? data.hostName : data.clientName;
                const winnerScore = Math.max(data.hostScore, data.clientScore);

                // Show the end dialog using received data
                this.dialogController.showMultiplayerEndDialog(
                    data.hostName, data.hostScore,
                    data.clientName, data.clientScore
                );

                // Save winner's score to highscores
                this.highscoresManager.addScore(
                    this.selectedSheets.join(','), // Assuming key format
                    this.difficulty,
                    winnerName,
                    winnerScore
                );

                // DO NOT call cleanupMultiplayer here. Dialog handles return to menu.
                break;

            // ... other cases ...
        }
    }
}