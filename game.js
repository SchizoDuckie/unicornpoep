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
        this.timer = null;
        this.isTestMode = false;
        this.difficulty = null;
        this.config = null;
        this.questionsManager = null;
        this.mainMenu = new MainMenu(this);
        this.ui = new UI(this);
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
            // Consider implementing a fallback configuration or error handling strategy
        }
    }

    /**
     * Preloads necessary data such as sheet names and highscores.
     * @private
     */
    async preloadData() {
        console.log("Preloading spreadsheet data");
        try {
            const highscoresClass = new Highscores(this.questionsManager);
            this.highscores = await highscoresClass.fetchHighscores();
            this.preloadSheets();
        } catch (error) {
            console.error("Error preloading data: ", error);
            // Consider implementing a retry mechanism or fallback data
        }
    }

    preloadSheets() {
        this.sheetNames = this.questionsManager.listSheets();
        this.mainMenu.setSheetNames(this.sheetNames);
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
                // Consider notifying the user about the error
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
     * Shuffles the current questions array.
     * @private
     */
    shuffleQuestions() {
        for (let i = this.currentQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.currentQuestions[i], this.currentQuestions[j]] = [this.currentQuestions[j], this.currentQuestions[i]];
        }
    }

    /**
     * Displays the current question and sets up answer options.
     * @private
     */
    displayCurrentQuestion() {
        const currentQuestion = this.currentQuestions[this.currentQuestionIndex];
        this.ui.displayQuestion(currentQuestion.question);
        const answers = this.getShuffledAnswers(currentQuestion);
        this.ui.displayAnswers(answers, (selectedAnswer, event) => this.handleAnswerSelection(selectedAnswer, event));
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
            this.ui.showConfetti(scoreIncrement * 3 || 30, event);
        } else {
            this.ui.showBadConfetti(scoreIncrement || 10);
        }

        this.ui.showNextButton(this.nextQuestion.bind(this));
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
        } else {
            this.endGame();
        }
    }

    /**
     * Ends the current game session.
     */
    endGame() {
        if (this.timer) {
            this.timer.stop();
        }
        this.ui.hideNextButton();
        this.ui.hideGameArea();
        if (this.isTestMode) {
            this.ui.showEndOfGame(this.score);
        } else {
            this.mainMenu.showMainMenu();
        }
    }

    /**
     * Saves the current score to the highscores.
     * @param {string} playerName - The name of the player.
     */
    async saveHighscore(playerName) {
        if (playerName) {
            const highscoresClass = new Highscores(this.questionsManager);
            await highscoresClass.updateHighscore(this.selectedSheets.join(', '), playerName, this.score, new Date().toISOString());
            alert(`Highscore for ${this.selectedSheets.join(' and ')} saved!`);
        }
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
}