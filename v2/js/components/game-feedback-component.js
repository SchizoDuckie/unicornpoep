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
    /**
     * Creates an instance of GameFeedbackComponent.
     */
    constructor() {
        super('#gameFeedback', Views.GameFeedback);

        if (!this.rootElement) {
            console.warn(`[${this.name}] Root element #gameFeedback not found. Component initialized but might not have a visual container.`);
        }

        this._bindMethods();
        this.listen(Events.Game.AnswerChecked, this.handleAnswerChecked);
        this.listen('multiplayer:client:answerResult', this.handleAnswerChecked);
    }

    /** Binds methods */
    _bindMethods() {
        this.handleAnswerChecked = this.handleAnswerChecked.bind(this);
        this.triggerConfetti = this.triggerConfetti.bind(this);
        this.triggerIncorrectFeedback = this.triggerIncorrectFeedback.bind(this);
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
                particleCount: 100,
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
