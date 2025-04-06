/**
 * Manages the About screen UI.
 * Uses class toggling (.hidden) for visibility.
 */
class AboutController {
    /**
     * Initializes the controller, gets the container element, and sets up listeners.
     * @param {MainMenu} mainMenuController - The main menu controller instance.
     */
    constructor(mainMenuController) {
        this.mainMenuController = mainMenuController;
        this.aboutElement = document.getElementById('about');
        this.backButton = this.aboutElement?.querySelector('.backToMain');

        this.setupEventListeners();
        this.hide(); // Add .hidden class initially
    }

    /**
     * Sets up listeners for buttons within the about view.
     */
    setupEventListeners() {
        this.backButton?.addEventListener('click', () => {
            this.mainMenuController.showView('mainMenu', 'backward');
        });
    }

    /**
     * Shows the about container. Assumes base style is display: flex.
     */
    show() {
        this.aboutElement?.classList.remove('hidden');
    }

    /**
     * Hides the about container.
     */
    hide() {
        this.aboutElement?.classList.add('hidden');
    }

    activate() {
        console.log("AboutController activating.");
        // No specific setup needed currently, but method exists for consistency
    }
}