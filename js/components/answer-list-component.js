import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

const ANSWER_BUTTON_CLASS = 'answer-button';
const CORRECT_CLASS = 'correct-answer';
const INCORRECT_CLASS = 'wrong-answer';
const SELECTED_CLASS = 'selected'; // Used for immediate feedback

/**
 * Manages the display and interaction of the answer list/buttons in the game area.
 * Listens for new questions to populate the list and for answer checks to provide feedback.
 * Emits an event when an answer is selected by the user.
 * Uses BUTTON elements directly.
 *
 * @extends BaseComponent
 */
class AnswerListComponent extends BaseComponent {
    static SELECTOR = '#answers';
    static VIEW_NAME = 'AnswerListComponent';

    /** Initializes component elements. */
    constructor() {
        super(); // Call BaseComponent constructor
        console.log("[AnswerListComponent] Constructed (via BaseComponent).");
    }

    /**
     * Initializes the component, setting up the root element and binding methods.
     */
    initialize() {
        console.log(`[${this.name}] Initializing...`);
        this.listElement = this.rootElement; 
        if (!this.listElement) {
             throw new Error(`[${this.name}] Root element not found with selector: ${this.selector}`);
        }
        this._clearAnswers(); // Initial state
        
        // --- BIND ALL METHODS HERE --- 
        console.log(`[${this.name}] Binding methods in initialize...`);
        this._handleQuestionNew = this._handleQuestionNew.bind(this);
        
        // --- Ensure exact name match for the failing bind --- 
        this._handleAnswerClick = this._handleAnswerClick.bind(this); 
        // --- End exact name check --- 

        this._handleTimeUp = this._handleTimeUp.bind(this);
        this._handleFeedback = this._handleFeedback.bind(this); 
        this._handleGameFinished = this._handleGameFinished.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);
        console.log(`[${this.name}] Methods bound in initialize.`);
        
        console.log(`[${this.name}] Initialized.`);
    }

    /**
     * Registers DOM listeners and eventBus listeners using pre-bound methods.
     */
    registerListeners() {
        console.log(`[${this.name}] Registering listeners.`);
        
        // DOM Listeners (Event delegation on root)
        if (this.listElement) {
             this.listElement.addEventListener('click', this._handleAnswerClick); // Uses bound method
             this.listElement.addEventListener('keydown', this._handleKeyDown);   // Uses bound method
        }
        
        // eventBus Listeners (Uses bound methods via this.listen)
        this.listen(Events.Game.QuestionNew, this._handleQuestionNew);
        this.listen(Events.Game.AnswerChecked, this._handleFeedback);
        this.listen(Events.Multiplayer.Client.AnswerResult, this._handleFeedback);
        this.listen(Events.Game.TimeUp, this._handleTimeUp);
        this.listen(Events.Game.Finished, this._handleGameFinished);
        
        console.log(`[${this.name}] Listeners registered.`);
    }

    /**
     * Handles keydown events on the answer list for accessibility.
     * Allows navigation with arrow keys and selection with Enter/Space.
     * Adapted for BUTTON elements.
     *
     * @param {KeyboardEvent} event - The keydown event object.
     */
    _handleKeyDown(event) {
        if (!this.isAnswerable) return; 

        // *** CHANGE: Target buttons instead of li items ***
        const items = Array.from(this.rootElement.querySelectorAll(`button.${ANSWER_BUTTON_CLASS}:not([disabled])`)); 
        if (items.length === 0) return; 

        const currentItem = document.activeElement;
        // Check if the focused element is one of our buttons
        let currentIndex = -1;
        if (currentItem && currentItem.matches(`button.${ANSWER_BUTTON_CLASS}`)) {
             currentIndex = items.indexOf(currentItem);
        }


        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowLeft':
                event.preventDefault();
                currentIndex = (currentIndex <= 0) ? items.length - 1 : currentIndex - 1;
                items[currentIndex].focus();
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                event.preventDefault();
                currentIndex = (currentIndex === -1 || currentIndex >= items.length - 1) ? 0 : currentIndex + 1;
                items[currentIndex].focus();
                break;
            case 'Enter':
            case ' ': // Space bar
                event.preventDefault();
                 // *** CHANGE: Check if currentItem is a button ***
                if (currentItem && currentItem.matches(`button.${ANSWER_BUTTON_CLASS}`) && !currentItem.disabled) {
                    this._submitAnswer(currentItem); // Pass the button element
                }
                break;
            default:
                break;
        }
    }

    /**
     * Handles clicks within the answer list container using event delegation.
     *
     * @param {Event} event - The click event object.
     */
    _handleAnswerClick(event) { // <<< Ensure name matches exactly
        if (!this.isAnswerable) return; 
        const answerButton = event.target.closest(`button.${ANSWER_BUTTON_CLASS}`); 
        if (!answerButton || answerButton.disabled) return;
        this._submitAnswer(answerButton);
    }

    /**
     * Processes the submission of an answer, whether by click or keyboard.
     * Adapted for BUTTON elements.
     *
     * @param {HTMLButtonElement} answerButton - The selected button element.
     * @private
     */
    _submitAnswer(answerButton) {
        const selectedAnswer = answerButton.dataset.answer;
        console.debug(`[${this.name}] Answer selected:`, selectedAnswer);

        this.isAnswerable = false; // Disable further answers
        this.disableInteraction(); // Disable all buttons visually/functionally

        // Add a 'selected' class immediately for visual feedback
        answerButton.classList.add(SELECTED_CLASS);
        
        eventBus.emit(Events.UI.GameArea.AnswerSubmitted, { answer: selectedAnswer });
    }

    /**
     * Populates the container with new answer BUTTONS when a new question is received.
     *
     * @param {object} payload - The event payload.
     * @param {object} payload.questionData - Data for the new question.
     * @param {string[]} payload.questionData.answers - Array of answer strings.
     */
    _handleQuestionNew({ questionData }) {
        // --- REPLACE Template Logic with Button Creation ---
        console.debug(`[${this.name}] Displaying new answer buttons.`);
        this._clearAnswers(); // Clear previous buttons
        
        if (!this.rootElement) return; 

        if (!questionData.answers || !Array.isArray(questionData.answers)) {
             console.warn(`[${this.name}] Invalid or missing answers in QuestionNew payload.`);
             this.isAnswerable = false;
             return;
        }

        questionData.answers.forEach(answerText => {
            // *** CORE CHANGE: Create button instead of cloning template ***
            const button = document.createElement('button');
            button.classList.add(ANSWER_BUTTON_CLASS); 
            button.dataset.answer = answerText; 
            button.textContent = answerText;   
            button.disabled = false; // Start enabled
            // Buttons are naturally focusable, so keyboard nav should work if they are not disabled

            this.rootElement.appendChild(button); 
        });
        // --- END REPLACE ---

        this.isAnswerable = true; // Enable clicks/keys for the new set of answers
        this.show(); // Ensure component is visible

        // Focus the first answer button for keyboard users
        const firstButton = this.rootElement.querySelector(`button.${ANSWER_BUTTON_CLASS}`);
        if (firstButton) {
            // Use try-catch for focus as element might be hidden transiently
            try {
                 firstButton.focus();
            } catch (e) {
                console.warn(`[${this.name}] Could not focus first answer button.`, e)
            }
        }
    }
    
    /**
     * Clears existing answer buttons.
     * @protected
     */
    _clearAnswers() {
        if (this.rootElement) {
            this.rootElement.innerHTML = ''; 
            this.rootElement.classList.remove('answered', 'feedback-shown'); 
        }
    }

    /**
     * Unified handler for providing visual feedback on answer buttons.
     * Handles payloads from both Events.Game.AnswerChecked and multiplayer:client:answerResult.
     *
     * @param {object} payload - The event payload.
     * @param {boolean} payload.isCorrect - Whether the submitted answer was correct.
     * @param {string} payload.correctAnswer - The correct answer text.
     * @param {any} [payload.submittedAnswer] - The answer submitted (may not be present in MP payload).
     * @private
     */
    _handleFeedback({ isCorrect, correctAnswer, submittedAnswer }) {
        // submittedAnswer might be undefined in the MP event, but we don't strictly need it
        // if we rely on the 'selected' class added during _submitAnswer.

        if (!this.rootElement) return;
        
        // Use submittedAnswer from payload if available, otherwise find the 'selected' button
        let submittedButton = null;
        if (submittedAnswer !== undefined) {
             // Use strict comparison, ensuring consistent types (string)
             submittedButton = this.rootElement.querySelector(`button.${ANSWER_BUTTON_CLASS}[data-answer="${String(submittedAnswer)}"]`);
        } else {
             submittedButton = this.rootElement.querySelector(`button.${ANSWER_BUTTON_CLASS}.${SELECTED_CLASS}`);
        }

        console.debug(`[${this.name}] Handling feedback. Correct: ${isCorrect}, Correct Ans: ${correctAnswer}, Submitted Ans: ${submittedAnswer}`);
        this.rootElement.classList.add('feedback-shown'); 

        const buttons = this.rootElement.querySelectorAll(`button.${ANSWER_BUTTON_CLASS}`);
        buttons.forEach(button => {
            const buttonAnswer = button.dataset.answer; // This is always a string
            button.disabled = true; 
            button.classList.remove(SELECTED_CLASS); // Remove selection highlight after processing

            // Use strict comparison for correct answer (convert correctAnswer to string if needed)
            const isButtonCorrectAnswer = String(buttonAnswer) === String(correctAnswer);

            if (button === submittedButton) {
                // This is the button the user clicked (or the one from the payload)
                 button.classList.add(isCorrect ? CORRECT_CLASS : INCORRECT_CLASS);
                 console.log(`Button ${buttonAnswer} was submitted. Correct: ${isCorrect}. Added class: ${isCorrect ? CORRECT_CLASS : INCORRECT_CLASS}`);
            }
            
            // Always highlight the correct answer green, even if submitted was wrong
            if (isButtonCorrectAnswer) {
                button.classList.add(CORRECT_CLASS);
                // Avoid adding 'incorrect' if it happened to be the correct one submitted incorrectly
                 button.classList.remove(INCORRECT_CLASS); 
                 console.log(`Button ${buttonAnswer} is the correct answer. Added class: ${CORRECT_CLASS}`);
            }
        });
        
        this.isAnswerable = false; 
    }

    /**
     * Disables all answer buttons.
     */
    disableInteraction() {
        if (!this.rootElement) return;
        const buttons = this.rootElement.querySelectorAll(`button.${ANSWER_BUTTON_CLASS}`);
        buttons.forEach(button => button.disabled = true);
    }

    /**
     * Overrides base destroy method to remove specific DOM listeners.
     */
    destroy() {
        // Ensure specific DOM listeners are removed if added directly (like keydown)
        // BaseComponent handles listeners added via this.listen() and addEventListener in registerListeners
        if (this.listElement) {
            this.listElement.removeEventListener('click', this._handleAnswerClick);
            this.listElement.removeEventListener('keydown', this._handleKeyDown);
        }
        super.destroy(); 
        console.log(`[${this.name}] Destroyed.`);
    }

    /** 
     * Handles the game time running out and disables interaction.
     * @private 
     */
    _handleTimeUp() {
        console.debug(`[${this.name}] Time up.`);
        this.isAnswerable = false;
        this.disableInteraction();
        // Optionally add visual feedback for time up
    }

    /**
     * Handles the game finishing and clears the answers.
     * @private
     */
    _handleGameFinished() {
        console.debug(`[${this.name}] Game finished.`);
        this._clearAnswers();
        this.isAnswerable = false;
        // Component might be hidden by GameArea or UIManager anyway
    }
}

export default AnswerListComponent; 