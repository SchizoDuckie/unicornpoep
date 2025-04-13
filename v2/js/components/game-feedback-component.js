import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

/**
 * @class GameFeedbackComponent
 * Handles global visual feedback during the game, such as confetti on correct answers
 * or brief body style changes.
 * Does not manage a specific DOM element directly.
 * @extends BaseComponent
 */
class GameFeedbackComponent extends BaseComponent {
    static SELECTOR = '#gameFeedback';
    static VIEW_NAME = 'GameFeedback';

    /**
     * Creates an instance of GameFeedbackComponent.
     */
    constructor() {
        super(GameFeedbackComponent.SELECTOR, GameFeedbackComponent.VIEW_NAME);

        if (!this.rootElement) {
            console.warn(`[${this.name}] Root element ${GameFeedbackComponent.SELECTOR} not found. Component initialized but might not have a visual container.`);
        }

        this._bindMethods();
        this.initialize();
    }

    /** Binds methods */
    _bindMethods() {
        this.handleAnswerChecked = this.handleAnswerChecked.bind(this);
        this.triggerConfetti = this.triggerConfetti.bind(this);
        this.triggerIncorrectFeedback = this.triggerIncorrectFeedback.bind(this);
        this.handleGameFinished = this.handleGameFinished.bind(this);
    }

    /** Initializes component elements. */
    initialize() {
        this.hideTimeout = null;
        this.listenForEvents();
        this.hide(); // Start hidden
        console.log(`[${this.name}] Initialized.`);
    }

    /** Registers DOM listeners (none needed). */
    registerListeners() {
        console.log(`[${this.name}] Registering DOM listeners (none).`);
    }
    /** Unregisters DOM listeners (none needed). */
    unregisterListeners() {
        console.log(`[${this.name}] Unregistering DOM listeners (none).`);
    }

    /** Listens for global game events */
    listenForEvents() {
        this.listen(Events.Game.AnswerChecked, this.handleAnswerChecked);
        this.listen(Events.Game.Finished, this.handleGameFinished); // Hide on finish
    }

    /**
     * Handles the AnswerChecked event to provide global feedback.
     * @param {object} payload
     * @param {boolean} payload.isCorrect
     * @private
     */
    handleAnswerChecked({ isCorrect }) {
        if (isCorrect) {
            console.debug(`[${this.name}] Triggering positive feedback.`);
            this.triggerConfetti();
        } else {
            console.debug(`[${this.name}] Triggering negative feedback.`);
            this.triggerIncorrectFeedback();
        }
    }

    /**
     * Handles the game finished event. Hides the component.
     * @private
     */
    handleGameFinished() {
        console.debug(`[${this.name}] Game finished, hiding feedback component if visible.`);
        this.hide(); // Hide the component
    }

    /**
     * Applies a CSS class to the body element for a specified duration.
     * @param {string} className - The CSS class to apply.
     * @param {number} durationMs - Duration in milliseconds.
     * @private
     */
    _applyBodyClassTemporarily(className, durationMs) {
        document.body.classList.add(className);
        setTimeout(() => {
            document.body.classList.remove(className);
        }, durationMs);
    }

    /** Triggers a confetti effect using the global function. */
    triggerConfetti() {
        if (typeof confetti === 'function') {
            console.debug(`[${this.name}] 🎉 Firing confetti! 🎉`);
            confetti({
                particleCount: 30,
                spread: 70,
                origin: { y: 0.6 }
            });
        } else {
            console.warn(`[${this.name}] Global confetti function not found. Skipping effect.`);
        }
    }

    /** Triggers visual feedback for an incorrect answer (e.g., body shake). */
    triggerIncorrectFeedback() {
        this._applyBodyClassTemporarily('incorrect-answer-shake', 500);
    }

    /** Cleans up listeners before destruction (handled by BaseComponent). */
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        super.destroy();
    }
}

export default GameFeedbackComponent;
