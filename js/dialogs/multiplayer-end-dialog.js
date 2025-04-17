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
    
    static SELECTORS = {
        TITLE_DISPLAY: '#multiplayerEndTitle',
        PLAYER_LIST_BODY: '#mpResultsList',
        BACK_BUTTON: '#mpReturnToMenuButton',
        PLAY_AGAIN_BUTTON: '#mpPlayAgainButton',
        PLAYER_TEMPLATE: '#mp-results-row-template'
    };

    /** 
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration object with events, domEvents, and domElements
     */
    initialize() {
        return {
            domEvents: [
                {
                    selector: MultiplayerEndDialog.SELECTORS.BACK_BUTTON,
                    event: 'click',
                    handler: this._handleBackClick
                },
                {
                    selector: MultiplayerEndDialog.SELECTORS.PLAY_AGAIN_BUTTON,
                    event: 'click',
                    handler: this._handlePlayAgainClick
                }
            ],
            domElements: [
                {
                    name: 'titleDisplay',
                    selector: MultiplayerEndDialog.SELECTORS.TITLE_DISPLAY
                },
                {
                    name: 'playerListBody',
                    selector: MultiplayerEndDialog.SELECTORS.PLAYER_LIST_BODY
                },
                {
                    name: 'backButton',
                    selector: MultiplayerEndDialog.SELECTORS.BACK_BUTTON
                },
                {
                    name: 'playAgainButton',
                    selector: MultiplayerEndDialog.SELECTORS.PLAY_AGAIN_BUTTON
                },
                {
                    name: 'playerTemplate',
                    selector: MultiplayerEndDialog.SELECTORS.PLAYER_TEMPLATE,
                    isGlobal: true // Template is not under the component's root element
                }
            ]
        };
    }

    /** 
     * Handles the back to menu button click 
     * @private
     */
    _handleBackClick() {
        console.log(`[${this.name}] Back to menu clicked.`);
        eventBus.emit(Events.UI.MultiplayerEndDialog.Closed);
        this.hide();
    }

    /** 
     * Handles the play again button click 
     * @private
     */
    _handlePlayAgainClick() {
        console.log(`[${this.name}] Play Again clicked.`);
        eventBus.emit(Events.UI.MultiplayerEndDialog.PlayAgainClicked);
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
            if (this.elements.titleDisplay) this.elements.titleDisplay.textContent = 'Error displaying results.';
            if (this.elements.playerListBody) this.elements.playerListBody.innerHTML = '';
            return;
        }

        let winnerText = getTextTemplate('mpEndDraw') || 'It\'s a draw!';
        if (results.winner) {
            const winner = results.winner;
            const name = winner.name || getTextTemplate('mpEndDefaultPlayerName') || `Player ${winner.peerId.slice(-4)}`;
            winnerText = getTextTemplate('mpEndWinnerPrefix', { '%NAME%': name }) || `${name} wint!`; 
        }
        if (this.elements.titleDisplay) this.elements.titleDisplay.textContent = winnerText;

        if (this.elements.playerListBody && this.elements.playerTemplate) {
            this.elements.playerListBody.innerHTML = '';
            const fragment = document.createDocumentFragment();
            results.players.forEach((player, index) => {
                const itemClone = this.elements.playerTemplate.content.cloneNode(true);
                const rankCell = itemClone.querySelector('.rank');
                const nameCell = itemClone.querySelector('.name');
                const scoreCell = itemClone.querySelector('.score');

                if (nameCell) nameCell.textContent = player.name || getTextTemplate('mpEndDefaultPlayerName') || `Player ${player.id.slice(-4)}`;
                if (scoreCell) scoreCell.textContent = player.score;
                if (rankCell) rankCell.textContent = `#${index + 1}`;

                fragment.appendChild(itemClone);
            });
            this.elements.playerListBody.appendChild(fragment);
        } else {
            if (!this.elements.playerListBody) console.error(`[${this.name}] Cannot populate results: List body (#mpResultsList) not found.`);
            if (!this.elements.playerTemplate) console.error(`[${this.name}] Cannot populate results: Template (#mp-results-row-template) not found.`);
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