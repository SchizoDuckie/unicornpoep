/**
 * Manages the Game Area UI: questions, answers, score, timer, progress, buttons.
 * Uses class toggling (.hidden) for visibility.
 */
class GameAreaController {
    /**
     * Initializes the controller, gets elements, and sets up listeners.
     * @param {Game} game - The main game instance.
     */
    constructor(game) {
        this.game = game;
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

        this.setupEventListeners();
        this.hide(); // Add .hidden class initially
    }

    /**
     * Sets up button listeners within the game area.
     */
    setupEventListeners() {
        this.nextButton?.addEventListener('click', () => {
            if (!this.nextButton.disabled) this.game.nextQuestion();
        });
        this.stopButton?.addEventListener('click', () => {
            const confirmMsg = this.game.isMultiplayer
                ? 'Weet je zeker dat je het spel wilt stoppen? De ander wint dan!'
                : 'Weet je zeker dat je wilt stoppen?';
            if (confirm(confirmMsg)) this.game.stopGame();
        });
    }

    /** Shows the game area UI by removing the 'hidden' class. */
    show() {
        this.container?.classList.remove('hidden');
    }
    /** Hides the game area container. */
    hide() { this.container?.classList.add('hidden'); }
    /** Checks if the game area is currently visible. @returns {boolean} */
    isVisible() { return !this.container?.classList.contains('hidden'); }

    /** Prepares UI for single player (practice or test mode). */
    prepareSinglePlayerUI() {
        // Assumes base style for score/timer is display: block
        this.game.isTestMode ? this.scoreElement?.classList.remove('hidden') : this.scoreElement?.classList.add('hidden');
        this.game.isTestMode ? this.timerElement?.classList.remove('hidden') : this.timerElement?.classList.add('hidden');

        this.playerScoresElement?.classList.add('hidden'); // Hide multiplayer scores
        this.progressIndicatorElement?.classList.remove('hidden'); // Show progress

        if (this.scoreElement) this.scoreElement.textContent = "Score: 0";
        if (this.timerElement) this.timerElement.textContent = ""; // Clear timer text initially
    }

    /**
     * Prepares UI for multiplayer mode.
     * @param {string} player1Name - Name of the local player.
     * @param {string} player2Name - Name of the opponent.
     */
    prepareMultiplayerUI(player1Name, player2Name) {
        this.scoreElement?.classList.add('hidden'); // Hide single player score
        // Assumes base style for timer is display: block
        this.timerElement?.classList.remove('hidden'); // Show timer
        // Assumes base style for playerScores is display: flex
        this.playerScoresElement?.classList.remove('hidden'); // Show multiplayer scores
        // Assumes base style for progress is display: block or inline-block
        this.progressIndicatorElement?.classList.remove('hidden'); // Show progress
        this.updatePlayerNames(player1Name, player2Name);
    }

    /**
     * Updates the displayed player names in multiplayer.
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
                if (this.answersAreEnabled) this.game.handleAnswerSelection(answer, event);
            });
            this.answersElement.appendChild(button);
        });
        this.enableAnswers();
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
        this.answersElement?.querySelectorAll('.answerButton').forEach(button => {
            if (button.getAttribute('data-answer') === correctAnswer) button.classList.add('correct-answer');
        });
    }
    /**
     * Highlights the button corresponding to the wrong answer selected.
     * @param {string} wrongAnswer - The incorrect answer string selected by the player.
     */
    highlightWrongAnswer(wrongAnswer) {
        this.answersElement?.querySelectorAll('.answerButton').forEach(button => {
            if (button.getAttribute('data-answer') === wrongAnswer) button.classList.add('wrong-answer');
        });
    }
    /** Removes all correct/wrong answer highlighting from buttons. */
    resetAnswerHighlights() {
        this.answersElement?.querySelectorAll('.answerButton').forEach(button => {
            button.classList.remove('correct-answer', 'wrong-answer');
        });
    }

    /**
     * Updates the score display (single player or player 1 in multiplayer).
     * @param {number} score - The score value.
     */
    updateScore(score) {
        const scoreVal = Math.max(0, score); // Ensure non-negative
        if (this.game.isMultiplayer && this.player1ScoreElement) {
            const scoreValueElement = this.player1ScoreElement.querySelector('.score-value');
            if (scoreValueElement) scoreValueElement.textContent = scoreVal;
        } else if (this.game.isTestMode && this.scoreElement) {
            this.scoreElement.textContent = `Score: ${scoreVal}`;
        }
    }
    /**
     * Updates the opponent's score display in multiplayer. Adds animation on increase.
     * @param {number} score - The opponent's score value.
     */
    updateOpponentScore(score) {
        if (!this.game.isMultiplayer || !this.player2ScoreElement) return;
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
                 setTimeout(() => this.player2ScoreElement?.classList.remove('score-updated'), 600);
             }
        }
    }
     /** Shows a small confetti burst near the opponent's score element. */
     showMiniConfettiForOpponent() { if (this.game.isMultiplayer && this.player2ScoreElement) this.showMiniConfetti(this.player2ScoreElement); }

    /**
     * Updates the timer display. Shows remaining seconds.
     * @param {number} remainingTimeMs - Remaining time in milliseconds.
     */
    updateTimer(remainingTimeMs) {
        if (!this.timerElement) return;
        // Hide timer if not in test/multiplayer mode
        if (!this.game.isTestMode && !this.game.isMultiplayer) {
            this.timerElement.classList.add('hidden');
            return;
        }
        this.timerElement.classList.remove('hidden'); // Ensure visible

        const seconds = Math.max(0, Math.ceil(remainingTimeMs / 1000));
        this.timerElement.textContent = `⏱ ${seconds}`;
        // Manage low-time class
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
        this.progressIndicatorElement?.classList.remove('hidden'); // Ensure visible
    }

    /** Shows the "Next" button navigation bar and enables the button. */
    showNextButton() {
        if (this.gameNavigationElement) {
            this.gameNavigationElement.classList.remove('hidden'); // Make visible
            // Use timeout to allow display change before starting transition
            setTimeout(() => this.gameNavigationElement.classList.add('active'), 10); // Slide up
        }
        if (this.nextButton) {
            this.nextButton.disabled = false;
        }
    }

    /** Hides the "Next" button navigation bar and disables the button. */
    hideNextButton() {
        if (this.gameNavigationElement) {
            this.gameNavigationElement.classList.remove('active'); // Slide down
            this.gameNavigationElement.classList.add('hidden'); // Ensure it's hidden
        }
        if (this.nextButton) {
            this.nextButton.disabled = true;
        }
    }

    /**
     * Shows confetti. Requires confetti.js library.
     * @param {number} [amount=40] - Number of confetti particles.
     * @param {Event|null} event - The click event for origin. Defaults to top center.
     */
    showConfetti(amount = 40, event) {
        if (typeof confetti !== 'function') return;
        let origin = { x: 0.5, y: 0.1 };
        if (event?.clientX && event.clientY) origin = { x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight };
        confetti({ particleCount: amount, spread: 70, ticks: 100, origin: origin });
    }
     /**
      * Shows falling emoji animation for wrong answers.
      * @param {number} [amount=15] - Number of emojis.
      */
     showBadConfetti(amount = 15) {
         const emojisList = ["😒", "😿", "😭", "😢", "👎", "❌", "💩"]; amount = Math.min(amount, 40);
         const container = document.body;
         for (let i = 0; i < amount; i++) {
             const el = document.createElement('div'); el.textContent = emojisList[Math.floor(Math.random() * emojisList.length)];
             el.style.position = 'absolute'; // Keep position absolute for animation control
             el.style.left = `${Math.random() * 90 + 5}vw`;
             el.style.top = `${Math.random() * -20 - 5}vh`; // Start above viewport
             el.style.fontSize = `${Math.random() * 1.0 + 0.8}em`;
             el.style.zIndex = '1001'; // Ensure visibility
             el.classList.add('emoji-fall'); // Add class to trigger CSS animation
             container.appendChild(el);
             // Remove element after animation completes
             el.addEventListener('animationend', () => el.remove(), { once: true });
         }
     }
    /**
     * Shows mini confetti near a specified element. Requires confetti.js library.
     * @param {HTMLElement} element - The target element.
     * @param {number} [amount=15] - Number of particles.
     */
    showMiniConfetti(element, amount = 15) {
        if (!element || typeof confetti !== 'function') return;
        const rect = element.getBoundingClientRect();
        const x = (rect.left + rect.right) / 2 / window.innerWidth; const y = (rect.top + rect.bottom) / 2 / window.innerHeight;
        confetti({ particleCount: amount, spread: 40, origin: { x, y }, colors: ['#FFD700', '#614ae2', '#2ecc71', '#f39c12'], gravity: 0.6, scalar: 0.6, ticks: 50, shapes: ['circle', 'square'] });
    }
     /** Resets the game area UI elements to a default hidden/empty state. */
     resetUI() {
         if (this.questionElement) this.questionElement.textContent = '';
         if (this.answersElement) this.answersElement.innerHTML = '';
         // Ensure timer/score elements are hidden and reset
         if (this.timerElement) { this.timerElement.textContent = ''; this.timerElement.classList.remove('low-time'); this.timerElement.classList.add('hidden'); }
         if (this.scoreElement) { this.scoreElement.textContent = 'Score: 0'; this.scoreElement.classList.add('hidden'); }
         // Reset and hide multiplayer score display
         if (this.player1ScoreElement) this.player1ScoreElement.innerHTML = '';
         if (this.player2ScoreElement) this.player2ScoreElement.innerHTML = '';
         this.playerScoresElement?.classList.add('hidden');
         // Reset and hide progress indicator
         if (this.currentQuestionNumberElement) this.currentQuestionNumberElement.textContent = '0';
         if (this.totalQuestionsElement) this.totalQuestionsElement.textContent = '0';
         this.progressIndicatorElement?.classList.add('hidden');
         // Ensure next button is hidden and answers are disabled
         this.hideNextButton();
         this.disableAnswers();
     }
}