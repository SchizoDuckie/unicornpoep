import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js'; // Import Views

// Import QuestionsManager to get sheet details
import questionsManager from '../services/QuestionsManager.js'; 

/**
 * @class ScoreDisplayComponent
 * @extends BaseComponent
 * Displays the player's current score.
 */
class ScoreDisplayComponent extends BaseComponent {
    static SELECTOR = '#scoreDisplay';
    static VIEW_NAME = 'ScoreDisplayComponent';

    constructor() {
        super();
        console.log(`[${this.name}] Constructed (via BaseComponent).`);
    }

    initialize() {
        console.log(`[${this.name}] Initializing...`);
        // No specific elements needed beyond the rootElement handled by BaseComponent
        this.scoreElement = this.rootElement; // Assuming root element IS the display

        // Bind handlers
        this._handleGameStart = this._handleGameStart.bind(this);
        this._handleScoreUpdate = this._handleScoreUpdate.bind(this);
        this._handleGameFinished = this._handleGameFinished.bind(this); // Add finish handler
        this._handleShowView = this._handleShowView.bind(this);     // Add view handler

        this._resetDisplay(); // Set initial text
        console.log(`[${this.name}] Initialized.`);
    }

    registerListeners() {
        console.log(`[${this.name}] Registering listeners.`);
        this.listen(Events.Game.Started, this._handleGameStart);
        this.listen(Events.Game.ScoreUpdated, this._handleScoreUpdate);
        this.listen(Events.Game.Finished, this._handleGameFinished); // Listen for game end
        this.listen(Events.Navigation.ShowView, this._handleShowView); // Listen for navigation
    }

    _resetDisplay() {
        if (this.scoreElement) {
            this.scoreElement.textContent = 'Score: 0';
        }
        // By default, assume it should be visible unless game starts in MP
        this.show();
    }

    /**
     * Handles the Game.Started event to potentially hide the display.
     * @param {object} payload
     * @param {string} payload.mode - Game mode ('singleplayer', 'multiplayer-host', 'multiplayer-client', 'practice').
     * @private
     */
    _handleGameStart({ mode }) {
        if (mode === 'multiplayer-host' || mode === 'multiplayer-client') {
            console.log(`[${this.name}] Multiplayer game started, hiding score display.`);
            this.hide(); // Hide for multiplayer
        } else {
            console.log(`[${this.name}] Single player/practice game started, showing score display.`);
            this._resetDisplay(); // Reset score to 0
            this.show(); // Ensure visible for other modes
        }
    }

    /**
     * Handles the Game.ScoreUpdated event (only relevant for SP/Practice).
     * @param {object} payload
     * @param {number} payload.score - The new total score.
     * @private
     */
    _handleScoreUpdate({ score }) {
        // Only update if the component is currently visible
        // (prevents updating during hidden multiplayer games)
        if (this.isVisible && this.scoreElement) {
            this.scoreElement.textContent = `Score: ${score}`;
        }
    }

    /**
     * Handles the Game.Finished event to ensure the display is visible again.
     * @private
     */
    _handleGameFinished() {
        // When any game finishes, make sure the score display is potentially visible
        // for subsequent non-multiplayer games or menu views.
        // Don't necessarily reset the text here, just ensure visibility.
        console.log(`[${this.name}] Game finished, ensuring score display is visible.`);
        this.show();
    }

     /**
     * Handles navigation events to ensure the display is visible on non-game views.
      * @param {object} payload
      * @param {string} payload.viewName - The name of the view being shown.
     * @private
     */
     _handleShowView({ viewName }) {
        // Show the score display if navigating to main menu or other non-gameplay views
        // Hide it specifically if navigating TO the game area (handled by _handleGameStart)
        if (viewName !== Views.GameArea && viewName !== Views.Loading) {
             // If we aren't explicitly in the game area or loading, ensure score is visible
             // This covers returning to MainMenu, Highscores, etc.
             if (!this.isVisible) {
                console.log(`[${this.name}] Navigating to non-game view (${viewName}), ensuring score display is visible.`);
                this.show();
             }
        }
        // Hiding for GameArea is handled by _handleGameStart based on mode
     }

    // destroy() is handled by BaseComponent to remove listeners.
}

export default ScoreDisplayComponent;

