import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js'; // Import Views constants
import questionsManager from '../services/QuestionsManager.js'; // Assuming we might fetch sheet list

/**
 * @class SheetSelectionComponent
 * @extends BaseComponent
 * Manages the sheet selection view (#sheetSelection), allowing users to pick question sheets
 * and difficulty levels, triggering game start, and managing the sheet navigation visibility.
 */
class SheetSelectionComponent extends BaseComponent {
    /**
     * Creates an instance of SheetSelectionComponent.
     */
    constructor() {
        super('#sheetSelection', Views.SheetSelection); // Use View constant for name consistency

        // Element references
        this.sheetsContainer = this.rootElement.querySelector('#sheetsCheckboxes');
        this.difficultyContainer = this.rootElement.querySelector('#difficultyCol');
        this.difficultyRadios = this.rootElement.querySelectorAll('input[name="difficulty"]');
        this.startButton = this.rootElement.querySelector('#startGame');
        this.backButton = this.rootElement.querySelector('#sheetSelectBack');
        // *** CORRECTED: Reference the container that needs animation ***
        this.sheetNavigationContainer = this.rootElement.querySelector('#sheetNavigation'); // Correct ID

        // ** Throw error if critical child elements are missing **
        if (!this.sheetsContainer) throw new Error(`[${this.name}] Missing required child element: #sheetsCheckboxes`);
        if (!this.difficultyContainer) throw new Error(`[${this.name}] Missing required child element: #difficultyCol`);
        if (!this.startButton) throw new Error(`[${this.name}] Missing required child element: #startGame`);
        if (!this.backButton) throw new Error(`[${this.name}] Missing required child element: #sheetSelectBack`);
        // *** CORRECTED: Validation for the navigation container ***
        if (!this.sheetNavigationContainer) console.warn(`[${this.name}] Optional child element #sheetNavigation not found. Sheet navigation animation will not work.`); // Warn or throw if mandatory

        this.selectedSheets = new Set();
        this.selectedDifficulty = 'medium'; // Default difficulty
        this.gameMode = null; // 'practice' or 'single' - set when shown

        this._bindMethods();
        this._addEventListeners();
        this.hide(); // Start hidden
        console.log(`[${this.name}] Initialized`);

        // Listen for when this view should be shown
        this.listen(Events.Navigation.ShowView, this.handleShowView);
    }

    _bindMethods() {
        this.handleShowView = this.handleShowView.bind(this);
        this._populateSheetList = this._populateSheetList.bind(this);
        this._handleSheetSelectionChange = this._handleSheetSelectionChange.bind(this);
        this._handleDifficultyChange = this._handleDifficultyChange.bind(this);
        this._handleStartClick = this._handleStartClick.bind(this);
        this._handleBackClick = this._handleBackClick.bind(this);
    }

    _addEventListeners() {
        // Use correct handler name
        this.sheetsContainer.addEventListener('change', this._handleSheetSelectionChange);

        // Add listeners for radio buttons
        this.difficultyRadios.forEach(radio => {
            radio.addEventListener('change', this._handleDifficultyChange);
        });

        this.startButton.addEventListener('click', this._handleStartClick);
        this.backButton.addEventListener('click', this._handleBackClick);
    }

    _removeEventListeners() {
        this.sheetsContainer.removeEventListener('change', this._handleSheetSelectionChange);
        this.difficultyRadios.forEach(radio => {
            radio.removeEventListener('change', this._handleDifficultyChange);
        });
        this.startButton.removeEventListener('click', this._handleStartClick);
        this.backButton.removeEventListener('click', this._handleBackClick);
    }

    /**
     * Handles the ShowView event to potentially load sheets and set mode.
     * Also ensures the sheet navigation is initially hidden if no sheets are pre-selected.
     * @param {object} payload
     * @param {string} payload.viewName
     * @param {object} [payload.data] - Optional data passed, e.g., { mode: 'practice' | 'single' }
     */
    handleShowView({ viewName, data }) {
        if (viewName === this.name) { // Use component name as view identifier
            console.log(`[${this.name}] Showing view. Data:`, data);
            this.gameMode = data?.mode || 'single'; // Default to single player if mode not specified
            this.updateDifficultyVisibility();
            this._populateSheetList(); // This also calls _updateStartButtonState
            // Ensure navigation state matches initial sheet state after populating
            this._updateStartButtonState();
            this.show(); // BaseComponent show
        } else {
             // Ensure navigation is hidden if this view itself becomes hidden
            this.hideSheetNavigation(); // Corrected method call
            this.hide(); // BaseComponent hide
        }
    }

    /**
     * Populates the checkbox list with available sheets from QuestionsManager.
     * @private
     */
    _populateSheetList() {
        this.sheetsContainer.innerHTML = ''; // Clear previous list
        this.selectedSheets.clear(); // Use correct set name

        try {
            // Get sheets synchronously from the manager
            const allSheets = questionsManager.getAvailableSheets(); 
            console.log(`[${this.name}] Populating with sheets:`, allSheets);

            if (!Array.isArray(allSheets) || allSheets.length === 0) {
                this.sheetsContainer.innerHTML = '<p><i>Geen vragenlijsten beschikbaar.</i></p>';
                this._updateStartButtonState(); // Ensure button is disabled
                return;
            }

            const fragment = document.createDocumentFragment();
            allSheets.forEach(sheet => {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                
                checkbox.type = 'checkbox';
                checkbox.value = sheet.id; // Use sheet ID as value
                checkbox.id = `sheet-${sheet.id}`;
                checkbox.dataset.sheetName = sheet.name; // Store name for potential use
                // Checkbox is initially unchecked

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` ${sheet.name || sheet.id}`)); // Use name, fallback to ID
                label.htmlFor = checkbox.id;
                
                fragment.appendChild(label);
                
            });

            this.sheetsContainer.appendChild(fragment);
        } catch (error) {
            console.error(`[${this.name}] Error populating sheet list:`, error);
            this.sheetsContainer.innerHTML = '<p><i>Fout bij laden vragenlijsten.</i></p>';
        }
        this._updateStartButtonState(); // Update button state after populating
    }

    /** Updates visibility of the difficulty selection based on game mode. @private */
    updateDifficultyVisibility() {
        if (this.gameMode === 'practice') {
            this.difficultyContainer?.classList.add('hidden');
        } else {
            this.difficultyContainer?.classList.remove('hidden');
        }
    }

    /** Handles changes to sheet selection checkboxes. @private */
    _handleSheetSelectionChange = (event) => { // Use arrow function
        // *** Check if target is within the expected container ***
        if (!this.sheetsContainer.contains(event.target)) return;

        if (event.target.type === 'checkbox') { // No need to check name if delegated from sheetsContainer
            const sheetId = event.target.value;
            if (event.target.checked) {
                if (!this.selectedSheets.has(sheetId)) {
                    this.selectedSheets.add(sheetId);
                }
            } else {
                this.selectedSheets.delete(sheetId);
            }
            console.log(`[${this.name}] Selected sheets changed:`, this.selectedSheets);
            this._updateStartButtonState(); // This will now handle the prompt visibility
        }
    }

    /** Handles changes to difficulty radio buttons. @private */
    _handleDifficultyChange = (event) => { // Use arrow function
        if (event.target.type === 'radio' && event.target.name === 'difficulty') {
            this.selectedDifficulty = event.target.value;
            console.log(`[${this.name}] Difficulty changed:`, this.selectedDifficulty);
        }
    }

    /**
     * Enables/disables the start button based on selection and shows/hides the sheet navigation container.
     * @private
     */
    _updateStartButtonState() {
        if (!this.startButton) return; // Nothing to update if button doesn't exist

        const canStart = this.selectedSheets.size > 0;

        // Update the button's disabled state
        this.startButton.disabled = !canStart;
        console.log(`[${this.name}] Start button ${canStart ? 'enabled' : 'disabled'}.`);

        // *** CORRECTED: Directly control the navigation container's classes ***
        if (this.sheetNavigationContainer) {
            if (canStart) {
                // Show the navigation
                this.sheetNavigationContainer.classList.add('active'); // Add active for animation
                 console.log(`[${this.name}] Showing sheet navigation.`);
            } else {
                // Hide the navigation
                this.hideSheetNavigation(); // Use corrected helper name
            }
        }
    }

    /** Handles the start button click. @private */
    _handleStartClick = () => { // Use arrow function
        if (this.selectedSheets.size === 0) {
            console.warn(`[${this.name}] Start clicked but no sheets selected.`);
            return;
        }

        const settings = {
            sheetIds: [...this.selectedSheets],
            difficulty: this.gameMode === 'practice' ? null : this.selectedDifficulty,
            // Add other relevant settings if needed
        };

        console.log(`[${this.name}] Start button clicked. Mode: ${this.gameMode}, Settings:`, settings);

        // Emit the generic Game.StartRequested event
        // GameCoordinator will pick this up and decide which game mode to start
        eventBus.emit(Events.Game.StartRequested, {
            mode: this.gameMode, // 'practice' or 'single'
            settings: settings,
            // playerName might be needed here if not prompted earlier
        });
    }

    /** Handles the back button click. @private */
    _handleBackClick = () => {
        console.log(`[${this.name}] Back button clicked.`);
        // Don't emit BackClicked if UIManager handles navigation based on ShowView
        // eventBus.emit(Events.UI.SheetSelection.BackClicked);
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu }); // Use imported constant
        // this.hide(); // hide() is called by handleShowView when another view is shown
    }

    /**
     * Helper method to explicitly hide the sheet navigation.
     * @private
     */
    hideSheetNavigation() { // Renamed method
        if (this.sheetNavigationContainer) {
            this.sheetNavigationContainer.classList.remove('active'); // Remove active first for exit animation
            console.log(`[${this.name}] Hiding sheet navigation.`);
        }
    }

    /** Hides the component's root element and ensures the sheet navigation is hidden. */
    hide() {
        // Ensure navigation is hidden when the whole component hides
        this.hideSheetNavigation(); // Use corrected method name
        super.hide(); // Call BaseComponent hide
    }

    // Override destroy to clean up listeners
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        this._removeEventListeners();
        // No need to manually hide navigation, element removal handles it
        super.destroy();
    }
}

export default SheetSelectionComponent; 