import BaseComponent from './base-component.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';
import webRTCManager from '../services/WebRTCManager.js';
import { getTextTemplate } from '../utils/miscUtils.js'; // Import the utility
// Potentially import PlayerListComponent if it's managed directly here

/**
 * @class HostLobbyComponent
 * @extends BaseComponent
 * Manages the host's view while waiting for players to join.
 * Displays connection info, player list, and the start game button.
 * Assumes it controls the `#connectionCode` div within the `#connectionStatus` dialog/view.
 */
class HostLobbyComponent extends BaseComponent {
    /**
     * Creates an instance of HostLobbyComponent.
     * @param {string} elementSelector - CSS selector for the component's root element (e.g., '#connectionCode').
     */
    constructor() {
        super('#connectionCode', Views.HostLobby);

        // Element references within the host lobby view
        this.hostCodeDisplay = this.rootElement.querySelector('#hostCodeDisplay');
        this.copyCodeButton = this.rootElement.querySelector('#copyCodeButton');
        this.hostJoinLinkDisplay = this.rootElement.querySelector('#hostJoinLinkDisplay');
        this.copyLinkButton = this.rootElement.querySelector('#copyJoinLinkButton');
        this.whatsappButton = this.rootElement.querySelector('#whatsappShareButton');
        this.waitingTextContainer = this.rootElement.querySelector('#hostWaitingText'); // Renamed variable
        this.statusInitializing = this.waitingTextContainer.querySelector('#host-status-initializing');
        this.statusWaiting = this.waitingTextContainer.querySelector('#host-status-waiting');
        this.playerCountSpan = this.statusWaiting.querySelector('.player-count');
        this.playerLabelSingular = this.statusWaiting.querySelector('.player-label-singular');
        this.playerLabelPlural = this.statusWaiting.querySelector('.player-label-plural');
        this.startButton = this.rootElement.querySelector('#hostStartButton');
        this.backButton = this.rootElement.closest('dialog, .view-container').querySelector('.backToMain'); // Find back button in parent
        this.hostErrorDisplay = this.rootElement.querySelector('#hostErrorDisplay'); // Added error display element
        // Assuming PlayerListComponent instance is managed elsewhere and updates via events
        // this.playerListContainer = this.rootElement.querySelector('#playerListContainer'); // If list is inside this component

        this.hostId = null;

        this._bindEvents();
        this.hide(); // Start hidden
        console.log(`[${this.name}] Initialized`);

        // Listen for events relevant to the host lobby
        this.listen(Events.Navigation.ShowView, this.handleShowView);
        this.listen(Events.Multiplayer.Host.Initialized, this.handleHostInitialized);
        this.listen(Events.Multiplayer.Host.ClientConnected, this.updatePlayerDisplay);
        this.listen(Events.Multiplayer.Host.ClientDisconnected, this.updatePlayerDisplay);
        this.listen(Events.Multiplayer.Host.ErrorOccurred, this._handleHostError); // Added listener for host errors
        // Listen for PlayerListUpdated if using a separate PlayerListComponent
        // this.listen(Events.Multiplayer.Common.PlayerListUpdated, this.handlePlayerListUpdate);

        // Basic check if waiting text structure exists
        if (!this.statusInitializing || !this.statusWaiting || !this.playerCountSpan || !this.playerLabelSingular || !this.playerLabelPlural) {
             console.warn(`[${this.name}] Could not find all waiting text elements. Player count display might be broken.`);
        }
    }

    /** Binds DOM event listeners. @private */
    _bindEvents() {
        this.copyCodeButton.addEventListener('click', this._handleCopyCode);
        this.copyLinkButton.addEventListener('click', this._handleCopyLink);
        this.startButton.addEventListener('click', this._handleStartClick);
        this.backButton.addEventListener('click', this._handleBackClick); // Use back/cancel event
        // Note: WhatsApp button uses href, no click listener needed unless modifying behavior
    }

    /** Removes DOM event listeners. @private */
    _unbindEvents() {
        this.copyCodeButton.removeEventListener('click', this._handleCopyCode);
        this.copyLinkButton.removeEventListener('click', this._handleCopyLink);
        this.startButton.removeEventListener('click', this._handleStartClick);
        this.backButton.removeEventListener('click', this._handleBackClick);
    }

    /**
     * Handles the ShowView event.
     * @param {object} payload
     * @param {string} payload.viewName
     * @param {object} [payload.data] - Optional data (playerName, settings) - might not be needed here
     */
    handleShowView({ viewName, data }) {
        if (viewName === this.name) {
            console.log(`[${this.name}] Showing view. Data:`, data);
            this._resetLobbyState();
            this.show();
            // WebRTC init happens in GameCoordinator, we wait for Host.Initialized
        }
    }

    /** Resets the lobby display elements. @private */
    _resetLobbyState() {
        const loadingText = getTextTemplate('hostLoading'); // Get loading text
        if (this.hostCodeDisplay) this.hostCodeDisplay.textContent = this.hostCodeDisplay.dataset.loadingText || loadingText;
        if (this.hostJoinLinkDisplay) this.hostJoinLinkDisplay.textContent = this.hostJoinLinkDisplay.dataset.loadingText || loadingText;
        if (this.whatsappButton) this.whatsappButton.href = '#';
        this.startButton.classList.add('hidden');
        this.startButton.removeAttribute('disabled'); // Re-enable start button
        this.hostId = null;
        this.hostErrorDisplay.classList.add('hidden'); // Hide error display on reset
        this.hostErrorDisplay.replaceChildren(); // Clear any previous error messages
        this.updatePlayerDisplay(); // Reset player count display
    }

    /**
     * Handles the Host.Initialized event from WebRTCManager.
     * @param {object} payload
     * @param {string} payload.hostId - The assigned host PeerJS ID.
     */
    handleHostInitialized({ hostId }) {
        console.log(`[${this.name}] Host initialized with ID: ${hostId}`);
        this.hostId = hostId;
        if (this.hostCodeDisplay) this.hostCodeDisplay.textContent = hostId;
        
        // Construct join link
        const joinUrl = `${window.location.origin}${window.location.pathname}?join=${hostId}`;
        if (this.hostJoinLinkDisplay) this.hostJoinLinkDisplay.textContent = joinUrl;
        if (this.whatsappButton) {
            // Construct the text for WhatsApp share
            // Use template for base text
            const shareBaseText = this.whatsappButton.dataset.shareText || getTextTemplate('hostWhatsappShare');
            const whatsappText = encodeURIComponent(`${shareBaseText} ${joinUrl}`);
            this.whatsappButton.href = `https://api.whatsapp.com/send?text=${whatsappText}`;
        }

        // Start button might still be hidden until at least one player joins?
        // Or enable immediately if 1-player hosting is allowed?
        // For now, enable when host is ready.
        this.startButton.classList.remove('hidden'); 
        this.updatePlayerDisplay(); // Update text now that host is ready
    }

    /** Updates the waiting text based on connected clients. */
    updatePlayerDisplay() {
        const playerList = webRTCManager.getPlayerList();
        let clientCount = 0;
        if (playerList) {
            playerList.forEach(player => {
                if (!player.isHost) {
                    clientCount++;
                }
            });
        }

        if (this.hostId) {
            // Host is ready, show waiting status
            this.statusInitializing.classList.add('hidden');
            this.statusWaiting.classList.remove('hidden');

            if (this.playerCountSpan) {
                 this.playerCountSpan.textContent = clientCount.toString();
            }
            if (this.playerLabelSingular && this.playerLabelPlural) {
                 this.playerLabelSingular.classList.toggle('hidden', clientCount !== 1);
                 this.playerLabelPlural.classList.toggle('hidden', clientCount === 1);
            }
        } else {
            // Host not ready yet, show initializing status
            this.statusInitializing.classList.remove('hidden');
            this.statusWaiting.classList.add('hidden');
        }

        // Show/hide start button based on player count? (Optional)
        // if (this.startButton) {
        //     this.startButton.classList.toggle('hidden', clientCount < 1);
        // }
    }

    /** Handles copying the host code. @private */
    _handleCopyCode = async () => {
        if (!this.hostId) return;
        try {
            await navigator.clipboard.writeText(this.hostId);
            console.log(`[${this.name}] Host code copied: ${this.hostId}`);
            // Use template for success message
            const msg = this.copyCodeButton.dataset.successMsg || getTextTemplate('hostCopyCodeSuccess');
            eventBus.emit(Events.System.ShowFeedback, { message: msg, level: 'success', duration: 1500 });
        } catch (err) {
            console.error(`[${this.name}] Failed to copy host code:`, err);
            // Use template for error message
            const msg = this.copyCodeButton.dataset.errorMsg || getTextTemplate('hostCopyCodeError');
            eventBus.emit(Events.System.ShowFeedback, { message: msg, level: 'error' });
        }
    }

    /** Handles copying the join link. @private */
    _handleCopyLink = async () => {
        const link = this.hostJoinLinkDisplay.textContent;
        // Use template for loading text comparison
        const loadingText = this.hostJoinLinkDisplay.dataset.loadingText || getTextTemplate('hostLoading');
        if (!link || link === loadingText) return;
        try {
            await navigator.clipboard.writeText(link);
            console.log(`[${this.name}] Join link copied: ${link}`);
            // Use template for success message
            const msg = this.copyLinkButton.dataset.successMsg || getTextTemplate('hostCopyLinkSuccess');
             eventBus.emit(Events.System.ShowFeedback, { message: msg, level: 'success', duration: 1500 });
        } catch (err) {
            console.error(`[${this.name}] Failed to copy join link:`, err);
            // Use template for error message
            const msg = this.copyLinkButton.dataset.errorMsg || getTextTemplate('hostCopyLinkError');
            eventBus.emit(Events.System.ShowFeedback, { message: msg, level: 'error' });
        }
    }

    /** Handles the start button click. @private */
    _handleStartClick = () => {
        console.log(`[${this.name}] Start Game button clicked.`);
        // GameCoordinator listens for this and starts the MultiplayerGame host instance
        eventBus.emit(Events.UI.HostLobby.StartGameClicked);
        // Optionally disable start button after clicking
         this.startButton.setAttribute('disabled', 'true');
    }

    /** Handles the back/cancel button click. @private */
    _handleBackClick = () => {
        console.log(`[${this.name}] Back/Cancel button clicked.`);
        eventBus.emit(Events.UI.HostLobby.CancelClicked); // Specific cancel event
        this.hide();
        // GameCoordinator handles cleanup and navigation
    }

    /**
     * Handles host-specific errors emitted by MultiplayerGame.
     * Displays the error message in the designated area.
     * @param {object} payload
     * @param {string} payload.errorKey - The key for the error template.
     * @param {string} [payload.originalMessage] - Additional message detail.
     * @param {number} [payload.index] - Additional index detail.
     * @private
     */
    _handleHostError = ({ errorKey, originalMessage, index }) => {
        if (!this.hostErrorDisplay) return;

        const errorTemplateSpan = this.hostErrorDisplay.querySelector(`span[data-key="${errorKey}"]`);
        if (!errorTemplateSpan) {
            console.error(`[${this.name}] Could not find error template span for key: ${errorKey}`);
            // Fallback: Display the key itself or a generic message
            this.hostErrorDisplay.textContent = `Host Error: ${errorKey}${originalMessage ? ` (${originalMessage})` : ''}`;
            this.hostErrorDisplay.classList.remove('hidden');
            return;
        }

        let errorMessage = errorTemplateSpan.textContent || 'Host error occurred.';

        // Append details if provided
        if (originalMessage) {
            errorMessage += originalMessage;
        } else if (index !== undefined) {
            errorMessage += index;
        }

        // Display the constructed message
        // Clear previous content and add the new message
        this.hostErrorDisplay.textContent = errorMessage;
        this.hostErrorDisplay.classList.remove('hidden');

        // Potentially disable start button or take other actions depending on the error
        if (errorKey === 'mpHostErrorNoQuestions') {
            this.startButton.setAttribute('disabled', 'true');
            this.startButton.classList.add('hidden'); // Hide if no questions
        }
    }

    // Override destroy
    destroy() {
        console.log(`[${this.name}] Destroying...`);
        this._unbindEvents();
        super.destroy();
    }
}

export default HostLobbyComponent;