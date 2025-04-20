import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

/**
 * @class GameFeedbackComponent
 * Handles global visual feedback during the game, such as confetti on correct answers
 * or brief body style changes.
 * Does not manage a specific DOM element directly.
 * @extends RefactoredBaseComponent
 */
class GameFeedbackComponent extends RefactoredBaseComponent {
    static SELECTOR = '#gameFeedback';
    static VIEW_NAME = 'GameFeedbackComponent';
    static IS_GAME_AREA_CHILD = true;
    
    // State properties
    hideTimeout = null;

    /** 
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration object with events and domEvents
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Game.AnswerChecked,
                    callback: this._handleAnswerChecked
                },
                {
                    eventName: Events.Game.Finished,
                    callback: this._handleGameFinished
                }
            ]
        };
    }

    /**
     * Handles the AnswerChecked event to provide global feedback.
     * @param {object} payload
     * @param {boolean} payload.isCorrect
     * @private
     */
    _handleAnswerChecked({ isCorrect }) {
        if (isCorrect) {
            this.triggerConfetti();
        } else {
            this.triggerIncorrectFeedback();
        }
    }

    /**
     * Handles the game finished event. Hides the component.
     * @private
     */
    _handleGameFinished() {
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

    /** 
     * Triggers a confetti effect using the global function. 
     */
    triggerConfetti() {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 30,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }

    /** 
     * Triggers visual feedback for an incorrect answer (e.g., body shake). 
     */
    triggerIncorrectFeedback() {
        this._applyBodyClassTemporarily('incorrect-answer-shake', 500);
    }
}

export default GameFeedbackComponent;
