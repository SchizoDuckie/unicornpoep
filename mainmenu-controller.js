/**
 * Manages the Main Menu UI, including sheet and difficulty selection.
 * Uses class toggling (.hidden) for visibility.
 */
class MainMenuController {
    /**
     * Initializes the controller, gets elements, and sets up listeners.
     * @param {Game} game - The main game instance.
     */
    constructor(game) {
        this.game = game;
        this.container = document.getElementById('mainMenu');
        this.menuItems = document.getElementById('menuItems');
        this.sheetSelectionElement = document.getElementById('sheetSelection');
        this.sheetsCheckboxesElement = document.getElementById('sheetsCheckboxes');
        this.difficultyColElement = document.getElementById('difficultyCol');
        this.difficultySelectionElement = document.getElementById('difficultySelection');
        this.startGameButton = document.getElementById('startGame');
        this.sheetNavigationElement = document.getElementById('sheetNavigation'); // Container ONLY for Start button
        this.sheetSelectBackButton = document.getElementById('sheetSelectBack');

        this.isTestModeSelection = false;
        this.isMultiplayerSelection = false;

        if (!this.container || !this.menuItems || !this.sheetSelectionElement || !this.startGameButton || !this.sheetNavigationElement) {
            console.error("MainMenuController: Critical UI element(s) not found!");
        }

        this.setupEventListeners();
        this.hide(); // Ensure all parts start hidden if needed by adding .hidden class
        this.hideSubMenu();
    }

    /**
     * Sets up main menu button listeners and sub-menu interaction listeners.
     */
    setupEventListeners() {
        document.getElementById('practice')?.addEventListener('click', () => this.showSheetSelection(false, false));
        document.getElementById('takeTest')?.addEventListener('click', () => this.showSheetSelection(true, false));
        document.getElementById('multiplayer')?.addEventListener('click', () => this.game.showMultiplayerChoice());
        document.getElementById('viewHighscores')?.addEventListener('click', () => this.game.viewHighscores());
        document.getElementById('myQuestions')?.addEventListener('click', () => this.game.showCustomQuestions());
        document.getElementById('hoeDan')?.addEventListener('click', () => this.game.showAbout());

        this.sheetSelectBackButton?.addEventListener('click', () => {
            this.hideSubMenu();
            this.showMenuItems();
        });

        this.sheetsCheckboxesElement?.addEventListener('change', (event) => {
            if (event.target.name === 'sheet') this.validateSelections();
        });
        this.difficultySelectionElement?.addEventListener('change', (event) => {
             if (event.target.name === 'difficulty') this.validateSelections();
        });
        this.startGameButton?.addEventListener('click', () => this.handleStartGame());
    }

    /** Shows the main menu container and the primary menu items. */
    show() {
        this.container?.classList.remove('hidden'); // Show main container
        this.showMenuItems(); // Show primary buttons
        this.hideSubMenu(); // Ensure sub-menu is hidden
    }

    /** Hides the main menu container. */
    hide() {
        this.container?.classList.add('hidden');
    }

    /** Shows the main menu buttons within the container. */
    showMenuItems() {
        // Assumes #menuItems base style is display: flex
        this.menuItems?.classList.remove('hidden');
    }

    /** Hides the main menu buttons. */
    hideMenuItems() {
        this.menuItems?.classList.add('hidden');
    }

    /** Shows the sheet selection sub-menu. */
    showSubMenu() {
         // Assumes #sheetSelection base style is display: flex
         this.sheetSelectionElement?.classList.remove('hidden');

         // Conditionally show difficulty based on mode
         // Assumes #difficultyCol base style is display: block or similar
         if (this.isTestModeSelection) {
            this.difficultyColElement?.classList.remove('hidden');
         } else {
            this.difficultyColElement?.classList.add('hidden');
         }
         // Assumes #sheetSelectBack base style allows visibility when not hidden
         this.sheetSelectBackButton?.classList.remove('hidden');
         this.validateSelections(); // Validate state immediately
    }

    /** Hides the sheet selection sub-menu. */
    hideSubMenu() {
         this.sheetSelectionElement?.classList.add('hidden');
         this.difficultyColElement?.classList.add('hidden');
         this.sheetSelectBackButton?.classList.add('hidden');
         // Hide the start button container
         this.sheetNavigationElement?.classList.remove('active'); // Ensure it slides down
         // MODIFIED: Add hidden class immediately when hiding submenu
         this.sheetNavigationElement?.classList.add('hidden');
         if (this.startGameButton) this.startGameButton.disabled = true;
    }

    /**
     * Populates the sheet selection checkboxes.
     * @param {string[]} sheetNames - Array of available sheet names.
     */
    setSheetNames(sheetNames) {
        if (!this.sheetsCheckboxesElement) return;
        const filteredNames = sheetNames.filter(name => name !== 'Scores' && name !== 'Highscores');
        this.sheetsCheckboxesElement.innerHTML = filteredNames
            .map(name => `<label><input type="checkbox" name="sheet" value="${name}"><span>${name}</span></label>`)
            .join('');
    }

    /**
     * Shows the sheet selection interface, hiding the main menu items.
     * @param {boolean} isTestMode - Whether difficulty selection should be shown.
     * @param {boolean} isMultiplayer - Whether this selection is for a multiplayer game.
     */
    showSheetSelection(isTestMode, isMultiplayer) {
        this.isTestModeSelection = isTestMode;
        this.isMultiplayerSelection = isMultiplayer;
        this.show(); // Ensure the main container is visible first
        this.hideMenuItems(); // Then hide the menu items
        this.showSubMenu(); // Then show the sub-menu
    }

    /**
     * Validates sheet/difficulty selection to enable/disable start button
     * AND controls the visibility/position of the #sheetNavigation container.
     */
    validateSelections() {
        if (!this.sheetSelectionElement || !this.startGameButton || !this.sheetNavigationElement) {
            console.error("MainMenuController: Cannot validate, required element missing.");
            return;
        }

        const selectedSheets = this.sheetSelectionElement.querySelectorAll('input[name="sheet"]:checked');
        // MODIFIED: Difficulty is only required in Test Mode (single or multi)
        const difficultyRequired = this.isTestModeSelection; // Check internal flag
        const selectedDifficulty = document.querySelector('input[name="difficulty"]:checked');
        const sheetsOk = selectedSheets.length > 0;
        const difficultyOk = !difficultyRequired || (selectedDifficulty !== null);

        const shouldBeEnabled = sheetsOk && difficultyOk;

        // 1. Enable/Disable the button itself
        this.startGameButton.disabled = !shouldBeEnabled;

        // 2. Control visibility and position of the navigation container
        if (shouldBeEnabled) {
            this.sheetNavigationElement.classList.remove('hidden'); // Ensure it's not display:none
            // Use timeout to allow display change before starting transition
            setTimeout(() => this.sheetNavigationElement.classList.add('active'), 10); // Slide up
        } else {
            this.sheetNavigationElement.classList.remove('active'); // Slide down
            // Optionally add hidden class after transition ends if needed
             // For now, just removing 'active' should hide it via `bottom: -100%`
             // Add hidden back if display:none is strictly required when inactive
             // setTimeout(() => {
             //     if (!this.sheetNavigationElement.classList.contains('active')) {
             //         this.sheetNavigationElement.classList.add('hidden');
             //     }
             // }, 400); // Match transition duration
        }
    }

    /** Handles the click on the "Start!" button. */
    handleStartGame() {
        if (!this.sheetSelectionElement || this.startGameButton.disabled) return;
        const selectedSheets = Array.from(this.sheetSelectionElement.querySelectorAll('input[name="sheet"]:checked')).map(el => el.value);
        const difficultyRequired = this.isTestModeSelection || this.isMultiplayerSelection;
        const selectedDifficultyRadio = document.querySelector('input[name="difficulty"]:checked');
        const selectedDifficulty = difficultyRequired ? (selectedDifficultyRadio?.value || null) : null;

        if (selectedSheets.length === 0) { alert("Kies tenminste één onderwerp!"); return; }
        if (difficultyRequired && !selectedDifficulty) { alert("Kies een moeilijkheidsgraad!"); return; }

        this.hideSubMenu();
        if (this.isMultiplayerSelection) this.game.startMultiplayerHost(selectedSheets, selectedDifficulty);
        else this.game.startNewGame(selectedSheets, selectedDifficulty);
    }

     /** Shows sheet selection for hosting multiplayer. */
    showSheetSelectionForMultiplayerHost() {
        this.showSheetSelection(true, true); 
    }
}