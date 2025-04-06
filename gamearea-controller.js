/**
 * Manages the Game Area UI: questions, answers, score, timer, progress, buttons.
 * Uses class toggling (.hidden) for visibility.
 */
class GameAreaController {
    /**
     * Initializes the controller, gets elements, and sets up listeners.
     * @param {MainMenu} mainMenu - The central orchestrator instance (mainMenu).
     */
    constructor(mainMenu) {
        if (!mainMenu) {
            throw new Error("GameAreaController requires a MainMenu instance!");
        }
        this.mainMenu = mainMenu; // Store the MainMenu instance

        this.container = document.getElementById('gameArea');
        this.questionElement = document.getElementById('question');
        this.answersElement = document.getElementById('answers');
        this.timerElement = document.getElementById('timer');
        this.scoreElement = document.getElementById('score');
        this.playerScoresElement = document.getElementById('playerScores');
        this.player1ScoreElement = document.getElementById('player1Score');
        this.player2ScoreElement = document.getElementById('player2Score');
        this.progressIndicatorElement = document.getElementById('progressIndicator');
        this.currentQuestionNumberElement = document.getElementById('currentQuestionNumber');
        this.totalQuestionsElement = document.getElementById('totalQuestions');
        this.gameNavigationElement = document.getElementById('gameNavigation');
        this.nextButton = document.getElementById('nextButton');
        this.stopButton = document.getElementById('stopGame');
        this.answersAreEnabled = false;
        this.opponentListElement = document.getElementById('opponentList');
        this.countdownDisplay = document.getElementById('countdownDisplay');
        this.gameElementsContainer = document.getElementById('gameElements');
        this.waitingUiContainer = document.getElementById('waitingUi');
        this.waitingMessageElement = document.getElementById('waitingMessageText');
        this.playerNameElement = document.getElementById('playerNameDisplayInGame');
        this.waitingUiElement = document.getElementById('waitingUi');
        if (!this.waitingUiElement) {
            console.warn("GameAreaController: Waiting UI element (#waitingUi) not found.");
        }

        this.hide(); // Add .hidden class initially
    }

    /** Shows the game area UI and sets up session listeners. */
    show() {
        console.log("GameAreaCtrl: show() called.");
        this.container.classList.remove('hidden');

        // --- Force Listener Setup ---
        console.log("GameAreaCtrl: Force removing/adding listeners in show().");

        const currentGame = this.mainMenu.currentGame;
        if (!currentGame) {
            console.error("GameAreaCtrl show(): Cannot set up listeners, currentGame is null.");
            return;
        }

        // --- Next Button Listener ---
        if (this.nextButton) {
            // Remove any existing listener first (using the stored reference if it exists)
            if (this._nextButtonClickListener) {
                console.log("GameAreaCtrl show(): Removing previous nextButton listener.");
                this.nextButton.removeEventListener('click', this._nextButtonClickListener);
            } else {
                 console.log("GameAreaCtrl show(): No previous nextButton listener reference found to remove.");
            }

            // Define the new listener function
            this._nextButtonClickListener = () => {
                console.log("--- NEXT BUTTON CLICKED ---"); // <<< Make this log stand out
                this.hideNextButton();
                this.resetAnswerHighlights();

                if (typeof currentGame.proceedToNextQuestion === 'function') {
                    console.log(`GameAreaCtrl (Next): Calling proceedToNextQuestion on ${currentGame.constructor.name}`);
                    currentGame.proceedToNextQuestion();
                } else {
                    console.error(`GameAreaCtrl (Next): currentGame (${currentGame.constructor.name}) does not have proceedToNextQuestion method!`);
                }
            };

            // Add the new listener
            console.log("GameAreaCtrl show(): Adding new nextButton listener.");
            this.nextButton.addEventListener('click', this._nextButtonClickListener);
        } else {
            console.error("GameAreaCtrl show(): Cannot add Next button listener, element not found.");
        }

        // --- Answer Button Listener (Delegate) ---
         if (this.answersElement) {
             if (this._answerClickListener) {
                 this.answersElement.removeEventListener('click', this._answerClickListener);
             }
             this._answerClickListener = (event) => {
                 if (event.target.classList.contains('answer-button')) {
                     this._handleAnswerClick(event);
                 }
             };
             this.answersElement.addEventListener('click', this._answerClickListener);
             console.log("GameAreaCtrl show(): Added Answer listener.");
         } else {
             console.error("GameAreaCtrl show(): Cannot add Answer listener, element not found.");
         }


        // --- Stop Button Listener ---
        if (this.stopButton) {
            if (this._stopButtonClickListener) {
                this.stopButton.removeEventListener('click', this._stopButtonClickListener);
            }
            this._stopButtonClickListener = () => {
                console.log("--- STOP BUTTON CLICKED ---");
                if (typeof currentGame.stopGame === 'function') {
                    currentGame.stopGame();
                } else { console.error("Current game instance lacks stopGame()!"); }
            };
            this.stopButton.addEventListener('click', this._stopButtonClickListener);
             console.log("GameAreaCtrl show(): Added Stop listener.");
        } else {
             console.error("GameAreaCtrl show(): Cannot add Stop listener, element not found.");
        }

        console.log("GameAreaCtrl show(): Listener setup complete.");
    }

    /** Hides the game area container and explicitly removes listeners. */
    hide() {
        console.log("GameAreaCtrl: hide() called.");
        this.container.classList.add('hidden');

        // Remove listeners to prevent memory leaks and duplicate handlers
        console.log("GameAreaCtrl hide(): Removing listeners.");
        if (this._nextButtonListener) {
            console.log("   - Removing existing nextButton listener.");
            this.nextButton.removeEventListener('click', this._nextButtonListener);
            this._nextButtonListener = null; // Clear the reference
        } else {
            console.log("   - No nextButton listener reference found to remove.");
        }
        if (this._answerClickListener) {
            console.log("   - Removing existing answer listener.");
            this.answersElement.removeEventListener('click', this._answerClickListener);
            this._answerClickListener = null; // Clear the reference
        } else {
            console.log("   - No answer listener reference found to remove.");
        }
        if (this._stopButtonListener) {
            console.log("   - Removing existing stopButton listener.");
            this.stopButton.removeEventListener('click', this._stopButtonListener);
            this._stopButtonListener = null;
        } else {
             console.log("   - No stopButton listener reference found to remove.");
        }

        // Remove answer listeners (assuming they are attached directly)
        this.answersElement.querySelectorAll('button').forEach(button => {
            // We need a way to reference the specific bound function to remove it.
            // This requires storing the listener reference when adding it.
            // For now, let's log a warning if we can't remove them properly.
             console.warn("GameAreaCtrl hide(): Cannot reliably remove answer listeners without stored references.");
             // If _handleAnswerClick was stored: 
             // button.removeEventListener('click', this._boundHandleAnswerClick);
        });

        // --- Original hide actions ---
        this.hideCountdownOverlay();
        this.hideGameCoreElements(); // Ensure core elements hidden on hide
        this.hideWaitingUi(); // Ensure waiting UI hidden on hide
        // --- End Original hide actions ---
    }
    /** Checks if the game area is currently visible. @returns {boolean} */
    isVisible() { return !this.container.classList.contains('hidden'); }

    /** Prepares UI for single player (practice or test mode). */
    prepareSinglePlayerUI() {
        // Access game properties via the hub and currentGame
        const isTest = this.mainMenu.currentGame.isTestMode;
        // Assumes base style for score/timer is display: block
        isTest ? this.scoreElement.classList.remove('hidden') : this.scoreElement.classList.add('hidden');
        isTest ? this.timerElement.classList.remove('hidden') : this.timerElement.classList.add('hidden');

        this.playerScoresElement.classList.add('hidden'); // Hide multiplayer scores
        this.progressIndicatorElement.classList.remove('hidden'); // Show progress
        this.opponentListElement.classList.add('hidden'); // Hide opponent list
        this.playerNameElement.classList.remove('hidden'); // Show SP name

        if (this.scoreElement) this.scoreElement.textContent = "Score: 0";
        if (this.timerElement) this.timerElement.textContent = ""; // Clear timer text initially
    }

    /**
     * Prepares UI for multiplayer mode.
     * @param {string} player1Name - Name of the local player.
     * @param {string} player2Name - Name of the opponent.
     */
    prepareMultiplayerUI(player1Name, player2Name) {
        // No direct game access needed here if UI elements are just shown/hidden
        this.timerElement.classList.remove('hidden'); // Show timer
        this.playerScoresElement.classList.remove('hidden'); // Show multiplayer scores
        this.progressIndicatorElement.classList.remove('hidden'); // Show progress
        this.opponentListElement.classList.add('hidden'); // Ensure opponent LIST is hidden
        this.scoreElement.classList.add('hidden'); // Hide single player score element
        this.playerNameElement.classList.add('hidden'); // Hide single player name display element
        this.updatePlayerNames(player1Name, player2Name);
    }

    /**
     * Sets the initial displayed player names and score structure in multiplayer.
     * @param {string} player1Name - Local player's name.
     * @param {string} player2Name - Opponent's name.
     */
    updatePlayerNames(player1Name, player2Name) {
        // Ensure scores are initialized to 0 visually when names are set
        if (this.player1ScoreElement) this.player1ScoreElement.innerHTML = `<span class="player-name">${player1Name || 'Jij'}</span>: <span class="score-value">0</span>`;
        if (this.player2ScoreElement) this.player2ScoreElement.innerHTML = `<span class="player-name">${player2Name || 'Ander'}</span>: <span class="score-value">0</span>`;
    }

    /**
     * Displays the question text.
     * @param {string} questionText - The text of the question.
     */
    displayQuestion(questionText) { if (this.questionElement) this.questionElement.textContent = questionText; }

    /**
     * Creates and displays answer buttons, attaching click listeners.
     * Also ensures the answer container is visible.
     * @param {string[]} answers - Array of answer strings.
     */
    displayAnswers(answers) {
        if (!this.answersElement) return;
        this.answersElement.innerHTML = ''; this.resetAnswerHighlights();
        answers.forEach(answer => {
            const button = document.createElement('button');
            button.textContent = answer; button.className = 'answerButton';
            button.setAttribute('data-answer', answer);
            button.addEventListener('click', (event) => {
                // Access handleAnswerSelection via the hub and currentGame
                if (this.answersAreEnabled) this.mainMenu.currentGame.handleAnswerSelection(answer, event);
            });
            this.answersElement.appendChild(button);
        });
        this.showAnswers();
        this.enableAnswers();
    }

    /** Shows the container for answer buttons. */
    showAnswers() {
        this.answersElement.classList.remove('hidden');
    }

    /** Hides the container for answer buttons. */
    hideAnswers() {
        this.answersElement.classList.add('hidden');
    }

    /** Shows the question display element. */
    showQuestion() {
        this.questionElement.classList.remove('hidden');
    }

    /** Hides the question display element. */
    hideQuestion() {
        this.questionElement.classList.add('hidden');
    }

    /** Shows the timer display element. */
    showTimer() {
        this.timerElement.classList.remove('hidden');
    }

    /** Hides the timer display element. */
    hideTimer() {
        this.timerElement.classList.add('hidden');
    }

    /** Enables answer buttons for interaction. */
    enableAnswers() { if (this.answersElement) this.answersElement.classList.remove('disable-interaction'); this.answersAreEnabled = true; }
    /** Disables answer buttons from interaction. */
    disableAnswers() { if (this.answersElement) this.answersElement.classList.add('disable-interaction'); this.answersAreEnabled = false; }
    /** Checks if answer buttons are currently enabled. @returns {boolean} */
    areAnswersEnabled() { return this.answersAreEnabled; }

    /**
     * Highlights the button corresponding to the correct answer.
     * @param {string} correctAnswer - The correct answer string.
     */
    highlightCorrectAnswer(correctAnswer) {
        this.answersElement.querySelectorAll('.answerButton').forEach(button => {
            if (button.getAttribute('data-answer') === correctAnswer) button.classList.add('correct-answer');
        });
    }
    /**
     * Highlights the button corresponding to the wrong answer selected.
     * @param {string} wrongAnswer - The incorrect answer string selected by the player.
     */
    highlightWrongAnswer(wrongAnswer) {
        this.answersElement.querySelectorAll('.answerButton').forEach(button => {
            if (button.getAttribute('data-answer') === wrongAnswer) button.classList.add('wrong-answer');
        });
    }
    /** Removes all correct/wrong answer highlighting from buttons. */
    resetAnswerHighlights() {
        this.answersElement.querySelectorAll('.answerButton').forEach(button => {
            button.classList.remove('correct-answer', 'wrong-answer');
        });
    }

    /**
     * Updates the score display (single player or player 1 in multiplayer).
     * @param {number} score - The score value.
     */
    updateScore(score) {
        const scoreVal = Math.max(0, score); // Ensure non-negative
        // Access game properties via the hub and currentGame
        const isMulti = this.mainMenu.currentGame.isMultiplayer;
        const isTest = this.mainMenu.currentGame.isTestMode;

        if (isMulti && this.player1ScoreElement) {
            const scoreValueElement = this.player1ScoreElement.querySelector('.score-value');
            if (scoreValueElement) {
                 scoreValueElement.textContent = scoreVal;
                 console.log(`GameAreaCtrl updateScore (MP): Found .score-value element, set textContent to ${scoreVal}`);
             } else {
                 console.error(`GameAreaCtrl updateScore (MP): Could not find .score-value inside player1ScoreElement!`);
             }
        } else if (isTest && this.scoreElement) { // Check isTest here, not just rely on element existence
            this.scoreElement.textContent = `Score: ${scoreVal}`;
            console.log(`GameAreaCtrl updateScore (Test): Set scoreElement textContent to Score: ${scoreVal}`);
        }
    }
    /**
     * Updates the opponent's score display in multiplayer. Adds animation on increase.
     * @param {number} score - The opponent's score value.
     */
    updateOpponentScore(score) {
        // Access game properties via the hub and currentGame
        if (!this.mainMenu.currentGame.isMultiplayer || !this.player2ScoreElement) return;
        const scoreVal = Math.max(0, score); // Ensure non-negative
        const scoreValueElement = this.player2ScoreElement.querySelector('.score-value');
        if (scoreValueElement) {
            const oldScore = parseInt(scoreValueElement.textContent || '0');
             scoreValueElement.textContent = scoreVal;
             if(scoreVal > oldScore) {
                 // Manage score update animation class
                 this.player2ScoreElement.classList.remove('score-updated');
                 void this.player2ScoreElement.offsetWidth; // Trigger reflow
                 this.player2ScoreElement.classList.add('score-updated');
                 // Remove class after animation duration (600ms based on CSS)
                 setTimeout(() => this.player2ScoreElement.classList.remove('score-updated'), 600);
             }
        }
    }
     /** Shows a small confetti burst near the opponent's score element. */
     showMiniConfettiForOpponent() {
        // Access game properties via the hub and currentGame
        if (this.mainMenu.currentGame.isMultiplayer && this.player2ScoreElement) this.showMiniConfetti(this.player2ScoreElement);
     }

    /**
     * Updates the timer display. Shows remaining seconds.
     * @param {number} remainingSeconds - Remaining time in seconds.
     */
    updateTimerDisplay(remainingSeconds) { // *** REVERT: Expects seconds ***
        if (!this.timerElement) return;
        const isTest = this.mainMenu.currentGame.isTestMode;
        const isMulti = this.mainMenu.currentGame.isMultiplayer;

        if (!isTest && !isMulti) {
            this.timerElement.classList.add('hidden');
            return;
        }
        this.timerElement.classList.remove('hidden');

        // *** REVERT: Directly use seconds ***
        const seconds = Math.max(0, remainingSeconds); // Ensure non-negative
        this.timerElement.textContent = `⏱ ${seconds}`;

        if (seconds <= 5 && seconds > 0) this.timerElement.classList.add('low-time');
        else this.timerElement.classList.remove('low-time');
    }

    /**
     * Updates the progress indicator (e.g., "Question 5 of 10").
     * @param {number} current - Current question number (1-based).
     * @param {number} total - Total number of questions.
     */
    updateProgress(current, total) {
        if (this.currentQuestionNumberElement) this.currentQuestionNumberElement.textContent = current;
        if (this.totalQuestionsElement) this.totalQuestionsElement.textContent = total;
        // Assumes base style allows visibility when not hidden
        this.progressIndicatorElement.classList.remove('hidden'); // Ensure visible
    }

    /** Shows the "Next" button navigation bar and enables the button. */
    showNextButton() {
        if (this.gameNavigationElement) {
            const navElement = this.gameNavigationElement;
            console.log(`GameAreaCtrl: Attempting to SHOW Next button. Current classes: ${navElement.classList}`);

            // *** CORRECT IMPLEMENTATION: Remove 'hidden', ADD 'active' ***
            navElement.classList.remove('hidden'); // Ensure hidden is removed
            navElement.classList.add('active');    // Ensure active is added

            console.log(`GameAreaCtrl: Next button nav classes AFTER show attempt: ${navElement.classList}`);

            if (this.nextButton) {
                this.nextButton.disabled = false;
                 console.log("GameAreaCtrl: Next button element enabled.");
            }
        } else {
            console.warn("GameAreaController: gameNavigationElement not found. Cannot show Next button.");
        }
    }
    /** Hides the "Next" button navigation bar and disables the button. */
    hideNextButton() {
        if (this.gameNavigationElement) {
             const navElement = this.gameNavigationElement;
             console.log(`GameAreaCtrl: Attempting to HIDE Next button. Current classes: ${navElement.classList}`);

            // *** CORRECT IMPLEMENTATION: Remove 'active' ***
            navElement.classList.remove('active'); // Remove active class to hide
            // Optionally re-add hidden if needed for initial state or other logic
            // navElement.classList.add('hidden');

             console.log(`GameAreaCtrl: Next button nav classes AFTER hide attempt: ${navElement.classList}`);

            if (this.nextButton) {
                this.nextButton.disabled = true;
                 console.log("GameAreaCtrl: Next button element disabled.");
            }
        } else {
             console.warn("GameAreaController: gameNavigationElement not found. Cannot hide Next button.");
        }
    }

    /** Shows a confetti animation centered on the screen. */
    showConfetti() {
        // Ensure confetti library is loaded
        if (typeof confetti === 'function') {
            confetti({
                 particleCount: 150,
                 spread: 70,
                 origin: { y: 0.6 }
             });
        } else {
             console.warn("Confetti function not found. Cannot show confetti.");
        }
    }
    /**
     * Shows a smaller confetti burst originating near a specified element.
     * @param {HTMLElement} element - The element to originate confetti from.
     */
    showMiniConfetti(element) {
         if (typeof confetti !== 'function' || !element) return;
         const rect = element.getBoundingClientRect();
         const originX = (rect.left + rect.width / 2) / window.innerWidth;
         const originY = (rect.top + rect.height / 2) / window.innerHeight;

         confetti({
             particleCount: 50,
             spread: 40,
             origin: { x: originX, y: originY },
             scalar: 0.6 // Smaller particles
         });
    }

    /**
     * Shows falling emoji animation for wrong answers.
     * @param {number} [amount=15] - Number of emojis.
     */
    showBadConfetti(amount = 15) {
        const emojisList = ["😒", "😿", "😭", "😢", "👎", "❌", "💩"];
        amount = Math.min(amount, 40); // Limit amount
        const container = document.body; // Or a more specific container if desired

        for (let i = 0; i < amount; i++) {
            const el = document.createElement('div');
            el.textContent = emojisList[Math.floor(Math.random() * emojisList.length)];
            el.style.position = 'absolute';
            el.style.left = `${Math.random() * 90 + 5}vw`;
            el.style.top = `${Math.random() * -20 - 5}vh`; // Start above viewport
            el.style.fontSize = `${Math.random() * 1.0 + 0.8}em`;
            el.style.zIndex = '1001'; // Ensure visibility above most elements
            el.classList.add('emoji-fall'); // Assumes CSS class '.emoji-fall' exists for animation
            container.appendChild(el);

            // Remove element after animation completes
            // Ensure the animation name/duration matches the CSS
            el.addEventListener('animationend', () => el.remove(), { once: true });
        }
    }

    /** Shows the main game elements (question, answers, score, timer, etc.). */
    showGameCoreElements() {
        if (this.gameElementsContainer) {
            console.log("GameAreaCtrl: showGameCoreElements called. Removing 'hidden' class from #gameElements.");
            this.gameElementsContainer.classList.remove('hidden');
            // This method should ALSO ensure children like score/timer are correctly shown/hidden based on mode
            const isTest = this.mainMenu.currentGame.isTestMode;
             const isMulti = this.mainMenu.currentGame.isMultiplayer;
            this.timerElement.classList.toggle('hidden', !isTest && !isMulti);
            this.scoreElement.classList.toggle('hidden', isMulti); // Hide SP score in MP? Or adapt?
            this.playerScoresElement.classList.toggle('hidden', !isMulti); // Show MP scores container
                 this.playerNameElement.classList.add('hidden'); // Hide SP name display
             this.hideWaitingUi(); // Ensure waiting is hidden
        } else {
            console.warn("GameAreaController: gameElements container not found.");
        }
        this.hideCountdownOverlay();
    }
    /** Hides the main game elements container. */
    hideGameCoreElements() { this.gameElementsContainer.classList.add('hidden'); }

    /**
     * Shows the countdown display element with the given number.
     * Updates text and triggers animation.
     * @param {number} seconds - The countdown number to display.
     */
    updateCountdown(seconds) { // Renamed from showCountdown for clarity
        if (this.countdownDisplay) {
            this.countdownDisplay.textContent = seconds;
            this.countdownDisplay.classList.add('active'); // Trigger animation

            // Remove active class after animation
            setTimeout(() => {
                this.countdownDisplay.classList.remove('active');
            }, 950); // Match animation duration
        } else {
            console.warn("GameAreaController: countdownDisplay element not found.");
        }
    }

    /** Shows the countdown overlay element. */
    showCountdownOverlay() {
        if (this.countdownDisplay) {
            this.countdownDisplay.classList.remove('hidden');
        } else {
            console.warn("GameAreaController: countdownDisplay element not found.");
        }
    }

    /** Hides the countdown overlay element. */
    hideCountdownOverlay() {
        if (this.countdownDisplay) {
            this.countdownDisplay.classList.add('hidden');
        }
    }

     /**
      * Shows the waiting UI with a specific message.
      * @param {string} message - The message to display.
      */
    showWaitingUi(message = "Wachten op andere spelers...") { // Default message
        console.log("GameAreaCtrl: Showing Waiting UI with message:", message);
        if (this.waitingUiElement) {
            if (this.waitingMessageElement) {
                this.waitingMessageElement.textContent = message;
            } else {
                 console.warn("GameAreaController: waitingMessageText element not found.");
            }
             this.waitingUiElement.classList.remove('hidden');
             this.hideGameCoreElements(); // Hide main game stuff
             this.hideCountdownOverlay(); // <<< Use hideCountdownOverlay
             this.hideNextButton();
        } else {
            console.warn("GameAreaController: waitingUi element not found.");
        }
    }
    /** Hides the waiting UI element. */
    hideWaitingUi() { this.waitingUiElement.classList.add('hidden'); }

    /**
     * Dynamically updates the player scores display area (#playerScores)
     * to show names and scores for all connected players.
     * @param {Map<string, { peerId: string, playerName: string, score: number, isFinished: boolean }>} players - Map of player data.
     * @param {string | null} localPlayerId - The PeerJS ID of the local player.
     */
    updateOpponentDisplay(players, localPlayerId) {
        console.log(`GameAreaCtrl updateOpponentDisplay: Rewritten - Called with ${players.size} players. Local ID: ${localPlayerId}`);

        if (!this.playerScoresElement) {
            console.error("GameAreaCtrl updateOpponentDisplay: CRITICAL - Missing main player scores container (#playerScores).");
            return;
        }

        // Clear previous scores
        this.playerScoresElement.innerHTML = '';
        console.log(`GameAreaCtrl updateOpponentDisplay: Cleared #playerScores container.`);

        // Iterate through players and create display elements
        players.forEach((player, peerId) => {
            console.log(`GameAreaCtrl updateOpponentDisplay: Creating element for ${player.playerName} (${peerId}), Score: ${player.score}`);

            const playerDiv = document.createElement('div');
            playerDiv.classList.add('player-score-entry'); // Add a class for potential styling

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('player-name');
            nameSpan.textContent = player.playerName || '???';

            const scoreSpan = document.createElement('span');
            scoreSpan.classList.add('score-value');
            scoreSpan.textContent = player.score;

            // *** ADDED LOG: Confirm exact score being set ***
            console.log(`-> Setting scoreSpan textContent for ${player.playerName} (${peerId}) to: ${player.score} (Type: ${typeof player.score})`);

            // Append name and score to the player's div
            playerDiv.appendChild(nameSpan);
            playerDiv.appendChild(document.createTextNode(': ')); // Separator
            playerDiv.appendChild(scoreSpan);

            // Highlight local player
            if (peerId === localPlayerId) {
                playerDiv.classList.add('local-player'); // Add class for styling 'Jij'
                nameSpan.textContent += " (Jij)";
            }

            // Append the player's div to the main container
            this.playerScoresElement.appendChild(playerDiv);
        });

        // Ensure the container is visible
        this.playerScoresElement.classList.remove('hidden');
        console.log(`GameAreaCtrl updateOpponentDisplay: Finished dynamically updating #playerScores.`);

        // Remove the old, unused references if they cause confusion (optional but good practice)
        // this.player1ScoreElement = null;
        // this.player2ScoreElement = null;
    }

     /**
      * Shows visual feedback after an answer is selected.
      * AND ensures the Next button is shown afterwards (for client).
      * @param {boolean} isCorrect - Whether the answer was correct.
      * @param {string} correctAnswer - The correct answer string.
      * @param {HTMLElement | null} [targetButton] - The button element that was clicked.
      */
    showFeedback(isCorrect, correctAnswer, targetButton = null) {
        console.log(`GameAreaCtrl: Showing feedback. Correct: ${isCorrect}, Correct Answer: ${correctAnswer}`);

        // Apply highlights
        this.highlightCorrectAnswer(correctAnswer);
        if (!isCorrect && targetButton) {
             const selectedAnswer = targetButton.getAttribute('data-answer');
             if(selectedAnswer) this.highlightWrongAnswer(selectedAnswer);
        }
         // Show confetti
         if (isCorrect) {
             this.showConfetti();
         } else {
             this.showBadConfetti();
         }

        // *** EXPLICITLY CALL showNextButton AFTER feedback for clarity ***
        // This was previously called from MultiplayerGame.handleAnswerSelection (client side).
        // Calling it here might be more robust, ensuring it happens after feedback rendering.
        // Note: This might show the button for the Host too if called directly after their answer,
        // which might not be desired. Let's keep the call in MultiplayerGame for now.
        // // this.showNextButton(); // Moved back to MultiplayerGame logic
    }

    /** Hides or resets any active visual feedback. */
    hideFeedback() {
        console.log("GameAreaCtrl: Hiding/Resetting feedback.");
        this.resetAnswerHighlights();
        // TODO: Add logic to stop/clear any ongoing feedback animations if necessary.
    }

    /** Resets the game area UI elements and removes listeners. */
    resetUI() {
        console.log("GameAreaCtrl: Resetting UI.");
        this.hide(); // Call hide which now removes listeners and hides container
        this.hideQuestion();
        this.hideAnswers();
        this.hideTimer();
        this.hideNextButton();
        this.hideWaitingUi();
        this.hideCountdownOverlay();
        this.resetAnswerHighlights();
        this.questionElement.textContent = '';
        this.answersElement.innerHTML = '';
        this.timerElement.textContent = '⏱ --';
        this.scoreElement.textContent = 'Score: 0';
        this.progressIndicatorElement.classList.add('hidden');
        this.opponentListElement.classList.add('hidden');
        this.opponentListElement.innerHTML = '';
        this.playerScoresElement.classList.add('hidden');
        this.playerNameElement.classList.add('hidden');
    }

    /**
     * Handles clicks on answer buttons. (Keep intensive logging for now)
     * @param {Event} event - The click event.
     * @private
     */
    _handleAnswerClick(event) {
        // ... (Keep the intensive logging block from the previous step here) ...

        const currentGame = this.mainMenu.currentGame; // Re-fetch current game just in case

        // Explicit check before calling
        if (currentGame && typeof currentGame.handleAnswerSelection === 'function') {
            console.log("GameAreaCtrl (Answer): OK - Calling currentGame.handleAnswerSelection...");
            currentGame.handleAnswerSelection(selectedAnswer, event);
        } else {
            console.error(`GameAreaCtrl (Answer): FAILED - Method 'handleAnswerSelection' not found or not a function on currentGame! (Type: ${currentGame.constructor.name})`);
            return;
        }
    }
}