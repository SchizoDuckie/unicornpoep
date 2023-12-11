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
        document.getElementById('viewHighscores').addEventListener('click', () => this.game.viewHighscores());
        document.getElementById('myQuestions').addEventListener('click', () => {
            this.hideMainMenu();
            this.game.ui.showCustomQuestions() });

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
     * Fetches sheet names from Google Sheets and populates the checkboxes for sheet selection.
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
     */
    selectSheets(isTestMode) {
        // Show the sheet and difficulty selection
        this.hideMainMenu();
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
            this.game.startNewGame(selectedSheets, selectedDifficulty);
            this.hideSubMenu();
        };
    }

    /**
     * Shows the main menu and hides the submenus and back button.
     */
    showMainMenu() {
        this.mainMenuContainer.style.display = 'flex';
        this.menuItemsContainer.style.display = 'flex';
        // Show the main menu buttons and hide the submenus
        this.sheetSelectionElement.style.display = 'none';
        this.difficultySelectionContainer.style.display = 'none';
        this.backButtonElement.style.display = 'none';
        this.game.ui.hideHighscores();
        this.game.ui.hideEndOfGameDialog();
        this.game.ui.hideGameArea();
        this.game.ui.hideCustomQuestions();
    }

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
