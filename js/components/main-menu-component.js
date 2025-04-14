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
    static SELECTOR = '#mainMenu';
    static VIEW_NAME = 'MainMenuComponent';

    /** Initializes the component. */
    constructor() {
        super();
        console.log("[MainMenuComponent] Constructed (via BaseComponent).");
    }

    initialize() {
        // Find buttons
        this.practiceButton = this.rootElement.querySelector('#practice');
        this.singlePlayerButton = this.rootElement.querySelector('#takeTest');
        this.multiplayerButton = this.rootElement.querySelector('#multiplayer');
        this.customQuestionsButton = this.rootElement.querySelector('#myQuestions');
        this.highscoresButton = this.rootElement.querySelector('#viewHighscores');
        this.aboutButton = this.rootElement.querySelector('#hoeDan');
        
        // Check if buttons exist (optional, but good practice)
        if (!this.practiceButton || !this.singlePlayerButton /* ... etc */) {
            console.warn(`[${this.name}] One or more menu buttons not found.`);
        }

        // --- Bind Handlers Here --- 
        this._handlePracticeClick = this._createClickHandler(Events.UI.MainMenu.StartPracticeClicked);
        this._handleSinglePlayerClick = this._createClickHandler(Events.UI.MainMenu.StartSinglePlayerClicked);
        this._handleMultiplayerClick = this._createClickHandler(Events.UI.MainMenu.JoinMultiplayerClicked);
        this._handleCustomQuestionsClick = this._createClickHandler(Events.UI.MainMenu.CustomQuestionsClicked);
        this._handleHighscoresClick = this._createClickHandler(Events.UI.MainMenu.HighscoresClicked);
        this._handleAboutClick = this._createClickHandler(Events.UI.MainMenu.AboutClicked);
        
        console.log(`[${this.name}] Initialized.`);
    }

    /** Registers DOM event listeners using pre-bound handlers. */
    registerListeners() {
        console.log(`[${this.name}] Registering listeners.`);
        if (this.practiceButton) this.practiceButton.addEventListener('click', this._handlePracticeClick);
        if (this.singlePlayerButton) this.singlePlayerButton.addEventListener('click', this._handleSinglePlayerClick);
        if (this.multiplayerButton) this.multiplayerButton.addEventListener('click', this._handleMultiplayerClick);
        if (this.customQuestionsButton) this.customQuestionsButton.addEventListener('click', this._handleCustomQuestionsClick);
        if (this.highscoresButton) this.highscoresButton.addEventListener('click', this._handleHighscoresClick);
        if (this.aboutButton) this.aboutButton.addEventListener('click', this._handleAboutClick);
    }
    
    /** 
     * Factory function to create a click handler that emits a specific event.
     * @param {string} eventToEmit - The event constant to emit.
     * @returns {Function} The event handler function.
     * @private 
     */
    _createClickHandler(eventToEmit) {
        // Return a function that closes over eventToEmit
        // Using a regular function here to ensure `this` refers to the component when bound
        return function() { 
            console.log(`[${this.name}] Button clicked, emitting: ${eventToEmit}`);
            eventBus.emit(eventToEmit);
        }.bind(this); // Bind the returned function to the component instance
    }

    destroy() {
        console.log(`[${this.name}] Destroying...`);
        // No need to manually remove listeners added in registerListeners
        super.destroy();
    }
}

export default MainMenuComponent; 