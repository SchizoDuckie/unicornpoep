import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';
import miscUtils from '../utils/miscUtils.js'; // Ensure default import

/**
 * @class MultiplayerChoiceComponent
 * @extends BaseComponent
 * Handles the view where the user chooses to Host or Join a multiplayer game
 * after entering their name.
 */
class MultiplayerChoiceComponent extends BaseComponent {
    static SELECTOR = '#multiplayerChoice';
    static VIEW_NAME = 'MultiplayerChoiceComponent';

    /** Initializes the component. */
    constructor() {
        super();
        console.log("[MultiplayerChoiceComponent] Constructed (via BaseComponent).");
    }

    initialize() {
        // Find elements
        this.playerNameInput = this.rootElement.querySelector('#playerNameInput');
        this.hostButton = this.rootElement.querySelector('#hostGame');
        this.joinButton = this.rootElement.querySelector('#joinGame');
        this.backButton = this.rootElement.querySelector('.backToMain');
        this.difficultyRadios = this.rootElement.querySelectorAll('input[name="mpDifficulty"]');
        this.difficultySelect = this.rootElement.querySelector('#difficultySelect');
        this.nameError = this.rootElement.querySelector('#choiceError');

        if (!this.playerNameInput || !this.hostButton || !this.joinButton || !this.backButton || !this.difficultySelect || !this.nameError) {
             console.error(`[${this.name}] Missing one or more required elements.`);
        }
        
        // --- Bind Handlers Here --- 
        this.handleShowView = this.handleShowView.bind(this);
        this._handleHostClick = this._handleHostClick.bind(this);
        this._handleJoinClick = this._handleJoinClick.bind(this);
        this._handleBackClick = this._handleBackClick.bind(this);
        this._clearError = this._clearError.bind(this); 

        // --- PRE-POPULATE Name Input --- 
        this._loadAndSetName();
        // --- END PRE-POPULATE ---

        console.log(`[${this.name}] Initialized.`);
    }

    /** Registers DOM and eventBus event listeners using pre-bound handlers. */
    registerListeners() {
        console.log(`[${this.name}] Registering listeners.`);
        
        // DOM Listeners
        if (this.hostButton) this.hostButton.addEventListener('click', this._handleHostClick);
        if (this.joinButton) this.joinButton.addEventListener('click', this._handleJoinClick);
        if (this.backButton) this.backButton.addEventListener('click', this._handleBackClick);
        if (this.playerNameInput) this.playerNameInput.addEventListener('input', this._clearError);
        
        // eventBus Listeners
        this.listen(Events.Navigation.ShowView, this.handleShowView); 
    }

    // --- Event Handlers (Regular Methods) ---
    handleShowView({ viewName }) {
        if (viewName === this.name) {
            console.log(`[${this.name}] Showing view.`);
            this.show();
            this.playerNameInput.focus();
        }
    }
    
    _clearError() {
        if (this.nameError) {
            this.nameError.textContent = '';
            this.nameError.classList.add('hidden');
        }
    }

    _showError(message) {
        if (this.nameError) {
            this.nameError.textContent = message;
            this.nameError.classList.remove('hidden');
        }
    }
    
    _validateAndGetName() {
        const playerName = this.playerNameInput.value.trim();
        if (!playerName) {
            this._showError(getTextTemplate('joinErrorEmptyName')); // Using template keys from join dialog
            this.playerNameInput.focus();
            return null;
        }
         if (playerName.length > 40) { 
             this._showError(getTextTemplate('joinErrorNameTooLong'));
             this.playerNameInput.focus();
             return null;
         }
        this._clearError();
        return playerName;
    }

    _handleHostClick() {
        console.log(`[${this.name}] _handleHostClick triggered!`);
        const playerName = this._validateAndGetName();
        if (!playerName) return;

        localStorage.setItem('unicornPoepUserName', playerName); // Save validated name

        console.log(`[${this.name}] Host button clicked. Player: ${playerName}`);

        let selectedDifficulty = 'medium'; // Default
        if (this.difficultyRadios) {
            this.difficultyRadios.forEach(radio => {
                if (radio.checked) {
                    selectedDifficulty = radio.value;
                }
            });
        }

        // Settings are now determined later in sheet selection, pass empty for now
        const settings = { 
            difficulty: selectedDifficulty 
            // sheetIds handled later
        };

        eventBus.emit(Events.UI.MultiplayerChoice.HostClicked, { 
            playerName: playerName,
            settings: settings
        });
    }

    _handleJoinClick() {
        const playerName = this._validateAndGetName();
        if (!playerName) return;

        localStorage.setItem('unicornPoepUserName', playerName); // Save validated name

        console.log(`[${this.name}] Join button clicked. Player: ${playerName}`);
        eventBus.emit(Events.UI.MultiplayerChoice.JoinClicked, { 
            playerName: playerName
        });
    }

    _handleBackClick() {
        console.log(`[${this.name}] Back button clicked.`);
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }
    
    // BaseComponent handles show/hide/destroy

    /** Loads name from localStorage and sets the input field value. */
    _loadAndSetName() {
        try {
            // Use the key you specified: unicornPoepUserName
            const storedName = localStorage.getItem('unicornPoepUserName'); 
            if (storedName && this.playerNameInput) {
                this.playerNameInput.value = storedName;
                console.log(`[${this.name}] Pre-populated name input with: ${storedName}`);
            } else if (!storedName) {
                console.log(`[${this.name}] No name found in localStorage.unicornPoepUserName.`);
                // Optional: Generate a random name if none is stored?
                this.playerNameInput.value = miscUtils.generateRandomPlayerName();
            }
        } catch (error) {
            console.error(`[${this.name}] Error loading name from localStorage:`, error);
        }
    }
}

export default MultiplayerChoiceComponent; 