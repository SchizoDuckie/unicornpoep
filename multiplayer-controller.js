/**
 * Manages Multiplayer UI elements: Choice screen, Connection status, Waiting messages.
 * Uses class toggling (.hidden) for visibility.
 */
class MultiplayerController {
    /**
     * Initializes the controller, gets elements, and sets up listeners.
     * @param {Game} game - The main game instance.
     */
    constructor(game) {
        this.game = game;
        this.choiceContainer = document.getElementById('multiplayerChoice');
        this.playerNameInput = document.getElementById('playerNameInput');
        this.hostButton = document.getElementById('hostGame');
        this.joinButton = document.getElementById('joinGame');
        this.statusDialog = document.getElementById('connectionStatus');
        this.hostCodeDisplay = document.getElementById('hostCodeDisplay');
        this.hostCodeContainer = document.getElementById('connectionCode');
        this.joinViewContainer = document.getElementById('joinView');
        this.codeInput = document.getElementById('connectionCodeInput');
        this.submitCodeButton = document.getElementById('submitCode');
        this.waitingMessageElement = document.getElementById('waitingMessage');
        this.copyCodeButton = document.getElementById('copyCodeButton');
        this.whatsappShareButton = document.getElementById('whatsappShareButton');

        this.setupEventListeners();
        this.hideAll(); // Add .hidden class initially
    }

    /** Sets up listeners for multiplayer choice and connection UI elements. */
    setupEventListeners() {
        this.hostButton?.addEventListener('click', () => {
            const name = this.playerNameInput?.value || '';
            if (!name.trim()) { 
                alert("Vul eerst je naam in!"); 
                return; 
            }
            this.game.updatePlayerName(name); 
            this.hideAll();
            // Delegate showing sheet selection to the main menu controller
            this.game.mainMenuController.showSheetSelectionForMultiplayerHost();
        });
        this.joinButton?.addEventListener('click', () => {
            const name = this.playerNameInput?.value || '';
            if (!name.trim()) { alert("Vul eerst je naam in!"); return; }
            this.game.updatePlayerName(name); this.hideAll();
            this.game.startMultiplayerJoin(); // Game class handles showing join screen
        });
        this.playerNameInput?.addEventListener('change', () => {
             if(this.playerNameInput) this.game.updatePlayerName(this.playerNameInput.value);
        });
        this.submitCodeButton?.addEventListener('click', () => this.submitCode());
        this.codeInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitCode();
            // Allow only numbers and essential control keys
            if (!/^[0-9]$/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
        });
        this.codeInput?.addEventListener('input', () => { // Limit length
             if (this.codeInput && this.codeInput.value.length > 6) this.codeInput.value = this.codeInput.value.slice(0, 6);
        });

        // Added listener for copy button
        this.copyCodeButton?.addEventListener('click', () => this.copyCodeToClipboard());

        // Add listeners to back buttons within these sections
        this.choiceContainer?.querySelectorAll('.backToMain').forEach(btn => btn.addEventListener('click', () => this.game.backToMainMenu()));
        this.statusDialog?.querySelectorAll('.backToMain').forEach(btn => btn.addEventListener('click', () => this.game.backToMainMenu()));
    }

    /** Hides all multiplayer UI sections by adding the 'hidden' class or closing the dialog. */
    hideAll() {
        this.choiceContainer?.classList.add('hidden');
        
        // Explicitly add .hidden class to the dialog itself for CSS hiding
        this.statusDialog?.classList.add('hidden'); 

        // Close the dialog if it's open
        if (this.statusDialog && this.statusDialog.open) {
                 this.statusDialog.close();
        }
        
        if (this.waitingMessageElement) this.waitingMessageElement.textContent = ''; // Clear messages
    }
    /**
     * Shows the initial Host/Join choice screen.
     * @param {string} currentName - The player's current name to pre-fill.
     */
    showChoiceScreen(currentName) {
        this.hideAll(); // Ensure others are hidden
        if (this.playerNameInput) this.playerNameInput.value = currentName;
        // Assumes #multiplayerChoice base style is display: flex
        this.choiceContainer?.classList.remove('hidden');
    }
    /**
     * Shows the screen for the host, displaying the connection code and waiting message.
     * @param {string} code - The connection code.
     */
    showHostWaitingScreen(code) {
        this.hideAll(); // Ensure others are hidden
        if (this.hostCodeDisplay) this.hostCodeDisplay.textContent = code;
        this.hostCodeContainer?.classList.remove('hidden'); // Show host code section
        this.joinViewContainer?.classList.add('hidden'); // Ensure join view is hidden

        // Set the initial waiting message
        if (this.waitingMessageElement) {
            this.waitingMessageElement.innerHTML = '<span>Wachten op andere speler</span><span class="dot1">.</span><span class="dot2">.</span><span class="dot3">.</span>';
        }

        // Set WhatsApp share link
        if (this.whatsappShareButton) {
            // --- Data Retrieval (Assumes valid now) ---
            const selectedKeys = this.game.selectedSheets; // Should be correctly set by game.startMultiplayerHost
            const difficulty = this.game.difficulty;       // Should be correctly set by game.startMultiplayerHost
            const questionsManager = this.game.questionsManager;
            const playerName = this.game.playerName; // Use game state name
            let sheetNamesText = questionsManager.getFormattedSheetNames(selectedKeys);
            const levels = `${sheetNamesText} op standje ${difficulty}`; // Directly use difficulty
            const baseUrl = window.location.href.replace(window.location.search,'');
            const messageText = `Hoi ${playerName} hier! Doe je mee met mijn spelletje Unicorn Poep 🦄💩?
We spelen levels: 
- ${levels}
Klik om gelijk mee te spelen: ${baseUrl}?join=${code}
Of voer deze code in onder 'Samen spelen': ${code}`;

            const encodedText = encodeURIComponent(messageText);

            this.whatsappShareButton.href = `https://api.whatsapp.com/send/?text=${encodedText}&type=custom_url&app_absent=0`;
        }

        this.statusDialog?.classList.remove('hidden');
        this.statusDialog?.showModal();
    }
    /** Shows the screen for the client to enter the connection code. */
    showJoinScreen() {
        this.hideAll(); // Ensure others are hidden
        this.hostCodeContainer?.classList.add('hidden'); // Ensure host view is hidden
        this.joinViewContainer?.classList.remove('hidden'); // Show join view section
        if (this.waitingMessageElement) this.waitingMessageElement.textContent = ''; // Clear message
        if (this.codeInput) this.codeInput.value = '';
        
        // Remove hidden class THEN show the dialog
        this.statusDialog?.classList.remove('hidden');
        this.statusDialog?.showModal(); 
        
        setTimeout(() => this.codeInput?.focus(), 100); // Focus after render
    }
    /** Shows a generic "Connecting..." message while connection is in progress. */
    showConnectingMessage() {
         this.hideAll(); // Ensure others are hidden
         this.hostCodeContainer?.classList.add('hidden');
         this.joinViewContainer?.classList.add('hidden');
         if (this.waitingMessageElement) { 
             this.waitingMessageElement.innerHTML = '<span>Verbinden</span><span class="dot1">.</span><span class="dot2">.</span><span class="dot3">.</span>'; 
             this.waitingMessageElement.style.color = ''; // Reset color
         }
         // Remove hidden class THEN show the dialog
         this.statusDialog?.classList.remove('hidden');
         this.statusDialog?.showModal(); 
    }
     /**
      * Shows a custom waiting message (e.g., waiting for game data).
      * @param {string} message - The message to display.
      */
     showWaitingMessage(message) {
         this.hideAll(); // Ensure others are hidden
         this.hostCodeContainer?.classList.add('hidden');
         this.joinViewContainer?.classList.add('hidden');
         if (this.waitingMessageElement) { 
             this.waitingMessageElement.innerHTML = `<span>${message}</span><span class="dot1">.</span><span class="dot2">.</span><span class="dot3">.</span>`; 
             this.waitingMessageElement.style.color = ''; // Reset color
         }
         // Remove hidden class THEN show the dialog
         this.statusDialog?.classList.remove('hidden');
         this.statusDialog?.showModal(); 
     }
    /**
     * Shows an error message on the join screen.
     * @param {string} message - The error message.
     */
    showJoinError(message) {
         this.showJoinScreen(); // Reset to join input state first (handles visibility)
         if (this.waitingMessageElement) { this.waitingMessageElement.textContent = `Fout: ${message}`; this.waitingMessageElement.style.color = 'red'; }
    }
    /** Handles code submission logic, validates code, and calls game connect method. */
    submitCode() {
        if (!this.codeInput) return;
        const code = this.codeInput.value.trim();
        if (code.length === 6 && /^[0-9]+$/.test(code)) {
             if (this.waitingMessageElement) this.waitingMessageElement.style.color = ''; // Reset color
             // Show connecting message while attempting
             this.showConnectingMessage();
             this.game.connectToMultiplayerGame(code);
        } else {
            this.showJoinError('Voer een geldige 6-cijferige code in.');
        }
    }

    /** Copies the host connection code to the clipboard. */
    copyCodeToClipboard() {
        const code = this.hostCodeDisplay?.textContent;
        if (!this.copyCodeButton) return; // Guard against missing button

        if (code && navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => {
                // Visual feedback
                const originalTitle = this.copyCodeButton.title;
                const originalIconHTML = this.copyCodeButton.innerHTML;
                this.copyCodeButton.title = 'Gekopieerd!';
                this.copyCodeButton.disabled = true; // Briefly disable
                 // Simple checkmark icon
                this.copyCodeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0z" fill="none"/><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
                setTimeout(() => {
                    this.copyCodeButton.title = originalTitle;
                    this.copyCodeButton.innerHTML = originalIconHTML; // Restore original icon
                    this.copyCodeButton.disabled = false;
                }, 2000); // Revert after 2 seconds
            }).catch(err => {
                console.error('Kon code niet kopiëren: ', err);
                alert('Kon code niet kopiëren.');
            });
        } else if (code) {
             // Fallback for older browsers
             try {
                 const tempInput = document.createElement('textarea'); // Use textarea for potential line breaks
                 tempInput.style.position = 'absolute';
                 tempInput.style.left = '-9999px';
                 tempInput.value = code;
                 document.body.appendChild(tempInput);
                 tempInput.select();
                 tempInput.setSelectionRange(0, 99999); // For mobile devices
                 document.execCommand('copy');
                 document.body.removeChild(tempInput);
                 alert('Code gekopieerd!'); // Simple alert feedback for fallback
             } catch (err) {
                 console.error('Fallback kopiëren mislukt: ', err);
                 alert('Kon code niet automatisch kopiëren.');
             }
        }
    }
}