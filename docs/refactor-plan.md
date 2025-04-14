# GameCoordinator Refactoring Plan: Component-Driven Architecture

## 1. Problem Statement

The current `GameCoordinator` class is excessively large and complex, handling too many responsibilities related to multiplayer game management:

- **Excessive Responsibilities**: The class manages game creation, lobby management, player connections, game state, navigation, and more - violating the Single Responsibility Principle.
- **Multiplayer Focus**: Despite its generic name, `GameCoordinator` is predominantly focused on multiplayer logic, with ~70% of its code dedicated to multiplayer-specific handling.
- **Navigation Control**: The coordinator directly manages navigation that belongs in UI components.
- **Component Coupling**: Components rely on `GameCoordinator` for functionality they need to manage internally.
- **Callback Hell**: Multiple nested event handlers and callbacks make the code flow difficult to trace and maintain.

## 2. Solution: Component-Driven Architecture with Event-Based Communication

We will refactor to a component-driven architecture where:

1. **Components Handle Their Own Logic**: UI components manage their own initialization, event handling, and navigation.
2. **Lightweight Coordination**: `GameCoordinator` becomes a lightweight service that creates game instances and maintains minimal global state, with no direct control over navigation or component logic.
3. **Direct Menu Integration**: Multiplayer options appear directly in the main menu without a separate component.
4. **Clear Separation of Concerns**: Each class has clearly defined responsibilities with minimal overlap.
5. **Event-Based Communication**: All inter-component and inter-service interactions occur via the `EventBus` using events defined in `event-constants.js`, ensuring explicit bindings and decoupling. Direct method calls between components or services are prohibited unless performance-critical and explicitly documented.

## 3. Implementation Strategy

### 3.1 Main Menu Integration

- Remove the separate `MultiplayerChoiceComponent`.
- Add "Host Game" and "Join Game" buttons directly to the main menu.
- Each button captures necessary information (player name) via a simple dialog.
- The main menu component handles navigation to appropriate screens by emitting events like `Game.StartRequested`.

### 3.2 Component Refactoring

- Each component takes responsibility for its own logic and state management.
- Components communicate exclusively via events defined in `event-constants.js` rather than direct coordinator method calls.
- Navigation happens through components emitting navigation events (e.g., `Navigation.ShowView`) and listening for relevant responses.
- Leverage the updated `BaseComponent` interface to define event listeners and setup logic declaratively within the `initialize()` method, ensuring implicit management of event listeners.

### 3.3 Service Management

- `MultiplayerHostManager` and `MultiplayerClientManager` handle their specific connection logic, listening and emitting events like `Multiplayer.Host.Initialized` or `Multiplayer.Client.ConnectedToHost`.
- `WebRTCManager` focuses purely on the WebRTC connection layer, emitting events like `WebRTC.MessageReceived` for other components to handle.
- Game classes (`SinglePlayerGame`, `MultiplayerHostGame`, `MultiplayerClientGame`, etc.) manage their own lifecycle, using events like `Game.Started` and `Game.Finished` to signal state changes.

### 3.4 Event-Driven Architecture

- **EventBus as Mailman**: The `EventBus` (from `event-bus.js`) acts solely as a dispatcher with no logic beyond event delivery, ensuring all bindings are explicit through `eventBus.on` and `eventBus.emit`.
- **Event Definitions**: Expand `event-constants.js` to cover all interactions currently managed by `GameCoordinator` method calls, ensuring each event has a documented payload structure.
- **Component and Service Events**: Each component and service must define which events it emits and listens to, replacing direct method calls with event-based communication.
- **Implicit Event Management**: Utilize the `BaseComponent` class's implicit event listener management by defining events in the `initialize()` configuration, automating listener addition and removal during the component lifecycle.

### 3.5 Performance and Risk Management

- **Performance Goals**: Set specific performance targets, especially for multiplayer scenarios (e.g., maximum 100ms latency for WebRTC message handling, minimal overhead for frequent events like `Game.TimeTick`).
- **Risk Mitigation**: Identify high-risk areas such as multiplayer state synchronization and propose strategies like a shared state manager or event bus for consistency across host and client.
- **Event Overhead Mitigation**: Batch events or allow direct calls for performance-critical paths (e.g., rapid game updates), with explicit documentation for exceptions.

### 3.6 Callback Complexity Resolution

- Replace nested callbacks with structured event chains or modern JavaScript patterns like async/await to improve readability.
- Use sequential events to represent complex flows (e.g., `Multiplayer.Host.Initialized` followed by `Navigation.ShowView`) rather than nested handlers.

## 4. Component Responsibilities

### 4.1 MainMenuComponent

**Responsibilities:**
- Handle player name input for all game modes.
- Navigate directly to appropriate views by emitting events:
  - Emit `Game.StartRequested` with mode 'single' or 'practice' for single-player/practice.
  - Emit `Game.StartRequested` with mode 'multiplayer-host' or 'multiplayer-join' for multiplayer scenarios.
- Listen for `System.ShowFeedback` to display errors if a game is active.

**Removed dependencies:**
- No longer needs `handleRequestMultiplayerChoice`.
- No longer relies on coordinator for navigation.

**Initialization Configuration:**
- Define event listeners declaratively in `initialize()` for events like `UI.MainMenu.StartSinglePlayerClicked` and `UI.MainMenu.JoinMultiplayerClicked`.

### 4.2 JoinLobbyComponent

**Responsibilities:**
- Capture and validate join code.
- Emit `Multiplayer.Client.Connecting` to initiate connection via `WebRTCManager`.
- Listen for `Multiplayer.Client.GameInfoReceived` to display game information from host.
- Emit `UI.JoinLobby.ConfirmClicked` to send join requests via `MultiplayerClientManager`.
- Emit `Navigation.ShowView` to navigate to multiplayer lobby on confirmation.

**Events to Implement:**
- Emit: `Multiplayer.Client.Connecting`, `UI.JoinLobby.SubmitCodeClicked`, `UI.JoinLobby.ConfirmClicked`.
- Listen: `Multiplayer.Client.GameInfoReceived`, `WebRTC.ConnectionFailed`.

**Initialization Configuration:**
- Define event listeners in `initialize()` for `Multiplayer.Client.GameInfoReceived` and `WebRTC.ConnectionFailed`.

**Methods to implement (currently in coordinator):**
- `_handleJoinAttempt` (from `handleJoinMultiplayerAttempt`).
- `_handleGameInfoReceived` (from `handleClientReceivedGameInfo`). 
- `_handleConfirmJoin` (from `handleClientConfirmJoin`).

### 4.3 HostLobbyComponent

**Responsibilities:**
- Display connected players.
- Update player list by listening to `Multiplayer.Common.PlayerListUpdated`.
- Validate when to enable "Start Game" button based on connected clients.
- Emit `UI.HostLobby.StartGameClicked` to initiate game start sequence.

**Events to Implement:**
- Emit: `UI.HostLobby.StartGameClicked`, `UI.HostLobby.CancelClicked`.
- Listen: `Multiplayer.Common.PlayerListUpdated`, `Multiplayer.Host.ClientConnected`.

**Initialization Configuration:**
- Define event listeners in `initialize()` for `Multiplayer.Common.PlayerListUpdated` and `Multiplayer.Host.ClientConnected`.

**Methods to implement (currently in coordinator):**
- `_handlePlayerListUpdate` (from current coordinator method).
- `_handleStartGame` (from `handleHostStartGame`).

### 4.4 Game Classes

#### 4.4.1 MultiplayerHostGame

**Responsibilities:**
- Manage host-side game logic and state.
- Track player progress by listening to `Multiplayer.Host.PlayerAnswered`.
- Process incoming messages by listening to `WebRTC.MessageReceived`.
- Handle game completion logic and emit `Game.Finished`.
- Broadcast updates to clients via `Multiplayer.Common.SendMessage`.

**Events to Implement:**
- Emit: `Game.Finished`, `Multiplayer.Host.AllPlayersAnswered`, `Multiplayer.Common.SendMessage`.
- Listen: `Multiplayer.Host.PlayerAnswered`, `WebRTC.MessageReceived`.

**Initialization Configuration:**
- Define event listeners in `initialize()` for `Multiplayer.Host.PlayerAnswered` and `WebRTC.MessageReceived`.

**Methods to implement (currently in coordinator):**
- Game message handling (from `_handleWebRTCMessageReceived`).
- Host waiting functionality (from `_handleHostWaiting`).
- Player list management (from `_handlePlayerListUpdate`).

#### 4.4.2 MultiplayerClientGame

**Responsibilities:**
- Manage client-side game logic and state.
- Send updates to host via `Multiplayer.Common.SendMessage`.
- Process incoming messages by listening to `WebRTC.MessageReceived`.
- Handle local game completion and emit `Game.LocalPlayerFinished`.

**Events to Implement:**
- Emit: `Game.LocalPlayerFinished`, `Multiplayer.Common.SendMessage`.
- Listen: `WebRTC.MessageReceived`, `Multiplayer.Common.GameStateSync`.

**Initialization Configuration:**
- Define event listeners in `initialize()` for `WebRTC.MessageReceived` and `Multiplayer.Common.GameStateSync`.

**Methods to implement (currently in coordinator):**
- Game message handling (from `_handleWebRTCMessageReceived`).
- Local player finished handling (from `_handleLocalPlayerFinished`).

### 4.5 GameCoordinator

**Reduced responsibilities:**
- Create appropriate game instances based on mode by listening to `Game.StartRequested`.
- Maintain minimal global state (active game reference only).
- Provide a central reset method for cleanup, triggered by events like `Game.Finished`.
- Handle only truly global events affecting multiple components (e.g., `Game.Finished` for cleanup).

**Events to Implement:**
- Emit: `System.ShowFeedback` for global errors, `Navigation.ShowView` only for initial game setup if needed.
- Listen: `Game.StartRequested`, `Game.Finished`, `UI.EndDialog.PlayAgainClicked`.

**Initialization Configuration:**
- Define event listeners in `initialize()` for global events like `Game.StartRequested` and `Game.Finished`.

**Methods to retain (simplified via events):**
- `resetCoordinatorState` (triggered by `Game.Finished`).
- Simplified game creation triggered by `Game.StartRequested`.

**Removed Methods:**
- All navigation methods (handled by components emitting `Navigation.ShowView`).
- Multiplayer-specific logic (handled by game classes and services via events).

## 5. Task Breakdown

### Phase 1: Main Menu Integration and Event Setup

1. Modify `MainMenuComponent` to include host and join buttons.
2. Implement name prompt dialog interactions, emitting `Game.StartRequested` with appropriate mode.
3. Add direct navigation via `Navigation.ShowView` events to appropriate views.
4. Remove `MultiplayerChoiceComponent` and related coordinator methods.
5. Review and expand `event-constants.js` to cover all current `GameCoordinator` interactions as events with documented payloads.
6. Ensure `BaseComponent` is updated with the implicit event listener interface, allowing declarative event configuration in `initialize()`.

### Phase 2: Component Logic Migration with Event Bindings

7. Move join lobby logic to `JoinLobbyComponent`, implementing event listeners for `Multiplayer.Client.GameInfoReceived` and emitters for `Multiplayer.Client.Connecting` using the `initialize()` configuration.
8. Move host lobby logic to `HostLobbyComponent`, using events like `Multiplayer.Common.PlayerListUpdated` for updates, defined in `initialize()`.
9. Split `MultiplayerGame` into dedicated `MultiplayerHostGame` and `MultiplayerClientGame` classes, ensuring they communicate via `WebRTC.MessageReceived` and related events, configured in `initialize()`.
10. Move game message handling into appropriate game classes, replacing direct calls with event listeners defined in `initialize()`.
11. Implement proper event handling in all components, ensuring no direct method calls to `GameCoordinator` or other services, using the declarative event setup.

### Phase 3: GameCoordinator Simplification and Interface Definition

12. Remove the following redundant navigation methods from GameCoordinator:
    - `handleRequestSinglePlayer`: Replaced by `MainMenuComponent` emitting `Game.StartRequested`.
    - `handleRequestPractice`: Replaced by `MainMenuComponent` emitting `Game.StartRequested`.
    - `handleRequestMultiplayerChoice`: No longer needed after removing MultiplayerChoiceComponent.
    - `handleShowJoinLobby`: Replaced by `JoinLobbyComponent` emitting `Navigation.ShowView`.
    - `handleStartMultiplayerHost`: Replaced by event-driven flow from `MainMenuComponent`.
13. Simplify game creation methods to respond only to `Game.StartRequested`.
14. Ensure proper state management for active game reference, updated via events like `Game.Started` and `Game.Finished`.
15. Update event listeners in `GameCoordinator` to match new architecture, limiting to global concerns, and defined in `initialize()`.
16. Define clear interfaces for event payloads in `event-constants.js`, ensuring components and services have predictable communication contracts.

### Phase 4: Testing, Verification, and Performance Optimization

17. Test all game flows (single-player, practice, host, join) to ensure event-driven communication works as expected.
18. Verify game state consistency across players, especially for multiplayer sync, using a shared state manager if needed.
19. Test error handling and edge cases, ensuring events like `WebRTC.ConnectionFailed` are handled gracefully.
20. Conduct performance testing for multiplayer scenarios, targeting maximum 100ms latency for WebRTC events and minimal overhead for frequent events.
21. Trace event flows using `EventBus` debug logs to debug complex interactions, ensuring no direct method calls bypass the event system and that declarative configurations in `initialize()` are correctly applied.

## 6. Development Guidelines

1. **Complete One Component at a Time**: Fully refactor one component, including its event bindings, before moving to the next.
2. **Test Each Change**: After each component refactor, test all related flows to ensure events are emitted and received correctly.
3. **Incremental Coordinator Simplification**: Gradually remove coordinator methods as component event replacements are implemented.
4. **Preserve Event Structure**: Maintain existing event payloads in `event-constants.js` to minimize disruption, expanding only as needed.
5. **Document Event Dependencies**: For each component and service, document which events it emits and listens to, ensuring explicit bindings.
6. **Mitigate Performance Risks**: Batch events or use direct calls only for performance-critical operations, with clear documentation for exceptions.
7. **Resolve Callback Complexity**: Refactor nested callbacks into event chains or async/await patterns, ensuring readability of event-driven flows.
8. **Use Declarative Event Configuration**: Define all event listeners and setup logic in the `initialize()` method of components, leveraging the implicit event management of `BaseComponent` for clarity and simplicity.