import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import questionsManager from '../services/QuestionsManager.js';

/**
 * @class SheetTitleDisplayComponent
 * Displays the title(s) of the currently active question sheet(s).
 * @extends BaseComponent
 */
class SheetTitleDisplayComponent extends BaseComponent {
    static SELECTOR = '#sheetTitleDisplay';
    // Use component registration name
    static VIEW_NAME = 'SheetTitleDisplayComponent';

    /** Initializes the component. */
    constructor() {
        super();
        console.log("[SheetTitleDisplayComponent] Constructed (via BaseComponent).");
    }
    
    initialize() {
        console.log(`[${this.name}] Initializing...`);
        this.titleElement = this.rootElement;
        if (!this.titleElement) {
            throw new Error(`[${this.name}] Root element not found with selector: ${this.selector}`);
        }
        
        // --- Bind Handlers Here --- 
        this._handleGameStarted = this._handleGameStarted.bind(this);
        this._handleGameFinished = this._handleGameFinished.bind(this);

        this._clearTitle(); // Initial state
        console.log(`[${this.name}] Initialized.`);
    }

    /** Registers eventBus listeners using pre-bound handlers. */
    registerListeners() {
        console.log(`[${this.name}] Registering listeners.`);
        this.listen(Events.Game.Started, this._handleGameStarted);
        this.listen(Events.Game.Finished, this._handleGameFinished);
    }

    // --- Event Handlers (Regular Methods) ---

    /** Sets the title based on the sheets used in the started game. */
    _handleGameStarted(payload) {
        let title = 'Spel Gestart'; // Default title
        if (payload && payload.settings && payload.settings.sheetIds && questionsManager) {
            const sheetIds = payload.settings.sheetIds;
            if (sheetIds.length > 0) {
                try {
                    // Get display names for all selected sheets
                    const sheetNames = sheetIds.map(id => questionsManager.getSheetDisplayName(id) || id);
                    title = sheetNames.join(' & '); // Join with & for multiple sheets
                } catch (e) {
                    console.error(`[${this.name}] Error getting sheet display names:`, e);
                    title = 'Fout bij laden titel';
                }
            }
        }
        console.log(`[${this.name}] Setting title to: ${title}`);
        this._updateTitle(title);
        this.show(); // Ensure visible
    }

    /** Clears the title when the game finishes. */
    _handleGameFinished() {
        console.log(`[${this.name}] Game finished, clearing title.`);
        this._clearTitle();
        this.hide(); // Hide when game is done
    }

    /** Updates the text content of the title element. */
    _updateTitle(text) {
        if (this.titleElement) {
            this.titleElement.textContent = text;
        }
    }

    /** Clears the title element text. */
    _clearTitle() {
        this._updateTitle(''); // Set empty text
    }
    
    // BaseComponent handles show/hide/destroy
}

export default SheetTitleDisplayComponent; 