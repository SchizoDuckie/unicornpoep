import RefactoredBaseComponent from './RefactoredBaseComponent.js';
import eventBus from '../core/event-bus.js';
import Events from '../core/event-constants.js';
import Views from '../core/view-constants.js';

/**
 * @class MainMenuComponent
 * @extends RefactoredBaseComponent
 * Manages the main menu buttons and navigation using declarative event patterns.
 */
class MainMenuComponent extends RefactoredBaseComponent {
    static SELECTOR = '#mainMenu';
    static VIEW_NAME = 'MainMenuComponent';

    static SELECTORS = {
        PRACTICE_BUTTON: '#practice',
        SINGLE_PLAYER_BUTTON: '#takeTest',
        HOST_GAME_BUTTON: '#hostGame',
        JOIN_GAME_BUTTON: '#joinGame',
        CUSTOM_QUESTIONS_BUTTON: '#myQuestions',
        HIGHSCORES_BUTTON: '#viewHighscores',
        ABOUT_BUTTON: '#hoeDan'
    };

    /**
     * Initializes the component using declarative event mappings.
     * @returns {Object} Configuration object for BaseComponent.
     */
    initialize() {
        return {
            events: [
                {
                     eventName: Events.UI.MainMenu.Show,
                     callback: this.hideAllAndShow
                },
            ],
            domEvents: [
                // Simple event emitters (single event)
                { 
                    selector: MainMenuComponent.SELECTORS.PRACTICE_BUTTON, 
                    event: 'click', 
                    emits: Events.UI.MainMenu.StartPracticeClicked,
                },
                { 
                    selector: MainMenuComponent.SELECTORS.SINGLE_PLAYER_BUTTON, 
                    event: 'click', 
                    emits: Events.UI.MainMenu.SinglePlayerClicked,
                    
                },
                { 
                    selector: MainMenuComponent.SELECTORS.JOIN_GAME_BUTTON, 
                    event: 'click', 
                    handler: this._handleJoinGameClick // Use a direct handler
                },
                {
                    selector: MainMenuComponent.SELECTORS.HOST_GAME_BUTTON, 
                    event: 'click', 
                    emits: Events.UI.MainMenu.HostMultiplayerClicked
                },
                { 
                    selector: MainMenuComponent.SELECTORS.CUSTOM_QUESTIONS_BUTTON, 
                    event: 'click', 
                    handler: this._handleCustomQuestionsClick 
                },
                { 
                    selector: MainMenuComponent.SELECTORS.HIGHSCORES_BUTTON, 
                    event: 'click', 
                    handler: this._handleHighscoresClick 
                },
                { 
                    selector: MainMenuComponent.SELECTORS.ABOUT_BUTTON, 
                    event: 'click', 
                    handler: this._handleAboutClick 
                },
            ]
        };
    }
    
    hideAllAndShow() {
        eventBus.emit(Events.UI.HideAllViews);
        this.show();
    }

    /**
     * Handles click on host multiplayer button - emits action event and navigates
     * @private
     */
    _handleMultiplayerClick(event) {
        event.preventDefault();
        eventBus.emit(Events.UI.HideAllViews);
        eventBus.emit( Events.UI.MainMenu.JoinMultiplayerClicked);
    }
    
    /**
     * Handles click on custom questions button - emits action event and navigates
     * @private
     */
    _handleCustomQuestionsClick(event) {
        eventBus.emit(Events.UI.HideAllViews);
       // eventBus.emit(Events.UI.MainMenu.CustomQuestionsClicked);
        eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.CustomQuestions 
        });
    }
    
    /**
     * Handles click on highscores button - emits action event and navigates with data
     * @private
     */
    _handleHighscoresClick(event) {
        eventBus.emit(Events.UI.HideAllViews);
        
        eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.Highscores, 
            data: { loadImmediately: true } 
        });
    }
    
    /**
     * Handles click on about button - emits action event and navigates
     * @private
     */
    _handleAboutClick(event) {
        eventBus.emit(Events.UI.HideAllViews);;
       // eventBus.emit(Events.UI.MainMenu.AboutClicked);
        eventBus.emit(Events.Navigation.ShowView, { 
            viewName: Views.About 
        });
    }

    /**
     * Handles click on join game button - emits action event and navigates
     * @private
     */
    _handleJoinGameClick(event) {
        eventBus.emit(Events.UI.HideAllViews);

        // Emit the event with a proper payload object containing viewName
        eventBus.emit(Events.UI.MainMenu.JoinGameClicked, {
            viewName: 'JoinLobbyComponent'
        });
    }
}

export default MainMenuComponent; 