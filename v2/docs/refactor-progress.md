# Refactor Progress (V2 Event-Based Architecture)

**Last Updated:** {Current Date/Time} - (Refine WebRTCManager)

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

Refactoring has established the core architecture (EventBus, BaseComponent, Services) and implemented key features like Custom Questions (CRUD), core `GameCoordinator`, essential Menu/Lobby components, and `WebRTCManager` integration. Single Player and Practice modes correctly extend `BaseGameMode`. Core Game UI components (`AnswerList`, `QuestionDisplay`, `ProgressDisplay`, `TimerDisplay`) and utility components (`Loading`, `Toast`, `GameFeedback`, `PlayerList`, `GameNavigation`) are implemented. Initial dialogs (`NamePrompt`, `SinglePlayerEnd`) are now implemented. Validation confirmed most components match the plan and progress claims. Critical architectural mismatches identified in `QuizEngine.js` and `core/timer.js` have been resolved through refactoring. Minor issues (payload mismatch, navigation targets) were also fixed. **Client-side logic has been removed from `MultiplayerGame.js` to align with the plan, solidifying its role as host-only.** `MultiplayerClientManager.js` now correctly handles all client-side game communication. **`WebRTCManager.js` has been refined for robustness, error handling, state management, and cleanup.** **`MultiplayerChoiceComponent` was updated to include host difficulty selection, addressing a gap where it previously used a hardcoded default.** The next steps involve completing dialog implementation and integration testing.

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
    ├── components
    │   ├── about-component.js # Implemented & Verified [100%]
    │   ├── answer-list-component.js # Implemented (Basic + Keyboard Nav) [80%]
    │   ├── base-component.js # Implemented [100%]
    │   ├── countdown-component.js # Implemented (Needs Verification) [90%]
    │   ├── custom-questions-component.js # Implemented (CRUD) [100%]
    │   ├── game-area-component.js # Stub/Container [0%]
    │   ├── game-feedback-component.js # Implemented (Confetti, Body FX) [100%]
    │   ├── game-navigation-component.js # Implemented (Stop Button) [100%]
    │   ├── highscores-component.js # Implemented & Verified [100%]
    │   ├── host-lobby-component.js # Implemented & Verified [100%]
    │   ├── join-lobby-component.js # Implemented & Verified [100%]
    │   ├── loading-component.js # Implemented (Events) [100%]
    │   ├── main-menu-component.js # Implemented [100%]
    │   ├── multiplayer-choice-component.js # Implemented (Includes Host Difficulty Selection) [100%]
    │   ├── player-list-component.js # Implemented (Template, Events) [100%]
    │   ├── progress-display-component.js # Implemented (Text + Progress Bar) [90%]
    │   ├── question-display-component.js # Implemented (Handles Text) [70%]
    │   ├── score-display-component.js # Implemented (Hides in MP, Shows SP/Practice) [100%]
    │   ├── sheet-selection-component.js # Implemented [100%]
    │   ├── timer-display-component.js # Implemented (Handles ms, formats MM:SS, time states) [100%]
    │   └── toast-component.js # Implemented (Handles ShowFeedback, levels, auto-hide) [100%]
    ├── core
    │   ├── event-bus.js # Implemented [100%]
    │   └── event-constants.js # Implemented (Includes JSDoc Payloads) [100%]
    ├── dialogs
    │   └── base-dialog.js # Implemented (Specific dialog components missing) [50%]
    ├── game
    │   ├── BaseGameMode.js # Implemented [80%]
    │   ├── MultiplayerGame.js # Refactored (Host-side logic only, Client logic removed) [80%]
    │   ├── PracticeGame.js # Refactored to extend BaseGameMode [70%]
    │   └── SinglePlayerGame.js # Refactored to extend BaseGameMode [70%]
    ├── lib
    │   └── peerjs.min.js # Present [100%]
    ├── services
    │   ├── GameCoordinator.js # Implemented (Handles game start coordination) [90%]
    │   ├── HighscoreManager.js # Implemented (Based on V1) [100%]
    │   ├── MultiplayerClientManager.js # Implemented (Handles all client-side MP game logic) [100%]
    │   ├── QuestionsManager.js # Implemented [100%]
    │   ├── QuizEngine.js # Refactored to passive service for BaseGameMode [100%]
    │   └── WebRTCManager.js # Refined (Error handling, state mgmt, cleanup) [100%]
    ├── ui
    │   └── UIManager.js # Implemented (Basic view switching) [80%]
    └── utils
        ├── arrayUtils.js # Implemented [100%]
        ├── miscUtils.js # Implemented [100%]
        └── timer.js # Implemented (Event-emitter pattern: 'tick', 'end') [100%]


*(Note: Completion percentages reflect current status after validation and refactoring)*

## Implementation Correctness vs. V1

*   **Quiz Engine:**
    *   V2 Status: `QuizEngine` service refactored to align with `BaseGameMode`. Handles question loading, data access, shuffling, and answer checking as a passive service.
    *   Correctness: Aligns with the intended architecture. `BaseGameMode` now correctly uses `QuizEngine` methods.
*   **Core Game UI Components (`QuestionDisplay`, `AnswerList`, `ProgressDisplay`, `ScoreDisplay`, `TimerDisplay`):**
    *   V2 Status: Basic implementations exist, responding to events.
    *   Correctness: Follows component-based architecture. Need review/enhancement.
*   **Game Coordinator:** Verified structure and coordination logic.
*   **Custom Questions:** Verified CRUD implementation.
*   **High Scores:** Verified persistence and rendering.
*   **Timer:** Refactored to use event-emitter pattern, matching `SinglePlayerGame` usage.
*   **Other Areas:** Generally align with plan or are acknowledged deviations/stubs.
*   **Game Modes (`SinglePlayerGame`, `PracticeGame`):**
    *   V2 Status: Correctly extend `BaseGameMode`.
    *   Correctness: Basic flow relies on `BaseGameMode` and refactored `QuizEngine`/`Timer`. Need integration testing.
*   **Multiplayer Logic Location:** [RESOLVED] Client logic removed from `MultiplayerGame.js`. `MultiplayerClientManager.js` handles client-side game events/communication. `MultiplayerGame.js` handles host logic only.

## Adherence to Refactor Plan (`refactor-plan.md`)

*   Plan largely followed for implemented core architecture and completed components.
*   Event-based communication and decoupling achieved for implemented parts.
*   `<template>` UI Pattern: Used correctly in `HighscoresComponent` and `PlayerListComponent`.
*   Coordinator Pattern: Implemented correctly in `GameCoordinator` and `UnicornPoep.js`.
*   Deviation: ~~Multiplayer client logic merged into MultiplayerGame.js (acknowledged).~~ [RESOLVED] Client logic separated into `MultiplayerClientManager.js`.
*   Enhancement: `BaseComponent` throws Error if root element not found (verified).
*   Correction: `TimerDisplayComponent` correctly handles millisecond payloads (verified).
*   Gap: Specific dialog components need implementation. Basic UI components (`AnswerList`, `ScoreDisplay`, `ProgressDisplay`, `QuestionDisplay`) need review/enhancement.
*   Gap: Multiplayer host difficulty selection was missing. [RESOLVED]

## Translation Refactoring Progress (Moving Strings to HTML)

**(See `translation-plan.md` for details - Note: List below is updated based on verification)**

*   **Status:** In Progress
*   **Goal:** Move all user-facing strings from JS to `v2/index.html`, replace `alert/confirm`.
*   **High Priority:** ~~Replace `confirm()` in `v2/js/services/QuestionsManager.js`~~ (**DONE**) and ~~`v2/js/components/custom-questions-component.js`~~ (**DONE - Replaced by Coordinator pattern**).
*   **Files Requiring Refactoring:**
    *   `v2/js/components/join-lobby-component.js`
    *   `v2/js/components/loading-component.js`
    *   `v2/js/components/main-menu-component.js`
    *   `v2/js/components/multiplayer-choice-component.js`
    *   `v2/js/components/player-list-component.js`
    *   `v2/js/components/progress-display-component.js`
    *   `v2/js/components/score-display-component.js`
    *   `v2/js/components/sheet-selection-component.js`
    *   `v2/js/dialogs/disconnection-dialog.js`
    *   `v2/js/dialogs/error-dialog.js`
    *   `v2/js/dialogs/multiplayer-end-dialog.js`
    *   `v2/js/dialogs/single-player-end-dialog.js`
    *   `v2/js/services/HighscoreManager.js`
    *   `v2/js/services/MultiplayerClientManager.js`
    *   `v2/js/services/QuizEngine.js`
    *   `v2/js/services/WebRTCManager.js`
    *   `v2/js/ui/UIManager.js`
    *   `v2/js/utils/easter-egg-activator.js`
    *   `v2/js/game/BaseGameMode.js`
    *   `v2/js/game/MultiplayerGame.js`
    *   `v2/js/UnicornPoep.js`
*   **Files Confirmed OK:**
    *   `v2/js/components/about-component.js`
    *   `v2/js/components/answer-list-component.js`
    *   `v2/js/components/base-component.js`
    *   `v2/js/components/game-area-component.js`
    *   `v2/js/components/game-feedback-component.js`
    *   `v2/js/components/game-navigation-component.js`
    *   `v2/js/components/question-display-component.js`
    *   `v2/js/components/timer-display-component.js`
    *   `v2/js/components/toast-component.js`
    *   `v2/js/core/event-bus.js`
    *   `v2/js/core/event-constants.js`
    *   `v2/js/core/timer.js`
    *   `v2/js/dialogs/base-dialog.js`
    *   `v2/js/dialogs/name-prompt-dialog.js`
    *   `v2/js/dialogs/practice-end-dialog.js`
    *   `v2/js/game/PracticeGame.js`
    *   `v2/js/game/SinglePlayerGame.js`
    *   `v2/js/services/GameCoordinator.js` (Assumed OK - Needs final check if modified)
    *   `v2/js/ui/AnswerListComponent.js`
    *   `v2/js/utils/arrayUtils.js`
    *   `v2/js/utils/miscUtils.js`

## Validation Findings & Resolutions

*   **`