/**
 * Main game class that orchestrates the gameplay, manages game states, and handles user interactions.
 */
class Game {
    constructor() {
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
     * Initializes and starts the game.
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
     * Loads configuration from the config.json file.
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
     * Preloads necessary data like sheet names and highscores.
     */
    async preloadData() {
        console.log("Preloading spreadsheet data");
        try {
            this.sheetNames = this.questionsManager.listSheets();
            const highscoresClass = new Highscores(this.questionsManager);
            this.highscores = await highscoresClass.fetchHighscores();
            this.mainMenu.setSheetNames(this.sheetNames);

        } catch (error) {
            console.error("Error preloading data: ", error);
        }
    }

    /**
     * Starts a new game with the selected sheets and difficulty.
     * @param {Array} selectedSheets Array of selected sheet names.
     * @param {string|null} difficulty The selected difficulty (null for practice mode).
     */
    async startNewGame(selectedSheets, difficulty) {
        this.mainMenu.hideMainMenu();
        this.mainMenu.hideSubMenu();
        this.ui.showGameArea();
        this.ui.enableAnswers();

        this.currentQuestions = [];
        for (const sheetName of selectedSheets) {
            const questionSheet = new QuestionSheet(this.questionsManager, sheetName);
            await questionSheet.fetchQuestions();
            this.currentQuestions.push(...questionSheet.questions);
        }
        this.shuffleQuestions();
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.isTestMode = difficulty !== null;
        this.difficulty = difficulty;
        if(this.isTestMode) {
            this.timer = new ScoreTimer(difficulty);
        }
        this.displayCurrentQuestion();
    }

    restart() {
        this.mainMenu.hideMainMenu();
        this.mainMenu.hideSubMenu();
        this.ui.showGameArea();
        this.ui.enableAnswers();
        this.ui.hideEndOfGameDialog();
        this.shuffleQuestions();
        this.currentQuestionIndex = 0;
        this.score = 0;
        if(this.isTestMode) {
            this.timer = new ScoreTimer(this.getTimerDuration(difficulty));
        }
        this.displayCurrentQuestion();
    }

    /**
     * Shuffles the current questions array to randomize the order.
     */
    shuffleQuestions() {
        for (let i = this.currentQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.currentQuestions[i], this.currentQuestions[j]] = [this.currentQuestions[j], this.currentQuestions[i]];
        }
    }

    /**
     * Displays the current question and sets up answer options.
     */
    displayCurrentQuestion() {
        const currentQuestion = this.currentQuestions[this.currentQuestionIndex];
        this.ui.displayQuestion(currentQuestion.question);
        const answers = this.getShuffledAnswers(currentQuestion);
        this.ui.displayAnswers(answers, (selectedAnswer, event) => this.handleAnswerSelection(selectedAnswer, event));
        if(this.isTestMode) {
            this.timer.start((remainingTime) => {
                this.ui.updateTimer(remainingTime);
            });
        }
    }

    /**
     * Gets a shuffled array of answers for the current question.
     * Includes one correct answer and three incorrect answers.
     * @param {Object} currentQuestion The current question object.
     * @returns {Array} Shuffled array of answers.
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
     * Utility function to shuffle an array (Fisher-Yates shuffle algorithm).
     * @param {Array} array The array to shuffle.
     * @returns {Array} The shuffled array.
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
     * @param {string} selectedAnswer The answer selected by the player.
     */
    handleAnswerSelection(selectedAnswer, event) {
        this.ui.disableAnswers();

        let scoreIncrement = 0;
        const isCorrect = selectedAnswer === this.currentQuestions[this.currentQuestionIndex].answer;
        if (this.isTestMode) {
            scoreIncrement = isCorrect ? this.timer.calculateScore(this.difficulty) : 0;
            this.score += scoreIncrement;
            this.ui.updateScore(this.score);
        }

        if(isCorrect) {
            if(scoreIncrement == 0) {
                scoreIncrement = 10;
            }
            this.ui.showConfetti(scoreIncrement*3, event);
        } else {
            this.ui.showBadConfetti(scoreIncrement, event);
        }

        this.ui.showNextButton(this.nextQuestion.bind(this));
    }




    /**
     * Proceeds to the next question in the game.
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
     * Ends the current game session and handles post-game activities.
     */
    endGame() {
        if(this.timer) {
            this.timer.stop();
        }
        // Display the final score and provide options to save to highscores, restart, or return to menu
        this.ui.hideNextButton();
        this.ui.hideGameArea();
        if(this.isTestMode) {
            this.ui.showEndOfGame(this.score);
        } else {
            this.mainMenu.showMainMenu();
        }

    }

    /**
     * Saves the current score to the highscores.
     * This method could be expanded to prompt for the player's name.
     */
    async saveHighscore(playerName) {

        if (playerName) {
            const highscoresClass = new Highscores(this.questionsManager);
            await highscoresClass.updateHighscore(playerName, this.score, new Date().toISOString());
            alert("Highscore opgeslagen!");
        }
        this.viewHighscores();
    }

    /**
     * Restarts the game, resetting the game state and showing the main menu.
     */
    restartGame() {
        this.currentQuestions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.timer = null;
        this.isTestMode = false;
        this.difficulty = null;
        this.mainMenu.display();
    }

    /**
     * Displays the highscores.
     */
    async viewHighscores() {
        this.highscores = new Highscores();
        this.highscores.render();
        // Logic to display highscores in the UI
        this.ui.hideEndOfGameDialog();
        this.ui.showHighscores();
        this.mainMenu.hideMainMenu();


        const duration = 15 * 1000,
            animationEnd = Date.now() + duration,
            defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            // since particles fall down, start a bit higher than random
            confetti(
                Object.assign({}, defaults, {
                    particleCount,
                    origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
                })
            );
            confetti(
                Object.assign({}, defaults, {
                    particleCount,
                    origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
                })
            );
        }, 250);
    }



}
