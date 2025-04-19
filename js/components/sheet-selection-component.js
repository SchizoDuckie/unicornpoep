import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js'; // Import Views constants
import questionsManager from '../services/QuestionsManager.js'; // Assuming we might fetch sheet list
import { getTextTemplate } from '../utils/miscUtils.js'; // Import the utility

/**
 * Class SheetSelectionComponent.
 * 
 * Manages the sheet selection view, allowing users to pick question sheets
 * and difficulty levels for different game modes. Handles sheet list population,
 * selection validation, and game start requests.
 *
 * @property {Object} elements Cached DOM elements for the component
 * @property {HTMLElement} elements.sheetsContainer Container for sheet checkboxes
 * @property {HTMLElement} elements.difficultyContainer Container for difficulty options
 * @property {NodeList} elements.difficultyRadios Collection of difficulty radio buttons
 * @property {HTMLElement} elements.startButton Button to start the game
 * @property {HTMLElement} elements.backButton Button to return to main menu
 * @property {HTMLElement} elements.sheetNavigationContainer Container for navigation controls
 * @property {Set<string>} selectedSheets Set of selected sheet IDs
 * @property {string} selectedDifficulty Currently selected difficulty level
 * @property {string|null} gameMode Current game mode (single, practice, multiplayer-host)
 * @property {string|null} playerName Name of the player (for multiplayer)
 */
class SheetSelectionComponent extends RefactoredBaseComponent {
    static SELECTOR = '#sheetSelection';
    static VIEW_NAME = 'SheetSelectionComponent';
    
    // Define element selectors as constants
    static SELECTORS = {
        SHEETS_CONTAINER: '#sheetsCheckboxes',
        DIFFICULTY_CONTAINER: '#difficultyCol',
        DIFFICULTY_RADIOS: 'input[name="difficulty"]',
        START_BUTTON: '#startGame',
        BACK_BUTTON: '#sheetSelectBack',
        SHEET_NAVIGATION: '#sheetNavigation'
    };

    // Initial state
    selectedSheets = new Set();
    selectedDifficulty = 'medium';
    gameMode = null;
    playerName = null;

    /**
     * Initializes the component using the declarative pattern.
     * 
     * @return Object Configuration object with events, domEvents, domElements
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Navigation.ShowView,
                    callback: this.handleShowView
                }
            ],
            domEvents: [
                {
                    selector: 'input[type="checkbox"]',  // Select checkboxes directly
                    event: 'change',
                    handler: this._handleSheetSelectionChange
                },
                {
                    selector: '#difficultyCol input[name="difficulty"]',
                    event: 'change',
                    handler: this._handleDifficultyChange
                },
                {
                    selector: SheetSelectionComponent.SELECTORS.START_BUTTON,
                    event: 'click',
                    handler: this._handleStartClick
                },
                {
                    selector: SheetSelectionComponent.SELECTORS.BACK_BUTTON,
                    event: 'click',
                    handler: this._handleBackClick
                }
            ],
            domElements: [
                {
                    name: 'sheetsContainer',
                    selector: SheetSelectionComponent.SELECTORS.SHEETS_CONTAINER
                },
                {
                    name: 'difficultyContainer',
                    selector: SheetSelectionComponent.SELECTORS.DIFFICULTY_CONTAINER
                },
                {
                    name: 'startButton',
                    selector: SheetSelectionComponent.SELECTORS.START_BUTTON
                },
                {
                    name: 'backButton',
                    selector: SheetSelectionComponent.SELECTORS.BACK_BUTTON
                },
                {
                    name: 'sheetNavigationContainer',
                    selector: SheetSelectionComponent.SELECTORS.SHEET_NAVIGATION
                }
            ],
            setup: () => {
                // Get difficultyRadios with querySelectorAll (needs special handling)
                this.difficultyRadios = this.rootElement.querySelectorAll(SheetSelectionComponent.SELECTORS.DIFFICULTY_RADIOS);
            }
        };
    }

    /**
     * Handles the ShowView event to potentially load sheets and set mode.
     * 
     * @param Object $payload Event payload
     * @param string $payload.viewName Name of the view to show
     * @param Object $payload.data Optional data with mode and player name
     * @return void
     */
    handleShowView({ viewName, data }) {
        if (viewName === this.name) {
            this.gameMode = data.mode || 'single'; 
            this.playerName = data.playerName || null; 
            
            this.updateDifficultyVisibility();
            this._populateSheetList();
            this._updateStartButtonState();
            this.show();
        } else {
            this.hideSheetNavigation();
            this.hide();
        }
    }

    /**
     * Populates the checkbox list with available sheets from QuestionsManager.
     * 
     * @return void
     * @private
     */
    _populateSheetList() {
        this.elements.sheetsContainer.innerHTML = '';
        this.selectedSheets.clear();

        try {
            const allSheets = questionsManager.getAvailableSheets(); 

            if (!Array.isArray(allSheets) || allSheets.length === 0) {
                this.elements.sheetsContainer.innerHTML = `<p><i>${getTextTemplate('sheetSelectNoneAvailable')}</i></p>`;
                this._updateStartButtonState();
                return;
            }

            const fragment = document.createDocumentFragment();
            allSheets.forEach((sheet, index) => {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                
                checkbox.type = 'checkbox';
                checkbox.value = sheet.id;
                checkbox.id = `sheet-${sheet.id}`;
                checkbox.dataset.sheetName = sheet.name;
                
                // Just set the index for animation staggering, avoiding setting a conflicting view-transition-name
                // The CSS already sets view-transition-name: sheet-checkbox;
                label.style.setProperty('--index', index);
                label.dataset.sheetIndex = index; // Add a unique data-attribute for identification
                
                // Add direct event listener to ensure it works
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        this.selectedSheets.add(sheet.id);
                    } else {
                        this.selectedSheets.delete(sheet.id);
                    }
                    this._updateStartButtonState();
                });

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` ${sheet.name || sheet.id}`));
                label.htmlFor = checkbox.id;
                
                fragment.appendChild(label);
            });

            this.elements.sheetsContainer.appendChild(fragment);
        } catch (error) {
            console.error(`[${this.name}] Error populating sheet list:`, error);
            this.elements.sheetsContainer.innerHTML = `<p><i>${getTextTemplate('sheetSelectLoadError')}</i></p>`;
        }
        this._updateStartButtonState();
    }

    /** 
     * Updates visibility of the difficulty selection based on game mode.
     * 
     * @return void
     * @private 
     */
    updateDifficultyVisibility() {
        if (this.gameMode === 'practice') {
            this.elements.difficultyContainer.classList.add('hidden');
        } else {
            this.elements.difficultyContainer.classList.remove('hidden');
        }
    }

    /** 
     * Handles changes to sheet selection checkboxes.
     * 
     * @param Event $event The change event
     * @return void
     * @private 
     */
    _handleSheetSelectionChange(event) {
        
        // Find the target checkbox that was clicked (might be the event.target or a child)
        const checkbox = event.target.type === 'checkbox' ? event.target : event.target.querySelector('input[type="checkbox"]');
        
        if (!checkbox || checkbox.type !== 'checkbox') {
            return;
        }
            
        const sheetId = checkbox.value;
        
        if (checkbox.checked) {
            if (!this.selectedSheets.has(sheetId)) {
                this.selectedSheets.add(sheetId);
            }
        } else {
            this.selectedSheets.delete(sheetId);
        }
        
        this._updateStartButtonState();
    }

    /** 
     * Handles changes to difficulty radio buttons.
     * 
     * @param Event $event The change event
     * @return void
     * @private 
     */
    _handleDifficultyChange(event) {
        if (event.target.type === 'radio' && event.target.name === 'difficulty') {
            this.selectedDifficulty = event.target.value;
        }
    }

    /**
     * Enables/disables the start button based on selection and toggles active state
     * of the sheet navigation container.
     * 
     * @return void
     * @private
     */
    _updateStartButtonState() {
        const canStart = this.selectedSheets.size > 0;
        
        
        if (canStart) {
            this.elements.startButton.disabled = false;
            
            this.elements.sheetNavigationContainer.classList.add('active');
        } else {
            this.elements.startButton.disabled = true;
            this.elements.sheetNavigationContainer.classList.remove('active');
        }
        console.log(this.elements.sheetNavigationContainer);
    }

    /**
     * Handles the start button click.
     * Triggers Events.Game.StartRequested with the selected settings.
     * 
     * @return void
     * @event Events.Game.StartRequested
     * @private
     */
    _handleStartClick() {

        if (this.selectedSheets.size === 0) {
            return;
        }

        const sheetIds = Array.from(this.selectedSheets);
        let gameMode = this.gameMode || 'single';
        
        const settings = {
            sheetIds: sheetIds,
            difficulty: this.selectedDifficulty
        };
        
        eventBus.emit(Events.Game.StartRequested, {
            mode: gameMode,
            settings: settings,
            playerName: this.playerName
        });
    }

    /**
     * Handles the back button click, returning to the main menu.
     * 
     * @return void
     * @event Events.Navigation.ShowView
     * @private
     */
    _handleBackClick() {
        eventBus.emit(Events.Navigation.ShowView, { viewName: Views.MainMenu });
    }

    /**
     * Hides the sheet navigation container.
     * Used when navigating away from this view.
     * 
     * @return void
     * @private
     */
    hideSheetNavigation() {
        this.elements.sheetNavigationContainer.classList.remove('active');
    }

    /**
     * Overrides the base hide method to also hide the sheet navigation.
     * 
     * @override
     * @return void
     */
    hide() {
        this.hideSheetNavigation();
        super.hide();
    }
}

export default SheetSelectionComponent; 