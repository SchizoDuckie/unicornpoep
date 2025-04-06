// Add near top if not in separate file:
const MultiplayerModes = Object.freeze({
    CHOICE: 'choice',
    PREPARE_HOST: 'prepare_host',
    JOIN: 'join'
});

/**
 * Manages the Main Menu UI, sheet/difficulty selection,
 * AND acts as the central orchestrator for application initialization and navigation.
 */
class MainMenu {
    /**
     * Initializes the MainMenu orchestrator.
     */
    constructor() {
        console.log("MainMenu: Initializing.");
        this.viewContainer = document.getElementById('gameContainer');
        this.mainMenuElement = document.getElementById('mainMenu');
        this.sheetSelectionElement = document.getElementById('sheetSelection');
        this.sheetsCheckboxesElement = document.getElementById('sheetsCheckboxes');
        this.difficultyColElement = document.getElementById('difficultyCol');
        this.startGameButton = document.getElementById('startGame');
        this.practiceButton = document.getElementById('practice');
        this.testButton = document.getElementById('takeTest');
        this.sheetSelectBackButton = document.getElementById('sheetSelectBack');
        this.menuItemsElement = document.getElementById('menuItems');

        // --- Controller/Manager References ---
        this.questionsManager = null;
        this.highscoresManager = null;
        this.loadingController = null;
        this.gameAreaController = null;
        this.multiplayerController = null;
        this.highscoresController = null;
        this.customQuestionsController = null;
        this.aboutController = null;
        this.dialogController = null;
        this.toastNotification = null;
        this.currentGame = null; // Holds active Game or MultiplayerGame

        this.sheetNames = [];
        this.selectedSheets = [];
        this.difficulty = 'medium'; // Default difficulty
        this.gameMode = null; // 'practice', 'test', or MultiplayerModes.PREPARE_HOST

        // Map view IDs to their elements for navigation
        this.viewElements = {
            'mainMenu': this.mainMenuElement,
            'sheetSelection': this.sheetSelectionElement,
            'gameArea': document.getElementById('gameArea'),
            'multiplayerChoice': document.getElementById('multiplayerChoice'),
            'highscores': document.getElementById('highscores'),
            'customQuestionsManager': document.getElementById('customQuestionsManager'),
            'about': document.getElementById('about'),
            'loading': document.getElementById('loading')
            // Add others as needed, exclude dialogs managed by specific controllers
        };
        this.allDialogIds = [
            'endOfGameDialog', 'disconnectionDialog', 'namePromptDialog',
            'errorDialog', 'multiplayerEndDialog', 'connectionStatus'
        ];
    }

    /**
     * Initializes managers, controllers, fetches initial data, sets up listeners, and shows the main menu.
     * This is the main application entry point after DOM load.
     */
    async init() {
        console.log("MainMenu: Starting initialization...");

        // --- Create Core Instances ---
        this.loadingController = new LoadingController();
        this.questionsManager = new QuestionsManager();
        this.highscoresManager = new HighscoresManager();
        this.toastNotification = new ToastNotification();
        this.dialogController = new DialogController(this);
        this.gameAreaController = new GameAreaController(this);
        this.multiplayerController = new MultiplayerController(this);
        this.highscoresController = new HighscoresController(this);
        this.customQuestionsController = new CustomQuestionsController(this);
        this.aboutController = new AboutController(this);
        this.setControllerGameInstance(null);

        // *** ADD CONTROLLER MAP INITIALIZATION ***
        this.controllers = {
            'mainMenu': this, // MainMenu acts as controller for its own view
            'sheetSelection': this, // MainMenu also handles sheet selection logic
            'gameArea': this.gameAreaController,
            'multiplayerChoice': this.multiplayerController, // Assuming MP controller handles this choice view
            'highscores': this.highscoresController,
            'customQuestionsManager': this.customQuestionsController,
            'about': this.aboutController,
            'loading': this.loadingController
            // Add other viewId -> controller mappings if needed
        };
        console.log("MainMenu: Controllers map initialized.");
        // *** END ADDITION ***

        this.loadingController.show("App laden...");
        this.setupEventListeners();

        try {
            // 1. Load configuration first
            let config = {};
            try {
                 const response = await fetch('config.json'); // Assuming config file name
                 if (!response.ok) {
                     throw new Error(`HTTP error! status: ${response.status}`);
                 }
                 config = await response.json();
                 console.log("MainMenu: Config loaded:", config);
            } catch (e) {
                 console.error("MainMenu: Failed to load config.json", e);
                 config.sheets = []; // Default to empty array on error
                 this.toastNotification?.show("Waarschuwing: Kon config niet laden.", 5000);
            }

            // 2. Initialize QuestionsManager WITH sheets from config
            // THIS IS THE FIX: Pass the file paths array to init
            await this.questionsManager.init(config?.sheets || []);
            await this.questionsManager.waitForInitialisation(); // Ensure it's fully ready

            // Now retrieve the sheet names *after* init has processed the files/categories
            this.sheetNames = await this.questionsManager.listSheets(); // Use listSheets based on original QM structure
            this.populateSheetCheckboxes();

            // Check URL params for auto-join *after* basic setup
            const urlParams = new URLSearchParams(window.location.search);
            const joinCode = urlParams.get('join');

            if (joinCode && /^[0-9]{6}$/.test(joinCode)) {
                console.log("INIT: Join code found in URL:", joinCode);
                this.startMultiplayer(MultiplayerModes.JOIN, { hostId: joinCode });
                // Multiplayer flow will handle showing connection UI
            } else {
                // Default: Show Main Menu
                this.show();
            }

        } catch (error) {
            console.error("MainMenu: Failed during initial setup:", error);
            this.loadingController.hide();
            this.dialogController?.showError(`Kon app niet initialiseren: ${error.message}`);
            // Attempt to show main menu even on error? Or display fatal error?
            // this.showView('mainMenu'); // Maybe omit this on fatal init error

        } finally {
            this.loadingController.hide();
        }
    }

    /** Helper to set/unset the game instance on controllers */
    setControllerGameInstance(gameInstance) {
        this.currentGame = gameInstance;

        // Update controllers that need the game reference
        // They access it via `this.mainMenuController.currentGame`
        // So, direct update here might not be strictly needed if they always use the hub reference.
        // However, keeping it can be slightly more direct for the controller's internal logic.
        if (this.gameAreaController) this.gameAreaController.game = gameInstance;
        if (this.multiplayerController) this.multiplayerController.game = gameInstance;
        if (this.dialogController) this.dialogController.game = gameInstance;
        // Add others if they directly store 'game'
    }

    /** Sets up main menu and global navigation event listeners */
    setupEventListeners() {
        console.log("MainMenu: Setting up event listeners.");
        this.practiceButton?.addEventListener('click', () => this.showSheetSelectionView('practice'));
        this.testButton?.addEventListener('click', () => this.showSheetSelectionView('test'));
        this.startGameButton?.addEventListener('click', () => this.startGame());
        this.sheetSelectBackButton?.addEventListener('click', () => this.showView('mainMenu', 'backward'));

        // Listeners for other main sections, handled by this controller now
        document.getElementById('viewHighscores')?.addEventListener('click', () => this.showView('highscores'));
        document.getElementById('myQuestions')?.addEventListener('click', () => this.showView('customQuestionsManager'));
        document.getElementById('hoeDan')?.addEventListener('click', () => this.showView('about'));
        document.getElementById('multiplayer')?.addEventListener('click', () => {
            // When user clicks "Samen spelen", create MP game instance first
            // Then show the choice screen. The MP Game instance is needed for the choice screen actions.
            this.startMultiplayer(MultiplayerModes.CHOICE);
        });

        // Listeners for back buttons within other views need to be set up in *their* controllers,
        // but they should call back to `mainMenuController.showView('mainMenu')` or similar.
        // Example (in HighscoresController):
        // constructor(mainMenuController) { this.mainMenuController = mainMenuController; ... }
        // setupListeners() { this.backButton.onclick = () => this.mainMenuController.showView('mainMenu'); }

        // Difficulty selection change
        this.sheetSelectionElement?.querySelectorAll('input[name="difficulty"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.difficulty = e.target.value;
                console.log(`Difficulty set to: ${this.difficulty}`);
            });
        });

        // Need to handle sheet checkbox changes within populateSheetCheckboxes or here
    }

    /** Populates the sheet selection checkboxes */
    populateSheetCheckboxes() {
        if (!this.sheetsCheckboxesElement || !this.sheetNames) return;
        this.sheetsCheckboxesElement.innerHTML = ''; // Clear existing
        this.sheetNames.forEach(name => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = name; // Use sheet name/key
            checkbox.addEventListener('change', () => this.updateSelectedSheets());
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${name}`)); // Add space
            this.sheetsCheckboxesElement.appendChild(label);
        });
    }

    /** Updates the list of selected sheets based on checkboxes */
    updateSelectedSheets() {
        this.selectedSheets = Array.from(this.sheetsCheckboxesElement.querySelectorAll('input[type="checkbox"]:checked'))
                                  .map(cb => cb.value);
        this.validateSelection();
    }

    /** Toggles the visibility/active state of the start button container based on selection */
    validateSelection() {
        const hasSelection = this.selectedSheets.length > 0;
        const sheetNavigationElement = document.getElementById('sheetNavigation');

        // Manage the button's enabled state
        if (this.startGameButton) {
            this.startGameButton.disabled = !hasSelection;
        }

        // ONLY toggle the 'active' class for the container's visibility and animation
        if (sheetNavigationElement) {
            sheetNavigationElement.classList.toggle('active', hasSelection);
        }
    }

    /** Shows the main menu view elements */
    show() {
        // *** REMOVE RECURSIVE CALL ***
        // this.showView('mainMenu'); // <<< DO NOT call showView here

        // Just ensure the main menu items are visible if needed
        this.mainMenuElement?.classList.remove('hidden');
        this.menuItemsElement?.classList.remove('hidden');
        console.log("MainMenu.show(): Ensuring mainMenuElement/menuItemsElement are visible.");

        // Optionally ensure other views are hidden (although showView handles this)
        // this.hideSheetSelection(); // Don't call this here either, let showView manage top-level views
    }

    /** Hides the main menu view */
    hide() {
        // This might not even be needed if showView handles hiding correctly
        this.mainMenuElement?.classList.add('hidden');
        console.log("MainMenu.hide(): Hiding mainMenuElement.");
    }

    /** Shows the sheet selection VIEW */
    showSheetSelectionView(mode) {
        console.log(`MainMenu: Showing sheet selection view via wrapper for mode: ${mode}`);
        this.prepareSheetSelectionUI(mode); // Prepare state first
        this.showView('sheetSelection');   // Then navigate
    }

    /**
     * Prepares the sheet selection UI elements based on the game mode.
     * Does NOT navigate. Navigation is handled by showView.
     * @param {string} mode - 'practice', 'test', or MultiplayerModes.PREPARE_HOST
     */
    prepareSheetSelectionUI(mode) { // Renamed from showSheetSelection to clarify purpose
        this.gameMode = mode;
        console.log(`MainMenu: Preparing sheet selection UI state for mode: ${mode}`);

        // Reset selection state
        this.sheetsCheckboxesElement?.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        this.selectedSheets = [];
        const defaultDifficulty = this.sheetSelectionElement?.querySelector(`input[name="difficulty"][value="${this.difficulty}"]`);
        if (defaultDifficulty) defaultDifficulty.checked = true;

        // Hide difficulty column in practice mode
        this.difficultyColElement?.classList.toggle('hidden', mode === 'practice');

        // Reset and validate the start button state
        const sheetNavigationElement = document.getElementById('sheetNavigation');
        sheetNavigationElement?.classList.remove('active'); // Start inactive
        this.validateSelection(); // Set initial button state (disabled)

        // *** REMOVE Navigation Call from here ***
        // this.showView('sheetSelection');
    }

    /** Hides the sheet selection VIEW elements */
    hideSheetSelection() {
        // This method primarily hides the #sheetSelection div container.
        // showView already handles this by calling hideViewById.
        // If specific internal cleanup is needed when navigating *away* from
        // sheetSelection, it could be done here or in _handleViewSpecificLogic.
        console.log("MainMenu: Hiding sheet selection view (delegated to showView/hideViewById).");
    }

    /** Starts a game (SP or MP Host) after sheet/difficulty selection */
    async startGame() {
        if (this.startGameButton.disabled) {
            console.log("MainMenu: Start button clicked but disabled.");
            return;
        }
        console.log(`MainMenu: startGame() called. Mode: ${this.gameMode}`);

        // Explicitly hide the sheet selection UI elements before proceeding
        this.hideSheetSelection();

        if (this.gameMode === 'practice' || this.gameMode === 'test') {
            // --- Start Single Player Game ---
            const difficultyToUse = this.gameMode === 'test' ? this.difficulty : null;
            console.log(`MainMenu: Starting SP Game. Mode: ${this.gameMode}, Sheets: ${this.selectedSheets}, Difficulty: ${difficultyToUse}`);
            this.loadingController?.show("Spel starten...");
            try {
                if (this.currentGame) { this.currentGame.cleanup?.(); this.setControllerGameInstance(null); }
                const game = new Game(this);
                this.setControllerGameInstance(game);
                console.log("MainMenu: SP Game instance created. Calling startNewGame...");
                await game.startNewGame(this.selectedSheets, difficultyToUse); // Wait for game setup
                console.log("MainMenu: SP game.startNewGame finished.");
                this.loadingController?.hide();
                this.showView('gameArea'); // NOW transition to the game area
                console.log("MainMenu: Navigated to gameArea.");
            } catch (error) {
                this.loadingController?.hide();
                console.error("MainMenu: Error during SP startGame:", error);
                this.dialogController?.showError(`Kon spel niet starten: ${error.message}`);
                this.showView('mainMenu'); // Go back to main menu on error
            }

        } else if (this.gameMode === MultiplayerModes.PREPARE_HOST) {
            // --- Start Multiplayer Host Game ---
            // hideSheetSelection() was called above
            console.log(`MainMenu: Starting MP Host Game. Sheets: ${this.selectedSheets}, Difficulty: ${this.difficulty}`);
            if (this.currentGame && this.currentGame.isMultiplayer) {
                console.log("MainMenu: Calling startMultiplayerHost...");
                // This method likely handles its own navigation/UI updates (e.g., showing connection code)
                await this.currentGame.startMultiplayerHost(this.selectedSheets, this.difficulty);
                console.log("MainMenu: startMultiplayerHost finished.");
                // Typically, we don't call showView here, the host flow manages UI
            } else {
                console.error("MainMenu: Cannot start MP host, currentGame is not a MultiplayerGame instance.");
                this.showView('mainMenu');
            }
         } else {
            console.error(`MainMenu: Unknown game mode "${this.gameMode}" in startGame.`);
            // hideSheetSelection() was called above
            this.showView('mainMenu'); // Go back to menu if mode was weird
        }
    }

    /** Initiates the multiplayer flow OR prepares for hosting */
    startMultiplayer(mode, options = {}) {
        console.log(`MainMenu: Handling Multiplayer Mode: ${mode}`, options);

        // Create MP game instance if needed (choice/join or if no game exists)
        if (mode === MultiplayerModes.CHOICE || mode === MultiplayerModes.JOIN || !this.currentGame?.isMultiplayer) {
             if (this.currentGame) { this.currentGame.cleanup?.(); this.setControllerGameInstance(null); }
             // Prepare host also needs an MP instance ready
             const isHostInstance = (mode === MultiplayerModes.JOIN) ? false : true;
             const mpGame = new MultiplayerGame(isHostInstance, this);
             this.setControllerGameInstance(mpGame);
             mpGame.loadPlayerName();
        }

        // Handle the specific mode
        switch(mode) {
            case MultiplayerModes.JOIN:
                if (options.hostId) {
                    // Navigation/UI handled by MP flow
                    this.multiplayerController?.showFetchingGameInfo();
                    this.currentGame.requestToJoin(options.hostId);
                } else {
                    console.error("MainMenu: Join mode requires hostId.");
                    this.showView('mainMenu');
                }
                break;
            case MultiplayerModes.CHOICE:
                // Navigate and let controller show its screen
                this.showView('multiplayerChoice');
                this.multiplayerController?.showChoiceScreen(this.currentGame.playerName);
                break;
            case MultiplayerModes.PREPARE_HOST:
                // *** FIX: Prepare state FIRST, then navigate DIRECTLY ***
                console.log("MainMenu: PREPARE_HOST - Preparing sheet selection state.");
                // 1. Prepare the sheet selection UI state
                this.prepareSheetSelectionUI(MultiplayerModes.PREPARE_HOST);
                // 2. Navigate directly to the sheet selection view
                console.log("MainMenu: PREPARE_HOST - Navigating to sheetSelection view.");
                this.showView('sheetSelection');
                // *** END FIX ***
                break;
            default:
                 console.error("MainMenu: Invalid multiplayer mode:", mode);
                 this.showView('mainMenu');
                 this.setControllerGameInstance(null);
        }
    }

    /**
     * Shows a specific view container and hides others, handling transitions.
     * Ensures the corresponding controller's 'show' method is called AFTER the view is ready.
     * @param {string} viewId - The ID of the view container div to show.
     * @param {string} [direction='forward'] - Transition direction.
     */
    async showView(viewId, direction = 'forward') {
        // Add a guard against navigating to the same view unnecessarily
        if (this.currentViewId === viewId && document.getElementById(viewId)?.classList.contains('hidden') === false) {
             console.warn(`MainMenu: showView called for already active view "${viewId}". Skipping.`);
             return;
         }

        console.log(`MainMenu: Navigating to ${viewId} (Direction: ${direction})`);
        const targetView = document.getElementById(viewId);
        const targetController = this.controllers[viewId];

        if (!targetView) {
            console.error(`MainMenu: View with ID "${viewId}" not found.`);
            return;
        }

        // Remember the view we are leaving
        const oldViewId = this.currentViewId;

        const transitionClass = direction === 'forward' ? 'transitioning-forward' : (direction === 'backward' ? 'transitioning-backward' : '');
        const transitionName = viewId === 'mainMenu' ? 'main-content' : (targetView.style.viewTransitionName || 'main-content');

        // Add transition class for direction styling
        if (transitionClass) {
            console.log(`MainMenu: Added class ${transitionClass} to html element`);
            document.documentElement.classList.add(transitionClass);
        }

        let transition;
        try {
            /**
             * Helper function within showView to update DOM visibility and potentially schedule controller.show().
             * @param {string} viewId - The ID of the view to show.
             * @param {Object|null} controller - The controller associated with the view, if any.
             * @private
             */
            async function updateDOMAndCallShow(viewId, controller) {
                console.log(`MainMenu: Updating DOM for ${viewId}`);
                // Hide all top-level views first
                Object.values(this.viewElements).forEach(el => el.classList.add('hidden'));

                // Show the target view
                const targetView = this.viewElements[viewId];
                if (targetView) {
                    targetView.classList.remove('hidden');
                    this.currentViewId = viewId; // Update current view tracking

                    // *** REVERT: Schedule controller.show() using requestAnimationFrame ***
                    if (controller && typeof controller.show === 'function' && viewId !== 'mainMenu' && viewId !== 'sheetSelection') {
                        console.log(`MainMenu: Scheduling show() method call via rAF for controller ${viewId} (Type: ${controller.constructor.name}).`);
                        // Use requestAnimationFrame to defer the show call slightly after DOM updates
                        requestAnimationFrame(() => {
                            console.log(`MainMenu: Executing scheduled show() for ${viewId}`);
                            try {
                                controller.show();
                            } catch (error) {
                                 console.error(`MainMenu: Error executing scheduled show() for ${viewId}:`, error);
                            }
                        });
                    } else if (viewId === 'sheetSelection' || viewId === 'mainMenu') {
                         console.log(`MainMenu: View is '${viewId}', managed by MainMenu, no specific controller.show() needed during DOM update.`);
                    } else if (!controller || typeof controller.show !== 'function') {
                         console.warn(`MainMenu: No controller or show() method found for view ${viewId}, or unhandled case.`);
                    }
                    // *** END REVERT ***
                } else {
                    console.error(`MainMenu: View element with ID ${viewId} not found.`);
                }
            }

            const transition = document.startViewTransition(async () => {
                console.log(`MainMenu: Starting view transition to ${viewId}`);
                // Pass the controller instance, but updateDOMAndCallShow now handles scheduling show()
                await updateDOMAndCallShow.call(this, viewId, targetController); // Ensure 'this' context
                console.log(`MainMenu: View transition ready for ${viewId}.`);
            });

            transition.finished.then(() => {
                console.log(`MainMenu: View transition to ${viewId} finished.`);
                this.isTransitioning = false;
                document.documentElement.classList.remove('transitioning-forward', 'transitioning-backward');

                console.log(`MainMenu: showView for ${viewId} completed (transition/update phase).`);
                 // Call view-specific logic AFTER transition finishes
                 this._handleViewSpecificLogic(viewId, oldViewId);

                 // Ask controller to observe resize AFTER view transition is fully done
                 if (targetController && typeof targetController.observeResize === 'function' && viewId !== 'mainMenu' && viewId !== 'sheetSelection') {
                    console.log(`MainMenu: Asking ${targetController.constructor.name} to observe after transition.`);
                    targetController.observeResize();
                 }
            });

        } catch (e) {
            console.error("MainMenu: Error during showView execution:", e);
            // Fallback DOM update
             Object.keys(this.controllers).forEach(id => this.hideViewById(id));
            targetView.classList.remove('hidden');
            this.currentViewId = viewId;
             // Attempt deferred show even on error? Risky, maybe just log.
             console.error(`MainMenu: Failed to show ${viewId} due to error. Controller show() not called.`);

        } finally {
            if (transitionClass) { document.documentElement.classList.remove(transitionClass); }
            document.documentElement.classList.remove('animating');
        }
    }

    /** Helper to hide a specific view by ID */
    hideViewById(viewId) {
         const view = document.getElementById(viewId);
         if (view) {
             view.classList.add('hidden');
         }
         // Also ask controller to stop observing resize
         const controller = this.controllers[viewId];
         if (controller && typeof controller.stopObservingResize === 'function') {
              controller.stopObservingResize();
          }
    }

    /**
     * Updates the internal active view state.
     * @param {string} viewId
     * @private
     */
    setActiveView(viewId) {
         this.activeViewId = viewId;
    }

    /**
     * Updates the main H1 title based on the current view.
     * @param {string} viewId
     * @private
     */
     _updateTitle(viewId) {
        let titleText = 'Unicorn Poep'; // Default
        let subTitleText = 'Door SchizoDuckie, voor Sanne 🙂'; // Default

        // Logic to set titles based on viewId
        switch (viewId) {
            case 'mainMenu':
                // Keep defaults or set specific menu title
                break;
            case 'gameArea':
                // Construct title based on MainMenu state instead of calling game.getTitle()
                if (this.currentGame) { // Check if a game is actually active
                    if (this.gameMode === 'practice') {
                        titleText = 'Oefenen';
                    } else if (this.gameMode === 'test') {
                        titleText = 'Toets';
                    } else if (this.currentGame.isMultiplayer) { // Check if it's an MP game
                         titleText = 'Multiplayer Spel';
                    } else {
                        titleText = 'Spel'; // Generic fallback
                    }
                     // Optionally add sheet names if available and not too long
                     if (this.selectedSheets && this.selectedSheets.length > 0 && this.selectedSheets.length <= 2) {
                         // Corrected: Directly use the selected sheet names as they are the display names
                         subTitleText = this.selectedSheets.join(' & ');
                     } else if (this.selectedSheets && this.selectedSheets.length > 2) {
                         subTitleText = `${this.selectedSheets.length} Tafels/Onderwerpen`;
                     } else {
                        subTitleText = ''; // Clear subtitle if no specific info
                     }

                } else {
                     titleText = 'Spel'; // Fallback title if no currentGame
                     subTitleText = '';
                }
                break; // *** IMPORTANT: Added missing break statement ***
            case 'highscores':
                titleText = 'High Scores';
                subTitleText = '';
                break;
             case 'customQuestionsManager':
                 titleText = 'Eigen Sommen Maken';
                 subTitleText = '';
                 break;
             case 'about':
                 titleText = 'Over Unicorn Poep';
                 subTitleText = '';
                 break;
            case 'multiplayer':
                 // Title for pre-game MP screens (Host/Join choice, code display etc.)
                 // This might be handled more specifically by MultiplayerController updates,
                 // but set a default here.
                 titleText = 'Samen Spelen';
                 subTitleText = '';
                 break;
            // Add other cases as needed
        }

         const titleElement = document.querySelector('#app > h1');
         if (titleElement) {
             // Update safely using textContent or careful innerHTML construction
             titleElement.textContent = ''; // Clear existing content
             const titleNode = document.createTextNode(titleText);
             titleElement.appendChild(titleNode);
             if (subTitleText) {
                 const smallElement = document.createElement('small');
                 smallElement.textContent = subTitleText;
                 titleElement.appendChild(smallElement);
             }

             // Re-trigger animation if desired (check if needed)
             titleElement.style.animation = 'none';
             void titleElement.offsetWidth; // Trigger reflow
             titleElement.style.animation = 'bounceIn 1s ease-out forwards';
         }
    }

    /**
     * Handles logic specific to entering/leaving views.
     * @param {string} newViewId
     * @param {string|null} oldViewId
     * @private
     */
    _handleViewSpecificLogic(newViewId, oldViewId) {
        // Example: Reset multiplayer UI when leaving it
        if (oldViewId === 'multiplayer' && newViewId !== 'multiplayer') {
            this.multiplayerController?.resetUI();
        }
        // Example: Initialize something when entering a view
        if (newViewId === 'highscores') {
            this.highscoresController?.render(); // Call render() instead
        }
         if (newViewId === 'customQuestionsManager') {
             this.customQuestionsController.populateSheetList(); // Refresh custom sheets
         }
    }

    // Extracted resize observer logic into its own method
    _handleResizeObserver(viewId) {
        // Ensure gameAreaController exists before trying to call methods
        if (!this.gameAreaController) {
            console.warn("MainMenu: GameAreaController not available for resize observation.");
            return;
        }

        if (viewId === 'gameArea') {
            // Assuming the method is named 'observe' in GameAreaController
            console.log("MainMenu: Asking GameAreaController to observe.");
            this.gameAreaController.observe?.(); // Use optional chaining on the method itself too
        } else {
            // Assuming the method is named 'unobserve' in GameAreaController
            console.log("MainMenu: Asking GameAreaController to unobserve.");
            this.gameAreaController.unobserve?.(); // Use optional chaining on the method itself too
        }
    }

    /**
     * Hides the bottom navigation bar used for sheet selection.
     */
    hideSheetNavigation() {
        const sheetNav = document.getElementById('sheetNavigation');
        if (sheetNav) {
            sheetNav.classList.remove('active');
            // Ensure button is disabled when hiding nav
            const startButton = sheetNav.querySelector('#startGame');
            if (startButton) startButton.disabled = true;
        } else {
            console.warn("MainMenu: #sheetNavigation element not found.");
        }
    }

     /**
      * Shows the bottom navigation bar used for sheet selection.
      * Note: Relies on validateSelection being called elsewhere to enable/disable button.
      */
     showSheetNavigation() {
         const sheetNav = document.getElementById('sheetNavigation');
         if (sheetNav) {
             sheetNav.classList.add('active');
             // Button state should be managed by validateSelection based on checkbox changes
         } else {
             console.warn("MainMenu: #sheetNavigation element not found.");
         }
     }


    /**
     * Hides the bottom navigation bar used during gameplay (Next button).
     */
    hideGameNavigation() {
        const gameNav = document.getElementById('gameNavigation');
        if (gameNav) {
            gameNav.classList.remove('active');
             // Optional: Disable next button when hiding
             const nextButton = gameNav.querySelector('#nextButton');
             if (nextButton) nextButton.disabled = true;
        } else {
            console.warn("MainMenu: #gameNavigation element not found.");
        }
    }

     /**
      * Shows the bottom navigation bar used during gameplay (Next button).
      * @param {boolean} [enableNext=false] - Whether the next button should be enabled immediately.
      */
     showGameNavigation(enableNext = false) {
         const gameNav = document.getElementById('gameNavigation');
         if (gameNav) {
             gameNav.classList.add('active');
             const nextButton = gameNav.querySelector('#nextButton');
             if (nextButton) nextButton.disabled = !enableNext;
         } else {
             console.warn("MainMenu: #gameNavigation element not found.");
         }
     }

    /**
     * Handles the selection of sheets and difficulty.
     * @private
     */
    _handleSheetAndDifficultySelection() {
        // ... existing code ...
    }

    /**
     * Performs cleanup after a game session ends and navigation back to the menu occurs.
     * Resets the currentGame reference.
     * Should be called by components initiating the return to menu (e.g., DialogController, stopGame).
     */
    _handleEndOfGameCleanup() {
        console.log("MainMenu: Performing end-of-game cleanup.");
        if (this.currentGame) {
            // Optional: Call a specific cleanup on the game instance if needed,
            // but Game/MultiplayerGame cleanup methods handle internal state.
            // this.currentGame.cleanupInternalState(); // Example if needed

            console.log("MainMenu: Setting currentGame to null.");
            this.currentGame = null;
        } else {
             console.log("MainMenu: End-of-game cleanup called, but currentGame was already null.");
        }
        // Reset any related UI state managed by MainMenu if necessary
    }
}