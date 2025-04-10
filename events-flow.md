# V2 Application Event Flow (Segmented)

This file breaks down the event flow of the V2 application into logical segments using Mermaid diagrams. GitHub Flavored Markdown can render this syntax directly.

Node border colors indicate the component category:
*   **Coordinators / Managers:** Light Purple (`#e6e0f8`)
*   **Core / Base:** Grey (`#aaaaaa`)
*   **Services:** Amber/Orange (`#ffc107`)
*   **Game Modes:** Teal (`#20c997`)
*   **UI Components:** Light Blue (`#0dcaf0`)

Arrows indicate event flow via the central EventBus or direct calls (dashed lines).
Labels on arrows to/from EventBus are simplified categories.

## 1. System Initialization & Navigation

This diagram shows the initial application setup and how view navigation is handled.

```mermaid
graph TD
    %% Node Styles
    style UnicornPoep stroke:#e6e0f8,stroke-width:2px
    style UIManager stroke:#e6e0f8,stroke-width:2px
    style GameCoordinator stroke:#e6e0f8,stroke-width:2px
    style EventBus stroke:#aaaaaa,stroke-width:2px
    style BaseComponent stroke:#aaaaaa,stroke-width:2px

    %% Initialization Flow
    UnicornPoep -- "Instantiates" --> UIManager
    UnicornPoep -- "Instantiates" --> GameCoordinator
    UIManager -- "Instantiates Components" --> BaseComponent

    %% Component Lifecycle Events
    BaseComponent -- "Component Lifecycle Events" --> EventBus

    %% Navigation Request
    UnicornPoep -- "Navigation Events" --> EventBus
    %% GameCoordinator also emits Navigation Events later
    %% UI Components also emit Navigation Events

    %% Navigation Handling
    EventBus -- "Navigation Events" --> UIManager
    UIManager -. "Calls show()/hide()" .-> BaseComponent
```

## 2. Game Startup Flow (Menus & Coordination)

This diagram shows how user interactions in the menus trigger the game coordination process to start different game modes.

```mermaid
graph TD
    %% Node Styles
    style MainMenuComponent stroke:#0dcaf0,stroke-width:2px
    style MultiplayerChoiceComponent stroke:#0dcaf0,stroke-width:2px
    style HostLobbyComponent stroke:#0dcaf0,stroke-width:2px
    style JoinLobbyComponent stroke:#0dcaf0,stroke-width:2px
    style NamePromptDialog stroke:#0dcaf0,stroke-width:2px
    style GameCoordinator stroke:#e6e0f8,stroke-width:2px
    style UIManager stroke:#e6e0f8,stroke-width:2px
    style WebRTCManager stroke:#ffc107,stroke-width:2px
    style QuestionsManager stroke:#ffc107,stroke-width:2px
    style EventBus stroke:#aaaaaa,stroke-width:2px
    style GameModes stroke:#20c997,stroke-width:2px %% Represents the Game Mode nodes in general

    %% User Actions -> Event Bus
    MainMenuComponent -- "UI Events (Menu)" --> EventBus
    MultiplayerChoiceComponent -- "UI Events (MP Choice)" --> EventBus
    NamePromptDialog -- "UI Events (Dialog)" --> EventBus
    HostLobbyComponent -- "UI Events (Lobby)" --> EventBus
    JoinLobbyComponent -- "UI Events (Lobby)" --> EventBus

    %% Event Bus -> Game Coordinator
    EventBus -- "UI Events<br>(Menu, Dialog, Lobby)" --> GameCoordinator

    %% Game Coordinator Actions
    GameCoordinator -- "Navigation Events" --> EventBus
    GameCoordinator -. "Calls WebRTCManager" .-> WebRTCManager
    GameCoordinator -. "Calls QuestionsManager" .-> QuestionsManager
    %% See Core Gameplay Diagram for GameModes nodes
    GameCoordinator -. "Instantiates Game Modes" .-> GameModes

    %% Navigation handled by UIManager
    EventBus -- "Navigation Events" --> UIManager
```

## 3. Core Gameplay Loop (Single Player / Practice / Base)

Focuses on the flow of questions, answers, scoring, and timing. Small nodes near the EventBus represent event categories.

```mermaid
graph TD
    %% Node Styles
    style BaseGameMode stroke:#20c997,stroke-width:2px
    style QuizEngine stroke:#ffc107,stroke-width:2px
    style Timer stroke:#ffc107,stroke-width:2px
    style QuestionDisplayComponent stroke:#0dcaf0,stroke-width:2px
    style AnswerListComponent stroke:#0dcaf0,stroke-width:2px
    style ProgressDisplayComponent stroke:#0dcaf0,stroke-width:2px
    style ScoreDisplayComponent stroke:#0dcaf0,stroke-width:2px
    style TimerDisplayComponent stroke:#0dcaf0,stroke-width:2px
    style GameFeedbackComponent stroke:#0dcaf0,stroke-width:2px
    style EventBus stroke:#aaaaaa,stroke-width:2px
    %% Event Group Node Style
    style EvGroup_GameState fill:#f8f8f8,stroke:#ccc,stroke-width:1px
    style EvGroup_UIAnswer fill:#f8f8f8,stroke:#ccc,stroke-width:1px
    style EvGroup_GameLogic fill:#f8f8f8,stroke:#ccc,stroke-width:1px
    style EvGroup_Timer fill:#f8f8f8,stroke:#ccc,stroke-width:1px

    %% Event Group Nodes
    EvGroup_GameState(("Game State"))
    EvGroup_UIAnswer(("UI Answer"))
    EvGroup_GameLogic(("Game Logic"))
    EvGroup_Timer(("Timer"))

    %% Game Flow Events
    BaseGameMode -- "Start, Question, Score, Finish" --> EvGroup_GameState
    EvGroup_GameState --> EventBus

    %% UI Display Updates
    EventBus --> EvGroup_GameState -- "Update" --> QuestionDisplayComponent
    EventBus --> EvGroup_GameState -- "Update" --> AnswerListComponent
    EventBus --> EvGroup_GameState -- "Update" --> ProgressDisplayComponent
    EventBus --> EvGroup_GameState -- "Update" --> ScoreDisplayComponent
    EventBus --> EvGroup_GameState -- "Start/Finish" --> TimerDisplayComponent

    %% User Interaction
    AnswerListComponent -- "Answer Submitted" --> EvGroup_UIAnswer
    EvGroup_UIAnswer --> EventBus
    %% Or MultiplayerClientManager in MP
    EventBus --> EvGroup_UIAnswer -- "Submitted" --> BaseGameMode

    %% Answer Processing
    BaseGameMode -. "Calls QuizEngine" .-> QuizEngine
    QuizEngine -- "Answer Checked" --> EvGroup_GameLogic
    EvGroup_GameLogic --> EventBus
    EventBus --> EvGroup_GameLogic -- "Checked" --> GameFeedbackComponent
    EventBus --> EvGroup_GameLogic -- "Checked" --> AnswerListComponent

    %% Timer
    BaseGameMode -. "Calls Timer" .-> Timer
    Timer -- "Tick, TimeUp" --> EvGroup_Timer
    EvGroup_Timer --> EventBus
    EventBus --> EvGroup_Timer -- "Tick/TimeUp" --> TimerDisplayComponent
    %% To end the game
    EventBus --> EvGroup_Timer -- "TimeUp" --> BaseGameMode
```

## 4. Multiplayer Communication & Sync

Illustrates the primary WebRTC message flows and state synchronization between Host, Client, and UI during multiplayer.

```mermaid
graph TD
    %% Node Styles
    style WebRTCManager stroke:#ffc107,stroke-width:2px
    style MultiplayerClientManager stroke:#ffc107,stroke-width:2px
    style MultiplayerGame stroke:#20c997,stroke-width:2px
    style HostLobbyComponent stroke:#0dcaf0,stroke-width:2px
    style JoinLobbyComponent stroke:#0dcaf0,stroke-width:2px
    style PlayerListComponent stroke:#0dcaf0,stroke-width:2px
    style AnswerListComponent stroke:#0dcaf0,stroke-width:2px
    style EventBus stroke:#aaaaaa,stroke-width:2px

    %% Core MP Components
    WebRTCManager
    MultiplayerGame("MP Game (Host)")
    MultiplayerClientManager("MP Client Mgr")
    EventBus

    %% Relevant UI
    HostLobbyComponent
    JoinLobbyComponent
    PlayerListComponent
    AnswerListComponent

    %% WebRTC -> EventBus (Raw Events)
    WebRTCManager -- "Connection/Msg/Error Events" --> EventBus

    %% EventBus -> Host Logic
    EventBus -- "Client Msgs / Disconnects" --> MultiplayerGame

    %% Host Logic -> EventBus (Syncing State to Clients)
    MultiplayerGame -- "Player/Game State Updates" --> EventBus
    MultiplayerGame -. "Calls WebRTC (Send)" .-> WebRTCManager

    %% EventBus -> Client Logic
    EventBus -- "Host Msgs / Disconnects" --> MultiplayerClientManager
    EventBus -- "Game State Sync from Host" --> MultiplayerClientManager

    %% Client UI -> EventBus (Player Actions)
    AnswerListComponent -- "Player Answer Submitted" --> EventBus

    %% EventBus -> Client Logic (Processing UI Actions)
    EventBus -- "Player Answer Submitted" --> MultiplayerClientManager

    %% Client Logic -> EventBus (Updating Local State / Sending to Host)
    MultiplayerClientManager -- "Processed State Updates" --> EventBus
    MultiplayerClientManager -. "Calls WebRTC (Send)" .-> WebRTCManager

    %% EventBus -> UI Updates
    EventBus -- "Connection Status / Errors" --> HostLobbyComponent
    EventBus -- "Connection Status / Errors" --> JoinLobbyComponent
    EventBus -- "Player List / Game State" --> HostLobbyComponent
    EventBus -- "Player List / Game State" --> JoinLobbyComponent
    EventBus -- "Player List / Game State" --> PlayerListComponent
```

## 5. Game End & Highscores Flow

Shows game completion, end dialogs, and highscore handling. Small nodes near the EventBus represent event categories.

```mermaid
graph TD
    %% Node Styles
    style BaseGameMode stroke:#20c997,stroke-width:2px
    style SinglePlayerEndDialog stroke:#0dcaf0,stroke-width:2px
    style MultiplayerEndDialog stroke:#0dcaf0,stroke-width:2px
    style PracticeEndDialog stroke:#0dcaf0,stroke-width:2px
    style HighscoresComponent stroke:#0dcaf0,stroke-width:2px
    style MainMenuComponent stroke:#0dcaf0,stroke-width:2px
    style GameCoordinator stroke:#e6e0f8,stroke-width:2px
    style UnicornPoep stroke:#e6e0f8,stroke-width:2px
    style HighscoreManager stroke:#ffc107,stroke-width:2px
    style EventBus stroke:#aaaaaa,stroke-width:2px
    %% Event Group Node Style
    style EvGroup_GameFinish fill:#f8f8f8,stroke:#ccc,stroke-width:1px
    style EvGroup_DialogUI fill:#f8f8f8,stroke:#ccc,stroke-width:1px
    style EvGroup_HighscoreMenuUI fill:#f8f8f8,stroke:#ccc,stroke-width:1px
    style EvGroup_HighscoreData fill:#f8f8f8,stroke:#ccc,stroke-width:1px
    style EvGroup_SystemFeedback fill:#f8f8f8,stroke:#ccc,stroke-width:1px
    style EvGroup_Navigation fill:#f8f8f8,stroke:#ccc,stroke-width:1px

    %% Event Group Nodes (near EventBus)
    EvGroup_GameFinish(("Game Finish"))
    EvGroup_DialogUI(("Dialog UI"))
    EvGroup_HighscoreMenuUI(("Highscore UI"))
    EvGroup_HighscoreData(("Highscore Data"))
    EvGroup_SystemFeedback(("System Feedback"))
    EvGroup_Navigation(("Navigation"))

    %% Flow Through Event Groups and EventBus
    BaseGameMode -- "Game.Finished" --> EvGroup_GameFinish
    EvGroup_GameFinish --> EventBus
    EventBus --> EvGroup_GameFinish -- "Trigger Save" --> GameCoordinator
    EventBus --> EvGroup_GameFinish -- "Trigger Dialog" --> SinglePlayerEndDialog
    EventBus --> EvGroup_GameFinish -- "Trigger Dialog" --> MultiplayerEndDialog
    EventBus --> EvGroup_GameFinish -- "Trigger Dialog" --> PracticeEndDialog

    GameCoordinator -. "Calls HighscoreManager" .-> HighscoreManager
    HighscoreManager -- "Save Feedback" --> EvGroup_SystemFeedback
    EvGroup_SystemFeedback --> EventBus
    %% EventBus --> EvGroup_SystemFeedback --> Potentially ToastComponent or other listeners

    SinglePlayerEndDialog -- "Dialog Actions" --> EvGroup_DialogUI
    MultiplayerEndDialog -- "Dialog Actions" --> EvGroup_DialogUI
    PracticeEndDialog -- "Dialog Actions" --> EvGroup_DialogUI
    EvGroup_DialogUI --> EventBus
    EventBus --> EvGroup_DialogUI -- "ReturnToMenu" --> UnicornPoep
    EventBus --> EvGroup_DialogUI -- "PlayAgain" --> GameCoordinator

    MainMenuComponent -- "Show Highscores" --> EvGroup_HighscoreMenuUI
    EvGroup_HighscoreMenuUI --> EventBus
    EventBus --> EvGroup_HighscoreMenuUI -- "Trigger Load" --> UnicornPoep

    UnicornPoep -- "Show Highscores View" --> EvGroup_Navigation
    EvGroup_Navigation --> EventBus
    EventBus --> EvGroup_Navigation -- "Navigate" --> UIManager

    UnicornPoep -. "Calls HighscoreManager" .-> HighscoreManager
    HighscoreManager -- "Loaded/Failed" --> EvGroup_HighscoreData
    EvGroup_HighscoreData --> EventBus
    EventBus --> EvGroup_HighscoreData -- "Loaded" --> HighscoresComponent
```

## 6. Custom Questions Management

Details the flow for creating, updating, and deleting custom question sheets.

```mermaid
graph TD
    %% Node Styles
    style CustomQuestionsComponent stroke:#0dcaf0,stroke-width:2px
    style ToastComponent stroke:#0dcaf0,stroke-width:2px
    style UnicornPoep stroke:#e6e0f8,stroke-width:2px
    style QuestionsManager stroke:#ffc107,stroke-width:2px
    style EventBus stroke:#aaaaaa,stroke-width:2px

    %% User Actions
    CustomQuestionsComponent -- "UI Events (CRUD)" --> EventBus

    %% Event Handling by Coordinator
    EventBus -- "UI Events (Save/Delete)" --> UnicornPoep

    %% Coordinator Calls Service
    UnicornPoep -. "Calls QuestionsManager" .-> QuestionsManager

    %% Service Emits Feedback
    QuestionsManager -- "System Feedback Events" --> EventBus

    %% Feedback Displayed
    EventBus -- "System Feedback Events" --> ToastComponent
    %% Could potentially update UI based on feedback
    EventBus -- "System Feedback Events" --> CustomQuestionsComponent
```