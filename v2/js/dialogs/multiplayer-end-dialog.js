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
    /**
     * Creates an instance of MultiplayerEndDialog.
     */
    constructor() {
        super('#multiplayerEndDialog', 'MultiplayerEndDialog');

        // Find result display elements
        this.resultsListBody = this.rootElement.querySelector('#mpResultsList');
        this.rowTemplate = this.rootElement.querySelector('#mp-results-row-template');
        this.returnButton = this.rootElement.querySelector('#mpReturnToMenuButton');

        if (!this.resultsListBody || !this.rowTemplate || !this.returnButton) {
            throw new Error(`[${this.name}] Missing required child elements (#mpResultsList, #mp-results-row-template, #mpReturnToMenuButton).`);
        }

        this._bindMethods();
        this._addEventListeners();

        // Listen for the game to finish
        this.listen(Events.Game.Finished, this.handleGameFinished);

        console.log(`[${this.name}] Initialized.`);
    }

    /** Binds component methods to the class instance. */
    _bindMethods() {
        this.handleGameFinished = this.handleGameFinished.bind(this);
        this.handleReturnClick = this.handleReturnClick.bind(this);
    }

    /** Adds DOM event listeners. */
    _addEventListeners() {
        this.returnButton.addEventListener('click', this.handleReturnClick);
    }

    /** Removes DOM event listeners. */
    _removeEventListeners() {
        // Assuming element exists because constructor throws if it doesn't
        this.returnButton.removeEventListener('click', this.handleReturnClick);
    }

    /**
     * Handles the Game.Finished event.
     * If the mode is 'multiplayer', displays the ranked results and shows the dialog.
     * @param {object} payload - Event payload.
     * @param {'single' | 'multiplayer' | 'practice'} payload.mode
     * @param {object} payload.results - Game results.
     * @param {Map<string, {name: string, score: number}>} [payload.results.playerScores] - Map of peerId -> {name, score}.
     * @param {Array<object>} [payload.results.rankings] - Alternatively, pre-ranked array [{rank, name, score}].
     * @private
     */
    handleGameFinished({ mode, results }) {
        if (mode === 'multiplayer') {
            console.log(`[${this.name}] Displaying multiplayer results:`, results);
            
            // Determine player results - use rankings if provided, otherwise calculate from scores
            let rankedPlayers = [];
            if (Array.isArray(results.rankings)) {
                rankedPlayers = results.rankings;
            } else if (results.playerScores instanceof Map) {
                 // Convert Map to array and sort by score descending
                 rankedPlayers = Array.from(results.playerScores.values())
                    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                    .map((player, index) => ({ 
                        rank: index + 1, 
                        name: player.name || getTextTemplate('mpEndDefaultPlayerName'), 
                        score: player.score ?? 0 
                    }));
            } else {
                 console.error(`[${this.name}] Invalid or missing player results data. Cannot display.`);
                 this.resultsListBody.innerHTML = `<tr><td colspan="3">${getTextTemplate('mpEndLoadError')}</td></tr>`;
                 this.show();
                 return;
            }

            // Populate the table
            this.resultsListBody.innerHTML = ''; // Clear previous entries

            if (rankedPlayers.length === 0) {
                 this.resultsListBody.innerHTML = `<tr><td colspan="3">${getTextTemplate('mpEndNoData')}</td></tr>`;
            } else {
                rankedPlayers.forEach(player => {
                    const templateClone = this.rowTemplate.content.cloneNode(true);
                    const rowElement = templateClone.querySelector('tr');
                    
                    rowElement.querySelector('.rank').textContent = player.rank;
                    rowElement.querySelector('.name').textContent = player.name;
                    rowElement.querySelector('.score').textContent = player.score;
                    
                    // Optional: Highlight local player?
                    // if (player.peerId === webRTCManager.getMyPeerId()) { rowElement.classList.add('local-player'); }
                    
                    this.resultsListBody.appendChild(rowElement);
                });
            }
            
            this.show(); // Show the dialog
        }
    }

    /** Handles the return to menu button click. */
    handleReturnClick() {
        console.log(`[${this.name}] Return to menu clicked.`);
        eventBus.emit(Events.UI.EndDialog.ReturnToMenuClicked);
        this.hide(); // Close the dialog
    }

    // Override destroy to ensure listeners are removed
    destroy() {
         console.log(`[${this.name}] Destroying...`);
         this._removeEventListeners(); 
         super.destroy();
    }
}

export default MultiplayerEndDialog; 