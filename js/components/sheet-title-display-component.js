import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import questionsManager from '../services/QuestionsManager.js';

/**
 * @class SheetTitleDisplayComponent
 * Displays the title(s) of the currently active question sheet(s).
 * @extends RefactoredBaseComponent
 */
class SheetTitleDisplayComponent extends RefactoredBaseComponent {
    static SELECTOR = '#sheetTitleDisplay';
    static VIEW_NAME = 'SheetTitleDisplayComponent';
    
    /**
     * Initializes the component using the declarative pattern
     * @returns {Object} Configuration object with events and domEvents
     */
    initialize() {
        return {
            events: [
                {
                    eventName: Events.Game.Started,
                    callback: this._handleGameStarted
                },
                {
                    eventName: Events.Game.Finished,
                    callback: this._handleGameFinished
                }
            ]
        };
    }

    /** 
     * Sets the title based on the sheets used in the started game.
     * @param {Object} payload - The Game.Started event payload
     */
    _handleGameStarted = (payload) => {
        let title = 'Spel Gestart'; // Default title
        if (payload && payload.settings && payload.settings.sheetIds && questionsManager) {
            const sheetIds = payload.settings.sheetIds;
            if (sheetIds.length > 0) {
                try {
                    // Get display names for all selected sheets
                    const sheetNames = sheetIds.map(id => questionsManager.getSheetDisplayName(id) || id);
                    title = sheetNames.join(' & '); // Join with & for multiple sheets
                } catch (e) {
                    title = 'Fout bij laden titel';
                }
            }
        }
        this.rootElement.textContent = title;
        this.show();
    }

    /** 
     * Clears the title when the game finishes.
     */
    _handleGameFinished = () => {
        this.rootElement.textContent = '';
        this.hide();
    }

}

export default SheetTitleDisplayComponent; 