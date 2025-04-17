import BaseDialog from './base-dialog.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';


/**
 * Class PracticeEndDialog.
 * 
 * Dialog displayed at the end of a practice game session, providing options
 * to try again or return to the main menu.
 * 
 * @extends BaseDialog
 */
class PracticeEndDialog extends BaseDialog {
    static SELECTOR = '#practiceEndDialog';
    static VIEW_NAME = 'PracticeEndDialog';
    
    static SELECTORS = {
        RESTART_BUTTON: '#practiceTryAgainButton',
        MENU_BUTTON: '#practiceMenuButton'
    };

    /**
     * Initializes component with event handlers and DOM elements.
     * 
     * @return {Object} Configuration for event listeners, DOM events, and DOM elements
     */
    initialize() {
        return {
            domEvents: [
                { 
                    selector: PracticeEndDialog.SELECTORS.RESTART_BUTTON, 
                    event: 'click', 
                    handler: this._handleRestart 
                },
                { 
                    selector: PracticeEndDialog.SELECTORS.MENU_BUTTON, 
                    event: 'click', 
                    handler: this._handleBackToMenu 
                }
            ],
            domElements: [
                {
                    name: 'restartButton',
                    selector: PracticeEndDialog.SELECTORS.RESTART_BUTTON
                },
                {
                    name: 'menuButton',
                    selector: PracticeEndDialog.SELECTORS.MENU_BUTTON
                }
            ]
        };
    }

    /**
     * Handles restart button click.
     * Emits event and hides dialog.
     * 
     * @return void
     * @event Events.UI.EndDialog.RestartPracticeClicked
     * @private
     */
    _handleRestart() {
        console.log("[PracticeEndDialog] Restart clicked.");
        eventBus.emit(Events.UI.EndDialog.RestartPracticeClicked);
        this.hide();
    }

    /**
     * Handles back to menu button click.
     * Emits event and hides dialog.
     * 
     * @return void
     * @event Events.UI.EndDialog.ReturnToMenuClicked
     * @private
     */
    _handleBackToMenu() {
        console.log("[PracticeEndDialog] Back to menu clicked.");
        eventBus.emit(Events.UI.EndDialog.ReturnToMenuClicked);
        this.hide();
    }

    /**
     * Shows the dialog.
     * 
     * @param {Object} results The game results
     * @return void
     */
    show(results) {
        // No need to display score in practice mode
        super.show(results);
    }
}

// Event constants (like Events.UI.EndDialog.PlayAgainClicked) are now defined centrally
// in v2/js/core/event-constants.js

export default PracticeEndDialog; 