import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


/**
 * Manages the display of the current question text.
 * Listens for new questions to update the display.
 * @extends BaseComponent
 */
class QuestionDisplayComponent extends BaseComponent {
    /**
     * Creates an instance of QuestionDisplayComponent.
     */
    constructor() {
        super('#question', 'QuestionDisplay'); // Hardcode the selector
        // BaseComponent constructor throws if rootElement is null, no need to check here.

        this._bindMethods();
        this.listen(Events.Game.QuestionNew, this.handleNewQuestion);
        // Listen for game start/finish to show/hide
        this.listen(Events.Game.Started, this.show);
        this.listen(Events.Game.Finished, this.hide);

        // Initial state can be empty or hidden
        // this.rootElement.textContent = '';
        this.hide(); // Start hidden
    }

    /** Binds component methods to the class instance. */
    _bindMethods() {
        this.handleNewQuestion = this.handleNewQuestion.bind(this);
    }

    /**
     * Updates the display with the new question text.
     * @param {object} payload - The event payload.
     * @param {object} payload.questionData - Data for the new question.
     * @param {string} payload.questionData.question - The question text.
     */
    handleNewQuestion({ questionData }) {
        console.debug(`[${this.name}] Displaying new question.`);
        // Use textContent for safety, assuming questions are plain text.
        this.rootElement.textContent = questionData.question; 
        // Ensure component is visible
        this.show();
    }

    // No specific DOM listeners to add/remove in this component
}

export default QuestionDisplayComponent; 