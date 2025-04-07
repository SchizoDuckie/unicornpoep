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
        // ** REMOVED: this.gameMode set here, will be set by flows **
        // this.gameMode = null;

        // Map view IDs to their elements for navigation
        this.viewElements = {
            'mainMenu': this.mainMenuElement,
            'sheetSelection': this.sheetSelectionElement,
            'gameArea': document.getElementById('gameArea'),
            'multiplayerChoice': document.getElementById('multiplayerChoice'), // Added
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

        // *** Controller Map Initialization (keep this here) ***
        this.controllers = {
            'mainMenu': this,
            'sheetSelection': this,
            'gameArea': this.gameAreaController,
            'multiplayerChoice': this.multiplayerController,
            'highscores': this.highscoresController,
            'customQuestionsManager': this.customQuestionsController,
            'about': this.aboutController,
            'loading': this.loadingController
        };
        console.log("MainMenu: Controllers map initialized.");

        // *** MOVED FROM EARLIER ***
        // Setup listeners only AFTER controllers/managers exist
        this.setupEventListeners();
        console.log("MainMenu: Event listeners set up.");
        // *** END MOVE ***

        this.loadingController.show("App laden...");

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
                 this.toastNotification.show("Waarschuwing: Kon config niet laden.", 5000);
            }

            // 2. Initialize QuestionsManager WITH sheets from config
            // THIS IS THE FIX: Pass the file paths array to init
            await this.questionsManager.init(config.sheets || []);
            await this.questionsManager.waitForInitialisation(); // Ensure it's fully ready

            // Now retrieve the sheet names *after* init has processed the files/categories
            this.sheetNames = await this.questionsManager.listSheets(); // Use listSheets based on original QM structure
            this.populateSheetCheckboxes();

            // Check URL params for auto-join *after* basic setup
            const urlParams = new URLSearchParams(window.location.search);
            const joinCode = urlParams.get('join');

            if (joinCode && /^[0-9]{6}$/.test(joinCode)) {
                console.log("INIT: Join code found in URL:", joinCode);
                // *** Directly initiate joining flow ***
                await this.initiateJoiningFlow(joinCode);
                // Joining flow handles showing connection UI, not show()
            } else {
                // Default: Show Main Menu
                this.showView('mainMenu'); // Navigate to main menu
            }

        } catch (error) {
            console.error("MainMenu: Failed during initial setup:", error);
            this.loadingController.hide();
            this.dialogController.showError(`Kon app niet initialiseren: ${error.message}`);
            // Attempt to show main menu even on error? Or display fatal error?
            this.showView('mainMenu'); // Show menu on error

        } finally {
            this.loadingController.hide();
        }
    }

    /** Cleans up any existing game instance */
    _cleanupCurrentGame() {
        if (this.currentGame) {
            console.log(`MainMenu: Cleaning up existing game instance (Type: ${this.currentGame.constructor.name})`);
            this.currentGame.cleanup(); // Let the game instance clean its internal state/resources
            this.setControllerGameInstance(null); // Remove reference in MainMenu and linked controllers
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
        this.practiceButton.addEventListener('click', () => this.showSheetSelectionView('practice'));
        this.testButton.addEventListener('click', () => this.showSheetSelectionView('test'));
        this.startGameButton.addEventListener('click', () => this.startGame());
        this.sheetSelectBackButton.addEventListener('click', () => this.showView('mainMenu', 'backward'));

        // Listeners for other main sections, handled by this controller now
        document.getElementById('viewHighscores').addEventListener('click', () => this.showView('highscores'));
        document.getElementById('myQuestions').addEventListener('click', () => this.showView('customQuestionsManager'));
        document.getElementById('hoeDan').addEventListener('click', () => this.showView('about'));
        document.getElementById('multiplayer').addEventListener('click', () => {
            // *** Change: Just navigate to the choice screen ***
            this.startMultiplayerEntry();
        });

        // Listeners for back buttons within other views need to be set up in *their* controllers,
        // but they should call back to `mainMenuController.showView('mainMenu')` or similar.
        // Example (in HighscoresController):
        // constructor(mainMenuController) { this.mainMenuController = mainMenuController; ... }
        // setupListeners() { this.backButton.onclick = () => this.mainMenuController.showView('mainMenu'); }

        // Difficulty selection change
        this.sheetSelectionElement.querySelectorAll('input[name="difficulty"]').forEach(radio => {
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
        this.mainMenuElement.classList.remove('hidden');
        this.menuItemsElement.classList.remove('hidden');
        console.log("MainMenu.show(): Ensuring mainMenuElement/menuItemsElement are visible.");

        // Optionally ensure other views are hidden (although showView handles this)
        // this.hideSheetSelection(); // Don't call this here either, let showView manage top-level views
    }

    /** Hides the main menu view */
    hide() {
        // This might not even be needed if showView handles hiding correctly
        this.mainMenuElement.classList.add('hidden');
        console.log("MainMenu.hide(): Hiding mainMenuElement.");
    }

    /** Shows the sheet selection VIEW and prepares its UI state */
    showSheetSelectionView(mode) {
        console.log(`MainMenu: Preparing and showing sheet selection view for mode: ${mode}`);
        this.prepareSheetSelectionUI(mode); // Prepare state first
        this.showView('sheetSelection');   // Then navigate
    }

    /**
     * Prepares the sheet selection UI elements based on the game mode.
     * Does NOT navigate. Navigation is handled by showView.
     * @param {string} mode - 'practice', 'test', or MultiplayerModes.PREPARE_HOST
     */
    prepareSheetSelectionUI(mode) {
        // *** Store the mode for later use in startGame ***
        this.currentGameMode = mode;
        console.log(`MainMenu: Preparing sheet selection UI state for mode: ${this.currentGameMode}`);

        this.sheetsCheckboxesElement.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        this.selectedSheets = [];
        const defaultDifficulty = this.sheetSelectionElement.querySelector(`input[name="difficulty"][value="${this.difficulty}"]`);
        if (defaultDifficulty) defaultDifficulty.checked = true;

        // Hide difficulty column in practice mode
        this.difficultyColElement.classList.toggle('hidden', mode === 'practice');

        // Reset and validate the start button state
        const sheetNavigationElement = document.getElementById('sheetNavigation');
        if (sheetNavigationElement) sheetNavigationElement.classList.remove('active'); // Start inactive
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
        // Use the stored mode from prepareSheetSelectionUI
        const mode = this.currentGameMode;
        console.log(`MainMenu: startGame() called. Mode: ${mode}`);

        // No need to hide sheet selection explicitly, showView will handle it

        try {
            if (mode === 'practice' || mode === 'test') {
                this._cleanupCurrentGame(); // Cleanup before creating new
                const game = new Game(this); // Pass main menu controller reference
                this.setControllerGameInstance(game);
                const difficultyToUse = mode === 'test' ? this.difficulty : null;
                console.log(`MainMenu: Starting SP Game. Sheets: ${this.selectedSheets}, Difficulty: ${difficultyToUse}`);
                this.loadingController.show("Spel starten...");
                await game.startNewGame(this.selectedSheets, difficultyToUse);
                this.loadingController.hide();
                this.showView('gameArea');

            } else if (mode === MultiplayerModes.PREPARE_HOST) {
                // Check if a valid *host* MP game instance already exists (created by initiateHostingFlow)
                if (this.currentGame && this.currentGame.isMultiplayer && this.currentGame.isHost) {
                    console.log(`MainMenu: Starting MP Host Game Phase. Sheets: ${this.selectedSheets}, Difficulty: ${this.difficulty}`);
                    // Loading/UI during host setup is handled within startMultiplayerHost
                    // It will show loading, then connection code screen, not 'gameArea' yet.
                    await this.currentGame.startMultiplayerHost(this.selectedSheets, this.difficulty);
                } else {
                    console.error("MainMenu: Cannot start MP host, currentGame is not a valid Host MultiplayerGame instance. This indicates a flow error.");
                    this.dialogController.showError("Multiplayer host setup fout. Probeer opnieuw.");
                    this._cleanupCurrentGame(); // Cleanup invalid state
                    this.showView('mainMenu'); // Go back to safety
                }
            } else {
                console.error(`MainMenu: Unknown game mode "${mode}" in startGame.`);
                 this._cleanupCurrentGame(); // Cleanup potentially broken state
                this.showView('mainMenu');
            }
        } catch (error) {
            this.loadingController.hide();
            console.error(`MainMenu: Error during startGame for mode ${mode}:`, error);
            this.dialogController.showError(`Kon spel niet starten: ${error.message}`);
            this._cleanupCurrentGame(); // Cleanup on error
            this.showView('mainMenu');
        } finally {
            // Reset mode after attempt
             this.currentGameMode = null;
        }
    }

    /**
     * Entry point when user clicks the main "Samen Spelen" button.
     * Navigates to the multiplayer choice screen.
     */
    startMultiplayerEntry() {
        console.log(`MainMenu: Multiplayer entry point clicked.`);
        this._cleanupCurrentGame(); // Clean up any previous game before showing choice screen
        this.showView('multiplayerChoice');
        // MultiplayerController's showChoiceScreen (called via showView mechanism)
        // will now handle resetting its UI and setting the name.
    }

    /**
     * Initiates the flow for hosting a multiplayer game.
     * Creates a host MP Game instance and navigates to sheet selection.
     * This should be called by the MultiplayerController when 'Host' is selected.
     */
    initiateHostingFlow() {
        console.log("MainMenu: Initiating Hosting Flow.");
        this._cleanupCurrentGame(); // Ensure clean state
        try {
            // Create a HOST instance. Sheet/difficulty are set later via sheet selection.
            const mpGame = new MultiplayerGame(this, true); // isHost=true
            this.setControllerGameInstance(mpGame);
            mpGame.loadPlayerName(); // Load name early

            // Prepare sheet selection UI for hosting mode
            // This also sets this.currentGameMode = MultiplayerModes.PREPARE_HOST
            this.prepareSheetSelectionUI(MultiplayerModes.PREPARE_HOST);
            // Navigate to sheet selection
            this.showView('sheetSelection');
        } catch (error) {
             console.error("MainMenu: Error initiating hosting flow:", error);
             this.dialogController.showError(`Kon multiplayer host niet starten: ${error.message}`);
             this.setControllerGameInstance(null); // Ensure cleanup on error
             this.showView('mainMenu');
        }
    }

    /**
     * Initiates the flow for joining a multiplayer game via host ID.
     * Creates a client MP Game instance and attempts connection.
     * This should be called by MultiplayerController or init (URL).
     * @param {string} hostId - The 6-digit host code.
     */
    async initiateJoiningFlow(hostId) {
        if (this.currentGame) {
            console.warn("MainMenu: Trying to join while a game is active. Cleaning up old game.");
            this.currentGame.cleanup();
        }
        console.log("MainMenu: Creating MULTIPLAYER game instance for JOINING.");
        this.currentGame = new MultiplayerGame(this, false); // isHost = false

        // *** ADDED: Load player name explicitly after creating instance ***
        this.currentGame.loadPlayerName();

        // Access MultiplayerController via the hub
        if (this.multiplayerController) {
            console.log(`MainMenu: MultiplayerController exists. Accessing it for joining.`);
            // Update UI *before* the async connection attempt
            // Pass true to indicate it's a direct join from a link
            this.multiplayerController.showJoinScreen(true); // Show the join screen *with* welcome message

            // Attempt connection (async). requestToJoin handles subsequent UI updates
            // via MultiplayerController based on connection success/failure or messages.
            try {
                await this.currentGame.requestToJoin(hostId);

                // ... post-connection logic (not reached on error) ...
            } catch (error) {
                // --- Robust Error Handling --- 
                console.error(`MainMenu: Error during initiateJoiningFlow for hostId ${hostId}:`, error);
                // Ensure WebRTC is cleaned up in the game instance if it exists
                if (this.currentGame && this.currentGame.webRTCManager) {
                    console.log("MainMenu initiateJoiningFlow CATCH: Cleaning up WebRTCManager.");
                    this.currentGame.webRTCManager.cleanup();
                }
                // Use DialogController directly to show a generic error
                if (this.dialogController) {
                    this.dialogController.showError("Kon niet verbinden met het spel. Probeer het opnieuw.");
                } else {
                    console.error("MainMenu initiateJoiningFlow CATCH: DialogController not found!");
                }
                // Always ensure the game instance reference is cleared on error
                this.setControllerGameInstance(null); 
                // --- End Robust Error Handling ---
            }
        } else {
            console.error("MainMenu: MultiplayerController not found. Cannot join game.");
            this.dialogController.showError("Multiplayer controller not found. Cannot join game.");
            this.setControllerGameInstance(null); // Ensure cleanup on error
            // Don't navigate away, showJoinError handles the UI state.
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
         if (this.currentViewId === viewId && this.viewElements[viewId] && !this.viewElements[viewId].classList.contains('hidden')) {
             console.warn(`MainMenu: showView called for already active view "${viewId}". Skipping.`);
             return;
         }

        console.log(`MainMenu: Navigating from ${this.currentViewId} to ${viewId} (Direction: ${direction})`); // Log current view
        const targetView = this.viewElements[viewId]; // Use mapped elements
        const targetController = this.controllers[viewId];

        if (!targetView) {
            console.error(`MainMenu: View element for ID "${viewId}" not found in viewElements map.`);
            return;
        }

        // REMOVED Cleanup logic from here
        // const oldViewId = this.currentViewId;
        // if (oldViewId === 'gameArea' && viewId !== 'gameArea') { ... }

        const transitionClass = direction === 'forward' ? 'transitioning-forward' : (direction === 'backward' ? 'transitioning-backward' : '');
        const transitionName = viewId === 'mainMenu' ? 'main-content' : (targetView.style.viewTransitionName || 'main-content');

        // Add transition class for direction styling
        if (transitionClass) {
            console.log(`MainMenu: Added class ${transitionClass} to html element`);
            document.documentElement.classList.add(transitionClass);
        }

        let transitionPromise = Promise.resolve(); // Default to resolved promise

        try {
            /**
             * Helper function within showView to update DOM visibility and potentially schedule controller.show().
             * @param {string} viewId - The ID of the view to show.
             * @param {Object|null} controller - The controller associated with the view, if any.
             * @private
             */
            async function updateDOMAndCallShow(viewId, controller) {
                console.log(`MainMenu: Updating DOM for ${viewId}`);
                // Hide all top-level views first using the map
                Object.values(this.viewElements).forEach(el => {
                    if (el) el.classList.add('hidden'); // Check if element exists
                });

                // Show the target view
                const targetViewToShow = this.viewElements[viewId]; // Get from map again
                if (targetViewToShow) {
                    targetViewToShow.classList.remove('hidden');
                    this.currentViewId = viewId; // Update current view tracking

                    // Schedule controller.show() using requestAnimationFrame AFTER DOM update
                    if (controller && typeof controller.show === 'function' && controller !== this) { // Exclude self (MainMenu)
                        console.log(`MainMenu: Scheduling show() method call via rAF for controller ${viewId} (Type: ${controller.constructor.name}).`);
                        requestAnimationFrame(() => {
                            console.log(`MainMenu: Executing scheduled show() for ${viewId}`);
                            try {
                                // Ensure the view is still the active one before calling show
                                if (this.currentViewId === viewId) {
                                    controller.show();
                                } else {
                                    console.warn(`MainMenu: Aborted scheduled show() for ${viewId} as view changed before execution.`);
                                }
                            } catch (error) {
                                 console.error(`MainMenu: Error executing scheduled show() for ${viewId}:`, error);
                            }
                        });
                    } else if (controller === this) {
                         console.log(`MainMenu: View is '${viewId}', managed by MainMenu, no specific controller.show() needed during DOM update.`);
                    } else if (!controller || typeof controller.show !== 'function') {
                         console.warn(`MainMenu: No controller or show() method found for view ${viewId}, or unhandled case.`);
                    }
                } else {
                    console.error(`MainMenu: View element with ID ${viewId} not found during DOM update.`);
                }
            }

            // Check if View Transitions API is supported
            if (document.startViewTransition) {
                const transition = document.startViewTransition(async () => {
                    console.log(`MainMenu: Starting view transition to ${viewId}`);
                    // Pass the controller instance, but updateDOMAndCallShow now handles scheduling show()
                    await updateDOMAndCallShow.call(this, viewId, targetController); // Ensure 'this' context
                    console.log(`MainMenu: View transition ready for ${viewId}.`);
                });

                // Store the finished promise to return it
                transitionPromise = transition.finished;

                transition.finished.then(() => {
                    console.log(`MainMenu: View transition to ${viewId} finished.`);
                    this.isTransitioning = false;
                    document.documentElement.classList.remove('transitioning-forward', 'transitioning-backward');

                    console.log(`MainMenu: showView for ${viewId} completed (transition/update phase).`);
                     // Call view-specific logic AFTER transition finishes
                     this._handleViewSpecificLogic(viewId, this.currentViewId);


                });
            } else {
                 // View Transitions not supported, update DOM directly
                 console.log(`MainMenu: View Transitions not supported. Updating DOM directly for ${viewId}.`);
                 // Await the direct call to ensure completion before resolving the promise
                 try {
                     await updateDOMAndCallShow.call(this, viewId, targetController);
                     console.log(`MainMenu: Direct DOM update for ${viewId} completed.`);
                     this.isTransitioning = false; // Still need to reset this flag
                     document.documentElement.classList.remove('transitioning-forward', 'transitioning-backward'); // Clean up classes

                     // Call view-specific logic AFTER direct update
                     this._handleViewSpecificLogic(viewId, this.currentViewId);

                     
                      transitionPromise = Promise.resolve(); // Resolve immediately as there's no transition
                 } catch (domUpdateError) {
                      console.error(`MainMenu: Error during direct DOM update for ${viewId}:`, domUpdateError);
                      this.isTransitioning = false; // Reset flag even on error
                      document.documentElement.classList.remove('transitioning-forward', 'transitioning-backward'); // Clean up
                      transitionPromise = Promise.reject(domUpdateError); // Reject the promise
                 }
            }

        } catch (e) {
            console.error("MainMenu: Error during showView execution:", e);
            // Fallback DOM update
             Object.keys(this.controllers).forEach(id => this.hideViewById(id));
            targetView.classList.remove('hidden');
            this.currentViewId = viewId;
             // Attempt deferred show even on error? Risky, maybe just log.
             console.error(`MainMenu: Failed to show ${viewId} due to error. Controller show() not called.`);
            transitionPromise = Promise.reject(e); // Reject on error

        } finally {
            if (transitionClass) { document.documentElement.classList.remove(transitionClass); }
            document.documentElement.classList.remove('animating');
        }

        return transitionPromise; // Return the promise
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
                // Keep defaults
                break;
            case 'sheetSelection': // Add title for sheet selection
                 // Title depends on the mode stored when prepareSheetSelectionUI was called
                 const mode = this.currentGameMode;
                 if (mode === 'practice') {
                     titleText = 'Oefenen: Kies Onderwerp(en)';
                     subTitleText = '';
                 } else if (mode === 'test') {
                     titleText = 'Toets: Kies Onderwerp(en) & Niveau';
                     subTitleText = '';
                 } else if (mode === MultiplayerModes.PREPARE_HOST) {
                     titleText = 'Host Spel: Kies Onderwerp(en) & Niveau';
                     subTitleText = '';
                 } else {
                     titleText = 'Kies Onderwerp(en)'; // Fallback
                     subTitleText = '';
                 }
                break;
            case 'gameArea':
                // Construct title based on MainMenu state (or currentGame if needed)
                if (this.currentGame) {
                    // Determine if SP or MP based on instance type
                    const isMp = this.currentGame.isMultiplayer;
                    const gameDifficulty = this.currentGame.difficulty; // Get difficulty from game instance
                    const gameSheets = this.currentGame.selectedSheets; // Get sheets from game instance

                    if (isMp) {
                         titleText = 'Multiplayer Spel';
                         subTitleText = gameSheets && gameSheets.length > 0
                             ? `${gameSheets.join(' & ')} (${gameDifficulty || '??'})`
                             : `(${gameDifficulty || '??'})`;
                    } else {
                         // Single Player (check if practice or test via constructor or property if set)
                         // Assuming SP Game sets a property like 'mode' or relies on difficulty being null for practice
                         const isPractice = !gameDifficulty; // Infer practice if difficulty is null/undefined
                         titleText = isPractice ? 'Oefenen' : 'Toets';
                         subTitleText = gameSheets && gameSheets.length > 0
                             ? `${gameSheets.join(' & ')}${isPractice ? '' : ` (${gameDifficulty})`}`
                             : (isPractice ? '' : `(${gameDifficulty})`);
                    }
                } else {
                     titleText = 'Spel'; // Fallback title if no currentGame
                     subTitleText = '';
                }
                break;
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
            case 'multiplayerChoice': // Add title for the choice screen
                 titleText = 'Samen Spelen';
                 subTitleText = 'Kies hosten of joinen';
                 break;
            // Add other cases as needed (e.g., multiplayer connection status screens if they are separate views)
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
            this.multiplayerController.resetUI();
        }
        // Example: Initialize something when entering a view
        if (newViewId === 'highscores') {
            this.highscoresController.render(); // Call render() instead
        }
         if (newViewId === 'customQuestionsManager') {
             this.customQuestionsController.populateSheetList(); // Refresh custom sheets
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
        // Call the cleanup helper
        this._cleanupCurrentGame();
        // Reset any related UI state managed by MainMenu if necessary
        this.currentGameMode = null; // Reset game mode tracking
    }
}