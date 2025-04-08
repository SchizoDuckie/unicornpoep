/**
 * Defines constants for view component names used for registration and navigation.
 * Maps public-facing view names (keys) to internal component registration names (values).
 */
const Views = Object.freeze({
    // Public Name : Registered Component Name
    MainMenu:           'MainMenuComponent',
    MultiplayerChoice:  'MultiplayerChoiceComponent',
    HostLobby:          'HostLobbyComponent',
    JoinLobby:          'JoinLobbyComponent',
    GameArea:           'GameAreaComponent', // Assuming this is registered name
    Highscores:         'Highscores',
    CustomQuestions:    'CustomQuestionsManager',
    About:              'AboutComponent',
    SheetSelection:     'SheetSelectionComponent',
    Loading:            'LoadingComponent',
    Countdown:          'CountdownComponent',
    PlayerList:         'PlayerListComponent',
});

export default Views;
