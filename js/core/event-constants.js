/**
 * Core application events namespace.
 * Use these constants when calling `eventBus.on()` or `eventBus.emit()`.
 * Rigorously document the payload structure for each event using JSDoc.
 * @namespace Events
 */
const Events = {
    /**
     * System and general application events.
     * @namespace Events.System
     */
    System: {
        /**
         * Fired when a significant error occurs that needs reporting or handling.
         * @event Events.System.ErrorOccurred
         * @type {object}
         * @property {string} message - User-friendly error message.
         * @property {Error} [error] - The original Error object, if available.
         * @property {string} [context] - Optional context where the error occurred (e.g., 'WebRTC Connection').
         */
        ErrorOccurred: 'Events.System.ErrorOccurred',
        /**
         * Fired when a major application state transition occurs (e.g., view change).
         * @event Events.System.StateChange
         * @type {object}
         * @property {string} newState - Identifier of the new state/view.
         * @property {string} oldState - Identifier of the previous state/view.
         */
        StateChange: 'Events.System.StateChange',
        /**
         * Request to show transient feedback to the user (e.g., a toast notification).
         * @event Events.System.ShowFeedback
         * @type {object}
         * @property {string} message - The feedback message.
         * @property {'info'|'success'|'warn'|'error'} level - Severity level.
         * @property {number} [duration] - Optional display duration in milliseconds.
         */
        ShowFeedback: 'Events.System.ShowFeedback',
        /**
         * Request to show the global loading indicator.
         * @event Events.System.LoadingStart
         * @type {object} [payload]
         * @property {string} [payload.message] - Optional message to display (e.g., "Connecting...").
         */
        LoadingStart: 'Events.System.LoadingStart',
        /**
         * Request to hide the global loading indicator.
         * @event Events.System.LoadingEnd
         * @type {object} - Payload is typically empty.
         */
        LoadingEnd: 'Events.System.LoadingEnd',
        /**
         * Fired by UIManager when a valid 6-digit join code is detected in the URL parameters (?join=...).
         * Listened for by components responsible for initiating the join flow (e.g., GameCoordinator).
         * @event Events.System.ValidJoinCodeDetected
         * @type {object}
         * @property {string} code - The 6-digit join code detected.
         */
        ValidJoinCodeDetected: 'Events.System.ValidJoinCodeDetected',
        /**
         * Fired when the application is fully initialized and ready to use.
         * @event Events.System.AppInitialized
         * @type {object} - Payload is typically empty.
         */
        AppInitialized: 'Events.System.AppInitialized',
        /**
         * Fired when the application is waiting for user interaction.
         * @event Events.System.ShowWaitingDialog
         * @type {object} - Payload is typically empty.
         */
        ShowWaitingDialog: 'Events.System.ShowWaitingDialog',
        /**
         * Request to hide the waiting dialog.
         * @event Events.System.HideWaitingDialog
         * @type {object} - Payload is typically empty.
         */
        HideWaitingDialog: 'Events.System.HideWaitingDialog',
    },
    /**
     * Events related to application navigation and view management.
     * @namespace Events.Navigation
     */
    Navigation: {
        /**
         * Request to show a specific application view/component.
         * @event Events.Navigation.ShowView
         * @type {object}
         * @property {string} viewName - The identifier of the view to show (e.g., 'MainMenu', 'GameArea', 'HostLobby').
         * @property {any} [data] - Optional data to pass to the view upon showing.
         */
        ShowView: 'Events.Navigation.ShowView',
    },
    /**
     * Lifecycle events emitted by BaseComponent instances.
     * @namespace Events.Component
     */
    Component: {
        /**
         * Fired *by BaseComponent* after a component instance is constructed and basic setup is complete.
         * @event Events.Component.Initialized
         * @type {object}
         * @property {import('../components/base-component.js').BaseComponent} component - The component instance that was initialized.
         * @property {string} componentName - The name/identifier of the component.
         */
        Initialized: 'Events.Component.Initialized',
        /**
         * Fired *by BaseComponent* when a component's root element is shown (e.g., 'hidden' class removed).
         * @event Events.Component.Shown
         * @type {object}
         * @property {import('../components/base-component.js').BaseComponent} component - The component instance that was shown.
         * @property {string} componentName - The name/identifier of the component.
         */
        Shown: 'Events.Component.Shown',
        /**
         * Fired *by BaseComponent* when a component's root element is hidden (e.g., 'hidden' class added).
         * @event Events.Component.Hidden
         * @type {object}
         * @property {import('../components/base-component.js').BaseComponent} component - The component instance that was hidden.
         * @property {string} componentName - The name/identifier of the component.
         */
        Hidden: 'Events.Component.Hidden',
        /**
         * Fired *by BaseComponent* just before a component is destroyed and listeners are cleaned up.
         * @event Events.Component.Destroyed
         * @type {object}
         * @property {import('../components/base-component.js').BaseComponent} component - The component instance being destroyed.
         * @property {string} componentName - The name/identifier of the component.
         */
        Destroyed: 'Events.Component.Destroyed',
    },
    /**
     * General game-related events, applicable across different modes.
     * @namespace Events.Game
     */
    Game: {
         /**
          * Request to start a new game. Handled by GameCoordinator.
          * @event Events.Game.StartRequested
          * @type {object}
          * @property {'single' | 'multiplayer-host' | 'multiplayer-join' | 'practice'} mode - The requested game mode.
          * @property {object} [settings] - Game settings (e.g., sheet ID, difficulty). Specific structure depends on mode.
          * @property {string} [hostId] - Required for 'multiplayer-join' mode.
          * @property {string} [playerName] - Player's chosen name.
          */
         StartRequested: 'Events.Game.StartRequested',
        /**
         * Fired by the active Game Mode class when a game has successfully started and is ready.
         * @event Events.Game.Started
         * @type {object}
         * @property {'single' | 'multiplayer' | 'practice'} mode - The mode of the game that started.
         * @property {object} settings - The final settings used for the game.
         */
        Started: 'Events.Game.Started',
        /**
         * Fired by the active Game Mode class when a game finishes.
         * @event Events.Game.Finished
         * @type {object}
         * @property {'single' | 'multiplayer' | 'practice'} mode - The mode of the game that finished.
         * @property {object} results - Game results (e.g., score, rankings). Structure varies by mode.
         */
        Finished: 'Events.Game.Finished',
        /**
         * Fired by the active Game Mode class (using QuizEngine) when a new question is presented.
         * @event Events.Game.QuestionNew
         * @type {object}
         * @property {number} questionIndex - 0-based index of the current question.
         * @property {number} totalQuestions - Total number of questions in the quiz.
         * @property {object} questionData - The question details.
         * @property {string} questionData.question - The question text.
         * @property {string[]} questionData.answers - Shuffled array of possible answers.
         */
        QuestionNew: 'Events.Game.QuestionNew',
        /**
         * Fired *by the QuizEngine* after checking a submitted answer.
         * @event Events.Game.AnswerChecked
         * @type {object}
         * @property {boolean} isCorrect - Whether the submitted answer was correct.
         * @property {number} scoreDelta - Change in score resulting from this answer.
         * @property {string} correctAnswer - The correct answer text.
         * @property {any} submittedAnswer - The answer submitted by the player.
         */
        AnswerChecked: 'Events.Game.AnswerChecked',
        /**
         * Fired when the player's score is updated. Emitted by the active Game Mode class.
         * @event Events.Game.ScoreUpdated
         * @type {object}
         * @property {number} totalScore - The new total score for the player.
         * @property {string} [playerId] - Identifier for the player whose score updated (relevant in MP). If omitted, assumes local player.
         */
        ScoreUpdated: 'Events.Game.ScoreUpdated',
        /**
         * Fired periodically by a timer during the game.
         * @event Events.Game.TimeTick
         * @type {object}
         * @property {number} remainingTime - Remaining time in **milliseconds**.
         * @property {string} [timerId] - Optional identifier if multiple timers exist.
         */
        TimeTick: 'Events.Game.TimeTick',
         /**
         * Fired when a game timer runs out.
         * @event Events.Game.TimeUp
         * @type {object}
         * @property {string} [timerId] - Optional identifier if multiple timers exist.
         */
        TimeUp: 'Events.Game.TimeUp',
         /**
         * Fired *by the QuizEngine* when all questions have been answered.
         * @event Events.Game.AllQuestionsAnswered
         * @type {object}
         * @property {number} finalScore - The final score achieved in the quiz round.
         */
        AllQuestionsAnswered: 'Events.Game.AllQuestionsAnswered',
        /**
         * Fired to initiate the pre-game countdown display.
         * @event Events.Game.CountdownStart
         * @type {object}
         * @property {number} [duration=5] - Duration of the countdown in seconds.
         */
        CountdownStart: 'Events.Game.CountdownStart',
        /**
         * Fired by a multiplayer client game instance when it has finished its quiz.
         * Listened for by GameCoordinator.
         * @event Events.Game.LocalPlayerFinished
         * @type {object}
         * @property {number} score - The final score achieved by the local client.
         */
        LocalPlayerFinished: 'Events.Game.LocalPlayerFinished',
        /**
         * Fired when a game is prematurely stopped or aborted by the user or system.
         * @event Events.Game.Aborted
         * @type {object}
         * @property {string} reason - Optional reason for the abortion.
         */
        Aborted: 'Events.Game.Aborted'
    },
    /**
     * Events specific to multiplayer mode.
     * @namespace Events.Multiplayer
     */
    Multiplayer: {
        /** @namespace Events.Multiplayer.Host */
        Host: {
            /**
             * Fired when the host initializes the PeerJS connection and obtains its ID.
             * @event Events.Multiplayer.Host.Initialized
             * @type {object}
             * @property {string} hostId - The 6-digit code used as the host's PeerJS ID.
             */
            Initialized: 'Events.Multiplayer.Host.Initialized',
            /**
             * Fired by WebRTCManager on the host when a client successfully connects.
             * @event Events.Multiplayer.Host.ClientConnected
             * @type {object}
             * @property {string} peerId - The PeerJS ID of the connected client.
             * @property {string} playerName - The name provided by the client.
             */
            ClientConnected: 'Events.Multiplayer.Host.ClientConnected',
            /**
             * Fired by WebRTCManager on the host when a client disconnects.
             * @event Events.Multiplayer.Host.ClientDisconnected
             * @type {object}
             * @property {string} peerId - The PeerJS ID of the disconnected client.
             */
            ClientDisconnected: 'Events.Multiplayer.Host.ClientDisconnected',
            /**
             * Fired by the HostLobby component just before initiating the game start process.
             * Typically triggers the creation/start of the MultiplayerGame instance.
             * @event Events.Multiplayer.Host.GameStarting
             * @type {object}
             * @property {object} settings - The final game settings selected by the host.
             * @property {string} playerName - The host's player name.
             */
            GameStarting: 'Events.Multiplayer.Host.GameStarting',
            /**
             * Fired by MultiplayerGame (Host) when a valid answer is received from a specific client.
             * This occurs *before* round results are processed.
             * @event Events.Multiplayer.Host.PlayerAnswered
             * @type {object}
             * @property {string} peerId - The PeerJS ID of the client who answered.
             * @property {object} answerData - The answer payload received from the client.
             * @property {any} answerData.answer - The submitted answer.
             * @property {number} answerData.questionIndex - The index of the question answered.
             */
            PlayerAnswered: 'Events.Multiplayer.Host.PlayerAnswered',
             /**
             * Fired by MultiplayerGame (Host) when all currently connected players
             * have submitted an answer for the ongoing question round.
             * @event Events.Multiplayer.Host.AllPlayersAnswered
             * @type {object} - Payload is typically empty.
             */
            AllPlayersAnswered: 'Events.Multiplayer.Host.AllPlayersAnswered',
             /**
             * Fired by MultiplayerGame (Host) when a host-specific error occurs during game setup or progression.
             * Listened for by host UI components to display targeted error messages.
             * @event Events.Multiplayer.Host.ErrorOccurred
             * @type {object}
             * @property {string} errorKey - The key corresponding to a text template for the error message (e.g., 'mpHostErrorNoQuestions').
             * @property {string} [originalMessage] - The underlying error message, if applicable (e.g., from a catch block).
             * @property {number} [index] - Relevant index if error relates to a specific question (e.g., 'mpHostErrorNextQPrefix').
             */
            ErrorOccurred: 'Events.Multiplayer.Host.ErrorOccurred',
            /**
             * Fired by MultiplayerGame (Host) when the host finishes their local quiz
             * but is waiting for one or more clients to finish.
             * Listened for by UI/Coordinator to display a waiting message for the host.
             * @event Events.Multiplayer.Host.HostWaiting
             * @type {object} - Payload is typically empty, but could include IDs of waiting clients.
             */
            HostWaiting: 'Events.Multiplayer.Host.HostWaiting',
            RematchReady: 'Events.Multiplayer.Host.RematchReady'
        },
        /** @namespace Events.Multiplayer.Client */
        Client: {
            /**
             * Fired by WebRTCManager on the client when successfully connected to the host.
             * @event Events.Multiplayer.Client.ConnectedToHost
             * @type {object}
             * @property {string} hostId - The PeerJS ID of the host.
             */
            ConnectedToHost: 'Events.Multiplayer.Client.ConnectedToHost',
             /**
             * Fired by WebRTCManager on the client when disconnected from the host.
             * @event Events.Multiplayer.Client.DisconnectedFromHost
             * @type {object} - Payload might be empty or contain a reason string.
             * @property {string} [reason] - Optional reason for disconnection.
             */
            DisconnectedFromHost: 'Events.Multiplayer.Client.DisconnectedFromHost',
             /**
             * Fired on the client when receiving initial game info from the host (before game start).
             * Typically emitted by WebRTCManager upon receiving a specific message type.
             * @event Events.Multiplayer.Client.GameInfoReceived
             * @type {object}
             * @property {object} settings - Game settings chosen by the host.
             * @property {Map<string, object>} players - Map of currently connected players (peerId -> playerData: { name: string, score: number, isFinished: boolean }).
             */
            GameInfoReceived: 'Events.Multiplayer.Client.GameInfoReceived',
            /**
             * Fired by MultiplayerClientManager when the host sends the H_COMMAND_GAME_OVER message.
             * This signals that the host has determined the game is over and has sent final results.
             * Listened for by MultiplayerClientGame to trigger its local game over sequence.
             * @event Events.Multiplayer.Client.GameOverCommandReceived
             * @type {object}
             * @property {object} results - The final game results payload sent by the host.
             */
            GameOverCommandReceived: 'Events.Multiplayer.Client.GameOverCommandReceived',
            /**
             * Fired by the JoinLobby component when the client initiates the connection attempt to the host.
             * Listened for primarily by WebRTCManager to start the PeerJS connection.
             * @event Events.Multiplayer.Client.Connecting
             * @type {object}
             * @property {string} hostId - The host PeerJS ID the client is attempting to connect to.
             * @property {string} playerName - The name the client is using.
             */
            Connecting: 'Events.Multiplayer.Client.Connecting',
            /**
             * Fired by the client when it is ready to start the multiplayer game (after confirming join and preparing QuizEngine).
             * @event Events.Multiplayer.Client.ReadyToStart
             * @type {object}
             * @property {string} playerName - The name of the player.
             * @property {string} hostId - The PeerJS ID of the host.
             * @property {object} questionsData - The questions data structure ({ sheets: [...] }).
             * @property {string} difficulty - The selected difficulty.
             * @property {object} settings - Additional game settings.
             */
            ReadyToStart: 'Events.Multiplayer.Client.ReadyToStart',
            /**
             * Fired by MultiplayerClientManager when an attempt to initiate a connection fails before connection is established.
             * @event Events.Multiplayer.Client.JoinFailed
             * @type {object}
             * @property {string} reason - Reason for the failure (e.g., 'Connection already active', 'Invalid code format').
             */
            JoinFailed: 'Events.Multiplayer.Client.JoinFailed',
        },
        /** @namespace Events.Multiplayer.Common */
        Common: {
            /**
             * Fired for all peers (host and clients) when a new player joins the session.
             * Typically emitted by WebRTCManager based on connection events or messages.
             * @event Events.Multiplayer.Common.PlayerJoined
             * @type {object}
             * @property {string} peerId - The PeerJS ID of the player who joined.
             * @property {object} playerData - Initial data for the joined player (e.g., { name: string }).
             */
            PlayerJoined: 'Events.Multiplayer.Common.PlayerJoined',
            /**
             * Fired for all peers when a player leaves the session.
             * Typically emitted by WebRTCManager based on disconnection events or messages.
             * @event Events.Multiplayer.Common.PlayerLeft
             * @type {object}
             * @property {string} peerId - The PeerJS ID of the player who left.
             */
            PlayerLeft: 'Events.Multiplayer.Common.PlayerLeft',
            /**
             * Fired for all peers when a player's data (e.g., score, status) is updated.
             * Typically emitted by WebRTCManager upon receiving a specific message type.
             * @event Events.Multiplayer.Common.PlayerUpdated
             * @type {object}
             * @property {string} peerId - The PeerJS ID of the player whose data changed.
             * @property {object} updatedData - The specific fields that were updated (e.g., { score: 100, isFinished: true }).
             */
            PlayerUpdated: 'Events.Multiplayer.Common.PlayerUpdated',
             /**
             * Fired when the overall list of players needs updating.
             * Often triggered *by UI components* (like PlayerListComponent) listening to PlayerJoined/PlayerLeft/PlayerUpdated.
             * @event Events.Multiplayer.Common.PlayerListUpdated
             * @type {object}
             * @property {Map<string, object>} players - The complete, current map of players (peerId -> playerData: { name: string, score: number, isFinished: boolean }).
             */
            PlayerListUpdated: 'Events.Multiplayer.Common.PlayerListUpdated',
            /**
             * Used for sending potentially large or complete game state snapshots for synchronization.
             * Emitted by the host's MultiplayerGame instance, received by WebRTCManager on clients.
             * @event Events.Multiplayer.Common.GameStateSync
             * @type {object}
             * @property {object} state - The full or partial game state object to sync.
             */
            GameStateSync: 'Events.Multiplayer.Common.GameStateSync',
            /**
             * Request sent *to WebRTCManager* to broadcast a message to all connected peers (or specific peers).
             * @event Events.Multiplayer.Common.SendMessage
             * @type {object}
             * @property {object} message - The message payload to send.
             * @property {string|string[]} [targetPeerIds] - Optional. If provided, send only to these peer IDs. If omitted, broadcast to all.
             */
            SendMessage: 'Events.Multiplayer.Common.SendMessage',
            /**
             * Fired when game data (like state or player updates) is received from another peer.
             * Emitted by WebRTCManager.
             * @event Events.Multiplayer.Common.DataReceived
             * @type {object}
             * @property {string} peerId - The PeerJS ID of the sender.
             * @property {string} type - The type of message received (e.g., 'gameState', 'playerUpdate', 'chat').
             * @property {any} payload - The data payload. Structure depends on the message type.
             */
            DataReceived: 'Events.Multiplayer.Common.DataReceived',
        },
        /**
         * Fired by MultiplayerGame (Host) when the host finishes their local quiz
         * but is waiting for one or more clients to finish.
         * Listened for by GameCoordinator to display the waiting UI for the host.
         * @event Events.Multiplayer.HostWaiting
         * @type {object}
         * @property {string} messageKey - Localization key for the waiting message (e.g., 'mpHostWaitOthers').
         */
        HostWaiting: 'Events.Multiplayer.HostWaiting',
        /**
         * Fired when a multiplayer game session is started (typically by the host).
         * @event Events.Multiplayer.GameStarted
         * @type {object}
         * @property {object} gameData - Initial game state/data from the host.
         */
        GameStarted: 'Events.Multiplayer.GameStarted',
        /**
         * Fired when a participant disconnects or is removed from the multiplayer session.
         * @event Events.Multiplayer.Disconnected
         * @type {object}
         * @property {string} peerId - The ID of the peer who disconnected.
         * @property {string} [reason] - Optional reason for disconnection (e.g., 'left', 'error', 'timeout').
         */
        Disconnected: 'Events.Multiplayer.Disconnected'
    },
    /**
     * Events generated BY UI components interacting with the user.
     * @namespace Events.UI
     */
    UI: {
        /**
         * Fired to hide all views and start the ui with a clean slate.
         * @event Events.UI.HideAllViews
         */
        HideAllViews: 'Events.UI.HideAllViews',
        /** @namespace Events.UI.MainMenu */
        MainMenu: {
            /**
             * Fired when the mainmenu needs to be shown.
             * @event Events.UI.MainMenu.Show
             */
            Show: 'Events.UI.MainMenu.Show',
            /**
             * Fired when the player clicks the Single Player button in the main menu.
             * @event Events.UI.MainMenu.StartSinglePlayerClicked
             */
            StartSinglePlayerClicked: 'Events.UI.MainMenu.StartSinglePlayerClicked',
            /**
             * Fired when the player clicks the Single Player button in the main menu.
             * @event Events.UI.MainMenu.SinglePlayerClicked
             */
            SinglePlayerClicked: 'Events.UI.MainMenu.SinglePlayerClicked',
            /**
             * Fired when the player clicks the Practice button in the main menu.
             * @event Events.UI.MainMenu.StartPracticeClicked
             */
            StartPracticeClicked: 'Events.UI.MainMenu.StartPracticeClicked',
            /**
             * Fired when the player clicks the Multiplayer button in the main menu.
             * @event Events.UI.MainMenu.JoinMultiplayerClicked
             */
            JoinMultiplayerClicked: 'Events.UI.MainMenu.JoinMultiplayerClicked',
            /**
             * Fired when the player clicks the Create Game button in the main menu.
             * @event Events.UI.MainMenu.CreateGameClicked
             */
            HostMultiplayerClicked: 'Events.UI.MainMenu.HostMultiplayerClicked',
            /**
             * Fired when the player clicks the Join Game button in the main menu.
             * @event Events.UI.MainMenu.JoinGameClicked
             */
            JoinGameClicked: 'Events.UI.MainMenu.JoinGameClicked',
            /**
             * Fired when the player clicks the Highscores button in the main menu.
             * @event Events.UI.MainMenu.HighscoresClicked
             */
            HighscoresClicked: 'Events.UI.MainMenu.HighscoresClicked',

            // Add other main menu button events as needed
        },
         /** @namespace Events.UI.GameSetup */
        GameSetup: {
            /**
             * Fired when the player clicks the Start Game button in the game setup screen.
             * @event Events.UI.GameSetup.StartGameClicked
             * @type {object}
             * @property {string} difficulty - Selected difficulty level
             * @property {number} questionCount - Number of questions for the game
             * @property {string[]} categories - Selected question categories
             * @property {string} playerName - Player's name
             */
            StartGameClicked: 'Events.UI.GameSetup.StartGameClicked',
            
            /**
             * Fired when the player clicks the Cancel button in the game setup screen.
             * @event Events.UI.GameSetup.CancelSetupClicked
             */
            CancelSetupClicked: 'Events.UI.GameSetup.CancelSetupClicked'
        },
         /** @namespace Events.UI.GameArea */
        GameArea: {
            /**
             * Fired when the player submits an answer.
             * @event Events.UI.GameArea.AnswerSubmitted
             * @type {object}
             * @property {string} answer - The answer selected by the player.
             */
            AnswerSubmitted: 'Events.UI.GameArea.AnswerSubmitted',
            
            /**
             * Fired when the player clicks the leave game button.
             * @event Events.UI.GameArea.LeaveGameClicked
             */
            LeaveGameClicked: 'Events.UI.GameArea.LeaveGameClicked'
        },
         /** @namespace Events.UI.Dialog */
        Dialog: {
            /**
             * Fired when the user confirms their name in the name prompt dialog.
             * @event Events.UI.Dialog.NameConfirmed
             * @type {object}
             * @property {string} name - The entered name.
             */
            NameConfirmed: 'Events.UI.Dialog.NameConfirmed',
             /**
             * Fired when a generic confirmation dialog is accepted.
             * @event Events.UI.Dialog.GenericConfirm
             * @type {object}
             * @property {string} dialogId - Identifier for the dialog being confirmed.
             * @property {any} [value] - Optional value associated with the confirmation.
             */
            GenericConfirm: 'Events.UI.Dialog.GenericConfirm',
            /**
             * Fired when a generic confirmation dialog is cancelled.
             * @event Events.UI.Dialog.GenericCancel
             * @type {object}
             * @property {string} dialogId - Identifier for the dialog being cancelled.
             */
            GenericCancel: 'Events.UI.Dialog.GenericCancel',

            /**
             * Request to show the name prompt dialog.
             * Emitted by components needing the user's name before proceeding (e.g., MultiplayerChoiceComponent).
             * Listened for by NamePromptDialog.
             * @event Events.UI.Dialog.NamePromptRequested
             * @type {object} - Payload is typically empty, but could carry context if needed.
             */
            NamePromptRequested: 'Events.UI.Dialog.NamePromptRequested',

             /**
              * Fired by SinglePlayerEndDialog when the save button is clicked.
              * Listened for by HighscoreManager.
              * @event Events.UI.Dialog.SaveScoreClicked
              * @type {object}
              * @property {string} name - The player name entered.
              * @property {number} score - The score achieved.
              */
             SaveScoreClicked: 'Events.UI.Dialog.SaveScoreClicked',
        },
        /** @namespace Events.UI.MultiplayerChoice */
        MultiplayerChoice: {
            /**
             * Emitted when user clicks Host Game in multiplayer choice.
             * @event Events.UI.MultiplayerChoice.HostClicked
             * @type {object}
             * @property {string} [playerName] - Player name if already provided.
             */
            HostClicked: 'Events.UI.MultiplayerChoice.HostClicked',
            /**
             * Emitted when user clicks Join Game in multiplayer choice.
             * @event Events.UI.MultiplayerChoice.JoinClicked
             * @type {object}
             * @property {string} [playerName] - Player name if already provided.
             */
            JoinClicked: 'Events.UI.MultiplayerChoice.JoinClicked'
        },
        /** @namespace Events.UI.JoinLobby */
        JoinLobby: {
            /**
             * Emitted when user submits a connection code in the join lobby.
             * @event Events.UI.JoinLobby.SubmitCodeClicked
             * @type {object}
             * @property {string} code - The 6-digit connection code.
             * @property {string} playerName - The player's name.
             */
            SubmitCodeClicked: 'Events.UI.JoinLobby.SubmitCodeClicked',
            /**
             * Emitted when user confirms joining after seeing game info.
             * @event Events.UI.JoinLobby.ConfirmClicked
             * @type {object}
             * @property {string} playerName - The player's name, potentially changed in confirmation.
             */
            ConfirmClicked: 'Events.UI.JoinLobby.ConfirmClicked',
            /**
             * Emitted when user cancels joining from any join lobby view.
             * @event Events.UI.JoinLobby.CancelClicked
             */
            CancelClicked: 'Events.UI.JoinLobby.CancelClicked',
            /**
             * Emitted when there's an error during the join process.
             * @event Events.UI.JoinLobby.Error
             * @type {object}
             * @property {string} message - The error message to display.
             */
            Error: 'Events.UI.JoinLobby.Error',
            /**
             * Emitted by MultiplayerClientCoordinator when the host signals the game is starting.
             * Listened for by JoinLobbyComponent to trigger navigation to the game area.
             * @event Events.UI.JoinLobby.HostHasStartedGame
             * @type {object}
             * @property {object} gameData - The game data received from the host needed for navigation.
             */
            HostHasStartedGame: 'Events.UI.JoinLobby.HostHasStartedGame',
        },
         /** @namespace Events.UI.HostLobby */
        HostLobby: {
            /**
             * Emitted when host clicks Start Game in the host lobby.
             * @event Events.UI.HostLobby.StartGameClicked
             */
            StartGameClicked: 'Events.UI.HostLobby.StartGameClicked',
            /**
             * Emitted when host cancels hosting from the host lobby.
             * @event Events.UI.HostLobby.CancelClicked
             */
            CancelClicked: 'Events.UI.HostLobby.CancelClicked',
            /**
             * Emitted when the host copies the join code.
             * @event Events.UI.HostLobby.CodeCopied
             */
            CodeCopied: 'Events.UI.HostLobby.CodeCopied',
            /**
             * Emitted when the host copies the join link.
             * @event Events.UI.HostLobby.LinkCopied
             */
            LinkCopied: 'Events.UI.HostLobby.LinkCopied'
        },
         /** @namespace Events.UI.MultiplayerLobby */
        MultiplayerLobby: {
            /** Fired when the client clicks the "Leave Lobby" button. */
            LeaveClicked: 'Events.UI.MultiplayerLobby.LeaveClicked',
         },
         /** @namespace Events.UI.EndDialog */
        EndDialog: {
            /** Fired when the user clicks "Play Again" in any end dialog. */
            PlayAgainClicked: 'Events.UI.EndDialog.PlayAgainClicked',
            /** Fired when the user clicks "Return to Menu" in any end dialog. */
            ReturnToMenuClicked: 'Events.UI.EndDialog.ReturnToMenuClicked'
        },
        /** @namespace Events.UI.CustomQuestions */
        CustomQuestions: {
             /**
             * Fired when user clicks save, after entering name/questions.
             * @event Events.UI.CustomQuestions.SaveClicked
             * @type {object}
             * @property {string} sheetId - The ID of the sheet being saved (might be new or existing).
             * @property {string} name - The name of the sheet.
             * @property {string} questionsText - The raw text from the textarea.
             */
            SaveClicked: 'Events.UI.CustomQuestions.SaveClicked',
            /**
            * Fired when user clicks delete for a specific custom sheet.
            * @event Events.UI.CustomQuestions.DeleteClicked
            * @type {object}
            * @property {string} sheetId - The ID of the sheet to delete.
            */
            DeleteClicked: 'Events.UI.CustomQuestions.DeleteClicked',
            /**
            * Fired when user clicks edit for a specific custom sheet.
            * @event Events.UI.CustomQuestions.EditClicked
            * @type {object}
            * @property {string} sheetId - The ID of the sheet to edit.
            */
            EditClicked: 'Events.UI.CustomQuestions.EditClicked',
            /**
            * Fired when user clicks an action button within the sheet list.
            * @event Events.UI.CustomQuestions.SheetActionClicked
            * @type {object}
            * @property {HTMLElement} target - The button element that was clicked.
            */
            SheetActionClicked: 'Events.UI.CustomQuestions.SheetActionClicked',
            /** Fired when the user clicks the button to go back to the main menu. */
            BackClicked: 'Events.UI.CustomQuestions.BackClicked',
        },
        /** @namespace Events.UI.Highscores */
        Highscores: {
             /** Fired when user clicks back/cancel. Payload: None */
             BackClicked: 'Events.UI.Highscores.BackClicked',
        },
        /** @namespace Events.UI.About */
        About: {
             /** Fired when user clicks back/cancel. Payload: None */
             BackClicked: 'Events.UI.About.BackClicked',
        },
        MultiplayerEndDialog: {
            Closed: 'Events.UI.MultiplayerEndDialog.Closed',
            /**
             * Fired when user clicks Play Again in the MULTIPLAYER end dialog.
             * Listened for by GameCoordinator.
             * @event Events.UI.MultiplayerEndDialog.PlayAgainClicked
             * @type {object} - Payload might be empty or indicate context.
             */
            PlayAgainClicked: 'Events.UI.MultiplayerEndDialog.PlayAgainClicked',
        },
        /**
         * Events related to the name prompt dialog for various actions.
         * @namespace Events.UI.NamePrompt
         */
        NamePrompt: {
            /**
             * Request to show the name prompt dialog.
             * @event Events.UI.NamePrompt.Show
             * @type {object}
             * @property {string} [title] - Optional dialog title.
             * @property {string} [buttonText] - Optional confirm button text.
             * @property {string} [defaultName] - Optional name to pre-fill.
             * @property {any} context - Context to be passed back in the Confirmed event (e.g., 'host', 'join').
             */
            Show: 'Events.UI.NamePrompt.Show',
            /**
             * Fired when the user confirms a name in the dialog.
             * @event Events.UI.NamePrompt.Confirmed
             * @type {object}
             * @property {string} playerName - The name entered by the user.
             * @property {any} context - The context provided when the dialog was shown.
             */
            Confirmed: 'Events.UI.NamePrompt.Confirmed'
        },
        /** @namespace Events.UI.Lobby */
        Lobby: {
            /**
             * Fired when the host clicks the Start Game button in the lobby.
             * @event Events.UI.Lobby.StartGameClicked
             */
            StartGameClicked: 'Events.UI.Lobby.StartGameClicked',
            
            /**
             * Fired when the host or client clicks the Cancel/Leave button in the lobby.
             * @event Events.UI.Lobby.CancelGameClicked
             */
            CancelGameClicked: 'Events.UI.Lobby.CancelGameClicked',
            
            /**
             * Fired when a player clicks the Leave Game button in the lobby.
             * @event Events.UI.Lobby.LeaveGameClicked
             */
            LeaveGameClicked: 'Events.UI.Lobby.LeaveGameClicked'
        },
        /** @namespace Events.UI.JoinGame */
        JoinGame: {
            /**
             * Fired when the player submits a game code and attempts to connect.
             * @event Events.UI.JoinGame.ConnectClicked
             * @type {object}
             * @property {string} gameCode - The game code entered by the player
             * @property {string} playerName - The player's name
             */
            ConnectClicked: 'Events.UI.JoinGame.ConnectClicked',
            
            /**
             * Fired when the player cancels joining a game.
             * @event Events.UI.JoinGame.CancelJoinClicked
             */
            CancelJoinClicked: 'Events.UI.JoinGame.CancelJoinClicked'
        },
        // ... other UI interaction events could go here, organized by component
    },
    /**
     * Events specific to the WebRTC communication layer.
     * These are typically emitted BY WebRTCManager and listened to BY other services or UI components.
     * @namespace Events.WebRTC
     */
    WebRTC: {
         /**
         * Fired when a data message is received from a peer.
         * @event Events.WebRTC.MessageReceived
         * @type {object}
         * @property {object} msg - The parsed message data.
         * @property {string} senderPeerId - The PeerJS ID of the sender.
         */
        MessageReceived: 'Events.WebRTC.MessageReceived',
        /**
         * Fired when a PeerJS connection fails.
         * @event Events.WebRTC.ConnectionFailed
         * @type {object}
         * @property {Error} error - The connection error object.
         * @property {string} [peerId] - The ID of the peer connection that failed, if applicable.
         * @property {'host-init'|'client-connect'|'data-channel'} context - Where the failure occurred.
         */
        ConnectionFailed: 'Events.WebRTC.ConnectionFailed',
        /**
         * Fired when a peer explicitly disconnects or the connection is lost.
         * @event Events.WebRTC.PeerDisconnected
         * @type {object}
         * @property {string} peerId - The ID of the disconnected peer.
         */
        PeerDisconnected: 'Events.WebRTC.PeerDisconnected',
    },
     /**
     * Events related to specific menu sections like Highscores, Custom Questions.
     * @namespace Events.Menu
     */
    Menu: {
         /** @namespace Events.Menu.Highscores */
        Highscores: {
             /**
             * Fired *by HighscoresComponent* when the high score view is shown and needs data.
             * Listened for by HighscoreManager.
             * @event Events.Menu.Highscores.ShowRequested
             * @type {object} - Payload is empty.
             */
            ShowRequested: 'Events.Menu.Highscores.ShowRequested',
            /**
             * Fired *by HighscoreManager* when high scores have been loaded.
             * Listened for by HighscoresComponent.
             * @event Events.Menu.Highscores.Loaded
             * @type {object}
             * @property {Array<object>} scores - Array of score objects.
             */
            Loaded: 'Events.Menu.Highscores.Loaded',
             /**
             * Fired *by HighscoreManager* when high score loading failed.
             * Listened for by HighscoresComponent.
             * @event Events.Menu.Highscores.LoadFailed
             * @type {object}
             * @property {string} message - Error message describing the failure.
             */
            LoadFailed: 'Events.Menu.Highscores.LoadFailed',
        },
         /** @namespace Events.Menu.CustomQuestions */
        CustomQuestions: {
             /**
             * Fired *by QuestionsManager* when a custom question sheet was successfully saved.
             * Listened for by CustomQuestionsComponent for feedback.
             * @event Events.Menu.CustomQuestions.SaveSuccess
             * @type {object}
             * @property {string} sheetId - The unique ID assigned to the saved sheet.
             * @property {string} name - The name of the saved sheet.
             */
            SaveSuccess: 'Events.Menu.CustomQuestions.SaveSuccess',
            /**
             * Fired *by QuestionsManager* when saving a custom question sheet failed.
             * Listened for by CustomQuestionsComponent for feedback.
             * @event Events.Menu.CustomQuestions.SaveFailed
             * @type {object}
             * @property {string} [sheetId] - The ID of the sheet that failed to save (if applicable).
             * @property {string} name - The name of the sheet that failed to save.
             * @property {string} message - Error message describing the failure.
             */
            SaveFailed: 'Events.Menu.CustomQuestions.SaveFailed',
            /**
            * Fired *by QuestionsManager* (via Coordinator) when a custom sheet was successfully deleted.
            * Listened for by CustomQuestionsComponent for feedback/refresh.
            * @event Events.Menu.CustomQuestions.DeleteSuccess
            * @type {object}
            * @property {string} sheetId - The unique ID of the deleted sheet.
            */
            DeleteSuccess: 'Events.Menu.CustomQuestions.DeleteSuccess',
            /**
            * Fired *by QuestionsManager* (via Coordinator) when deleting a custom sheet failed.
            * Listened for by CustomQuestionsComponent for feedback.
            * @event Events.Menu.CustomQuestions.DeleteFailed
            * @type {object}
            * @property {string} sheetId - The ID of the sheet that failed to delete.
            * @property {string} message - Error message describing the failure.
            */
            DeleteFailed: 'Events.Menu.CustomQuestions.DeleteFailed',

            /**
            * Fired by the Coordinator when sheet data is loaded and ready for editing.
            * Listened for by CustomQuestionsComponent to populate the form.
            * @event Events.Menu.CustomQuestions.SheetLoadedForEdit
            * @type {object}
            * @property {string} sheetId - The ID of the sheet being edited.
            * @property {string} name - The name of the sheet.
            * @property {string} questionsText - The raw questions text formatted for the textarea.
            */
            SheetLoadedForEdit: 'Events.Menu.CustomQuestions.SheetLoadedForEdit',
        },
        /** @namespace Events.Menu.About */
        About: {
             /** Request to show the about view. Payload: None */
             ShowRequested: 'Events.Menu.About.ShowRequested',
        },
    },
    // Add more domains/actions as needed
};

export default Events; 