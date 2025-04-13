# Refactor Progress (V2 Event-Based Architecture)

**Last Updated:** {Current Date/Time} - (Verified Core, Menu, Lobby Components)

**CRITICAL PROCESS REMINDER:** Before implementing or modifying *any* component/service listed in the plan or 'Next Steps', **ALWAYS CHECK if a V2 version already exists (`v2/js/...`)**. If it exists, **READ and UNDERSTAND** its current code *before* making any changes. Overwriting existing V2 code without review is **STRICTLY PROHIBITED**. Assume nothing; verify everything against the current `v2` codebase first. Ask if unsure.

**Goal:** Refactor the codebase into the `v2/` directory using an event-based architecture, decoupling components and improving maintainability, testability, and clarity, as outlined in `refactor-plan.md`.

**Development Process Note:**
*When modifying existing components, the following verification process **must** be followed:*
1.  *Identify the target component file.*
2.  *Read its existing code completely.*
3.  *Identify its dependencies and event listeners.*
4.  *Trace the origin of listened-to events to understand the exact payload structure (e.g., data types, units).*
5.  *Only then, propose changes that integrate required enhancements while strictly respecting the verified payload structure and existing logic.*
*Failure to verify payload details (like time units for `TimerDisplayComponent`) leads to incorrect implementations. **No assumptions should be made; verification against the source code is mandatory.** *

## Current Overall Status

Refactoring has established the core architecture (`EventBus`, `BaseComponent`, `BaseDialog`, `UIManager`, `UnicornPoep.js`, `event-constants.js`) which aligns with the plan. Key UI components for the main menu (`MainMenuComponent`), multiplayer selection (`MultiplayerChoiceComponent`), hosting (`HostLobbyComponent`), joining (`JoinLobbyComponent`), and in-game player list (`PlayerListComponent`) have been implemented and verified against the plan and `index.html`. They correctly emit and handle documented events. `UnicornPoep.js` correctly initializes the system and coordinates Custom Question CRUD operations.

**Issue Found:** Inconsistent player name length validation (20 chars in `JoinLobbyComponent`, 40 chars in `MultiplayerChoiceComponent`). Needs standardization (likely to 40).

Previous findings remain valid: Custom Questions CRUD, Highscores (UI verified), `GameCoordinator` (initial verification), `WebRTCManager` refinements, `MultiplayerClientManager` separation, Practice/SinglePlayer extending `BaseGameMode`, most utility/game UI components implemented but need deeper verification. Dialogs (`NamePrompt`, `SinglePlayerEnd`, `MultiplayerEnd`, `PracticeEnd`, `Confirmation`, `Waiting`, `Disconnection`, `Error`, `MultiplayerLobby`) are implemented but require full integration testing.

Refactoring established the core architecture and key features. Initial dialogs (`NamePrompt`, `SinglePlayerEnd`) were implemented correctly. **A major process error occurred where the existing `v2/js/dialogs/multiplayer-end-dialog.js` was incorrectly overwritten instead of being read first.** This has been reverted. The existing `MultiplayerEndDialog` uses a `Game.Finished` listener, deviating slightly from the strict coordinator pattern (pending decision on refactoring). **Another gap was identified and fixed: `MultiplayerChoiceComponent` previously lacked UI and logic for host difficulty selection, defaulting to 'medium'. This functionality has been added.** Progress continues with stricter adherence to verifying existing V2 code and functional requirements before modification.

## File Tree (`v2/`)

v2
├── css
│   ├── fredoka.css
│   └── styles.css
├── data
│   └── questions
│       ├── default_basis.json
│       └── default_geografie.json
├── favicon.ico
├── fonts
│   └── fredoka.ttf # Moved from img/
├── img
│   ├── apple-touch-icon-114x114.png
│   ├── apple-touch-icon-120x120.png
│   ├── apple-touch-icon-144x144.png
│   ├── apple-touch-icon-152x152.png
│   ├── apple-touch-icon-180x180.png
│   ├── apple-touch-icon-57x57.png
│   ├── apple-touch-icon-72x72.png
│   ├── apple-touch-icon-76x76.png
│   ├── apple-touch-icon.png
│   ├── background.webp
│   ├── heart.gif
│   ├── loading.gif
│   ├── logo.png
│   ├── logo.webp
│   └── site.webmanifest
├── index.html
└── js
    ├── UnicornPoep.js  # Main App Initializer & Coordinator (Handles Custom Q)
    ├── webrtcmanager.js # NOTE: This file seems misplaced, likely belongs in services/
    ├── config.json # Configuration file (likely for WebRTC or other settings)
    ├── components
    │   ├── about-component.js # Implemented & Verified [100%]
    │   ├── answer-list-component.js # Implemented (Basic + Keyboard Nav) [100%]
    │   ├── base-component.js # Implemented & Verified [100%]
    │   ├── countdown-component.js # Implemented (Needs Verification) [90%]
    │   ├── custom-questions-component.js # Implemented (CRUD) [100%]
    │   ├── game-area-component.js # Stub/Container [100%]
    │   ├── game-feedback-component.js # Implemented (Confetti, Body FX) [100%]
    │   ├── game-navigation-component.js # Implemented (Stop Button) [100%]
    │   ├── highscores-component.js # Implemented & Verified [100%]
    │   ├── host-lobby-component.js # Implemented & Verified [100%]
    │   ├── join-lobby-component.js # Implemented & Verified [10%]
    │   ├── loading-component.js # Implemented (Events) [100%]
    │   ├── main-menu-component.js # Implemented & Verified [100%]
    │   ├── multiplayer-choice-component.js # Implemented & Verified (Includes Host Difficulty Selection) [100%]
    │   ├── player-list-component.js # Implemented & Verified [100%]
    │   ├── progress-display-component.js # Implemented (Text + Progress Bar) [90%]
    │   ├── question-display-component.js # Implemented (Handles Text) [70%]
    │   ├── score-display-component.js # Implemented (Hides in MP, Shows SP/Practice) [100%]
    │   ├── sheet-selection-component.js # Implemented [100%]
    │   ├── sheet-title-display-component.js # Implemented (Needs Verification) [90%]
    │   ├── timer-display-component.js # Implemented (Handles ms, formats MM:SS, time states) [100%]
    │   └── toast-component.js # Implemented (Handles ShowFeedback, levels, auto-hide) [100%]
    ├── core
    │   ├── event-bus.js # Implemented [100%]
    │   └── event-constants.js # Implemented (Includes JSDoc Payloads) [100%]
    ├── dialogs
    │   └── base-dialog.js # Implemented & Verified [100%]
    │   ├── confirmation-dialog.js # Implemented (Needs integration testing) [80%]
    │   ├── disconnection-dialog.js # Implemented (Needs integration testing) [80%]
    │   ├── error-dialog.js # Implemented (Needs integration testing) [80%]
    │   ├── multiplayer-end-dialog.js # Implemented (Needs integration testing) [80%]
    │   ├── multiplayer-lobby-dialog.js # Implemented (Needs integration testing) [80%]
    │   ├── name-prompt-dialog.js # Implemented (Needs integration testing) [80%]
    │   ├── practice-end-dialog.js # Implemented (Needs integration testing) [80%]
    │   └── single-player-end-dialog.js # Implemented (Needs integration testing) [80%]
    │   └── waiting-dialog.js # Implemented (Needs integration testing) [80%]
    ├── game
    │   ├── BaseGameMode.js # Implemented [100%]
    │   ├── MultiplayerGame.js # Refactored (Host-side logic only, Client logic removed) [80%]
    │   ├── PracticeGame.js # Refactored to extend BaseGameMode [70%]
    │   └── SinglePlayerGame.js # Refactored to extend BaseGameMode [70%]
    ├── lib
    │   ├── confetti.js # Present [100%]
    │   └── peerjs.min.js # Present [100%]
    ├── services
    │   ├── GameCoordinator.js # Implemented  [90%]
    │   ├── HighscoreManager.js # Implemented (Based on V1) [100%]
    │   ├── MultiplayerClientManager.js # Implemented (Handles all client-side MP game logic) [100%]
    │   ├── MultiplayerHostManager.js # Implemented (Needs verification) [70%]
    │   ├── QuestionsManager.js # Implemented [100%]
    │   ├── QuizEngine.js # Refactored to passive service for BaseGameMode [100%]
    │   └── WebRTCManager.js # Refined (Error handling, state mgmt, cleanup) [100%]
    ├── ui
    │   └── UIManager.js # Implemented & Verified [100%]
    └── utils
        ├── arrayUtils.js # Implemented [100%]
        ├── easter-egg-activator.js # Implemented (Needs verification) [90%]
        ├── miscUtils.js # Implemented [100%]
        ├── player-list-utils.js # Implemented [90%]
        └── timer.js # Implemented (Event-emitter pattern: 'tick', 'end') [100%]


*(Note: Completion percentages reflect current status after validation and refactoring)*

## Implementation Correctness vs. V1

*   **Quiz Engine:**
    *   V2 Status: `QuizEngine` service refactored to align with `BaseGameMode`. Handles question loading, data access, shuffling, and answer checking as a passive service.
    *   Correctness: Aligns with the intended architecture. `BaseGameMode` now correctly uses `QuizEngine` methods.
*   **Core Game UI Components (`QuestionDisplay`, `AnswerList`, `ProgressDisplay`, `ScoreDisplay`, `TimerDisplay`):**
    *   V2 Status: Basic implementations exist, responding to events.
    *   Correctness: Follows component-based architecture. Need full review/enhancement.
*   **Core Architecture (`EventBus`, `BaseComponent`, `BaseDialog`, `UIManager`, `UnicornPoep.js`):**
    *   V2 Status: Implemented and verified.
    *   Correctness: Aligns with plan.
*   **Menu/Lobby Components (`MainMenu`, `MultiplayerChoice`, `HostLobby`, `JoinLobby`, `PlayerList`):**
    *   V2 Status: Implemented and verified.
    *   Correctness: Align with plan, emit/handle documented events.
*   **Game Coordinator:** Verified structure and coordination logic.
*   **Custom Questions:** Verified CRUD implementation.
*   **High Scores:** Verified persistence and rendering.
*   **Timer:** Refactored to use event-emitter pattern, matching `SinglePlayerGame` usage.
*   **Other Areas:** Dialogs implemented but need full testing. Other UI components (`SheetSelection`, game UI) need deeper verification.
*   **Game Modes (`SinglePlayerGame`, `PracticeGame`):**
    *   V2 Status: Correctly extend `BaseGameMode`.
    *   Correctness: Basic flow relies on `BaseGameMode` and refactored `QuizEngine`/`Timer`. Need integration testing.
*   **Multiplayer Logic Location:** 
 `MultiplayerClientManager.js` handles client-side game events/communication. `MultiplayerGame.js` handles host logic only.
`MultiplayerHostManager.js` handles server-side game events/communication. 

