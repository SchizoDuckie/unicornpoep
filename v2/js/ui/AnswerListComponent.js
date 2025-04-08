import BaseComponent from '../components/base-component.js';
import eventBus from '../core/event-bus.js';
import { Events } from '../core/event-constants.js';

// Define the CSS class for the answer buttons (ensure this matches your CSS)
const ANSWER_BUTTON_CLASS = 'answer-button'; 
const CORRECT_CLASS = 'correct';
const INCORRECT_CLASS = 'incorrect';
const SELECTED_CLASS = 'selected'; // Optional class for immediate click feedback

/**
 * Manages the display and interaction of answer buttons within the #answers container.
 */
class AnswerListComponent extends BaseComponent {
    /**
     * @param {string} elementSelector - CSS selector for the component's root element.
     */
    constructor(elementSelector = '#answers') { // Target the div#answers
        super(elementSelector, 'AnswerList');

        if (!this.rootElement) {
             throw new Error(`AnswerListComponent: Root element ('${elementSelector}') not found.`);
        }

        this.listen(Events.Game.QuestionNew, this._handleNewQuestion);
        this.listen(Events.Game.AnswerChecked, this._handleAnswerChecked);
    }

    /**
     * Handles the new question event by displaying its answers as buttons.
     * @param {object} payload - Event payload from Events.Game.QuestionNew.
     * @param {object} payload.questionData - Contains answers.
     * @param {string[]} payload.questionData.answers - Array of answer strings.
     * @protected
     */
    _handleNewQuestion({ questionData }) {
        if (questionData && Array.isArray(questionData.answers)) {
            this._displayAnswers(questionData.answers);
        } else {
            console.warn(`[${this.name}] Invalid or missing answers in QuestionNew event.`);
            this._clearAnswers();
        }
    }

    /** Clears existing answer buttons. @protected */
    _clearAnswers() {
        if (this.rootElement) {
            this.rootElement.innerHTML = ''; 
        }
    }

    /**
     * Creates and displays the answer buttons.
     * @param {string[]} answers - An array of answer strings.
     * @protected
     */
    _displayAnswers(answers) {
        this._clearAnswers(); 
        if (!this.rootElement) return;

        answers.forEach(answerText => {
            const button = document.createElement('button');
            button.classList.add(ANSWER_BUTTON_CLASS); 
            button.dataset.answer = answerText; // Store answer value
            button.textContent = answerText;   // Set button text
            button.disabled = false;           // Ensure buttons start enabled

            button.addEventListener('click', () => {
                // Check if interaction is allowed (buttons might be disabled after an answer)
                if (!button.disabled) { 
                    this._handleAnswerClick(answerText, button); 
                }
            });

            this.rootElement.appendChild(button); 
        });
    }

    /**
     * Handles the click event on an answer button.
     * @param {string} answer - The answer value from the clicked button.
     * @param {HTMLButtonElement} clickedButton - The button element.
     * @protected
     */
    _handleAnswerClick(answer, clickedButton) {
        console.log(`[${this.name}] Answer clicked: ${answer}`);
        
        // Disable all buttons immediately to prevent multiple clicks
        this.disableInteraction(); 

        // Optional: Add immediate visual feedback
        // clickedButton.classList.add(SELECTED_CLASS); 

        // Emit the UI event for the game logic
        eventBus.emit(Events.UI.GameArea.AnswerSubmitted, { answer: answer }); 
    }

    /**
     * Handles the answer checked event, adds feedback classes, and re-enables for next question (handled by _handleNewQuestion).
     * @param {object} payload - Event payload from Events.Game.AnswerChecked.
     * @param {boolean} payload.isCorrect
     * @param {string} payload.correctAnswer
     * @param {any} payload.submittedAnswer
     * @protected
     */
     _handleAnswerChecked({ isCorrect, correctAnswer, submittedAnswer }) {
         if (!this.rootElement) return;

         const buttons = this.rootElement.querySelectorAll(`button.${ANSWER_BUTTON_CLASS}`);
         buttons.forEach(button => {
            const buttonAnswer = button.dataset.answer;
            // Disable button after check (re-enabled on new question)
            button.disabled = true; 

            // Remove potential selection class
            // button.classList.remove(SELECTED_CLASS); 

             if (buttonAnswer == submittedAnswer) {
                 button.classList.add(isCorrect ? CORRECT_CLASS : INCORRECT_CLASS);
             }
             // Optionally highlight the correct answer if the submitted one was wrong
             if (!isCorrect && buttonAnswer == correctAnswer) {
                 button.classList.add(CORRECT_CLASS); 
             }
         });
         // Interaction remains disabled until _displayAnswers is called for the next question.
     }

     /** Disables all answer buttons. */
     disableInteraction() {
         if (!this.rootElement) return;
         const buttons = this.rootElement.querySelectorAll(`button.${ANSWER_BUTTON_CLASS}`);
         buttons.forEach(button => button.disabled = true);
     }

     /** Enables all answer buttons (unused here, handled by _displayAnswers). */
     // enableInteraction() {
     //     if (!this.rootElement) return;
     //     const buttons = this.rootElement.querySelectorAll(`button.${ANSWER_BUTTON_CLASS}`);
     //     buttons.forEach(button => button.disabled = false);
     // }
}

export default AnswerListComponent; 