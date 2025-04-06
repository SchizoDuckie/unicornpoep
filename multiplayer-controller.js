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
        this.backButtonChoice = this.choiceScreen?.querySelector('.backToMain'); // Assuming back button exists

        // Get elements for connection status dialog/screens
        this.connectionDialog = document.getElementById('connectionStatus');
        this.hostView = this.connectionDialog?.querySelector('#connectionCode');
        this.hostCodeDisplay = document.getElementById('hostCodeDisplay');
        this.copyCodeButton = document.getElementById('copyCodeButton');
        this.whatsappShareButton = document.getElementById('whatsappShareButton');
        this.hostWaitingText = this.connectionDialog?.querySelector('#hostWaitingText');
        this.hostStartButton = this.connectionDialog?.querySelector('#hostStartButton');
        this.joinView = document.getElementById('joinView');
        this.connectionCodeInput = document.getElementById('connectionCodeInput');
        this.submitCodeButton = document.getElementById('submitCode');

        this.fetchingInfoView = document.getElementById('fetchingInfoView');
        this.joinConfirmView = document.getElementById('joinConfirmView');
        this.joinGameInfo = document.getElementById('joinGameInfo');
        this.confirmJoinButton = document.getElementById('confirmJoinButton');
        this.cancelJoinButton = document.getElementById('cancelJoinButton');

        this.waitingForStartView = document.getElementById('waitingForStartView');
        this.connectionErrorMessage = document.getElementById('connectionErrorMessage');
        this.backButtonConnection = this.connectionDialog?.querySelector('.backToMain'); // Assuming one back button

        // Error check elements
        if (!this.hostStartButton) console.warn("MultiplayerController: Host Start Button not found in dialog.");

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.hostButton?.addEventListener('click', () => {
            if (this.validatePlayerName(this.playerNameInput?.value)) {
                console.log("MultiplayerController: Requesting PREPARE_HOST flow from MainMenu.");
                this.mainMenuController.startMultiplayer(MultiplayerModes.PREPARE_HOST);
            }
        });

        this.joinButton?.addEventListener('click', () => {
            if (this.validatePlayerName(this.playerNameInput?.value)) {
                console.log("MultiplayerController: Showing join view (connection status dialog).");
                this.showJoinScreen();
            }
        });

        this.playerNameInput?.addEventListener('input', (e) => {
            const name = e.target.value;
            this.game?.updatePlayerName(name);
            this.validatePlayerName(name);
        });

        this.submitCodeButton?.addEventListener('click', () => {
            const code = this.connectionCodeInput?.value.trim();
            if (code && /^[0-9]{6}$/.test(code)) {
                console.log(`MultiplayerController: Submitting join code: ${code}`);
                this.mainMenuController.startMultiplayer(MultiplayerModes.JOIN, { hostId: code });
            } else {
                this.showConnectionError("Voer een geldige 6-cijferige code in.");
            }
        });

        this.confirmJoinButton?.addEventListener('click', () => {
            console.log("MultiplayerController: Confirm Join button clicked.");
            this.game?.confirmJoin();
        });

        this.cancelJoinButton?.addEventListener('click', () => {
            console.log("MultiplayerController: Cancel Join button clicked.");
            this.game?.cancelJoin();
        });

        this.backButtonChoice?.addEventListener('click', () => this.mainMenuController?.showView('mainMenu'));
        this.backButtonConnection?.addEventListener('click', () => {
            console.log("MP Connection Back button clicked.");
            this.hideConnectionDialog();
            this.game?.cancelJoin?.();
            this.mainMenuController?.showView('mainMenu');
        });

        this.copyCodeButton?.addEventListener('click', () => this.copyHostCode());

        this.hostStartButton?.addEventListener('click', () => {
            if (this.hostStartButton && !this.hostStartButton.disabled) {
                 console.log("MultiplayerController: Host Start Button clicked.");
                 this.hostStartButton.disabled = true;
                 this.mainMenuController?.currentGame?.requestStartGame();
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
        const trimmedName = name?.trim(); // Trim whitespace and handle potential undefined
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
        this.choiceScreen?.classList.add('hidden');
        this.showChoiceError("");
        if(this.playerNameInput) this.playerNameInput.value = this.mainMenuController?.currentGame?.playerName || '';
        if(this.connectionCodeInput) this.connectionCodeInput.value = '';
        this.hostStartButton?.classList.add('hidden');
        if (this.hostStartButton) this.hostStartButton.disabled = false;
    }

    hideAllScreens() {
        this.hostView?.classList.add('hidden');
        this.joinView?.classList.add('hidden');
        this.fetchingInfoView?.classList.add('hidden');
        this.joinConfirmView?.classList.add('hidden');
        this.waitingForStartView?.classList.add('hidden');
        this.connectionErrorMessage?.classList.add('hidden');
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
        if (this.connectionDialog?.open) {
             console.log("MultiplayerController: Closing connection dialog modal.");
             this.connectionDialog.close();
        }
        this.connectionDialog?.classList.add('hidden');
        this.hideAllScreens();
    }

    showChoiceScreen(playerName) {
        this.resetUI();
        if(this.playerNameInput) this.playerNameInput.value = playerName || '';
        this.choiceScreen?.classList.remove('hidden');
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
        this.hostView?.classList.remove('hidden');

        let shareText = `Hoi! Doe je mee met mijn spelletje Unicorn Poep 🦄💩?`;

        const gameInstance = this.mainMenuController?.currentGame;
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

        const joinLink = `${window.location.origin}${window.location.pathname}?join=${hostId}`;
        shareText += `Klik om gelijk mee te spelen: ${joinLink}\nOf voer deze code in onder 'Samen spelen': ${hostId}`;

        if(this.whatsappShareButton) {
             this.whatsappShareButton.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
        } else {
             console.warn("WhatsApp share button not found.");
        }

        this.hostStartButton?.classList.add('hidden');
        if (this.hostStartButton) this.hostStartButton.disabled = true;
        this.updateLobbyPlayerCount(this.mainMenuController?.currentGame?.players.size || 1);

        console.log("MultiplayerController: Showing host screen.");
    }

    updateLobbyPlayerCount(count = 0) {
        if(this.hostWaitingText && this.hostView && !this.hostView.classList.contains('hidden')) {
             const canStart = count > 1;
             if (count <= 1) {
                 this.hostWaitingText.textContent = "Wachten op andere spelers om mee te doen...";
                 this.hostStartButton?.classList.add('hidden');
                 if (this.hostStartButton) this.hostStartButton.disabled = true;
             } else {
                 const playerText = count === 1 ? 'speler' : 'spelers';
                 this.hostWaitingText.textContent = `${count} ${playerText} in lobby. Klaar om te starten?`;
                 this.hostStartButton?.classList.remove('hidden');
                 if (this.hostStartButton) this.hostStartButton.disabled = !canStart;
             }
        }
    }

    showJoinScreen() {
        this.hideAllScreens();
        this.showConnectionDialog();
        this.joinView?.classList.remove('hidden');
        if(this.connectionCodeInput) this.connectionCodeInput.focus();
        this.showConnectionError("");
        console.log("MultiplayerController: Showing join screen.");
    }

    showConnectionError(message, keepJoinViewVisible = false) {
        if (this.connectionErrorMessage) {
            this.connectionErrorMessage.textContent = message;
            this.connectionErrorMessage.classList.toggle('hidden', !message);
        }
        if (!keepJoinViewVisible) {
            this.hideAllScreens();
            this.joinView?.classList.add('hidden');
            if (message && keepJoinViewVisible) {
                this.joinView?.classList.remove('hidden');
            }
        }
    }

    showFetchingGameInfo() {
        this.hideAllScreens();
        this.showConnectionDialog();
        this.fetchingInfoView?.classList.remove('hidden');
        console.log("MultiplayerController: Showing fetching game info screen.");
    }

    showJoinConfirmationScreen(gameInfo) {
        this.hideAllScreens();
        this.showConnectionDialog();
        if (this.joinGameInfo) {
             // Format sheet names from the received sheetKeys array
             const formattedSheets = (gameInfo.sheetKeys && gameInfo.sheetKeys.length > 0)
                 ? gameInfo.sheetKeys.join(', ')
                 : '?'; // Fallback if empty or missing

             this.joinGameInfo.innerHTML = `
                 <p>Host: <strong>${gameInfo.hostName || '?'}</strong></p>
                 <p>Onderwerpen: <strong>${formattedSheets}</strong></p>
                 <p>Niveau: <strong>${gameInfo.difficulty || '?'}</strong></p>
                 <p>Aantal spelers: <strong>${gameInfo.playerCount || '?'}</strong></p>
            `;
        }
        this.joinConfirmView?.classList.remove('hidden');
        console.log("MultiplayerController: Showing join confirmation screen.");
    }

     showWaitingForGameStart() {
        this.hideAllScreens();
        this.showConnectionDialog();
         this.waitingForStartView?.classList.remove('hidden');
         console.log("MultiplayerController: Showing waiting for game start screen.");
    }

    copyHostCode() {
        const code = this.hostCodeDisplay?.textContent;
        if (code) {
            navigator.clipboard.writeText(code).then(() => {
                this.mainMenuController.toastNotification?.show("Code gekopieerd!");
            }).catch(err => {
                console.error('Failed to copy code: ', err);
                this.mainMenuController.toastNotification?.show("Kopiëren mislukt.", 3000);
            });
        }
    }

    activate() {
        console.log("MultiplayerController activating (likely for choice screen).");
        if (this.mainMenuController.currentGame?.playerName) {
             this.showChoiceScreen(this.mainMenuController.currentGame.playerName);
        } else {
             console.warn("MultiplayerController activate: Cannot show choice screen, player name missing.");
             this.mainMenuController?.showView('mainMenu');
         }
    }
}