/**
 * Manages the overall game state, logic, and flow.
 */
class Game {
    /**
     * Initializes a new Game instance.
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
        this.mainMenu = new MainMenu(this);
        this.ui = new UI(this);
        this.webRTCManager = new WebRTCManager(this);
        this.mainMenu.hideMainMenu();
        this.start();
    }

    /**
     * Starts the game by loading configuration and initializing necessary components.
     */
    async start() {
        await this.loadConfig();
        this.questionsManager = new QuestionsManager();
        await this.questionsManager.init(this.config.sheets);
        await this.questionsManager.waitForInitialisation();
        await this.preloadData();
        this.ui.hideLoader();
        this.mainMenu.showMainMenu();
    }

    /**
     * Loads the game configuration from a JSON file.
     * @private
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

        }
    }

    /**
     * Preloads necessary data such as sheet names and highscores.
     * @private
     */
    async preloadData() {
        try {
            const highscoresClass = new Highscores(this.questionsManager);
            this.highscores = await highscoresClass.fetchHighscores();
            this.preloadSheets();
        } catch (error) {
            console.error("Error preloading data: ", error);

        }
    }

    preloadSheets() {
        this.sheetNames = this.questionsManager.listSheets();
        this.mainMenu.setSheetNames(this.sheetNames);
    }

    /**
     * Starts a multiplayer game session.
     * @param {string[]} selectedSheets - Array of selected sheet names.
     * @param {string} difficulty - Selected difficulty level.
     * @param {boolean} isHost - Whether this player is hosting the game.
     */
    async startMultiplayerGame(selectedSheets, difficulty, isHost) {
        // Preserve existing initialization
        this.isMultiplayer = true;
        this.currentQuestions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.opponentScore = 0;  // Add opponent score reset
        
        // Keep existing question loading logic
        for (const sheetName of selectedSheets) {
            const questions = await this.questionsManager.readSheet(sheetName);
            this.currentQuestions.push(...questions);
        }
        this.shuffleQuestions();

        // Preserve existing WebRTC setup
        if (isHost) {
            await this.webRTCManager.initializeAsHost();
            this.ui.displayConnectionCode(this.webRTCManager.connectionCode);
            this.ui.showGameArea();
            this.ui.waitingMessage.textContent = 'Wachtend op andere speler...';
        } else {
            this.ui.showConnectionCodeInput();
        }
    }

    shuffleQuestions() {
        for (let i = this.currentQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.currentQuestions[i], this.currentQuestions[j]] = [this.currentQuestions[j], this.currentQuestions[i]];
        }
    }

    /**
     * Handles the connection being established between players.
     */
    handleConnectionEstablished() {
        // Hide connection status
        this.ui.connectionStatus.style.display = 'none';
        
        // Send player info immediately
        this.webRTCManager.sendMessage({
            type: 'playerInfo',
            name: this.playerName || 'Speler 1'
        });
        
        // If this is the host, send game data to the client
        if (this.webRTCManager.isHost) {
            console.log("Host sending game setup data to client");
            this.webRTCManager.sendMessage({
                type: 'gameSetup',
                questions: this.currentQuestions,
                currentIndex: this.currentQuestionIndex,
                difficulty: this.difficulty,
                hostName: this.playerName || 'Speler 1'
            });
        }
        
        // Show game UI for both host and client
        this.ui.showMultiplayerGame();
        
        // Initialize scores for both
        this.score = 0;
        this.opponentScore = 0;
        
        // Update UI with player names
        this.ui.updatePlayerNames(
            this.playerName || 'Speler 1',
            this.opponentName || 'Speler 2'
        );
        
        this.ui.updateScore(0);
        this.ui.updateOpponentScore(0);
        
        // Display the current question for the host
        if (this.webRTCManager.isHost) {
            this.displayCurrentQuestion();
        }
    }

    /**
     * Handles game setup data received from host.
     * @param {Object} data - Game setup data including questions.
     */
    handleGameSetup(data) {
        // Set game data received from host
        this.currentQuestions = data.questions;
        this.currentQuestionIndex = data.currentIndex || 0;
        this.difficulty = data.difficulty;
        this.isMultiplayer = true;
        
        // Now that we have questions, show the game UI
        this.ui.showMultiplayerGame();
        
        // Display the first question
        this.displayCurrentQuestion();
    }

    /**
     * Shows the connection code input for joining a multiplayer game.
     */
    showJoinMultiplayerGame() {
        this.mainMenu.hideMainMenu();
        this.mainMenu.hideSubMenu();
        this.ui.showMultiplayerArea(false);
        this.ui.showConnectionCodeInput();
    }

    /**
     * Connects to a multiplayer game using a connection code.
     * @param {string} code - The connection code provided by the host.
     */
    async connectToMultiplayerGame(code) {
        await this.webRTCManager.connectToHost(code);
    }

    /**
     * Handles the opponent's answer.
     * @param {string} answer - The answer selected by the opponent.
     */
    handleOpponentAnswer(answer) {
        const currentQuestion = this.currentQuestions[this.currentQuestionIndex];
        const isCorrect = answer === currentQuestion.answer;
        
        if (isCorrect) {
            this.opponentScore += this.timer ? this.timer.calculateScore(this.difficulty) : 10;
            this.ui.updateOpponentScore(this.opponentScore);
        }
    }

    /**
     * Updates the opponent's score.
     * @param {number} score - The new score for the opponent.
     */
    updateOpponentScore(score) {
        this.opponentScore = score;
        this.ui.updateOpponentScore(score);
    }

    /**
     * Handles the opponent indicating they are ready for the next question.
     */
    handleOpponentReady() {
        this.nextQuestion();
    }

    /**
     * Handles the player's answer selection in multiplayer mode.
     * @param {string} selectedAnswer - The answer selected by the player.
     * @param {Event} event - The event object from the selection.
     */
    handleMultiplayerAnswer(selectedAnswer, event) {
        this.ui.disableAnswers();

        const currentQuestion = this.currentQuestions[this.currentQuestionIndex];
        const isCorrect = selectedAnswer === currentQuestion.answer;

        this.ui.highlightCorrectAnswer(currentQuestion.answer);
        if (!isCorrect) {
            this.ui.highlightWrongAnswer(selectedAnswer);
        }

        // Calculate score increment
        let scoreIncrement = 0;
        if (isCorrect) {
            // Use timer score if available, otherwise fixed value 
            scoreIncrement = this.timer ? this.timer.calculateScore(this.difficulty) : 10;
            this.score += scoreIncrement;
            
            // Ensure UI updates BEFORE sending message
            console.log(`Updating player score to: ${this.score}`);
            this.ui.updateScore(this.score);
            
            // Send score update to opponent
            this.webRTCManager.sendMessage({
                type: 'score',
                score: this.score,
                playerName: this.playerName || 'Speler 1'
            });
        }

        // Visual feedback
        if (isCorrect) {
            this.ui.showConfetti(scoreIncrement * 2 || 30, event);
        } else {
            this.ui.showBadConfetti(10);
        }

        // Send answer to opponent
        this.webRTCManager.sendMessage({
            type: 'answer',
            answer: selectedAnswer,
            isCorrect: isCorrect
        });
        
        this.ui.showNextButton(this.nextQuestion.bind(this));
    }

    /**
     * Shows the multiplayer choice dialog.
     */
    showMultiplayerChoice() {
        // Use cleanupMultiplayerGame instead of endMultiplayerGame
        this.cleanupMultiplayerGame();
        this.mainMenu.hideMainMenu();
        this.ui.showMultiplayerChoice();
    }

    /**
     * Cleans up the multiplayer game session without showing the end dialog.
     */
    cleanupMultiplayerGame() {
        if (this.timer) this.timer.stop();
        this.webRTCManager.cleanup();
        this.ui.hideGameArea();
        this.isMultiplayer = false;
    }

    /**
     * Proceeds to the next question or ends the game if all questions are answered.
     */
    nextQuestion() {
        this.currentQuestionIndex++;
        if (this.currentQuestionIndex < this.currentQuestions.length) {
            this.displayCurrentQuestion();
            this.ui.hideNextButton();
            this.ui.enableAnswers();
            
            // In multiplayer, notify the other player
            if (this.isMultiplayer) {
                this.webRTCManager.sendMessage({ type: 'nextQuestion', index: this.currentQuestionIndex });
            }
        } else {
            // All questions answered
            if (this.isMultiplayer) {
                console.log(`Ending game with scores: ${this.score} vs ${this.opponentScore}`);
                console.log(`Player names: ${this.playerName} vs ${this.opponentName}`);
                
                // Send both scores AND names in the gameEnd message
                this.webRTCManager.sendMessage({ 
                    type: 'gameEnd', 
                    hostScore: this.score,
                    clientScore: this.opponentScore,
                    hostName: this.playerName || 'Speler 1',
                    clientName: this.opponentName || 'Speler 2'
                });
                
                // End the game locally
                this.endMultiplayerGame();
            } else {
                this.endGame();
            }
        }
    }

    /**
     * Ends the multiplayer game session.
     * @param {boolean} disconnected - Whether the game ended due to disconnection
     */
    endMultiplayerGame(disconnected = false) {
        console.log(`Ending multiplayer game. Disconnected: ${disconnected}`);
        
        if (!disconnected && this.currentQuestionIndex >= this.currentQuestions.length) {
            // Normal game end logic...
            this.ui.showMultiplayerEndGame(
                this.score,
                this.opponentScore,
                this.playerName || 'Speler 1',
                this.opponentName || 'Speler 2'
            );
        } else {
             this.mainMenu.showMainMenu();
        }
        
        // Cleanup in all cases
        this.resetGameState();
        
        // Only hide game-related screens, not dialogs
        this.ui.hideGameArea();
        this.ui.hideConnectingScreen();
        
        // Reset multiplayer flag
        this.isMultiplayer = false;
    }

    /**
     * Resets all game state to initial values
     * @private
     */
    resetGameState() {
        // Reset scores
        this.score = 0;
        this.opponentScore = 0;
        
        // Reset question tracking
        this.currentQuestionIndex = 0;
        this.currentQuestions = [];
        
        // Reset player info
        this.opponentName = null;
        
        // Clear any active timers
        if (this.timer) {
            this.timer.stop();
            this.timer = null;
        }
        
        // Clear WebRTC if exists
        if (this.webRTCManager) {
            this.webRTCManager.cleanup();
        }
        
        // Reset any other game state flags
        this.waitingForOpponent = false;
        
        console.log('Game state has been reset');
    }

    /**
     * Starts a new game with selected sheets and difficulty.
     * @param {string[]} selectedSheets - Array of selected sheet names.
     * @param {string|null} difficulty - Selected difficulty level.
     */
    async startNewGame(selectedSheets, difficulty) {
        this.mainMenu.hideMainMenu();
        this.mainMenu.hideSubMenu();
        this.ui.showGameArea();
        this.ui.enableAnswers();
        this.selectedSheets = selectedSheets;

        this.currentQuestions = [];
        for (const sheetName of selectedSheets) {
            try {
                const questions = await this.questionsManager.readSheet(sheetName);
                this.currentQuestions.push(...questions);
            } catch (error) {
                console.error(`Error loading questions for sheet "${sheetName}":`, error);

            }
        }
        this.shuffleQuestions();
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.isTestMode = difficulty !== null;
        this.difficulty = difficulty;
        if (this.isTestMode) {
            this.timer = new ScoreTimer(difficulty);
        }
        this.displayCurrentQuestion();
    }

    /**
     * Displays the current question and sets up answer options.
     * @private
     */
    displayCurrentQuestion() {
        if (this.currentQuestionIndex >= this.currentQuestions.length) return;

        // Update the progress indicator
        this.ui.updateProgress(this.currentQuestionIndex + 1, this.currentQuestions.length);
        
        const currentQuestion = this.currentQuestions[this.currentQuestionIndex];
        
        if (this.isMultiplayer) {
            // Use main game area elements instead of multiplayer-specific selectors
            this.ui.displayQuestion(currentQuestion.question);
            const answers = this.getShuffledAnswers(currentQuestion);
            this.ui.displayAnswers(answers, (selectedAnswer, event) => 
                this.handleMultiplayerAnswer(selectedAnswer, event));
        } else {
            // Single-player logic remains unchanged
            this.ui.displayQuestion(currentQuestion.question);
            const answers = this.getShuffledAnswers(currentQuestion);
            this.ui.displayAnswers(answers, (selectedAnswer, event) => 
                this.handleAnswerSelection(selectedAnswer, event));
        }

        if (this.isTestMode) {
            this.timer.start((remainingTime) => {
                this.ui.updateTimer(remainingTime);
            });
        }
    }

    /**
     * Gets a shuffled array of answers for the current question.
     * @param {{question: string, answer: string}} currentQuestion - The current question object.
     * @returns {string[]} Shuffled array of answers.
     * @private
     */
    getShuffledAnswers(currentQuestion) {
        // Extract the correct answer.
        const correctAnswer = currentQuestion.answer;

        // Filter out the correct answer and get a shuffled list of remaining answers.
        const incorrectAnswers = this.currentQuestions
            .filter(question => question.answer !== correctAnswer)
            .map(question => question.answer)
            .sort(() => 0.5 - Math.random()); // Shuffle the answers

        // Slice to get three incorrect answers.
        const selectedIncorrectAnswers = incorrectAnswers.slice(0, 3);

        // Combine the correct answer with the three incorrect answers.
        const answers = [correctAnswer, ...selectedIncorrectAnswers];

        // Shuffle the combined answers array to ensure the correct answer is not always first.
        return this.shuffleArray(answers);
    }

    /**
     * Utility function to shuffle an array.
     * @param {Array} array - The array to shuffle.
     * @returns {Array} The shuffled array.
     * @private
     */
    shuffleArray(array) {
        let currentIndex = array.length,  randomIndex;

        // While there remain elements to shuffle...
        while (currentIndex !== 0) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }

        return array;
    }

    /**
     * Handles the player's answer selection.
     * @param {string} selectedAnswer - The answer selected by the player.
     * @param {Event} event - The event object from the selection.
     * @private
     */
    handleAnswerSelection(selectedAnswer, event) {
        this.ui.disableAnswers();

        const currentQuestion = this.currentQuestions[this.currentQuestionIndex];
        const isCorrect = selectedAnswer === currentQuestion.answer;

        this.ui.highlightCorrectAnswer(currentQuestion.answer);
        if (!isCorrect) {
            this.ui.highlightWrongAnswer(selectedAnswer);
        }

        let scoreIncrement = 0;
        if (this.isTestMode) {
            scoreIncrement = isCorrect ? this.timer.calculateScore(this.difficulty) : 0;
            this.score += scoreIncrement;
            this.ui.updateScore(this.score);
        }

        if (isCorrect) {
            this.ui.showConfetti(scoreIncrement * 2 || 30, event);
        } else {
            this.ui.showBadConfetti(scoreIncrement * 3 || 10);
        }

        this.ui.showNextButton(this.nextQuestion.bind(this));
    }

    /**
     * Ends the current game session.
     */
    endGame() {
        if (this.timer) {
            this.timer.stop();
        }
        
        // Mark the connection closure as user-initiated if multiplayer
        if (this.isMultiplayer) {
            this.webRTCManager.cleanup(true); // User initiated
        }
        
        this.ui.hideNextButton();
        this.ui.hideGameArea();
        
        if (this.isTestMode) {
            this.ui.showEndOfGame(this.score);
        } else {
            this.mainMenu.showMainMenu();
        }
        
        this.isMultiplayer = false;
    }

    /**
     * Stops the current game when the user clicks the stop button.
     */
    stopGame() {
        console.log('User stopped game');
        
        // Set disconnect flag FIRST
        if (this.isMultiplayer) {
            this.webRTCManager.disconnectedByUser = true;
        }
        
        // Then handle normal cleanup
        if (this.timer) {
            this.timer.stop();
        }
        
        this.ui.hideNextButton();
        this.ui.hideGameArea();
        
        // Clean up multiplayer connections
        if (this.isMultiplayer) {
            this.webRTCManager.cleanup(true);
            this.isMultiplayer = false;
        }
        
        // Return to main menu
        this.mainMenu.showMainMenu();
    }

    /**
     * Saves the current score to the highscores.
     * @param {string} playerName - The name of the player.
     */
    async saveHighscore(playerName) {
        if (!playerName) return;
        
        const sheetKey = this.selectedSheets.join(', ');
        const isMultiplayer = this.isMultiplayer;
        
        // Get both scores for multiplayer
        const scores = isMultiplayer ? 
            [{ name: playerName, score: this.score }, 
             { name: 'Opponent', score: this.opponentScore }] :
            [{ name: playerName, score: this.score }];

        const highscoresClass = new Highscores(this.questionsManager);
        
        // Save all scores
        for (const score of scores) {
            await highscoresClass.updateHighscore(
                sheetKey,
                score.name,
                score.score,
                new Date().toISOString(),
                isMultiplayer
            );
        }
        
        alert(`Highscores saved for ${sheetKey}!`);
        this.viewHighscores();
    }

    /**
     * Restarts the game, resetting the game state.
     */
    restart() {
        this.currentQuestions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.timer = null;
        this.isTestMode = false;
        this.difficulty = null;
        this.mainMenu.showMainMenu();
    }

    /**
     * Displays the highscores.
     */
    async viewHighscores() {
        this.highscores = new Highscores();
        await this.highscores.render();
        this.ui.hideEndOfGameDialog();
        this.ui.showHighscores();
        this.mainMenu.hideMainMenu();

        // Trigger celebratory confetti
        const duration = 15 * 1000,
            animationEnd = Date.now() + duration,
            defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            confetti(Object.assign({}, defaults, {
                particleCount,
                origin: { x: Math.random(), y: Math.random() - 0.2 }
            }));
        }, 250);
    }

    /**
     * Ends the game when the opponent disconnects.
     */
    endDisconnectedGame() {
        console.log('Ending game due to disconnection');
        
        const wasMultiplayer = this.isMultiplayer;
        const userInitiated = this.webRTCManager.disconnectedByUser;
        
        if (this.timer) {
            this.timer.stop();
        }
        
        this.ui.hideNextButton();
        this.ui.hideGameArea();
        
        if (wasMultiplayer) {
            if (userInitiated) {
                // User clicked stop - go straight to main menu
                this.mainMenu.showMainMenu();
            } else {
                // Other player disconnected - show dialog
                const dialog = document.getElementById('disconnectionDialog');
                if (dialog) {
                    document.getElementById('disconnectionMessage').textContent = 
                        `${this.opponentName || 'De andere speler'} heeft de verbinding verbroken.`;
                    dialog.showModal(); // Use showModal() for HTML dialog element
                    
                    // Handle the back to main menu button
                    document.getElementById('backToMainMenu').onclick = () => {
                        dialog.close();
                        this.mainMenu.showMainMenu();
                    };
                }
            }
        }
        
        this.isMultiplayer = false;
    }

    /**
     * Handles when the opponent intentionally quits.
     */
    handleOpponentQuit() {
        console.log('Opponent intentionally quit the game');
        
        // End the game without showing the disconnection message
        if (this.timer) {
            this.timer.stop();
        }
        
        this.ui.hideNextButton();
        this.ui.hideGameArea();
        this.mainMenu.showMainMenu();
        this.isMultiplayer = false;
        
        // Maybe show a less alarming message
        alert('De andere speler heeft het spel verlaten.');
    }
}