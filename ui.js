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
        
        this.connectionStatus = document.getElementById('connectionStatus');
        this.connectionCode = document.getElementById('connectionCode');
        this.waitingMessage = document.getElementById('waitingMessage');
        this.multiplayerGame = document.getElementById('multiplayerGame');
        this.player1Score = document.getElementById('player1Score');
        this.player2Score = document.getElementById('player2Score');
        this.stopMultiplayerGame = document.getElementById('stopMultiplayerGame');
        this.multiplayerChoice = document.getElementById('multiplayerChoice');
        this.hostGameButton = document.getElementById('hostGame');
        this.joinGameButton = document.getElementById('joinGame');
        this.multiplayerEndGameDialog = document.getElementById('multiplayerEndGame');
        
        this.progressIndicator = document.getElementById('progressIndicator');
        this.currentQuestionNumber = document.getElementById('currentQuestionNumber');
        this.totalQuestions = document.getElementById('totalQuestions');
        
        // Create player score elements if they don't exist in HTML
        if (!this.player1Score) {
            this.player1Score = document.createElement('div');
            this.player1Score.id = 'player1Score';
            this.player1Score.className = 'player-score-display';
            this.player1Score.textContent = 'Speler 1: 0';
        }
        
        if (!this.player2Score) {
            this.player2Score = document.createElement('div');
            this.player2Score.id = 'player2Score';
            this.player2Score.className = 'player-score-display';
            this.player2Score.textContent = 'Speler 2: 0';
        }
    }

    /**
     * Sets up event listeners for various UI elements.
     * @private
     */
    initializeEventListeners() {
        this.nextButton.addEventListener('click', () => this.onNextClicked());
        
        // Add confirmation dialog before stopping game
        this.stopButton.addEventListener('click', () => {
            // Only show confirmation in multiplayer mode
            if (this.game.isMultiplayer) {
                if (confirm('Weet je zeker dat je het spel wilt stoppen?')) {
                    if (this.game.webRTCManager) {
                        this.game.webRTCManager.disconnectedByUser = true;
                    }
                    
                    // Ensure all UI elements are properly hidden
                    this.hideAllDialogs();
                    this.hideConnectingScreen();
                    
                    this.game.endMultiplayerGame(true); // Pass true to indicate not normal end
                }
            } else {
                // Single player doesn't need confirmation
                this.game.endGame();
            }
        });
        
        document.getElementById('saveCustomQuestionsButton').addEventListener('click', () => this.handleSaveCustomQuestions());
        document.getElementById('editCustomQuestionsButton').addEventListener('click', () => this.handleEditCustomQuestions());
        document.getElementById('deleteCustomQuestionsButton').addEventListener('click', () => this.handleDeleteCustomQuestions());
        this.initEndOfGameDialog();
        
       
        this.hostGameButton.addEventListener('click', () => {
            this.hideMultiplayerElements();
            this.game.mainMenu.selectSheets(true, true);
        });
        
        this.joinGameButton.addEventListener('click', () => {
            this.multiplayerChoice.style.display = 'none';
            this.connectionStatus.style.display = 'block';
            this.showConnectionCodeInput();
        });
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
            alert('Je vragen zijn opgeslagen!');
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

    /**
     * Hides all multiplayer related elements.
     */
    hideMultiplayerElements() {
        this.multiplayerChoice.style.display = 'none';
        this.connectionStatus.style.display = 'none';
        document.getElementById('player1Score').style.display = 'none';
        document.getElementById('player2Score').style.display = 'none';
    }

    /**
     * Shows the multiplayer game area
     */
    showMultiplayerGame() {
        // Make sure all game elements are visible
        this.gameArea.style.display = 'block';
        this.questionElement.style.display = 'block';
        this.answersElement.style.display = 'flex';
        
        // Make sure player scores div is visible
        document.getElementById('playerScores').style.display = 'flex';
        
        // Show multiplayer-specific elements
        this.player1Score.style.display = 'block';
        this.player2Score.style.display = 'block';
        
        // Make sure progress indicator is visible
        if (document.getElementById('progressIndicator')) {
            document.getElementById('progressIndicator').style.display = 'block';
        }
        
        // Hide connection-related elements
        this.hideConnectionStatus();
    }

    /**
     * Shows the multiplayer choice dialog.
     */
    showMultiplayerChoice() {
        // Retrieve saved player name from localStorage if available
        const savedName = localStorage.getItem('unicornPoepPlayerName') || '';
        
        // Update the HTML to include player name input
        this.multiplayerChoice.innerHTML = `
            <h2>Samen spelen</h2>
            <div class="name-input-container">
                <label for="playerNameInput">Je naam:</label>
                <input type="text" id="playerNameInput" placeholder="Typ je naam..." value="${savedName}">
            </div>
            <button id="hostGame" class="menuButton">Ik wil een spel starten</button>
            <button id="joinGame" class="menuButton">Ik wil meedoen met een spel</button>
        `;
        
        // Re-attach event listeners
        document.getElementById('hostGame').addEventListener('click', () => {
            const playerName = document.getElementById('playerNameInput').value.trim();
            if (playerName) {
                localStorage.setItem('unicornPoepPlayerName', playerName);
                this.game.playerName = playerName;
                this.hideMultiplayerElements();
                this.game.mainMenu.selectSheets(true, true);
            } else {
                alert('Vul alsjeblieft je naam in!');
            }
        });
        
        document.getElementById('joinGame').addEventListener('click', () => {
            const playerName = document.getElementById('playerNameInput').value.trim();
            if (playerName) {
                localStorage.setItem('unicornPoepPlayerName', playerName);
                this.game.playerName = playerName;
                this.multiplayerChoice.style.display = 'none';
                this.connectionStatus.style.display = 'block';
                this.showConnectionCodeInput();
            } else {
                alert('Vul alsjeblieft je naam in!');
            }
        });
        
        this.multiplayerChoice.style.display = 'flex';
    }

    /**
     * Shows the connection code input interface.
     */
    showConnectionCodeInput() {
        // Remove host view reference
        this.connectionCode.style.display = 'none';
        document.getElementById('joinView').style.display = 'block';
        
        const input = document.getElementById('connectionCodeInput');
        const button = document.getElementById('submitCode');
        
        console.log('Setting up join game input', button, input);
        
        // Add enter key support for numbers
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('Enter key pressed');
                const code = input.value;
                if (code.length === 6) {
                    console.log('Connecting with code (Enter):', code);
                    this.game.connectToMultiplayerGame(code);
                } else {
                    alert('Voer een 6-cijferige code in');
                }
            }
        });

        button.addEventListener('click', () => {
            console.log('Submit button clicked');
            const code = input.value;
            if (code.length === 6) {
                console.log('Connecting with code (click):', code);
                this.game.connectToMultiplayerGame(code);
            } else {
                alert('Voer een 6-cijferige code in');
            }
        });
        
        // Focus the input
        setTimeout(() => input.focus(), 100);
    }

    /**
     * Displays the connection code for the host.
     * @param {string} code - The connection code to display.
     */
    displayConnectionCode(code) {
        this.connectionStatus.style.display = 'block';
        document.getElementById('joinView').style.display = 'none';
        this.connectionCode.style.display = 'block';
        document.getElementById('hostCodeDisplay').textContent = code;
        this.waitingMessage.textContent = 'Deel deze code met de andere speler';
    }

    /**
     * Updates the player names in the UI.
     * @param {string} playerName - The local player's name
     * @param {string} opponentName - The opponent's name
     */
    updatePlayerNames(playerName, opponentName) {
        // Style the player score displays
        this.player1Score.className = 'player-score-display';
        this.player2Score.className = 'player-score-display';
        
        // Set initial content with proper formatting
        this.player1Score.innerHTML = `<span class="player-name">${playerName}</span>: <span class="score-value">0</span>`;
        this.player2Score.innerHTML = `<span class="player-name">${opponentName}</span>: <span class="score-value">0</span>`;
        
        // Apply improved styling directly
        const scoreStyles = `
            .player-score-display {
                background-color: #FFD700;
                padding: 8px 15px;
                border-radius: 20px;
                font-weight: bold;
                box-shadow: 0 3px 5px rgba(0,0,0,0.2);
                margin: 5px;
                font-size: 1.2em;
            }
            
            .player-name {
                color: #6A1B9A;
                font-weight: bold;
            }
            
            .score-value {
                color: #009688;
                font-size: 1.2em;
                font-weight: bold;
            }
        `;
        
        // Add styles to document if not already present
        if (!document.getElementById('score-display-styles')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'score-display-styles';
            styleElement.textContent = scoreStyles;
            document.head.appendChild(styleElement);
        }
    }

    /**
     * Updates the player's score display.
     * @param {number} score - The new score for the player.
     */
    updateScore(score) {
        const scoreElement = this.player1Score.querySelector('.score-value');
        if (scoreElement) {
            scoreElement.textContent = score;
        } else {
            this.player1Score.textContent = `Speler 1: ${score}`;
        }
    }

    /**
     * Updates the opponent's score display.
     * @param {number} score - The new score for the opponent.
     */
    updateOpponentScore(score) {
        // Update the score display
        const scoreElement = this.player2Score.querySelector('.score-value');
        if (scoreElement) {
            const oldScore = parseInt(scoreElement.textContent);
            scoreElement.textContent = score;
            
            // Only animate if score increased
            if (score > oldScore) {
                // Remove any existing animation class
                this.player2Score.classList.remove('score-updated');
                
                // Force browser to recognize the change before adding the class again
                void this.player2Score.offsetWidth;
                
                // Add the animation class
                this.player2Score.classList.add('score-updated');
            }
        } else {
            this.player2Score.textContent = `Speler 2: ${score}`;
        }
    }

    /**
     * Creates a small confetti effect near an element.
     * @param {HTMLElement} element - The element to show confetti near
     * @param {number} amount - The amount of confetti particles
     */
    showMiniConfetti(element, amount = 15) {
        const rect = element.getBoundingClientRect();
        const x = (rect.left + rect.right) / 2;
        const y = (rect.top + rect.bottom) / 2;
        
        confetti({
            particleCount: amount,
            spread: 40,
            origin: {
                x: x / window.innerWidth,
                y: y / window.innerHeight
            },
            colors: ['#FFD700', '#614ae2', '#2ecc71'],
            gravity: 0.5,
            scalar: 0.7,
            shapes: ['circle', 'square']
        });
    }

    /**
     * Hides the connection status elements.
     */
    hideConnectionStatus() {
        this.connectionStatus.style.display = 'none';
        this.connectionCode.style.display = 'none';
        document.getElementById('joinView').style.display = 'none';
        this.waitingMessage.textContent = '';
    }

    // Make sure single player hides multiplayer elements
    showSinglePlayerGame() {
        // Hide multiplayer elements
        document.getElementById('player1Score').style.display = 'none';
        document.getElementById('player2Score').style.display = 'none';
        document.getElementById('stopMultiplayerGame').style.display = 'none';
        
        // Show single player elements
        // (Existing code for showing the game UI)
    }

    /**
     * Shows the multiplayer end game dialog.
     */
    showMultiplayerEndGame(player1Score, player2Score, player1Name = 'Speler 1', player2Name = 'Speler 2') {
        // Remove the duplicate Game Over title that appears in the page background
        // by hiding the top-level heading element
        const gameOverHeadings = document.querySelectorAll('h1');
        if (gameOverHeadings.length > 1) {
            // Keep only the one inside the dialog visible
            for (let i = 0; i < gameOverHeadings.length - 1; i++) {
                if (!gameOverHeadings[i].closest('#multiplayerEndGame')) {
                    gameOverHeadings[i].style.display = 'none';
                }
            }
        }
        
        // Make sure player names are properly displayed 
        document.getElementById('winnerName').textContent = player1Name || 'Speler 1';
        document.getElementById('loserName').textContent = player2Name || 'Speler 2';
        
        // Continue with existing score display logic
        document.getElementById('winnerScore').textContent = player1Score;
        document.getElementById('loserScore').textContent = player2Score;
        
        // Show the dialog
        this.multiplayerEndGameDialog.showModal();
    }

    hideMultiplayerEndGame() {
        this.multiplayerEndGameDialog.close();
    }

    /**
     * Updates the question progress indicator.
     * @param {number} current - The current question number (1-based)
     * @param {number} total - The total number of questions
     */
    updateProgress(current, total) {
        this.currentQuestionNumber.textContent = current;
        this.totalQuestions.textContent = total;
    }

    /**
     * Shows a message when the opponent disconnects.
     * @param {string} playerName - The name of the player who disconnected.
     */
    showDisconnectionMessage(playerName) {
        const dialog = document.getElementById('disconnectionDialog');
        if (dialog) {
            document.getElementById('disconnectionMessage').textContent = 
                `${playerName} heeft de verbinding verbroken.`;
            dialog.showModal();
        }
    }

    /**
     * Hides all dialog elements in the game
     */
    hideAllDialogs() {
        const dialogs = [
            document.getElementById('endOfGameDialog'),
            document.getElementById('multiplayerEndGame'),
            document.getElementById('disconnectionDialog')
        ];
        
        dialogs.forEach(dialog => {
            if (dialog && dialog.open) {
                dialog.close();
            }
        });
    }

    /**
     * Hides the connecting screen
     */
    hideConnectingScreen() {
        const connectingScreen = document.getElementById('connectingScreen');
        if (connectingScreen) {
            connectingScreen.style.display = 'none';
        }
        
        // Also hide the waiting status if visible
        const waitingStatus = document.getElementById('waitingStatus');
        if (waitingStatus) {
            waitingStatus.style.display = 'none';
        }
    }
}