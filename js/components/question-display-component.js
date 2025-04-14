import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


/**
 * Displays the current question text.
 */
class QuestionDisplayComponent extends BaseComponent {
    static SELECTOR = '#question';
    static VIEW_NAME = 'QuestionDisplay';

    /** Initializes component elements. */
    constructor() {
        super(); // Use BaseComponent constructor
        console.log("[QuestionDisplay] Constructed (via BaseComponent).");
    }
    
    initialize() {
        // The root element itself will display the question text
        this.questionTextElement = this.rootElement;
        this.clearQuestion(); // Initial state
        console.log(`[${this.name}] Initialized.`);
    }

    /** Registers DOM listeners (none needed) and eventBus listeners. */
    registerListeners() {
        console.log(`[${this.name}] Registering listeners.`);
        // Bind handlers
        this._handleQuestionNew = this._handleQuestionNew.bind(this);
        this._handleGameFinished = this._handleGameFinished.bind(this);
        
        // Listen for global game events
        this.listen(Events.Game.QuestionNew, this._handleQuestionNew);
        this.listen(Events.Game.Finished, this._handleGameFinished); // Clear on game end
    }

    // UnregisterListeners handled by BaseComponent

    // Define handlers as regular methods
    _handleQuestionNew({ questionData }) {
        console.debug(`[${this.name}] Displaying new question.`);
        // Use textContent for safety, assuming questions are plain text.
        if (this.questionTextElement) {
            this.questionTextElement.textContent = questionData.question;
            // Ensure component is visible (BaseComponent show)
            this.show(); 
        } else {
            console.error(`[${this.name}] Text element not found!`);
        }
    }

    _handleGameFinished() {
        console.debug(`[${this.name}] Game finished. Clearing question display.`);
        this.hide(); // BaseComponent hide
        this.clearQuestion();
    }

    clearQuestion() {
        if (this.questionTextElement) {
            this.questionTextElement.textContent = '';
        }
    }

    // No specific destroy logic needed beyond BaseComponent.
}

export default QuestionDisplayComponent; 