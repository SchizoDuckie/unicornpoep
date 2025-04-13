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
        ErrorOccurred: 'system:errorOccurred',
        /**
         * Fired when a major application state transition occurs (e.g., view change).
         * @event Events.System.StateChange
         * @type {object}
         * @property {string} newState - Identifier of the new state/view.
         * @property {string} oldState - Identifier of the previous state/view.
         */
        StateChange: 'system:stateChange',
        /**
         * Request to show transient feedback to the user (e.g., a toast notification).
         * @event Events.System.ShowFeedback
         * @type {object}
         * @property {string} message - The feedback message.
         * @property {'info'|'success'|'warn'|'error'} level - Severity level.
         * @property {number} [duration] - Optional display duration in milliseconds.
         */
        ShowFeedback: 'system:showFeedback',
        /**
         * Request to show the global loading indicator.
         * @event Events.System.LoadingStart
         * @type {object} [payload]
         * @property {string} [payload.message] - Optional message to display (e.g., "Connecting...").
         */
        LoadingStart: 'system:loadingStart',
        /**
         * Request to hide the global loading indicator.
         * @event Events.System.LoadingEnd
         * @type {object} - Payload is typically empty.
         */
        LoadingEnd: 'system:loadingEnd',
        /**
         * Fired by UIManager when a valid 6-digit join code is detected in the URL parameters (?join=...).
         * Listened for by components responsible for initiating the join flow (e.g., GameCoordinator).
         * @event Events.System.ValidJoinCodeDetected
         * @type {object}
         * @property {string} code - The 6-digit join code detected.
         */
        ValidJoinCodeDetected: 'system:validJoinCodeDetected',
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
        ShowView: 'navigation:showView',
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
        Initialized: 'component:initialized',
        /**
         * Fired *by BaseComponent* when a component's root element is shown (e.g., 'hidden' class removed).
         * @event Events.Component.Shown
         * @type {object}
         * @property {import('../components/base-component.js').BaseComponent} component - The component instance that was shown.
         * @property {string} componentName - The name/identifier of the component.
         */
        Shown: 'component:shown',
        /**
         * Fired *by BaseComponent* when a component's root element is hidden (e.g., 'hidden' class added).
         * @event Events.Component.Hidden
         * @type {object}
         * @property {import('../components/base-component.js').BaseComponent} component - The component instance that was hidden.
         * @property {string} componentName - The name/identifier of the component.
         */
        Hidden: 'component:hidden',
        /**
         * Fired *by BaseComponent* just before a component is destroyed and listeners are cleaned up.
         * @event Events.Component.Destroyed
         * @type {object}
         * @property {import('../components/base-component.js').BaseComponent} component - The component instance being destroyed.
         * @property {string} componentName - The name/identifier of the component.
         */
        Destroyed: 'component:destroyed',
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
         StartRequested: 'game:startRequested',
        /**
         * Fired by the active Game Mode class when a game has successfully started and is ready.
         * @event Events.Game.Started
         * @type {object}
         * @property {'single' | 'multiplayer' | 'practice'} mode - The mode of the game that started.
         * @property {object} settings - The final settings used for the game.
         */
        Started: 'game:started',
        /**
         * Fired by the active Game Mode class when a game finishes.
         * @event Events.Game.Finished
         * @type {object}
         * @property {'single' | 'multiplayer' | 'practice'} mode - The mode of the game that finished.
         * @property {object} results - Game results (e.g., score, rankings). Structure varies by mode.
         */
        Finished: 'game:finished',
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
        QuestionNew: 'game:questionNew',
        /**
         * Fired *by the QuizEngine* after checking a submitted answer.
         * @event Events.Game.AnswerChecked
         * @type {object}
         * @property {boolean} isCorrect - Whether the submitted answer was correct.
         * @property {number} scoreDelta - Change in score resulting from this answer.
         * @property {string} correctAnswer - The correct answer text.
         * @property {any} submittedAnswer - The answer submitted by the player.
         */
        AnswerChecked: 'game:answerChecked',
        /**
         * Fired when the player's score is updated. Emitted by the active Game Mode class.
         * @event Events.Game.ScoreUpdated
         * @type {object}
         * @property {number} totalScore - The new total score for the player.
         * @property {string} [playerId] - Identifier for the player whose score updated (relevant in MP). If omitted, assumes local player.
         */
        ScoreUpdated: 'game:scoreUpdated',
        /**
         * Fired periodically by a timer during the game.
         * @event Events.Game.TimeTick
         * @type {object}
         * @property {number} remainingTime - Remaining time in **milliseconds**.
         * @property {string} [timerId] - Optional identifier if multiple timers exist.
         */
        TimeTick: 'game:timeTick',
         /**
         * Fired when a game timer runs out.
         * @event Events.Game.TimeUp
         * @type {object}
         * @property {string} [timerId] - Optional identifier if multiple timers exist.
         */
        TimeUp: 'game:timeUp',
         /**
         * Fired *by the QuizEngine* when all questions have been answered.
         * @event Events.Game.AllQuestionsAnswered
         * @type {object}
         * @property {number} finalScore - The final score achieved in the quiz round.
         */
        AllQuestionsAnswered: 'game:allQuestionsAnswered',
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
            Initialized: 'multiplayer:host:initialized',
            /**
             * Fired by WebRTCManager on the host when a client successfully connects.
             * @event Events.Multiplayer.Host.ClientConnected
             * @type {object}
             * @property {string} peerId - The PeerJS ID of the connected client.
             * @property {string} playerName - The name provided by the client.
             */
            ClientConnected: 'multiplayer:host:clientConnected',
            /**
             * Fired by WebRTCManager on the host when a client disconnects.
             * @event Events.Multiplayer.Host.ClientDisconnected
             * @type {object}
             * @property {string} peerId - The PeerJS ID of the disconnected client.
             */
            ClientDisconnected: 'multiplayer:host:clientDisconnected',
            /**
             * Fired by the HostLobby component just before initiating the game start process.
             * Typically triggers the creation/start of the MultiplayerGame instance.
             * @event Events.Multiplayer.Host.GameStarting
             * @type {object}
             * @property {object} settings - The final game settings selected by the host.
             * @property {string} playerName - The host's player name.
             */
            GameStarting: 'mp:host:gameStarting',
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
            PlayerAnswered: 'mp:host:playerAnswered',
             /**
             * Fired by MultiplayerGame (Host) when all currently connected players
             * have submitted an answer for the ongoing question round.
             * @event Events.Multiplayer.Host.AllPlayersAnswered
             * @type {object} - Payload is typically empty.
             */
            AllPlayersAnswered: 'mp:host:allPlayersAnswered',
             /**
             * Fired by MultiplayerGame (Host) when a host-specific error occurs during game setup or progression.
             * Listened for by host UI components to display targeted error messages.
             * @event Events.Multiplayer.Host.ErrorOccurred
             * @type {object}
             * @property {string} errorKey - The key corresponding to a text template for the error message (e.g., 'mpHostErrorNoQuestions').
             * @property {string} [originalMessage] - The underlying error message, if applicable (e.g., from a catch block).
             * @property {number} [index] - Relevant index if error relates to a specific question (e.g., 'mpHostErrorNextQPrefix').
             */
            ErrorOccurred: 'mp:host:errorOccurred',
        },
        /** @namespace Events.Multiplayer.Client */
        Client: {
            /**
             * Fired by WebRTCManager on the client when successfully connected to the host.
             * @event Events.Multiplayer.Client.ConnectedToHost
             * @type {object}
             * @property {string} hostId - The PeerJS ID of the host.
             */
            ConnectedToHost: 'multiplayer:client:connectedToHost',
             /**
             * Fired by WebRTCManager on the client when disconnected from the host.
             * @event Events.Multiplayer.Client.DisconnectedFromHost
             * @type {object} - Payload might be empty or contain a reason string.
             * @property {string} [reason] - Optional reason for disconnection.
             */
            DisconnectedFromHost: 'multiplayer:client:disconnectedFromHost',
             /**
             * Fired on the client when receiving initial game info from the host (before game start).
             * Typically emitted by WebRTCManager upon receiving a specific message type.
             * @event Events.Multiplayer.Client.GameInfoReceived
             * @type {object}
             * @property {object} settings - Game settings chosen by the host.
             * @property {Map<string, object>} players - Map of currently connected players (peerId -> playerData: { name: string, score: number, isFinished: boolean }).
             */
            GameInfoReceived: 'multiplayer:client:gameInfoReceived',
            /**
             * Fired by the JoinLobby component when the client initiates the connection attempt to the host.
             * Listened for primarily by WebRTCManager to start the PeerJS connection.
             * @event Events.Multiplayer.Client.Connecting
             * @type {object}
             * @property {string} hostId - The host PeerJS ID the client is attempting to connect to.
             * @property {string} playerName - The name the client is using.
             */
            Connecting: 'mp:client:connecting',
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
            PlayerJoined: 'multiplayer:common:playerJoined',
            /**
             * Fired for all peers when a player leaves the session.
             * Typically emitted by WebRTCManager based on disconnection events or messages.
             * @event Events.Multiplayer.Common.PlayerLeft
             * @type {object}
             * @property {string} peerId - The PeerJS ID of the player who left.
             */
            PlayerLeft: 'multiplayer:common:playerLeft',
            /**
             * Fired for all peers when a player's data (e.g., score, status) is updated.
             * Typically emitted by WebRTCManager upon receiving a specific message type.
             * @event Events.Multiplayer.Common.PlayerUpdated
             * @type {object}
             * @property {string} peerId - The PeerJS ID of the player whose data changed.
             * @property {object} updatedData - The specific fields that were updated (e.g., { score: 100, isFinished: true }).
             */
            PlayerUpdated: 'multiplayer:common:playerUpdated',
             /**
             * Fired when the overall list of players needs updating.
             * Often triggered *by UI components* (like PlayerListComponent) listening to PlayerJoined/PlayerLeft/PlayerUpdated.
             * @event Events.Multiplayer.Common.PlayerListUpdated
             * @type {object}
             * @property {Map<string, object>} players - The complete, current map of players (peerId -> playerData: { name: string, score: number, isFinished: boolean }).
             */
            PlayerListUpdated: 'multiplayer:common:playerListUpdated',
            /**
             * Used for sending potentially large or complete game state snapshots for synchronization.
             * Emitted by the host's MultiplayerGame instance, received by WebRTCManager on clients.
             * @event Events.Multiplayer.Common.GameStateSync
             * @type {object}
             * @property {object} state - The full or partial game state object to sync.
             */
            GameStateSync: 'multiplayer:common:gameStateSync',
            /**
             * Request sent *to WebRTCManager* to broadcast a message to all connected peers (or specific peers).
             * @event Events.Multiplayer.Common.SendMessage
             * @type {object}
             * @property {object} message - The message payload to send.
             * @property {string|string[]} [targetPeerIds] - Optional. If provided, send only to these peer IDs. If omitted, broadcast to all.
             */
            SendMessage: 'multiplayer:common:sendMessage',
            /**
             * Fired when game data (like state or player updates) is received from another peer.
             * Emitted by WebRTCManager.
             * @event Events.Multiplayer.Common.DataReceived
             * @type {object}
             * @property {string} peerId - The PeerJS ID of the sender.
             * @property {string} type - The type of message received (e.g., 'gameState', 'playerUpdate', 'chat').
             * @property {any} payload - The data payload. Structure depends on the message type.
             */
            DataReceived: 'multiplayer:common:dataReceived',
        },
        /**
         * Fired by MultiplayerGame (Host) when the host finishes their local quiz
         * but is waiting for one or more clients to finish.
         * Listened for by GameCoordinator to display the waiting UI for the host.
         * @event Events.Multiplayer.HostWaiting
         * @type {object}
         * @property {string} messageKey - Localization key for the waiting message (e.g., 'mpHostWaitOthers').
         */
        HostWaiting: 'multiplayer:host:waiting'
    },
    /**
     * Events generated BY UI components interacting with the user.
     * @namespace Events.UI
     */
    UI: {
        /** @namespace Events.UI.MainMenu */
        MainMenu: {
            /** Fired when the single player button is clicked. Payload: None */
            StartSinglePlayerClicked: 'ui:mainMenu:startSinglePlayerClicked',
            /** Fired when the host multiplayer button is clicked. Payload: None */
            StartMultiplayerHostClicked: 'ui:mainMenu:startMultiplayerHostClicked',
            /** Fired when the join multiplayer button is clicked. Payload: None */
            JoinMultiplayerClicked: 'ui:mainMenu:joinMultiplayerClicked',
             /** Fired when the practice mode button is clicked. Payload: None */
             StartPracticeClicked: 'ui:mainMenu:startPracticeClicked',
             /** Fired when the custom questions button is clicked. Payload: None */
            CustomQuestionsClicked: 'ui:mainMenu:customQuestionsClicked',
            /** Fired when the highscores button is clicked. Payload: None */
            HighscoresClicked: 'ui:mainMenu:highscoresClicked',
             /** Fired when the about button is clicked. Payload: None */
            AboutClicked: 'ui:mainMenu:aboutClicked',
        },
         /** @namespace Events.UI.GameArea */
        GameArea: {
            /**
             * Fired when the user submits an answer.
             * @event Events.UI.GameArea.AnswerSubmitted
             * @type {object}
             * @property {string} answer - The answer text selected/submitted by the user.
             */
            AnswerSubmitted: 'ui:gameArea:answerSubmitted',
            /** Fired when the user clicks the button to leave the current game. Payload: None */
            LeaveGameClicked: 'ui:gameArea:leaveGameClicked',
        },
         /** @namespace Events.UI.Dialog */
        Dialog: {
            /**
             * Fired when the user confirms their name in the name prompt dialog.
             * @event Events.UI.Dialog.NameConfirmed
             * @type {object}
             * @property {string} name - The entered name.
             */
            NameConfirmed: 'ui:dialog:nameConfirmed',
             /**
             * Fired when a generic confirmation dialog is accepted.
             * @event Events.UI.Dialog.GenericConfirm
             * @type {object}
             * @property {string} dialogId - Identifier for the dialog being confirmed.
             * @property {any} [value] - Optional value associated with the confirmation.
             */
            GenericConfirm: 'ui:dialog:genericConfirm',
            /**
             * Fired when a generic confirmation dialog is cancelled.
             * @event Events.UI.Dialog.GenericCancel
             * @type {object}
             * @property {string} dialogId - Identifier for the dialog being cancelled.
             */
            GenericCancel: 'ui:dialog:genericCancel',

            /**
             * Request to show the name prompt dialog.
             * Emitted by components needing the user's name before proceeding (e.g., MultiplayerChoiceComponent).
             * Listened for by NamePromptDialog.
             * @event Events.UI.Dialog.NamePromptRequested
             * @type {object} - Payload is typically empty, but could carry context if needed.
             */
            NamePromptRequested: 'dialog:namePromptRequested',

             /**
              * Fired by SinglePlayerEndDialog when the save button is clicked.
              * Listened for by HighscoreManager.
              * @event Events.UI.Dialog.SaveScoreClicked
              * @type {object}
              * @property {string} name - The player name entered.
              * @property {number} score - The score achieved.
              */
             SaveScoreClicked: 'ui:dialog:saveScoreClicked',
        },
        /** @namespace Events.UI.MultiplayerChoice */
        MultiplayerChoice: {
            /**
             * Fired when user chooses to host, after entering name/settings.
             * @event Events.UI.MultiplayerChoice.HostClicked
             * @type {object}
             * @property {string} playerName - The host's chosen name.
             * @property {object} settings - Selected game settings (e.g., { sheetId: '...', difficulty: '...' }).
             */
            HostClicked: 'ui:mpChoice:hostClicked',
            /**
             * Fired when user chooses to join, after entering name.
             * @event Events.UI.MultiplayerChoice.JoinClicked
             * @type {object}
             * @property {string} playerName - The joining player's chosen name.
             */
            JoinClicked: 'ui:mpChoice:joinClicked',
            /** Fired when user clicks back/cancel. Payload: None */
            BackClicked: 'ui:mpChoice:backClicked',
        },
        /** @namespace Events.UI.HostLobby */
        HostLobby: {
            /** Fired when the host clicks the button to start the game. Payload: None */
            StartGameClicked: 'ui:hostLobby:startGameClicked',
            /** Fired when the host cancels the lobby (clicks back/cancel). Payload: None */
            CancelClicked: 'ui:hostLobby:cancelClicked',
            /** Fired when the host clicks the copy link button. Payload: None */
            CopyLinkClicked: 'ui:hostLobby:copyLinkClicked',
        },
        /** @namespace Events.UI.JoinLobby */
        JoinLobby: {
            /**
             * Fired when the user submits the host connection code.
             * @event Events.UI.JoinLobby.SubmitCodeClicked
             * @type {object}
             * @property {string} code - The submitted connection code.
             */
            SubmitCodeClicked: 'ui:joinLobby:submitCodeClicked',
            /** 
             * Fired when the user confirms joining after seeing game info and entering their name.
             * @event Events.UI.JoinLobby.ConfirmClicked
             * @type {object}
             * @property {string} playerName - The name entered by the user.
             */
            ConfirmClicked: 'ui:joinLobby:confirmClicked',
             /** Fired when the user cancels the joining process (e.g., from confirm view). */
            CancelClicked: 'ui:joinLobby:cancelClicked',
        },
         /** @namespace Events.UI.MultiplayerLobby */
         MultiplayerLobby: {
            /** Fired when the client clicks the "Leave Lobby" button. */
            LeaveClicked: 'ui:mpLobby:leaveClicked',
         },
         /** @namespace Events.UI.EndDialog */
        EndDialog: {
            /** Fired when user clicks Return to Menu in an end-game dialog. Payload: None */
             ReturnToMenuClicked: 'ui:endDialog:returnToMenuClicked',
             /**
              * Fired when user clicks Play Again (or Try Again) in an end-game dialog.
              * Listened for by GameCoordinator.
              * @event Events.UI.EndDialog.PlayAgainClicked
              * @type {object}
              * @property {'single' | 'practice'} mode - The mode of the game to restart.
              */
             PlayAgainClicked: 'ui:endDialog:playAgainClicked',
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
            SaveClicked: 'ui:customQuestions:saveClicked',
            /**
            * Fired when user clicks delete for a specific custom sheet.
            * @event Events.UI.CustomQuestions.DeleteClicked
            * @type {object}
            * @property {string} sheetId - The ID of the sheet to delete.
            */
            DeleteClicked: 'ui:customQuestions:deleteClicked',
            /**
            * Fired when user clicks edit for a specific custom sheet.
            * @event Events.UI.CustomQuestions.EditClicked
            * @type {object}
            * @property {string} sheetId - The ID of the sheet to edit.
            */
            EditClicked: 'ui:customQuestions:editClicked',
            /** Fired when the user clicks the button to go back to the main menu. */
            BackClicked: 'ui:customQuestions:backClicked',
        },
        /** @namespace Events.UI.Highscores */
        Highscores: {
             /** Fired when user clicks back/cancel. Payload: None */
             BackClicked: 'ui:highscores:backClicked',
        },
        /** @namespace Events.UI.About */
        About: {
             /** Fired when user clicks back/cancel. Payload: None */
             BackClicked: 'ui:about:backClicked',
        },
        MultiplayerEndDialog: {
            Closed: 'ui:multiplayerEndDialog:closed',
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
        MessageReceived: 'webrtc:messageReceived',
        /**
         * Fired when a PeerJS connection fails.
         * @event Events.WebRTC.ConnectionFailed
         * @type {object}
         * @property {Error} error - The connection error object.
         * @property {string} [peerId] - The ID of the peer connection that failed, if applicable.
         * @property {'host-init'|'client-connect'|'data-channel'} context - Where the failure occurred.
         */
        ConnectionFailed: 'webrtc:connectionFailed',
        /**
         * Fired when a peer explicitly disconnects or the connection is lost.
         * @event Events.WebRTC.PeerDisconnected
         * @type {object}
         * @property {string} peerId - The ID of the disconnected peer.
         */
        PeerDisconnected: 'webrtc:peerDisconnected',
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
            ShowRequested: 'menu:highscores:showRequested',
            /**
             * Fired *by HighscoreManager* when high scores have been loaded.
             * Listened for by HighscoresComponent.
             * @event Events.Menu.Highscores.Loaded
             * @type {object}
             * @property {Array<object>} scores - Array of score objects.
             */
            Loaded: 'menu:highscores:loaded',
             /**
             * Fired *by HighscoreManager* when high score loading failed.
             * Listened for by HighscoresComponent.
             * @event Events.Menu.Highscores.LoadFailed
             * @type {object}
             * @property {string} message - Error message describing the failure.
             */
            LoadFailed: 'menu:highscores:loadFailed',
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
            SaveSuccess: 'menu:customQuestions:saveSuccess',
            /**
             * Fired *by QuestionsManager* when saving a custom question sheet failed.
             * Listened for by CustomQuestionsComponent for feedback.
             * @event Events.Menu.CustomQuestions.SaveFailed
             * @type {object}
             * @property {string} [sheetId] - The ID of the sheet that failed to save (if applicable).
             * @property {string} name - The name of the sheet that failed to save.
             * @property {string} message - Error message describing the failure.
             */
            SaveFailed: 'menu:customQuestions:saveFailed',
            /**
            * Fired *by QuestionsManager* (via Coordinator) when a custom sheet was successfully deleted.
            * Listened for by CustomQuestionsComponent for feedback/refresh.
            * @event Events.Menu.CustomQuestions.DeleteSuccess
            * @type {object}
            * @property {string} sheetId - The unique ID of the deleted sheet.
            */
            DeleteSuccess: 'menu:customQuestions:deleteSuccess',
            /**
            * Fired *by QuestionsManager* (via Coordinator) when deleting a custom sheet failed.
            * Listened for by CustomQuestionsComponent for feedback.
            * @event Events.Menu.CustomQuestions.DeleteFailed
            * @type {object}
            * @property {string} sheetId - The ID of the sheet that failed to delete.
            * @property {string} message - Error message describing the failure.
            */
            DeleteFailed: 'menu:customQuestions:deleteFailed',

            /**
            * Fired by the Coordinator when sheet data is loaded and ready for editing.
            * Listened for by CustomQuestionsComponent to populate the form.
            * @event Events.Menu.CustomQuestions.SheetLoadedForEdit
            * @type {object}
            * @property {string} sheetId - The ID of the sheet being edited.
            * @property {string} name - The name of the sheet.
            * @property {string} questionsText - The raw questions text formatted for the textarea.
            */
            SheetLoadedForEdit: 'menu:customQuestions:sheetLoadedForEdit',
        },
        /** @namespace Events.Menu.About */
        About: {
             /** Request to show the about view. Payload: None */
             ShowRequested: 'menu:about:showRequested',
        },
    },
    // Add more domains/actions as needed
};

export default Events; 