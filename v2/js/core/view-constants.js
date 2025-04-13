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
    Highscores:         'HighscoresComponent',
    CustomQuestions:    'CustomQuestionsComponent',
    About:              'AboutComponent',
    SheetSelection:     'SheetSelectionComponent',
    Loading:            'LoadingComponent',
    Countdown:          'CountdownComponent',
    PlayerList:         'PlayerListComponent',
    MultiplayerLobby:   'MultiplayerLobbyDialog',
    // Dialogs (used sometimes like views via ShowView)
    SinglePlayerEndDialog: 'SinglePlayerEndDialog',
    MultiplayerEndDialog:  'MultiplayerEndDialog',
    PracticeEndDialog:     'PracticeEndDialog',
    NamePromptDialog:      'NamePromptDialog',
    DisconnectionDialog:   'DisconnectionDialog',
    ErrorDialog:           'ErrorDialog',
    ConfirmationDialog:    'ConfirmationDialog',
    WaitingDialog:         'WaitingDialog',
});

export default Views;
