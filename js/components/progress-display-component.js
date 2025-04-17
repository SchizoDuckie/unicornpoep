import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';

/**
 * Displays the current question progress (e.g., "Question 5 of 10").
 * @extends RefactoredBaseComponent
 */
class ProgressDisplayComponent extends RefactoredBaseComponent {
    static SELECTOR = '#progressIndicator';
    static VIEW_NAME = 'ProgressDisplayComponent';
    
    static SELECTORS = {
        PROGRESS_TEXT: '#progressText',
        PROGRESS_BAR: '#progressBar'
    };

    /** 
     * Initializes the component with the declarative pattern
     * @returns {Object} Configuration object with events, domEvents, and domElements
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Game.QuestionNew,
                    callback: this._updateDisplay
                },
                {
                    eventName: Events.Game.Finished,
                    callback: this._handleGameEnd
                }
            ],
            
            domEvents: [], // No DOM events to handle
            
            domElements: [
                {
                    name: 'progressTextElement',
                    selector: ProgressDisplayComponent.SELECTORS.PROGRESS_TEXT
                },
                {
                    name: 'progressBarElement',
                    selector: ProgressDisplayComponent.SELECTORS.PROGRESS_BAR
                }
            ]
        };
    }

    /** 
     * Updates the progress display.
     * @param {Object} payload - The event payload containing question info
     * @param {number} [payload.questionIndex] - Zero-based index of current question
     * @param {number} [payload.totalQuestions] - Total number of questions
     * @param {number} [payload.current] - Alternative for current question number (1-based)
     * @param {number} [payload.total] - Alternative for total questions
     */
    _updateDisplay(payload) {
        const current = payload.questionIndex !== undefined ? payload.questionIndex + 1 : (payload.current || 0);
        const total = payload.totalQuestions || payload.total || 0;

        const label = getTextTemplate('progressLabel') || 'Question';
        this.elements.progressTextElement.textContent = `${label} ${current} / ${total}`;
        this.elements.progressBarElement.max = total;
        this.elements.progressBarElement.value = current;
        
        if (total > 0) {
             this.show(); // Show if there are questions
        } else {
             this.hide(); // Hide if no total is known (e.g., initial state)
        }
    }
    
    /** 
     * Resets the display when the game ends.
     */
    _handleGameEnd() {
         this._updateDisplay({ current: 0, total: 0 }); // Reset to 0/0
         this.hide();
    }
}

export default ProgressDisplayComponent; 