/**
 * Manages the user interface for the Unicorn Poep game.
 */
class UI {
    /**
     * Creates a new UI instance.
     * @param {Game} game - The main Game instance.
     */
    constructor(game) {
        this.game = game;
        this.initializeElements();
        this.initializeEventListeners();
    }

    /**
     * Initializes DOM elements used in the UI.
     * @private
     */
    initializeElements() {
        this.questionElement = document.getElementById('question');
        this.answersElement = document.getElementById('answers');
        this.scoreElement = document.getElementById('score');
        this.timerElement = document.getElementById('timer');
        this.highscoresElement = document.getElementById('highscores');
        this.gameEndElement = document.getElementById('gameEnd');
        this.gameArea = document.getElementById('gameArea');
        this.gameNavigation = document.getElementById('gameNavigation');
        this.nextButton = document.getElementById('nextButton');
        this.loading = document.getElementById('loading');
        this.stopButton = document.getElementById('stopGame');
        this.endOfGameDialog = document.getElementById('endOfGameDialog');
        this.finalScoreSpan = document.getElementById('finalScore');
        this.playerNameInput = document.getElementById('playerName');
        this.customQuestions = document.getElementById('customQuestionsManager');
        this.aboutPage = document.getElementById('about');
        this.customSheetNameInput = document.getElementById('customSheetName');
        this.customQuestionsTextarea = document.getElementById('customQuestionsTextarea');
        this.existingCustomSheetsSelect = document.getElementById('existingCustomQuestions');
    }

    /**
     * Sets up event listeners for various UI elements.
     * @private
     */
    initializeEventListeners() {
        this.nextButton.addEventListener('click', () => this.onNextClicked());
        this.stopButton.addEventListener('click', () => this.game.endGame());
        document.getElementById('saveCustomQuestionsButton').addEventListener('click', () => this.handleSaveCustomQuestions());
        document.getElementById('editCustomQuestionsButton').addEventListener('click', () => this.handleEditCustomQuestions());
        document.getElementById('deleteCustomQuestionsButton').addEventListener('click', () => this.handleDeleteCustomQuestions());
        this.initEndOfGameDialog();
    }

    /**
     * Initializes the end-of-game dialog.
     * @private
     */
    initEndOfGameDialog() {
        document.getElementById('saveHighscore').addEventListener('click', () => {
            const playerName = this.playerNameInput.value.trim();
            if (playerName) {
                this.game.saveHighscore(playerName, this.game.score);
                this.hideEndOfGameDialog();
            } else {
                alert('Heb je geen naam?');
            }
        });

        document.getElementById('restartGame').addEventListener('click', () => {
            this.game.restart();
            this.hideEndOfGameDialog();
        });
    }

    /**
     * Displays the current question.
     * @param {string} question - The question to display.
     */
    displayQuestion(question) {
        this.questionElement.textContent = question;
    }

    /**
     * Displays answer options and sets up click handlers.
     * @param {string[]} answers - An array of answer options.
     * @param {Function} answerCallback - Callback function for answer selection.
     */
    displayAnswers(answers, answerCallback) {
        this.answersElement.innerHTML = '';
        answers.forEach(answer => {
            const button = document.createElement('button');
            button.textContent = answer;
            button.className = 'answerButton';
            button.setAttribute('data-answer', answer);
            button.addEventListener('click', (e) => answerCallback(answer, e));
            this.answersElement.appendChild(button);
        });
    }

    /**
     * Highlights the correct answer.
     * @param {string} correctAnswer - The correct answer to highlight.
     */
    highlightCorrectAnswer(correctAnswer) {
        const button = this.answersElement.querySelector(`button[data-answer="${correctAnswer}"]`);
        if (button) button.classList.add('correct-answer');
    }

    /**
     * Highlights a wrong answer.
     * @param {string} wrongAnswer - The wrong answer to highlight.
     */
    highlightWrongAnswer(wrongAnswer) {
        const button = this.answersElement.querySelector(`button[data-answer="${wrongAnswer}"]`);
        if (button) button.classList.add('wrong-answer');
    }

    /**
     * Updates the displayed score.
     * @param {number} score - The current score to display.
     */
    updateScore(score) {
        this.scoreElement.textContent = `Score: ${score}`;
    }

    /**
     * Updates the displayed timer.
     * @param {number} time - The current time remaining in milliseconds.
     */
    updateTimer(time) {
        this.timerElement.textContent = `Time: ${Math.ceil(time / 1000)}s`;
    }

    /**
     * Shows the 'Next' button and sets up its callback.
     * @param {Function} onNext - Callback function for the 'Next' button.
     */
    showNextButton(onNext) {
        this.onNext = onNext;
        this.gameNavigation.classList.add('active');
    }

    /**
     * Hides the 'Next' button.
     */
    hideNextButton() {
        this.onNext = null;
        this.gameNavigation.classList.remove('active');
    }

    /**
     * Handles the 'Next' button click.
     * @private
     */
    onNextClicked() {
        if (this.onNext) {
            this.onNext();
        }
    }

    /**
     * Displays confetti animation at the cursor position.
     * @param {number} amount - The amount of confetti particles.
     * @param {Event} event - The click event object.
     */
    showConfetti(amount = 40, event) {
        confetti({
            particleCount: amount,
            spread: 70,
            ticks: 100,
            origin: {
                x: event.clientX / window.innerWidth,
                y: event.clientY / window.innerHeight
            }
        });
    }

    /**
     * Displays a "bad" confetti animation (falling emojis).
     * @param {number} amount - The amount of emoji particles.
     */
    showBadConfetti(amount = 100) {
        const emojisList = ["😒", "😿", "😭", "😢", "😋", "❌"];
        for (let i = 0; i < amount; i++) {
            const emojiElement = document.createElement('div');
            emojiElement.textContent = emojisList[Math.floor(Math.random() * emojisList.length)];
            emojiElement.style.left = `${Math.random() * 100}vw`;
            emojiElement.style.top = `${Math.random() * 40}vh`;
            emojiElement.classList.add('emoji-fall');
            document.body.appendChild(emojiElement);
            emojiElement.addEventListener('animationend', () => emojiElement.remove());
        }
    }

    /**
     * Disables answer buttons.
     */
    disableAnswers() {
        this.answersElement.classList.add('disable-interaction');
    }

    /**
     * Enables answer buttons.
     */
    enableAnswers() {
        this.answersElement.classList.remove('disable-interaction');
    }

    /**
     * Shows the custom questions management interface.
     */
    showCustomQuestions() {
        this.customQuestions.style.display = 'flex';
        this.updateExistingCustomSheets();
    }

    /**
     * Hides the custom questions management interface.
     */
    hideCustomQuestions() {
        this.customQuestions.style.display = 'none';
    }

    /**
     * Updates the list of existing custom question sheets.
     * @private
     */
    updateExistingCustomSheets() {
        const sheets = this.game.questionsManager.listCustomSheets();
        this.existingCustomSheetsSelect.innerHTML = '<option value="">Kies een vragenlijst om te bewerken</option>';
        sheets.forEach(sheet => {
            const option = document.createElement('option');
            option.value = sheet;
            option.textContent = sheet;
            this.existingCustomSheetsSelect.appendChild(option);
        });
    }
    /**
     * Handles saving custom questions.
     * @private
     */
    handleSaveCustomQuestions() {
        const sheetName = this.customSheetNameInput.value.trim();
        const customText = this.customQuestionsTextarea.value.trim();
        if (sheetName && customText) {
            this.game.questionsManager.saveCustomQuestions(sheetName, customText);
            alert('Jouw vragen zijn opgeslagen!');
            this.updateExistingCustomSheets();
        } else {
            alert('Vul alsjeblieft een naam voor je vragenlijst in en typ wat vragen.');
        }
    }

    /**
     * Handles editing custom questions.
     * @private
     */
    handleEditCustomQuestions() {
        const sheetName = this.existingCustomSheetsSelect.value;
        if (sheetName) {
            const questions = this.game.questionsManager.getCustomQuestions(sheetName);
            if (questions) {
                this.customSheetNameInput.value = sheetName;
                this.customQuestionsTextarea.value = this.convertQuestionsToText(questions);
            } else {
                alert('Vragenlijst niet gevonden.');
            }
        } else {
            alert('Kies eerst een vragenlijst om te bewerken.');
        }
    }

    /**
     * Handles deleting custom questions.
     * @private
     */
    handleDeleteCustomQuestions() {
        const sheetName = this.existingCustomSheetsSelect.value;
        if (sheetName) {
            if (confirm(`Weet je zeker dat je de vragenlijst "${sheetName}" wilt verwijderen?`)) {
                this.game.questionsManager.deleteCustomQuestions(sheetName);
                alert('Vragenlijst verwijderd.');
                this.updateExistingCustomSheets();
            }
        } else {
            alert('Kies eerst een vragenlijst om te verwijderen.');
        }
    }

    /**
     * Converts an array of question objects to a formatted string.
     * @param {Array<{question: string, answer: string}>} questions - Array of question objects.
     * @returns {string} Formatted string of questions and answers.
     * @private
     */
    convertQuestionsToText(questions) {
        return questions.map(q => `${q.question} => ${q.answer}`).join('\n');
    }

    /**
     * Shows the game area.
     */
    showGameArea() {
        this.gameArea.style.display = 'block';
    }

    /**
     * Hides the game area.
     */
    hideGameArea() {
        this.gameArea.style.display = 'none';
    }

    /**
     * Shows the about page.
     */
    showAbout() {
        this.aboutPage.style.display = 'flex';
    }

    /**
     * Hides the about page.
     */
    hideAbout() {
        this.aboutPage.style.display = 'none';
    }

    /**
     * Shows the highscores.
     */
    showHighscores() {
        this.highscoresElement.style.display = 'flex';
    }

    /**
     * Hides the highscores.
     */
    hideHighscores() {
        this.highscoresElement.style.display = 'none';
    }

    /**
     * Shows the end of game dialog.
     * @param {number} score - The final score to display.
     */
    showEndOfGame(score) {
        this.finalScoreSpan.textContent = score;
        this.endOfGameDialog.showModal();
    }

    /**
     * Hides the end of game dialog.
     */
    hideEndOfGameDialog() {
        this.endOfGameDialog.close();
    }

    /**
     * Hides the loader.
     */
    hideLoader() {
        this.loading.style.display = 'none';
    }

    /**
     * Shows the loader.
     */
    showLoader() {
        this.loading.style.display = 'block';
    }
}