import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

/**
 * Manages the display and interaction of the answer list/buttons in the game area.
 * Listens for new questions to populate the list and for answer checks to provide feedback.
 * Emits an event when an answer is selected by the user.
 * Uses BUTTON elements directly.
 *
 * @extends RefactoredBaseComponent
 */
class AnswerListComponent extends RefactoredBaseComponent {
    static SELECTOR = '#answers'; // Restored: Required by BaseComponent
    static VIEW_NAME = 'AnswerListComponent';
    
    // CSS Classes
    static ANSWER_BUTTON_CLASS = 'answer-button';
    static CORRECT_CLASS = 'correct-answer';
    static INCORRECT_CLASS = 'wrong-answer';
    static SELECTED_CLASS = 'selected';
    
    // State properties
    isAnswerable = false;

    /**
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration object with events and domEvents
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Game.QuestionNew,
                    callback: this._handleQuestionNew
                },
                {
                    eventName: Events.Game.AnswerChecked,
                    callback: this._handleFeedback
                },
                {
                    eventName: Events.Game.TimeUp,
                    callback: this._handleTimeUp
                },
                {
                    eventName: Events.Game.Finished,
                    callback: this._handleGameFinished
                }
            ],
            
            domEvents: [
                {
                    selector: this.selector, // Reverted to use component's root selector
                    event: 'click',
                    handler: this._handleAnswerClick
                },
                {
                    selector: this.selector, // Reverted to use component's root selector
                    event: 'keydown',
                    handler: this._handleKeyDown
                }
            ]
        };
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

        // Target buttons instead of li items
        const items = Array.from(this.rootElement.querySelectorAll(`button.${AnswerListComponent.ANSWER_BUTTON_CLASS}:not([disabled])`)); 
        if (items.length === 0) return; 

        const currentItem = document.activeElement;
        // Check if the focused element is one of our buttons
        let currentIndex = -1;
        if (currentItem && currentItem.matches(`button.${AnswerListComponent.ANSWER_BUTTON_CLASS}`)) {
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
                // Check if currentItem is a button
                if (currentItem && currentItem.matches(`button.${AnswerListComponent.ANSWER_BUTTON_CLASS}`) && !currentItem.disabled) {
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
    _handleAnswerClick(event) {
        if (!this.isAnswerable) return; 
        const answerButton = event.target.closest(`button.${AnswerListComponent.ANSWER_BUTTON_CLASS}`); 
        if (!answerButton || answerButton.disabled) return;
        this._submitAnswer(answerButton);
    }

    /**
     * Processes the submission of an answer, whether by click or keyboard.
     * Adapted for BUTTON elements.
     *
     * @param {HTMLButtonElement} answerButton - The selected button element.
     * @event Events.UI.GameArea.AnswerSubmitted
     * @private
     */
    _submitAnswer(answerButton) {
        const selectedAnswer = answerButton.dataset.answer;

        this.isAnswerable = false; // Disable further answers
        this.disableInteraction(); // Disable all buttons visually/functionally

        // Add a 'selected' class immediately for visual feedback
        answerButton.classList.add(AnswerListComponent.SELECTED_CLASS);
        
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
        this._clearAnswers(); // Clear previous buttons

        if (!questionData.answers || !Array.isArray(questionData.answers)) {
             this.isAnswerable = false;
             return;
        }

        questionData.answers.forEach(answerText => {
            // Create button instead of cloning template
            const button = document.createElement('button');
            button.classList.add(AnswerListComponent.ANSWER_BUTTON_CLASS); 
            button.dataset.answer = answerText; 
            button.textContent = answerText;   
            button.disabled = false; // Start enabled
            // Buttons are naturally focusable, so keyboard nav should work if they are not disabled

            this.rootElement.appendChild(button); 
        });

        this.isAnswerable = true; // Enable clicks/keys for the new set of answers
        this.show(); // Ensure component is visible

        // Focus the first answer button for keyboard users
        const firstButton = this.rootElement.querySelector(`button.${AnswerListComponent.ANSWER_BUTTON_CLASS}`);
        if (firstButton) {
            try {
                firstButton.focus();
            } catch (e) {
                // Focus may fail if element is hidden
            }
        }
    }

    /**
     * Clears all answer buttons from the container.
     */
    _clearAnswers() {
        this.rootElement.innerHTML = ''; // Reverted: Remove guard clause
    }

    /**
     * Handles feedback after answer submission.
     * Adds visual classes to indicate correctness.
     *
     * @param {object} payload - The event payload.
     * @param {boolean} payload.isCorrect - Whether the submitted answer was correct.
     * @param {string} payload.correctAnswer - The correct answer text.
     * @param {string} payload.submittedAnswer - The submitted answer text.
     */
    _handleFeedback({ isCorrect, correctAnswer, submittedAnswer }) {
        const buttons = this.rootElement.querySelectorAll(`button.${AnswerListComponent.ANSWER_BUTTON_CLASS}`);
        
        // Apply respective classes to correct and incorrect answers
        buttons.forEach(button => {
            const buttonAnswer = button.dataset.answer;
            
            if (buttonAnswer === correctAnswer) {
                button.classList.add(AnswerListComponent.CORRECT_CLASS);
            } else if (buttonAnswer === submittedAnswer) {
                button.classList.add(AnswerListComponent.INCORRECT_CLASS);
            }
            
            // Remove the temporary 'selected' class if present
            button.classList.remove(AnswerListComponent.SELECTED_CLASS);
        });
        
        // Disable further interaction
        this.disableInteraction();
    }

    /**
     * Disables interaction with answer buttons.
     */
    disableInteraction() {
        const buttons = this.rootElement.querySelectorAll(`button.${AnswerListComponent.ANSWER_BUTTON_CLASS}`);
        buttons.forEach(button => {
            button.disabled = true;
        });
        this.isAnswerable = false;
    }

    /**
     * Handles when time runs out for a question without an answer.
     */
    _handleTimeUp() {
        this.disableInteraction();
    }

    /**
     * Handles the game finishing event.
     * Clears all answers and hides the component.
     */
    _handleGameFinished() {
        this.disableInteraction(); // Ensure buttons disabled
        this._clearAnswers();
        this.hide();
    }
}

export default AnswerListComponent; 