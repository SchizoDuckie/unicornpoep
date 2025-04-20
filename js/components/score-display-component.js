import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js'; // Import Views

// Import QuestionsManager to get sheet details
import questionsManager from '../services/QuestionsManager.js'; 

/**
 * @class ScoreDisplayComponent
 * @extends RefactoredBaseComponent
 * Displays the player's current score.
 */
class ScoreDisplayComponent extends RefactoredBaseComponent {
    static SELECTOR = '#scoreDisplay';
    static VIEW_NAME = 'ScoreDisplayComponent';
    static IS_GAME_AREA_CHILD = true;

    static SELECTORS = {
        // ... existing code ...
    };

    /**
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration object with events and domEvents
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Game.Started,
                    callback: this._handleGameStart
                },
                {
                    eventName: Events.Game.ScoreUpdated,
                    callback: this._handleScoreUpdate
                },
                {
                    eventName: Events.Game.Finished,
                    callback: this._handleGameFinished
                },
                {
                    eventName: Events.Navigation.ShowView,
                    callback: this._handleShowView
                }
            ],
            
            domEvents: [] // No DOM events to handle
        };
    }

    /**
     * Resets the score display to initial state
     * @private
     */
    _resetDisplay() {
        this.rootElement.textContent = 'Score: 0';
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
            this.hide(); // Hide for multiplayer
        } else {
            this._resetDisplay(); // Reset score to 0
            this.show(); // Ensure visible for other modes
        }
    }

    /**
     * Handles the Game.ScoreUpdated event (only relevant for SP/Practice).
     * @param {object} payload
     * @param {number} payload.newScore - The new total score.
     * @private
     */
    _handleScoreUpdate(payload) {
        // Explicitly check for payload and the required property
        if (payload && typeof payload.newScore === 'number') {
            const newScore = payload.newScore; // Assign if valid
            // Only update if the component is currently visible
            // (prevents updating during hidden multiplayer games)
            if (this.isVisible) {
                this.rootElement.textContent = `Score: ${newScore}`;
            }
        }
    }

    /**
     * Handles the Game.Finished event to ensure the display is visible again.
     * @private
     */
    _handleGameFinished() {
        // When any game finishes, make sure the score display is potentially visible
        // for subsequent non-multiplayer games or menu views.
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
            if (!this.isVisible) {
                this.show();
            }
        }
        // Hiding for GameArea is handled by _handleGameStart based on mode
    }
}

export default ScoreDisplayComponent;

