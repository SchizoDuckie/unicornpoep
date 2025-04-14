import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';


/**
 * Displays the current question progress (e.g., "Question 5 of 10").
 * @extends BaseComponent
 */
class ProgressDisplayComponent extends BaseComponent {
    static SELECTOR = '#progressIndicator';
    static VIEW_NAME = 'ProgressDisplayComponent';

    /**
     * Creates an instance of ProgressDisplayComponent.
     * @throws {Error} If the root element or essential child elements (#progressBar, #progressText) are not found.
     */
    constructor() {
        super();
        console.log("[ProgressDisplayComponent] Constructed (via BaseComponent).");
    }

    /** Initializes the component. */
    initialize() {
        console.log(`[${this.name}] Initializing...`);
        this.progressTextElement = this.rootElement.querySelector('#progressText');
        this.progressBarElement = this.rootElement.querySelector('#progressBar');

        if (!this.progressTextElement || !this.progressBarElement) {
            throw new Error(`[${this.name}] Missing required child elements: #progressText or #progressBar.`);
        }

        // --- Bind Handlers Here --- 
        this._updateDisplay = this._updateDisplay.bind(this);
        this._handleGameEnd = this._handleGameEnd.bind(this);
        
        this._updateDisplay({ current: 0, total: 0 }); // Initial state
        console.log(`[${this.name}] Initialized.`);
    }

    /** Registers eventBus listeners using pre-bound handlers. */
    registerListeners() {
        console.log(`[${this.name}] Registering listeners.`);
        // Listen to relevant game events
        this.listen(Events.Game.QuestionNew, this._updateDisplay); 
        this.listen(Events.Game.Finished, this._handleGameEnd); // Reset on game end
        // Could also listen to Game.Started to get initial total
    }

    /** Unregisters DOM listeners (none needed). */
    unregisterListeners() {
        console.log(`[${this.name}] Unregistering DOM listeners (none).`);
    }

    /** Updates the progress display. */
    _updateDisplay(payload) {
        const current = payload.questionIndex !== undefined ? payload.questionIndex + 1 : (payload.current || 0);
        const total = payload.totalQuestions || payload.total || 0;

        if (this.progressTextElement) {
            const label = getTextTemplate('progressLabel') || 'Question';
            this.progressTextElement.textContent = `${label} ${current} / ${total}`;
        }
        if (this.progressBarElement) {
            this.progressBarElement.max = total;
            this.progressBarElement.value = current;
        }
        
        if (total > 0) {
             this.show(); // Show if there are questions
        } else {
             this.hide(); // Hide if no total is known (e.g., initial state)
        }
    }
    
    /** Resets the display when the game ends. */
    _handleGameEnd() {
         console.log(`[${this.name}] Game ended, resetting progress.`);
         this._updateDisplay({ current: 0, total: 0 }); // Reset to 0/0
         this.hide();
    }

    // No specific DOM listeners to add/remove in this component
}

export default ProgressDisplayComponent; 