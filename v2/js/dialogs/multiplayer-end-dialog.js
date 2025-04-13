import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import { getTextTemplate } from '../utils/miscUtils.js';


/**
 * @class MultiplayerEndDialog
 * @extends BaseDialog
 * Displays the final results and rankings for a multiplayer game.
 */
class MultiplayerEndDialog extends BaseDialog {
    static SELECTOR = '#multiplayerEndDialog';
    static VIEW_NAME = 'MultiplayerEndDialog';

    /** Initializes component elements. */
    initialize() {
        this.titleDisplay = this.rootElement.querySelector('#multiplayerEndTitle');
        this.playerListBody = this.rootElement.querySelector('#mpResultsList');
        this.backToMenuButton = this.rootElement.querySelector('#mpReturnToMenuButton');
        this.playerTemplate = document.getElementById('mp-results-row-template');

        if (!this.titleDisplay) console.error(`[${this.name}] Missing #multiplayerEndTitle`);
        if (!this.playerListBody) console.error(`[${this.name}] Missing #mpResultsList (tbody)`);
        if (!this.backToMenuButton) console.error(`[${this.name}] Missing #mpReturnToMenuButton`);
        if (!this.playerTemplate) console.error(`[${this.name}] Missing template #mp-results-row-template`);

        this._bindMethods();
        console.log(`[${this.name}] Initialized.`);
    }

    _bindMethods() {
        this._handleBackClick = this._handleBackClick.bind(this);
        this.updateDisplay = this.updateDisplay.bind(this);
    }

    /** Registers DOM listeners. */
    registerListeners() {
        console.log(`[${this.name}] Registering DOM listeners.`);
        if (this.backToMenuButton) {
             this.backToMenuButton.addEventListener('click', this._handleBackClick);
        } else {
             console.warn(`[${this.name}] Back button not found, cannot add listener.`);
        }
    }

    /** Unregisters DOM listeners. */
    unregisterListeners() {
        console.log(`[${this.name}] Unregistering DOM listeners.`);
        if (this.backToMenuButton) {
             this.backToMenuButton.removeEventListener('click', this._handleBackClick);
        }
    }

    /** Handles the back to menu button click */
    _handleBackClick() {
        console.log(`[${this.name}] Back to menu clicked.`);
        eventBus.emit(Events.UI.EndDialog.ReturnToMenuClicked);
        this.hide();
    }
    
    /**
     * Updates the dialog display with the final game results.
     * @param {object} results - The results object from GameCoordinator/MultiplayerGame.
     * @param {Array<object>} results.players - Sorted array of player objects { id, name, score }.
     * @param {string|null} results.winnerId - ID of the winning player, or null for a draw.
     */
    updateDisplay(results) {
        if (!results || !results.players) {
            console.error(`[${this.name}] Invalid results data received.`, results);
            if (this.titleDisplay) this.titleDisplay.textContent = 'Error displaying results.';
            if (this.playerListBody) this.playerListBody.innerHTML = '';
                 return;
            }

        let winnerText = getTextTemplate('mpEndDraw') || 'It\'s a draw!';
        if (results.winnerId) {
            const winner = results.players.find(p => p.id === results.winnerId);
            if (winner) {
                 const name = winner.name || getTextTemplate('mpEndDefaultPlayerName') || `Player ${winner.id.slice(-4)}`;
                 winnerText = getTextTemplate('mpEndWinnerPrefix', { name: name }) || `${name} wint!`; 
            }
        }
        if (this.titleDisplay) this.titleDisplay.textContent = winnerText;

        if (this.playerListBody && this.playerTemplate) {
            this.playerListBody.innerHTML = '';
            const fragment = document.createDocumentFragment();
            results.players.forEach((player, index) => {
                const itemClone = this.playerTemplate.content.cloneNode(true);
                const rankCell = itemClone.querySelector('.rank');
                const nameCell = itemClone.querySelector('.name');
                const scoreCell = itemClone.querySelector('.score');

                if (nameCell) nameCell.textContent = player.name || getTextTemplate('mpEndDefaultPlayerName') || `Player ${player.id.slice(-4)}`;
                if (scoreCell) scoreCell.textContent = player.score;
                if (rankCell) rankCell.textContent = `#${index + 1}`;

                fragment.appendChild(itemClone);
            });
            this.playerListBody.appendChild(fragment);
        } else {
             if (!this.playerListBody) console.error(`[${this.name}] Cannot populate results: List body (#mpResultsList) not found.`);
             if (!this.playerTemplate) console.error(`[${this.name}] Cannot populate results: Template (#mp-results-row-template) not found.`);
        }
    }

    /**
     * Shows the dialog and updates its content.
     * @param {object} results - Results data to display.
     */
    show(results) {
        this.updateDisplay(results);
        super.show();
    }

    destroy() {
         console.log(`[${this.name}] Destroying...`);
        this.unregisterListeners();
         super.destroy();
    }
}

export default MultiplayerEndDialog; 