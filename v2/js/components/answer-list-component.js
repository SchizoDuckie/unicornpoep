import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

// Define the CSS class for the answer buttons (matches V1 CSS/HTML)
const ANSWER_BUTTON_CLASS = 'answer-button';
const CORRECT_CLASS = 'correct-answer';
const INCORRECT_CLASS = 'wrong-answer';
const SELECTED_CLASS = 'selected'; // Used for immediate feedback

/**
 * Manages the display and interaction of the answer list/buttons in the game area.
 * Listens for new questions to populate the list and for answer checks to provide feedback.
 * Emits an event when an answer is selected by the user.
 * Uses BUTTON elements directly.
 * @extends BaseComponent
 */
class AnswerListComponent extends BaseComponent {
    /**
     * Creates an instance of AnswerListComponent.
     */
    constructor() {
        // Target the div container
        super('#answers', Views.AnswerList); 
        this.isAnswerable = false;

        // --- REMOVE Template Logic ---
        // const templateSelector = '#answer-item-template'; 
        // this.template = document.querySelector(templateSelector);
        // if (!this.template) {
        //     console.error(`[${this.name}] Answer item template not found with selector: ${templateSelector}`);
        //     this.rootElement = null; 
        //     return;
        // }
        // --- END REMOVE ---

        // Ensure the rootElement (div#answers) exists
        if (!this.rootElement) {
            throw new Error(`AnswerListComponent: Root element ('#answers') not found.`);
       }

        this._bindMethods();
        this._addEventListeners(); // Keep original listeners
        
        // Listen for game events
        this.listen(Events.Game.QuestionNew, this.handleNewQuestion);
        this.listen(Events.Game.AnswerChecked, this._handleFeedback);
        this.listen('multiplayer:client:answerResult', this._handleFeedback);
    }

    /** Binds component methods to the class instance. */
    _bindMethods() {
        // Keep original bindings
        this.handleAnswerClick = this.handleAnswerClick.bind(this);
        this.handleNewQuestion = this.handleNewQuestion.bind(this);
        this._handleFeedback = this._handleFeedback.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this); 
    }

    /** Adds DOM event listeners. */
    _addEventListeners() {
        // Keep original listeners on the root element
        this.rootElement.addEventListener('click', this.handleAnswerClick);
        this.rootElement.addEventListener('keydown', this.handleKeyDown); 
    }

    /** Removes DOM event listeners. */
    _removeEventListeners() {
        // Keep original removal logic
        this.rootElement.removeEventListener('click', this.handleAnswerClick);
        this.rootElement.removeEventListener('keydown', this.handleKeyDown);
    }

    /**
     * Handles keydown events on the answer list for accessibility.
     * Allows navigation with arrow keys and selection with Enter/Space.
     * ADAPTED FOR BUTTONS.
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
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
     * Handles clicks within the answer list container. Uses event delegation.
     * ADAPTED FOR BUTTONS.
     * @param {Event} event - The click event.
     */
    handleAnswerClick(event) {
        if (!this.isAnswerable) return; 

        // *** CHANGE: Target buttons instead of li items ***
        const answerButton = event.target.closest(`button.${ANSWER_BUTTON_CLASS}`); 
        if (!answerButton || answerButton.disabled) return; // Clicked outside a button or on a disabled one

        this._submitAnswer(answerButton);
    }

    /**
     * Processes the submission of an answer, whether by click or keyboard.
     * ADAPTED FOR BUTTONS.
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
     * @param {object} payload - The event payload.
     * @param {object} payload.questionData - Data for the new question.
     * @param {string[]} payload.questionData.answers - Array of answer strings.
     */
    handleNewQuestion({ questionData }) {
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
    
    /** Clears existing answer buttons. @protected */
    _clearAnswers() {
        if (this.rootElement) {
            this.rootElement.innerHTML = ''; 
            this.rootElement.classList.remove('answered', 'feedback-shown'); 
        }
    }

    /**
     * Unified handler for providing visual feedback on answer buttons.
     * Handles payloads from both Events.Game.AnswerChecked and multiplayer:client:answerResult.
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

     /** Disables all answer buttons. */
     disableInteraction() {
         if (!this.rootElement) return;
         const buttons = this.rootElement.querySelectorAll(`button.${ANSWER_BUTTON_CLASS}`);
         buttons.forEach(button => button.disabled = true);
     }

    /**
     * Overrides base destroy method to remove specific DOM listeners.
     */
    destroy() {
        this._removeEventListeners(); // Keep original removal
        super.destroy(); 
    }
}

export default AnswerListComponent; 