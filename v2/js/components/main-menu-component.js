import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';


/**
 * @class MainMenuComponent
 * @extends BaseComponent
 * Manages the main menu buttons and emits corresponding UI events when they are clicked.
 */
class MainMenuComponent extends BaseComponent {
    /**
     * Creates an instance of MainMenuComponent.
     * @param {string} elementSelector - CSS selector for the main menu container (e.g., '#mainMenu').
     */
    constructor(elementSelector = '#mainMenu') {
        super(elementSelector, Views.MainMenu);

        // Find buttons within the main menu
        this.practiceButton = this.rootElement.querySelector('#practice');
        this.singlePlayerButton = this.rootElement.querySelector('#takeTest'); // Assuming #takeTest is Single Player
        this.multiplayerButton = this.rootElement.querySelector('#multiplayer');
        this.customQuestionsButton = this.rootElement.querySelector('#myQuestions');
        this.highscoresButton = this.rootElement.querySelector('#viewHighscores');
        this.aboutButton = this.rootElement.querySelector('#hoeDan'); // Assuming #hoeDan is About

        this._bindEvents();
        console.log(`[${this.name}] Initialized`);
    }

    /** Binds DOM event listeners to menu buttons. @private */
    _bindEvents() {
        this._addButtonListener(this.practiceButton, Events.UI.MainMenu.StartPracticeClicked);
        this._addButtonListener(this.singlePlayerButton, Events.UI.MainMenu.StartSinglePlayerClicked);
        this._addButtonListener(this.multiplayerButton, Events.UI.MainMenu.JoinMultiplayerClicked); // Changed from StartMultiplayerHostClicked based on refactor-plan
        this._addButtonListener(this.customQuestionsButton, Events.UI.MainMenu.CustomQuestionsClicked);
        this._addButtonListener(this.highscoresButton, Events.UI.MainMenu.HighscoresClicked);
        this._addButtonListener(this.aboutButton, Events.UI.MainMenu.AboutClicked);
    }

    /** Removes DOM event listeners. @private */
    _unbindEvents() {
        this._removeButtonListener(this.practiceButton, Events.UI.MainMenu.StartPracticeClicked);
        this._removeButtonListener(this.singlePlayerButton, Events.UI.MainMenu.StartSinglePlayerClicked);
        this._removeButtonListener(this.multiplayerButton, Events.UI.MainMenu.JoinMultiplayerClicked);
        this._removeButtonListener(this.customQuestionsButton, Events.UI.MainMenu.CustomQuestionsClicked);
        this._removeButtonListener(this.highscoresButton, Events.UI.MainMenu.HighscoresClicked);
        this._removeButtonListener(this.aboutButton, Events.UI.MainMenu.AboutClicked);
    }

    /**
     * Helper to add a click listener to a button and emit an event.
     * @param {HTMLElement | null} button - The button element.
     * @param {string} eventToEmit - The event constant to emit on click.
     * @private
     */
    _addButtonListener(button, eventToEmit) {
        if (!button) {
            console.warn(`[${this.name}] Button not found for event: ${eventToEmit}`);
            return;
        }
        // Store the handler function to remove it later
        button._clickHandler = () => {
            console.log(`[${this.name}] Button clicked, emitting: ${eventToEmit}`);
            eventBus.emit(eventToEmit);
        };
        button.addEventListener('click', button._clickHandler);
    }

    /**
     * Helper to remove a click listener added by _addButtonListener.
     * @param {HTMLElement | null} button - The button element.
     * @param {string} eventToEmit - The event associated (used for logging).
     * @private
     */
    _removeButtonListener(button, eventToEmit) {
        if (button && button._clickHandler) {
            button.removeEventListener('click', button._clickHandler);
            console.log(`[${this.name}] Removed listener for: ${eventToEmit}`);
            delete button._clickHandler; // Clean up the stored handler
        }
    }

    // Override destroy to clean up listeners
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        this._unbindEvents();
        super.destroy();
    }
}

export default MainMenuComponent; 