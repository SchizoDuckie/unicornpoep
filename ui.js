/**
 * This class handles all UI-related functionalities for the game.
 */
class UI {
    constructor(game) {
        this.game = game;
        this.questionElement = document.getElementById('question');
        this.answersElement = document.getElementById('answers');
        this.scoreElement = document.getElementById('score');
        this.timerElement = document.getElementById('timer');
        this.highscoresElement = document.getElementById('highscores');
        this.gameEndElement = document.getElementById('gameEnd');
        this.gameArea = document.getElementById('gameArea');
        this.gameNavigation = document.getElementById('gameNavigation');
        this.nextButton = document.getElementById('nextButton');
        this.nextButton.addEventListener('click', () => this.onNextClicked())
        this.loading = document.getElementById('loading');
        this.stopButton = document.getElementById('stopGame');
        this.stopButton.addEventListener('click', () => game.endGame())
        this.endOfGameDialog = document.getElementById('endOfGameDialog');
        this.finalScoreSpan = document.getElementById('finalScore');
        this.playerNameInput = document.getElementById('playerName');
        this.customQuestions = document.getElementById('customQuestionsManager')
        this.initEndOfGameDialog();

        document.getElementById('saveCustomQuestionsButton').addEventListener('click', () => this.handleSaveCustomQuestions());
        document.getElementById('editCustomQuestionsButton').addEventListener('click', () => this.handleEditCustomQuestions());
        document.getElementById('deleteCustomQuestionsButton').addEventListener('click', () => this.handleDeleteCustomQuestions());


    }

    initEndOfGameDialog() {
        document.getElementById('saveHighscore').addEventListener('click', () => {
            const playerName = this.playerNameInput.value.trim();
            if (playerName) {
                this.game.saveHighscore(playerName, this.game.score);
                this.hideEndOfGameDialog();
            } else {
                alert('Heb je geen naam?'); // Replace with a more user-friendly message if desired
            }
        });

        document.getElementById('restartGame').addEventListener('click', () => {
            this.game.restart();
            this.hideEndOfGameDialog();
        });

        document.getElementById('stopGame').addEventListener('click', () => {
            this.game.endGame();
            this.hideEndOfGameDialog();
            this.game.mainMenu.showMainMenu();
        });
    }

    showEndOfGame(score) {
        this.finalScoreSpan.textContent = score;
        this.endOfGameDialog.showModal();
    }


    hideEndOfGameDialog() {
        this.endOfGameDialog.close();
    }


    displayQuestion(question) {
        this.questionElement.textContent = question;
    }

    showGameArea() {
        this.gameArea.style.display = 'block';
    }

    hideGameArea() {
        this.gameArea.style.display = 'none';
    }

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

    highlightCorrectAnswer(correctAnswer) {
        let button = this.answersElement.querySelector('button[data-answer="'+correctAnswer+'"]');
        button.classList.add('correct-answer');
    }

    highlightWrongAnswer(wrongAnswer) {
        let button = this.answersElement.querySelector('button[data-answer="'+wrongAnswer+'"]');
        button.classList.add('wrong-answer');
    }

    hideLoader()
    {
        this.loading.style.display='none';
    }

    showLoader()
    {
        this.loading.style.display = 'block';
    }


    updateScore(score) {
        this.scoreElement.textContent = `Score: ${score}`;
    }

    updateTimer(time) {
        this.timerElement.textContent = `Time: ${Math.ceil(time / 1000)}s`;
    }


    showNextButton(onNext) {
        this.onNext = onNext;
        this.gameNavigation.classList.add('active');
    }

    hideNextButton() {
        this.onNext = null;
        this.gameNavigation.classList.remove('active');
    }

    /**
     * onNext is a callback that will be bound from the game engine
     * The 'next' button will use this callback to go to the next question.
     */
    onNextClicked() {
        if (this.onNext) {
            this.onNext();
        }
    }

    /**
     * Show Confetti at cursor position
     * @param amount
     * @param spread
     */
    showConfetti(amount=100, event) {

        confetti({
            particleCount: amount,
            spread: 70,
            origin: {
                x: event.clientX / window.innerWidth,
                y: event.clientY / window.innerHeight
            }
        });
    }

    showBadConfetti(amount=100, event=70) {
        let emojiElement = null;
        const emojisList = ["😒", "😿", "😭", "😢", "😋", "❌"];

        for(let i =0; i<100; i++) {
            emojiElement = document.createElement('div');
            emojiElement.textContent  = emojisList[Math.floor(Math.random() * emojisList.length)]; // Randomly select an emoji
            emojiElement.style.left = Math.floor(Math.random() * screen.width) + 'px';
            emojiElement.style.top = Math.floor(Math.random() * screen.height/2) + 'px';'0px';
            emojiElement.classList.add('emoji-fall');
            document.body.appendChild(emojiElement);

            // Remove the emoji after the animation is complete
            emojiElement.addEventListener('animationend', function() {
                this.parentElement.removeChild(this);
            }.bind(emojiElement))
        }
    }

    disableAnswers() {
        this.answersElement.classList.add('disable-interaction');
    }

    enableAnswers() {
        this.answersElement.classList.remove('disable-interaction');
    }

    showHighscores() {
        this.highscoresElement.style.display = 'flex';
    }

    hideHighscores() {
        this.highscoresElement.style.display = 'none';
    }

    displayEndOfGame(score, onSaveHighscore, onRestartGame) {
        // Clear existing elements and display end-of-game information
        this.gameEndElement.innerHTML = `<p>Final Score: ${score}</p>`;
        // Create buttons for saving highscore and restarting the game
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save Highscore';
        saveButton.addEventListener('click', onSaveHighscore);

        const restartButton = document.createElement('button');
        restartButton.textContent = 'Restart Game';
        restartButton.addEventListener('click', onRestartGame);

        this.gameEndElement.appendChild(saveButton);
        this.gameEndElement.appendChild(restartButton);
        this.gameEndElement.style.display = 'block';
    }

    showCustomQuestions() {
        this.customQuestions.style.display = 'flex';
    }

    hideCustomQuestions() {
        this.customQuestions.style.display = 'none';
    }

    handleSaveCustomQuestions() {
        const customText = document.getElementById('customQuestionsInput').value;
        const sheetName = document.getElementById('customSheetName').value.trim();
        if (sheetName) {
            questionsManager.saveCustomQuestions(sheetName, customText);
            alert('Custom questions saved.');
        } else {
            alert('Please enter a sheet name.');
        }
    }

    handleEditCustomQuestions() {
        const sheetName = document.getElementById('customSheetName').value.trim();
        if (sheetName) {
            const customQuestions = questionsManager.getCustomQuestions(sheetName);
            if (customQuestions) {
                document.getElementById('customQuestionsInput').value = convertQuestionsToText(customQuestions);
            } else {
                alert('Sheet not found.');
            }
        } else {
            alert('Please enter a sheet name.');
        }
    }

    handleDeleteCustomQuestions() {
        const sheetName = document.getElementById('customSheetName').value.trim();
        if (sheetName) {
            questionsManager.deleteCustomQuestions(sheetName);
            alert('Custom sheet deleted.');
        } else {
            alert('Please enter a sheet name.');
        }
    }

    convertQuestionsToText(questions) {
        return questions.map(q => `${q.question}\t${q.answer}`).join('\n');
    }

}
