/**
 * Manages Multiplayer UI elements: Choice screen, Connection status, Waiting messages.
 * Uses class toggling (.hidden) for visibility.
 */
class MultiplayerController {
    /**
     * @param {MainMenuController} mainMenuController
     */
    constructor(mainMenuController) {
        this.mainMenuController = mainMenuController;
        this.game = null; // Set by MainMenuController

        // Get elements for choice screen
        this.choiceScreen = document.getElementById('multiplayerChoice');
        this.hostButton = document.getElementById('hostGame');
        this.joinButton = document.getElementById('joinGame');
        this.playerNameInput = document.getElementById('playerNameInput');
        this.choiceErrorElement = document.getElementById('choiceError');
        this.backButtonChoice = this.choiceScreen.querySelector('.backToMain'); // Assuming back button exists

        // Get elements for connection status dialog/screens
        this.connectionDialog = document.getElementById('connectionStatus');
        this.hostView = this.connectionDialog.querySelector('#connectionCode');
        this.hostCodeDisplay = document.getElementById('hostCodeDisplay');
        this.copyCodeButton = document.getElementById('copyCodeButton');
        this.whatsappShareButton = document.getElementById('whatsappShareButton');
        this.hostWaitingText = this.connectionDialog.querySelector('#hostWaitingText');
        this.hostStartButton = this.connectionDialog.querySelector('#hostStartButton');
        this.joinView = document.getElementById('joinView');
        this.connectionCodeInput = document.getElementById('connectionCodeInput');
        this.submitCodeButton = document.getElementById('submitCode');

        this.fetchingInfoView = document.getElementById('fetchingInfoView');
        this.joinConfirmView = document.getElementById('joinConfirmView');
        this.joinGameInfo = document.getElementById('joinGameInfo');
        this.confirmJoinButton = document.getElementById('confirmJoinButton');
        this.cancelJoinButton = document.getElementById('cancelJoinButton');

        // *** Added: Name input on join confirm screen ***
        this.joinConfirmPlayerNameInput = document.getElementById('joinConfirmPlayerNameInput');

        this.waitingForStartView = document.getElementById('waitingForStartView');
        this.connectionErrorMessage = document.getElementById('connectionErrorMessage');
        this.backButtonConnection = this.connectionDialog.querySelector('.backToMain'); // Assuming one back button

        // *** Added: Elements for Join Link ***
        this.hostJoinLinkDisplay = document.getElementById('hostJoinLinkDisplay');
        this.copyJoinLinkButton = document.getElementById('copyJoinLinkButton');
        // *** End Added ***

        // Error check elements
        if (!this.hostStartButton) console.warn("MultiplayerController: Host Start Button not found in dialog.");

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.hostButton.addEventListener('click', () => {
            if (this.validatePlayerName(this.playerNameInput.value)) {
                console.log("MultiplayerController: Requesting HOSTING flow from MainMenu.");
                this.mainMenuController.initiateHostingFlow();
            }
        });

        this.joinButton.addEventListener('click', () => {
            if (this.validatePlayerName(this.playerNameInput.value)) {
                console.log("MultiplayerController: Showing join view (connection status dialog).");
                this.showJoinScreen();
            }
        });

        this.playerNameInput.addEventListener('input', (e) => {
            const name = e.target.value;
            if (this.mainMenuController.currentGame) {
                this.mainMenuController.currentGame.updatePlayerName(name);
            } else {
                localStorage.setItem('unicornPoepPlayerName', name.trim());
            }
            this.validatePlayerName(name);
        });

        this.submitCodeButton.addEventListener('click', () => {
            const code = this.connectionCodeInput.value.trim();
            if (code && /^[0-9]{6}$/.test(code)) {
                console.log(`MultiplayerController: Requesting JOINING flow from MainMenu with code: ${code}`);
                this.mainMenuController.initiateJoiningFlow(code);
            } else {
                this.showConnectionError("Voer een geldige 6-cijferige code in.");
            }
        });

        this.confirmJoinButton.addEventListener('click', () => {
            console.log("MultiplayerController: Confirm Join button clicked.");
            if (this.mainMenuController && this.mainMenuController.currentGame) {
                this.mainMenuController.currentGame.confirmJoin();
            } else {
                console.error("MultiplayerController: Cannot confirm join - MainMenuController or currentGame not found!");
                this.showConnectionError("Fout: Kan join niet bevestigen. Spel niet gevonden.");
            }
        });

        this.cancelJoinButton.addEventListener('click', () => {
            console.log("MultiplayerController: Cancel Join button clicked.");
            this.game.cancelJoin();
        });

        this.backButtonChoice.addEventListener('click', () => this.mainMenuController.showView('mainMenu'));
        this.backButtonConnection.addEventListener('click', () => {
            console.log("MP Connection Back button clicked.");
            this.hideConnectionDialog();
            
            // --- Robust Cleanup on Back Button --- 
            console.warn("MP Back Button: Manually navigating back from connection dialog.");
            // Ensure WebRTC is cleaned up if a game object somehow exists
            if (this.mainMenuController.currentGame && this.mainMenuController.currentGame.webRTCManager) {
                console.log("MP Back Button: Cleaning up WebRTCManager.");
                this.mainMenuController.currentGame.webRTCManager.cleanup();
            }
            // Ensure the currentGame reference is cleared in MainMenuController
            console.log("MP Back Button: Clearing currentGame reference in MainMenuController.");
            this.mainMenuController.setControllerGameInstance(null); 
            // REMOVED: this.game.cancelJoin(); - Not reliable here
            // --- End Robust Cleanup --- 

            this.mainMenuController.showView('mainMenu');
        });

        this.copyCodeButton.addEventListener('click', () => this.copyHostCode());

        this.whatsappShareButton.addEventListener('click', (event) => {
            event.preventDefault();
            const url = this.whatsappShareButton.getAttribute('data-whatsapp-url');
            if (url) {
                console.log("Opening WhatsApp share URL in new tab/window:", url);
                window.open(url, '_blank');
                this.mainMenuController.toastNotification.show("WhatsApp openen...");
            } else {
                console.error("WhatsApp share URL not found on button attribute.");
                this.mainMenuController.toastNotification.show("Kon WhatsApp link niet vinden.");
            }
        });

        // *** Added: Listener for Copy Join Link Button ***
        if (this.copyJoinLinkButton) {
            this.copyJoinLinkButton.addEventListener('click', () => this._copyJoinLink());
        } else {
            console.warn("MultiplayerController: Copy Join Link Button not found.");
        }
        // *** End Added ***

        // *** Added: Listener for join confirm name input ***
        if (this.joinConfirmPlayerNameInput) {
            // Remove previous listener if any to prevent duplicates
            this._joinConfirmNameInputListener = (e) => {
                const name = e.target.value;
                 // Use the currentGame reference from mainMenuController
                if (this.mainMenuController && this.mainMenuController.currentGame) {
                    this.mainMenuController.currentGame.updatePlayerName(name);
                } else {
                     console.error("MPCtrl: Cannot update name, currentGame not found on mainMenuController.");
                }
                // Basic validation feedback maybe?
                // e.target.classList.toggle('invalid', !name.trim());
            };
            // Listener will be attached in showJoinConfirmationScreen
        } else {
            console.warn("MultiplayerController: Join Confirm Player Name Input not found.");
        }

        this.hostStartButton.addEventListener('click', () => {
            if (this.hostStartButton && !this.hostStartButton.disabled) {
                 console.log("MultiplayerController: Host Start Button clicked.");
                 this.hostStartButton.disabled = true;
                 this.mainMenuController.currentGame.requestStartGame();
            }
        });
    }

    /**
     * Validates the player name input.
     * Shows/hides an error message and returns validity status.
     * @param {string | undefined} name - The player name to validate.
     * @returns {boolean} - True if the name is valid, false otherwise.
     * @private // Or public if needed elsewhere, but seems internal for now
     */
    validatePlayerName(name) {
        const trimmedName = name.trim(); // Trim whitespace and handle potential undefined
        if (!trimmedName) {
            this.showChoiceError("Vul alsjeblieft een naam in.");
            return false;
        } else {
            this.showChoiceError(""); // Clear error if valid
            return true;
        }
    }

    // --- UI Management Methods ---

    resetUI() {
        console.log("MultiplayerController: Resetting UI");
        this.hideAllScreens();
        this.hideConnectionDialog();
        this.choiceScreen.classList.add('hidden');
        this.showChoiceError("");
        if(this.playerNameInput) this.playerNameInput.value = '';
        if(this.connectionCodeInput) this.connectionCodeInput.value = '';
        if(this.joinConfirmPlayerNameInput) this.joinConfirmPlayerNameInput.value = '';
        this.hostStartButton.classList.add('hidden');
        if (this.hostStartButton) this.hostStartButton.disabled = false;
        if(this.hostJoinLinkDisplay) this.hostJoinLinkDisplay.textContent = 'Laden...';
    }

    hideAllScreens() {
        this.hostView.classList.add('hidden');
        this.joinView.classList.add('hidden');
        this.fetchingInfoView.classList.add('hidden');
        this.joinConfirmView.classList.add('hidden');
        this.waitingForStartView.classList.add('hidden');
        this.connectionErrorMessage.classList.add('hidden');
    }

    showConnectionDialog() {
        if (this.connectionDialog) {
            this.connectionDialog.classList.remove('hidden');

            if (!this.connectionDialog.open) {
                 console.log("MultiplayerController: Showing connection dialog modal.");
                 this.connectionDialog.showModal();
            } else {
                 console.log("MultiplayerController: Connection dialog already open.");
            }
        } else {
             console.error("MultiplayerController: Connection dialog element not found!");
        }
    }

    hideConnectionDialog() {
        if (this.connectionDialog.open) {
             console.log("MultiplayerController: Closing connection dialog modal.");
             this.connectionDialog.close();
        }
        this.connectionDialog.classList.add('hidden');
        this.hideAllScreens();
    }

    showChoiceScreen() {
        console.log("MPCtrl: showChoiceScreen called.");
        this.resetUI(); // Reset visuals first
        const storedPlayerName = localStorage.getItem('unicornPoepPlayerName');
        console.log(`MPCtrl: localStorage name: '${storedPlayerName}' (Type: ${typeof storedPlayerName})`);

        if (this.playerNameInput) {
            console.log(`MPCtrl: Player name input found. Current value: '${this.playerNameInput.value}'`);
            this.playerNameInput.value = storedPlayerName || ''; // Ensure empty string if null/undefined
            console.log(`MPCtrl: Player name input value AFTER setting: '${this.playerNameInput.value}'`);
        } else {
            console.error("MPCtrl: Player name input ELEMENT NOT FOUND!");
        }
        // Show the main choice screen container
        this.choiceScreen.classList.remove('hidden');
        // Ensure error message area is hidden initially
        this.showChoiceError("");
    }

    showChoiceError(message) {
        if (this.choiceErrorElement) {
            this.choiceErrorElement.textContent = message;
            this.choiceErrorElement.classList.toggle('hidden', !message);
        }
    }

    showHostScreen(hostId) {
        this.hideAllScreens();
        this.showConnectionDialog();
        if (this.hostCodeDisplay) this.hostCodeDisplay.textContent = hostId;
        this.hostView.classList.remove('hidden');

        let shareText = `Hoi! Doe je mee met mijn spelletje Unicorn Poep 🦄💩?`;

        const gameInstance = this.mainMenuController.currentGame;
        if (gameInstance) {
            const playerName = gameInstance.playerName || 'Ik';
            const sheetNames = gameInstance.selectedSheets || [];
            const difficulty = gameInstance.difficulty || 'onbekend';

            const formattedSheets = sheetNames.join(', ');

            shareText = `Hoi! ${playerName} 😎 hier! Doe je mee met mijn spelletje Unicorn Poep 🦄💩?\n`;
            if (formattedSheets) {
                shareText += `We spelen:\n- ${formattedSheets} op standje ${difficulty}\n\n`;
            } else {
                 shareText += `We spelen op standje ${difficulty}\n\n`;
            }
        } else {
             console.warn("showHostScreen: Could not get game instance details for share text.");
        }

        // *** Modified: Generate and display Join Link ***
        const baseURL = window.location.origin + window.location.pathname;
        const joinLink = `${baseURL}?join=${hostId}`;
        if (this.hostJoinLinkDisplay) {
            this.hostJoinLinkDisplay.textContent = joinLink;
        } else {
            console.warn("Host Join Link Display element not found.");
        }
        shareText += `Klik om gelijk mee te spelen: ${joinLink}\nOf voer deze code in onder 'Samen spelen': ${hostId}`;
        // *** End Modified ***

        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
        if(this.whatsappShareButton) {
             this.whatsappShareButton.setAttribute('data-whatsapp-url', whatsappUrl);
             this.whatsappShareButton.href = '#';
        } else {
             console.warn("WhatsApp share button not found.");
        }

        this.hostStartButton.classList.add('hidden');
        if (this.hostStartButton) this.hostStartButton.disabled = true;
        this.updateLobbyPlayerCount(this.mainMenuController.currentGame.players.size || 1);

        console.log("MultiplayerController: Showing host screen.");
    }

    updateLobbyPlayerCount(count = 0) {
        if (this.hostWaitingText && this.hostView && !this.hostView.classList.contains('hidden')) {
            const canStart = count > 1;
            let waitingText = "Wachten op andere spelers..."; // Default

            const currentGame = this.mainMenuController.currentGame;
            let players = null;
            let hostId = null;

            if (currentGame && currentGame.players && currentGame.webRTCManager) {
                players = currentGame.players;
                hostId = currentGame.webRTCManager.peerId;
            }

            if (count > 1 && players && hostId) {
                const opponentNames = [];
                players.forEach(player => {
                    // Add name if it's not the host
                    if (player.peerId !== hostId) {
                        opponentNames.push(player.playerName || '???'); // Add name, fallback if missing
                    }
                });

                if (opponentNames.length > 0) {
                    const namesString = opponentNames.join(', ');
                    waitingText = `Spelers: ${namesString}. Klaar om te starten?`;
                } else {
                    // This case shouldn't happen if count > 1, but handle it
                    waitingText = "Wachten op andere spelers...";
                }
            } else if (count <= 1) {
                 waitingText = "Wachten op andere spelers...";
            } else {
                // Fallback if players/hostId couldn't be accessed
                console.warn("updateLobbyPlayerCount: Could not get player names, showing count instead.");
                const playerText = count === 1 ? 'speler' : 'spelers';
                waitingText = `${count} ${playerText} aanwezig. Klaar om te starten?`;
            }

            // Update text content
            this.hostWaitingText.textContent = waitingText;

            // Update start button visibility/state
            if (canStart) {
                this.hostStartButton.classList.remove('hidden');
                this.hostStartButton.disabled = false;
            } else {
                this.hostStartButton.classList.add('hidden');
                this.hostStartButton.disabled = true;
            }
        }
    }

    /**
     * Shows the initial screen for joining a game.
     * If isDirectJoin is true, it shows a welcome message.
     * @param {boolean} [isDirectJoin=false] - Indicates if the user arrived via a direct join link.
     */
    showJoinScreen(isDirectJoin = false) {
        this.hideAllScreens();
        this.showConnectionDialog();

        // Show/Hide the welcome message based on direct join
        const welcomeMsg = document.getElementById('joinWelcomeMessage');
        if (welcomeMsg) {
            welcomeMsg.classList.toggle('hidden', !isDirectJoin);
        }

        this.joinView.classList.remove('hidden');
        if(this.connectionCodeInput) this.connectionCodeInput.focus();
        this.showConnectionError("", true);
        console.log(`MultiplayerController: Showing join screen (Direct join: ${isDirectJoin}).`);
    }

    /**
     * Shows or hides the connection error message.
     * @param {string} message - The error message to display, or empty string to hide.
     * @param {boolean} [keepJoinViewVisible=false] - If true, ensures the join code input view remains visible.
     */
    showConnectionError(message, keepJoinViewVisible = false) {
        if (!this.connectionErrorMessage) return;

        // Remove any existing text color classes first
        this.connectionErrorMessage.classList.remove('text-danger', 'text-warning', 'text-info', 'text-success', 'text-primary'); // Add any other colors used

        if (message) {
            console.log(`MPCtrl: Showing connection error: "${message}"`);
            // Add error icon and the message
            this.connectionErrorMessage.innerHTML = `⚠️ ${message}`; // Using innerHTML to add the icon
            this.connectionErrorMessage.classList.add('text-error-purple'); // Add your custom purple class
            this.connectionErrorMessage.classList.remove('hidden');
            // Ensure other intermediate views are hidden when showing an error
            this.fetchingInfoView.classList.add('hidden');
            this.joinConfirmView.classList.add('hidden');
            this.waitingForStartView.classList.add('hidden');
            // Keep the join input view visible if requested (e.g., for invalid code)
            if (keepJoinViewVisible) {
                this.joinView.classList.remove('hidden');
                if (this.connectionCodeInput) this.connectionCodeInput.focus(); // Focus input for correction
            } else {
                this.joinView.classList.add('hidden');
            }
        } else {
            console.log("MPCtrl: Hiding connection error message.");
            this.connectionErrorMessage.innerHTML = ''; // Clear content
            this.connectionErrorMessage.classList.add('hidden');
            this.connectionErrorMessage.classList.remove('text-error-purple'); // Remove purple class when hiding
        }
    }

    showFetchingGameInfo() {
        this.hideAllScreens();
        this.showConnectionDialog();
        this.fetchingInfoView.classList.remove('hidden');
        console.log("MultiplayerController: Showing fetching game info screen.");
    }

    /**
     * Shows the screen where the client confirms joining after receiving game info.
     * @param {object} gameInfo - Info object received from host { hostName, sheetKeys, difficulty, playerCount }
     */
    showJoinConfirmationScreen(gameInfo) {
        this.hideAllScreens();
        this.showConnectionDialog(); // Ensure dialog is visible

        // --- Update Dialog Title and Content --- 
        const hostName = gameInfo.hostName || '???';
        const titleElement = this.joinConfirmView.querySelector('h2'); // Assuming title is h2
        if (titleElement) {
            titleElement.textContent = `Uitnodiging van ${hostName}!`;
        }

        // Translate difficulty
        let difficultyText = gameInfo.difficulty || 'onbekend';
        switch(gameInfo.difficulty) {
            case 'easy': difficultyText = 'Makkelijk'; break;
            case 'medium': difficultyText = 'Normaal'; break;
            case 'hard': difficultyText = 'Moeilijk'; break;
        }

        // Format sheet names
        const sheetText = gameInfo.sheetKeys && gameInfo.sheetKeys.length > 0 
                          ? `- ${gameInfo.sheetKeys.join('\n- ')}` 
                          : '- Onbekend onderwerp';

        // Populate game info (excluding player count)
        this.joinGameInfo.innerHTML = `
            <p>Wil je meedoen met een spelletje:</p>
            <p style="margin-left: 1em;">${sheetText}</p> 
            <p>Niveau: <strong>${difficultyText}</strong></p>
        `;
        // --- End Update --- 

        // *** Added: Populate and add listener for name input ***
        if (this.joinConfirmPlayerNameInput) {
            const currentName = this.mainMenuController.currentGame.playerName || '';
            this.joinConfirmPlayerNameInput.value = currentName;
            
            // Remove old listener before adding new one
            this.joinConfirmPlayerNameInput.removeEventListener('input', this._joinConfirmNameInputListener);
            this.joinConfirmPlayerNameInput.addEventListener('input', this._joinConfirmNameInputListener);
        } else {
            console.error("MultiplayerController: Cannot set up join confirm name input.");
        }

        this.joinConfirmView.classList.remove('hidden');
    }

     showWaitingForGameStart() {
        this.hideAllScreens();
        this.showConnectionDialog();
         this.waitingForStartView.classList.remove('hidden');
         console.log("MultiplayerController: Showing waiting for game start screen.");
    }

    copyHostCode() {
        const code = this.hostCodeDisplay.textContent;
        if (code) {
            navigator.clipboard.writeText(code).then(() => {
                this.mainMenuController.toastNotification.show("Code gekopieerd!");
            }).catch(err => {
                console.error('Failed to copy code: ', err);
                this.mainMenuController.toastNotification.show("Kopiëren mislukt.", 3000);
            });
        }
    }

    /**
     * Copies the generated join link to the clipboard.
     * @private
     */
    async _copyJoinLink() {
        const link = this.hostJoinLinkDisplay.textContent;
        if (link && link !== 'Laden...' && navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(link);
                this.mainMenuController.toastNotification.show("Link gekopieerd!");
            } catch (err) {
                console.error("Failed to copy join link: ", err);
                this.mainMenuController.toastNotification.show("Kopiëren link mislukt.");
            }
        } else {
            this.mainMenuController.toastNotification.show("Kopiëren niet ondersteund/geen link.");
        }
    }

    activate() {
        console.log("MultiplayerController activating (likely for choice screen).");
        if (this.mainMenuController.currentGame.playerName) {
             this.showChoiceScreen(this.mainMenuController.currentGame.playerName);
        } else {
             console.warn("MultiplayerController activate: Cannot show choice screen, player name missing.");
             this.mainMenuController.showView('mainMenu');
         }
    }

    /**
     * Main show method called by MainMenuController when this view becomes active.
     * Delegates to the specific UI setup needed for the initial multiplayer screen.
     */
    show() {
        console.log("MPCtrl: show() called, delegating to showChoiceScreen()");
        this.showChoiceScreen();
    }
}