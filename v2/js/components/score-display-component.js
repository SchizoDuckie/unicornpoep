import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js'; // If you use this

// Import QuestionsManager to get sheet details
import questionsManager from '../services/QuestionsManager.js'; 

/**
 * Displays the player's current score.
 */
class ScoreDisplayComponent extends BaseComponent {
    static SELECTOR = '#scoreDisplay';
    static VIEW_NAME = 'ScoreDisplayComponent';

    /** Initializes the component. */
    constructor() {
        super();
        console.log("[ScoreDisplayComponent] Constructed (via BaseComponent).");
    }

    /** Initializes component elements. */
    initialize() {
        console.log(`[${this.name}] Initializing...`);
        // The root element itself will display the score
        this.scoreElement = this.rootElement; 
        this.baseScoreText = 'Score: '; // Store base text

        if (!this.scoreElement) {
            throw new Error(`[${this.name}] Root element not found with selector: ${this.selector}`);
        }

        // --- Bind Handlers Here --- 
        this._handleScoreUpdate = this._handleScoreUpdate.bind(this);
        this._handleGameStarted = this._handleGameStarted.bind(this);
        this.resetScore = this.resetScore.bind(this); // Bind reset method
        
        this.resetScore(); // Initial state
        console.log(`[${this.name}] Initialized.`);
    }

    /** Registers eventBus listeners using pre-bound handlers. */
    registerListeners() {
        console.log(`[${this.name}] Registering listeners.`);
        this.listen(Events.Game.ScoreUpdated, this._handleScoreUpdate);
        this.listen(Events.Game.Started, this._handleGameStarted); // Reset on new game
        this.listen(Events.Game.Finished, this.resetScore); // Reset on game end
    }

    /** Handles the ScoreUpdated event */
    _handleScoreUpdate(event) {

        if (!this.scoreElement) return;
        
        console.debug(`[${this.name}] Updating score display to: ${event.newScore}`);
        this.scoreElement.textContent = `${this.baseScoreText}${event.newScore}`;
        this.show(); 
    }

    /** Handles the Game Started event. Resets score. */
    _handleGameStarted(payload) {
        // Mode check might be useful if visibility depends on it, but reset is always needed.
        console.log(`[${this.name}] Game Started, resetting score.`);
        this.resetScore(); 
        this.show(); // Ensure visible on game start
    }

    /** Resets the score display to 0. */
    resetScore() {
        if (this.scoreElement) {
            console.debug(`[${this.name}] Resetting score display.`);
            this.scoreElement.textContent = `${this.baseScoreText}0`;
            // Visibility handled by _handleGameStarted or external logic
        }
    }

    // No specific DOM listeners to add/remove in this component beyond BaseComponent
}

export default ScoreDisplayComponent;

