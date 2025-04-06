/**
 * Manages the Highscores UI: fetching, displaying, and interacting with scores.
 * Also includes Konami code listener for confetti easter egg.
 * Uses class toggling (.hidden) for visibility.
 */
class HighscoresController {
    /**
     * Initializes the controller, gets elements, and sets up listeners.
     * @param {MainMenu} mainMenuController - The central orchestrator instance.
     */
    constructor(mainMenuController) {
        this.mainMenuController = mainMenuController; // Store the hub reference
        this.container = document.getElementById('highscores');
        this.listElement = document.getElementById('scoreList');
        // Access manager via the hub
        this.highscoresManager = this.mainMenuController.highscoresManager;
        if (!this.highscoresManager) {
            console.error("HighscoresController critical error: HighscoresManager not available via MainMenuController!");
        }

        this.setupEventListeners();
        new KonamiCode(() => this.triggerRandomConfetti());
        // Don't hide here, let MainMenuController manage top-level visibility
        // this.hide();
    }

    /** Sets up listeners for buttons within the highscores view. */
    setupEventListeners() {
        // Add listener for the back button
        this.backButton = document.querySelector('#highscores .backToMain');
        this.backButton?.addEventListener('click', () => {
            this.mainMenuController.showView('mainMenu', 'backward'); // Add direction
        });

        // Existing Konami Code listener...
    }

    /** Shows the highscores container and renders the scores. @async */
    async show() {
        // Assumes #highscores base style is display: flex
        this.container?.classList.remove('hidden');
        await this.render(); // Fetch and display scores
        this.triggerCelebratoryConfetti(); // Show confetti on view
    }

    /** Hides the highscores container. */
    hide() {
        this.container?.classList.add('hidden');
    }

    /** Fetches, sorts, and renders highscores into the table. @async */
    async render() {
        if (!this.listElement || !this.highscoresManager) return;
        this.listElement.innerHTML = '<tr><td colspan="5">Scores laden...</td></tr>';
        try {
            const allScores = await this.highscoresManager.getAllScores();

            // Sort scores: primary by score (desc), secondary by date (asc)
            allScores.sort((a, b) => {
                 if (b.score !== a.score) return b.score - a.score;
                 const dateA = new Date(a.date); const dateB = new Date(b.date);
                 if (isNaN(dateA) && isNaN(dateB)) return 0;
                 if (isNaN(dateA)) return 1;
                 if (isNaN(dateB)) return -1;
                 return dateA - dateB;
             });

            this.listElement.innerHTML = ''; // Clear loading/previous list

            if (allScores.length === 0) {
                this.listElement.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nog geen scores! Speel een toets om op de lijst te komen!</td></tr>';
                return;
            }

            allScores.forEach((score, index) => {
                const row = document.createElement('tr');
                row.classList.add('score-container');
                if (index < 3) {
                    row.classList.add('top-score');
                }

                const rankCell = this.createCell('th', this.getRankEmoji(index + 1), 'score-rank', 'Plek');
                rankCell.scope = 'row';
                const gameNameCell = this.createCell('td', score.gameName || '-', 'score-game-name', 'Level');
                const nameCell = this.createCell('td', score.player || '?', 'score-name', 'Naam');
                const scoreCell = this.createCell('td', score.score ?? '0', 'score-score', 'Score');
                const date = new Date(score.date);
                const dateStr = isNaN(date) ? '-' : `${date.toLocaleDateString('nl-NL')} ${date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
                const timestampCell = this.createCell('td', dateStr, 'score-timestamp', 'Datum');

                row.append(rankCell, gameNameCell, nameCell, scoreCell, timestampCell);
                this.listElement.appendChild(row);
            });
        } catch (error) {
            console.error("Error rendering highscores:", error);
            this.listElement.innerHTML = '<tr><td colspan="5" style="text-align:center; color: red;">Fout bij laden scores.</td></tr>';
        }
    }

    /**
     * Helper to create table cells (th or td).
     * @param {string} type - 'th' or 'td'.
     * @param {string|number} content - Content.
     * @param {string} className - CSS class.
     * @param {string} dataLabel - data-label attribute.
     * @returns {HTMLTableCellElement} The created cell.
     */
    createCell(type, content, className, dataLabel) {
        const cell = document.createElement(type);
        if (typeof content === 'string' && (content.includes('🥇') || content.includes('🥈') || content.includes('🥉'))) {
            cell.innerHTML = content;
        } else {
            cell.textContent = content;
        }
        cell.className = className;
        cell.setAttribute('data-label', dataLabel);
        return cell;
    }

    /**
     * Gets rank emoji.
     * @param {number} rank - Rank number.
     * @returns {string} Emoji or rank number string.
     */
    getRankEmoji(rank) {
        switch (rank) { case 1: return '🥇'; case 2: return '🥈'; case 3: return '🥉'; default: return rank.toString(); }
    }

     /** Triggers celebratory confetti. */
     triggerCelebratoryConfetti() {
         if (typeof confetti !== 'function') return;
         const duration = 4 * 1000;
         const animationEnd = Date.now() + duration;
         const defaults = { startVelocity: 25, spread: 360, ticks: 50, zIndex: 1000 };

         const interval = setInterval(() => {
             const timeLeft = animationEnd - Date.now();
             if (timeLeft <= 0) return clearInterval(interval);
             const particleCount = 40 * (timeLeft / duration);
             confetti({...defaults, particleCount, origin: { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.1 - 0.05 } });
         }, 200);
     }

    /** Enables click-based confetti after Konami code. */
    triggerRandomConfetti() {
        console.log("Konami activated! Click for confetti.");
        if (typeof confetti !== 'function') { console.warn("Confetti library not found."); return; }

        if (!window.konamiConfettiActive) {
             this.boundMouseDown = this.confettiMouseDownHandler.bind(this);
             this.boundMouseUp = this.confettiMouseUpHandler.bind(this);
             window.addEventListener('mousedown', this.boundMouseDown);
             window.addEventListener('mouseup', this.boundMouseUp);
             window.konamiConfettiActive = true;
        }
    }
     /** Mouse down handler for Konami confetti. @param {MouseEvent} e */
     confettiMouseDownHandler(e) { window._konamiConfettiStartTime = Date.now(); }
     /** Mouse up handler for Konami confetti. @param {MouseEvent} e */
     confettiMouseUpHandler(e) {
         if (typeof confetti !== 'function' || !window._konamiConfettiStartTime) return;
         const pressDuration = Date.now() - window._konamiConfettiStartTime;
         const particleCount = Math.min(150, Math.max(10, Math.floor(pressDuration / 12)));
         const spread = Math.min(360, 60 + Math.floor(pressDuration / 25));
         const origin = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
         confetti({ particleCount, spread, origin, startVelocity: 25, ticks: 80 + Math.floor(pressDuration/15) });
         window._konamiConfettiStartTime = null;
     }

    activate() {
        console.log("HighscoresController activating.");
        this.displayHighscores(); // Fetch and display scores when view becomes active
    }
}

// --- KonamiCode class ---
/** Helper class to detect Konami code sequence. */
class KonamiCode {
    /** Initializes sequence and listener. @param {Function} callback */
    constructor(callback) {
        this.konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        this.currentPosition = 0; this.callback = callback;
        this.checkCodeHandler = this.checkCode.bind(this);
        document.addEventListener('keydown', this.checkCodeHandler);
        console.log("Konami code listener active.");
    }
    /** Checks key against sequence. @param {KeyboardEvent} event */
    checkCode(event) {
         if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

         const key = event.key.toLowerCase(); const code = event.code;
         const expected = this.konamiSequence[this.currentPosition];
         const match = expected.startsWith('Arrow') ? (code === expected) : (key === expected);
        if (match) {
            this.currentPosition++;
            if (this.currentPosition === this.konamiSequence.length) {
                console.log("Konami sequence complete!"); this.callback(); this.currentPosition = 0;
            }
        } else {
            const firstExpected = this.konamiSequence[0];
            this.currentPosition = ((firstExpected.startsWith('Arrow') && code === firstExpected) || key === firstExpected) ? 1 : 0;
        }
    }
}