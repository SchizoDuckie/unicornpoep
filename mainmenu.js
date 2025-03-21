/**
 * This class manages the main menu interface of the game.
 * It handles displaying the menu options, fetching sheet names from Google Sheets,
 * and user interactions for starting the game in different modes.
 */
class MainMenu {
    /**
     * Constructs the MainMenu instance.
     *
     * @param {Game} game The Game instance this menu is part of.
     */
    constructor(game) {
        this.game = game;
        this.mainMenuContainer = document.getElementById('mainMenu');
        this.menuItemsContainer = document.getElementById('menuItems');
        this.sheetSelectionElement = document.getElementById('sheetSelection');
        this.difficultySelectionContainer = document.getElementById('difficultyCol');
        this.difficultySelectionElement = document.getElementById('difficultySelection');
        this.startGameButton = document.getElementById('startGame');
        this.backButtonElement = document.getElementById('backButton');

        // Setup event listeners for main menu interactions
        this.setupEventListeners();
    }

    /**
     * Sets up the event listeners for the menu buttons and back button.
     */
    setupEventListeners() {
        document.getElementById('practice').addEventListener('click', () => this.selectSheets(false));
        document.getElementById('takeTest').addEventListener('click', () => this.selectSheets(true));
        document.getElementById('multiplayer').addEventListener('click', () => this.game.showMultiplayerChoice());
        this.sheetSelectionElement.addEventListener('change', () => this.validateSelections());
        this.difficultySelectionElement.addEventListener('change', () => this.validateSelections());

        document.getElementById('viewHighscores').addEventListener('click', () => this.game.viewHighscores());
        document.getElementById('myQuestions').addEventListener('click', () => {
            this.hideMainMenu();
            this.game.ui.showCustomQuestions()
        });
        document.getElementById('hoeDan').addEventListener('click', () => {
            this.hideMainMenu();
            this.game.ui.showAbout()
        });

        document.body.addEventListener('click', (event)  => {
            if (event.target.classList.contains('backToMain')) {
                this.showMainMenu();
            }
        });

        // Initially hide the sheet selection and difficulty selection
        this.difficultySelectionContainer.style.display = 'none';
        this.backButtonElement.style.display = 'none';

        // Fetch and display sheet names for selection
    }

    /**
     * Validates the selections and shows/hides the startGame button accordingly.
     * @private
     */
    validateSelections() {
        const selectedSheets = Array.from(this.sheetSelectionElement.querySelectorAll('input[name="sheet"]:checked'));
        const selectedDifficulty = document.querySelector('input[name="difficulty"]:checked');

        const sheetNavigationElement = document.getElementById('sheetNavigation');

        if (selectedSheets.length > 0 && selectedDifficulty) {
            sheetNavigationElement.classList.add('active');
        } else {
            sheetNavigationElement.classList.remove('active');
        }
    }

    /**
     * Populates the checkboxes for sheet selection.
     */
    async setSheetNames(sheets) {
        const sheetsCheckboxesElement = document.getElementById('sheetsCheckboxes');

        sheetsCheckboxesElement.innerHTML = sheets
            .filter(name => name != 'Scores' && name != 'Highscores')
            .map(name => `<label><input type="checkbox" name="sheet" value="${name}"> ${name}</label>`)
            .join('');
    }

    /**
     * Handles the selection of sheets and difficulty (if applicable).
     * @param {boolean} isTestMode Indicates whether the test mode is selected.
     * @param {boolean} isMultiplayer Indicates whether multiplayer mode is selected.
     */
    selectSheets(isTestMode, isMultiplayer = false) {
        // Show the sheet and difficulty selection
        this.hideMainMenu();
        this.game.preloadSheets();

        this.sheetSelectionElement.style.display = 'flex';
        this.difficultySelectionContainer.style.display = isTestMode ? 'block' : 'none';

        // Hide the main menu items and show the back button
        this.backButtonElement.style.display = 'block';

        // Event handler for Start Game button
        this.startGameButton.onclick = () => {
            const selectedSheets = Array.from(this.sheetSelectionElement.querySelectorAll('input[name="sheet"]:checked')).map(el => el.value);
            const selectedDifficulty = isTestMode ? document.querySelector('input[name="difficulty"]:checked').value : null;
            if(selectedSheets.length === 0) {
                alert("Zo kan ik ook winnen, je moet wel iets te doen kiezen!")
                return;
            }
            if (isMultiplayer) {
                // Hide sheet selection and show multiplayer area
                this.hideSubMenu();
                this.game.startMultiplayerGame(selectedSheets, selectedDifficulty, true);
            } else {
                this.game.startNewGame(selectedSheets, selectedDifficulty);
                this.hideSubMenu();
            }
        };
    }

    /**
     * Shows the main menu and resets game state
     */
    showMainMenu() {
        // Ensure game is in clean state
        if (this.game) {
            this.game.resetGameState();
        }
        
        // Ensure UI is in clean state
        if (this.game.ui) {
            this.game.ui.hideAllDialogs();
            this.game.ui.hideGameArea();
            this.game.ui.hideConnectingScreen();
        }
        
        // Show the main menu
        this.mainMenuContainer.style.display = 'block';
        
        // Hide other screens
        this.menuItemsContainer.style.display = 'flex';
        this.sheetSelectionElement.style.display = 'none';
        this.difficultySelectionContainer.style.display = 'none';
        this.backButtonElement.style.display = 'none';
        this.game.ui.hideHighscores();
        this.game.ui.hideEndOfGameDialog();
        this.game.ui.hideCustomQuestions();
        this.game.ui.hideAbout();
        this.game.ui.hideMultiplayerElements();
        document.getElementById('gameArea').style.display = 'none';
        document.getElementById('connectionStatus').style.display = 'none';
        
        console.log('Main menu displayed, game state reset');
    }

    /**
     * Hides the main menu.
     */
    hideMainMenu() {
        this.menuItemsContainer.style.display = 'none';
    }

    /**
     * Hides the submenus and the back button.
     */
    hideSubMenu() {
        this.backButtonElement.style.display = 'none'
        this.sheetSelectionElement.style.display = 'none';
        this.difficultySelectionContainer.style.display = 'none';
    }
}
