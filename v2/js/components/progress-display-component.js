import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


/**
 * Manages the display of the current question progress (e.g., "Question 1 / 10").
 * Listens for new questions to update the progress count.
 * @extends BaseComponent
 */
class ProgressDisplayComponent extends BaseComponent {
    /**
     * Creates an instance of ProgressDisplayComponent.
     * @throws {Error} If the root element or essential child elements (#progressBar, #progressText) are not found.
     */
    constructor() {
        super('#progressIndicator', 'ProgressDisplay'); // Hardcode the selector

        if (!this.rootElement) return; // BaseComponent constructor should handle this

        // Find the progress bar and text elements within the root
        this.progressBarElement = this.rootElement.querySelector('#progressBar');
        this.progressTextElement = this.rootElement.querySelector('#progressText');

        // Validate that child elements were found (as per refactor plan)
        if (!this.progressBarElement || !this.progressTextElement) {
            const missing = [];
            if (!this.progressBarElement) missing.push('#progressBar'); // Use correct ID in error message
            if (!this.progressTextElement) missing.push('#progressText');
            // Throw error immediately if essential children are missing
            throw new Error(`[${this.name}] Component cannot function without required child elements: ${missing.join(' and ')}.`);
        }

        this._bindMethods();
        this.listen(Events.Game.QuestionNew, this.handleNewQuestion);
        // Listen for game start to ensure visibility and potentially reset
        this.listen(Events.Game.Started, this.handleGameStart);
        // Listen for game finish/stop to hide
        this.listen(Events.Game.Finished, this.handleGameFinished);

        this.resetDisplay(); // Reset and hide initially
    }

    /** Binds component methods to the class instance. */
    _bindMethods() {
        this.handleNewQuestion = this.handleNewQuestion.bind(this);
        this.handleGameFinished = this.handleGameFinished.bind(this); // Bind finish handler
        this.resetDisplay = this.resetDisplay.bind(this); // Bind reset handler
    }

    /**
     * Updates the progress display when a new question is presented.
     * Assumes progressBar and progressText exist due to constructor check.
     * @param {object} payload - The event payload.
     * @param {number} payload.questionIndex - 0-based index of the current question.
     * @param {number} payload.totalQuestions - Total number of questions.
     */
    handleNewQuestion({ questionIndex, totalQuestions }) {
        const currentQuestionNumber = questionIndex + 1; 
        console.debug(`[${this.name}] Updating progress: ${currentQuestionNumber} / ${totalQuestions}`);

        // No need for null checks here due to constructor guarantee
        this.progressTextElement.textContent = `Vraag ${currentQuestionNumber} / ${totalQuestions}`;
        this.progressBarElement.max = totalQuestions;
        this.progressBarElement.value = currentQuestionNumber;
        
        this.show();
    }
    
    /**
     * Resets the display elements to initial state.
     * Assumes progressBar and progressText exist due to constructor check.
     * @param {boolean} [hide=true] - Whether to hide the component after reset.
     */
    resetDisplay(hide = true) {
        console.debug(`[${this.name}] Resetting progress display.`);
        // No need for null checks here
        this.progressTextElement.textContent = `Vraag 0 / 0`;
        this.progressBarElement.max = 1; 
        this.progressBarElement.value = 0;

        if (hide) {
            this.hide();
        }
    }
    
    /**
     * Hides and resets the display when the game finishes.
     */
    handleGameFinished() {
        this.resetDisplay(true);
    }

    /** Resets and potentially shows the progress indicator when a game starts. */
    handleGameStart(payload) {
        // Reset on game start
        const totalQuestions = payload.settings.totalQuestions || payload.totalQuestions || 0; // Get total questions if available in start payload
        this.handleNewQuestion({ questionIndex: -1, totalQuestions: totalQuestions }); // Show 0 / total
        this.show();
    }

    // No specific DOM listeners to add/remove in this component
}

export default ProgressDisplayComponent; 