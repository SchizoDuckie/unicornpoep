/**
 * Manages the About screen UI.
 * Uses class toggling (.hidden) for visibility.
 */
class AboutController {
    /**
     * Initializes the controller, gets the container element, and sets up listeners.
     * @param {Game} game - The main game instance.
     */
    constructor(game) {
        this.game = game;
        this.container = document.getElementById('about');

        this.setupEventListeners();
        this.hide(); // Add .hidden class initially
    }

    /**
     * Sets up listeners for buttons within the about view.
     */
    setupEventListeners() {
        this.container?.querySelectorAll('.backToMain').forEach(btn => {
            btn.addEventListener('click', () => this.game.backToMainMenu());
        });
    }

    /**
     * Shows the about container. Assumes base style is display: flex.
     */
    show() {
        this.container?.classList.remove('hidden');
    }

    /**
     * Hides the about container.
     */
    hide() {
        this.container?.classList.add('hidden');
    }
}