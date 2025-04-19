import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';

/**
 * Displays the current question text.
 * @extends RefactoredBaseComponent
 */
class QuestionDisplayComponent extends RefactoredBaseComponent {
    static SELECTOR = '#question';
    static VIEW_NAME = 'QuestionDisplay';

    /**
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration object with events and domEvents
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Game.Started,
                    callback: this.show
                },
                {
                    eventName: Events.Game.QuestionNew,
                    callback: this._handleQuestionNew
                },
                {
                    eventName: Events.Game.Finished,
                    callback: this._handleGameFinished
                }
            ],
            
            domEvents: [] // No DOM events to handle
        };
    }

    show() {
        this.rootElement.classList.remove('hidden');
    }

    hide() {
       this.rootElement.classList.add('hidden');
      //  debugger;
    }

    /**
     * Handles displaying a new question when the Game.QuestionNew event is received
     * @param {Object} payload - The event payload
     * @param {Object} payload.questionData - The question data object
     * @param {string} payload.questionData.question - The question text
     */
    _handleQuestionNew({ questionData }) {
        // Use textContent for safety, assuming questions are plain text
        this.rootElement.textContent = questionData.question;
        // Ensure component is visible
        this.show();
    }

    /**
     * Handles the Game.Finished event by clearing and hiding the question display
     */
    _handleGameFinished() {
        this.hide();
        this.clearQuestion();
    }

    /**
     * Clears the question text
     */
    clearQuestion() {
        this.rootElement.textContent = '';
    }
}

export default QuestionDisplayComponent; 