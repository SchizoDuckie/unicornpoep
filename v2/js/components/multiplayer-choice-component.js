import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';


/**
 * @class MultiplayerChoiceComponent
 * @extends BaseComponent
 * Handles the view where the user chooses to Host or Join a multiplayer game
 * after entering their name.
 */
class MultiplayerChoiceComponent extends BaseComponent {
    /**
     * Creates an instance of MultiplayerChoiceComponent.
     */
    constructor() {
        super('#multiplayerChoice', Views.MultiplayerChoice);

        // Element references
        this.nameInput = this.rootElement.querySelector('#playerNameInput');
        this.hostButton = this.rootElement.querySelector('#hostGame');
        this.joinButton = this.rootElement.querySelector('#joinGame');
        this.backButton = this.rootElement.querySelector('.backToMain'); // Assuming generic back button class
        this.errorDisplay = this.rootElement.querySelector('#choiceError');
        // Reference the difficulty radio buttons
        this.difficultyRadios = this.rootElement.querySelectorAll('input[name="mpDifficulty"]');

        this._bindEvents();
        this.hide(); // Start hidden
        console.log(`[${this.name}] Initialized`);

        // Listen for when this view should be shown
        this.listen(Events.Navigation.ShowView, this.handleShowView);
    }

    /** Binds DOM event listeners. @private */
    _bindEvents() {
        this.hostButton.addEventListener('click', this._handleHostClick);
        this.joinButton.addEventListener('click', this._handleJoinClick);
        this.backButton.addEventListener('click', this._handleBackClick);
        // Add input listener to clear error on typing?
         this.nameInput.addEventListener('input', this._clearError);
    }

    /** Removes DOM event listeners. @private */
    _unbindEvents() {
        this.hostButton.removeEventListener('click', this._handleHostClick);
        this.joinButton.removeEventListener('click', this._handleJoinClick);
        this.backButton.removeEventListener('click', this._handleBackClick);
        this.nameInput.removeEventListener('input', this._clearError);
    }

    /**
     * Handles the ShowView event to potentially clear fields.
     * @param {object} payload
     * @param {string} payload.viewName
     */
    handleShowView({ viewName }) {
        if (viewName === this.name) {
            console.log(`[${this.name}] Showing view.`);
            this._clearForm();
            this.show();
            this.nameInput.focus(); // Focus name input when shown
        }
    }

    /** Clears the input field and error message. @private */
    _clearForm() {
        if (this.nameInput) this.nameInput.value = '';
        this._clearError();
    }

     /** Clears the error message display. @private */
     _clearError = () => { // Arrow function for listener context
        if (this.errorDisplay) {
            this.errorDisplay.textContent = '';
            this.errorDisplay.classList.add('hidden');
        }
    }

    /** Displays an error message. @private */
    _showError(message) {
        if (this.errorDisplay) {
            this.errorDisplay.textContent = message;
            this.errorDisplay.classList.remove('hidden');
        }
    }

    /** Validates the player name and returns it, or shows error. @private */
    _validateAndGetName() {
        const playerName = this.nameInput.value.trim();
        if (!playerName) {
            this._showError(getTextTemplate('mpChoiceErrorEmptyName'));
            this.nameInput.focus();
            return null;
        }
         if (playerName.length > 20) { // Example length limit
             this._showError(getTextTemplate('mpChoiceErrorNameTooLong'));
             this.nameInput.focus();
             return null;
         }
        this._clearError();
        return playerName;
    }

    /** Handles the Host button click. @private */
    _handleHostClick = () => { // Use arrow function
        const playerName = this._validateAndGetName();
        if (!playerName) return;

        console.log(`[${this.name}] Host button clicked. Player: ${playerName}`);

        // Get the selected difficulty
        let selectedDifficulty = 'medium'; // Default
        this.difficultyRadios.forEach(radio => {
            if (radio.checked) {
                selectedDifficulty = radio.value;
            }
        });

        // TODO: Need to get settings for hosting (SHEET IDs specifically).
        // Sheet selection should probably happen *before* this screen,
        // or be presented to the host here.
        const settings = {
            sheetIds: ['default_basis'], // STILL USING DEFAULT SHEET
            difficulty: selectedDifficulty // Use the selected difficulty
        };

        eventBus.emit(Events.UI.MultiplayerChoice.HostClicked, {
            playerName: playerName,
            settings: settings // Pass selected settings
        });
    }

    /** Handles the Join button click. @private */
    _handleJoinClick = () => { // Use arrow function
        const playerName = this._validateAndGetName();
        if (!playerName) return;

        console.log(`[${this.name}] Join button clicked. Player: ${playerName}`);
        eventBus.emit(Events.UI.MultiplayerChoice.JoinClicked, {
            playerName: playerName
        });
    }

    /** Handles the back button click. @private */
    _handleBackClick = () => {
        console.log(`[${this.name}] Back button clicked.`);
        eventBus.emit(Events.UI.MultiplayerChoice.BackClicked); 
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Use imported constant
    }

    // Override destroy to clean up listeners
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        this._unbindEvents();
        super.destroy();
    }
}

export default MultiplayerChoiceComponent; 