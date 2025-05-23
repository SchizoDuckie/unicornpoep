/**
 * Defines constants for WebRTC message types used throughout the application.
 */
export const MSG_TYPE = {
    // Internal WebRTC Manager types
    PING: 'kwek',
    PONG: 'kwaak',

    // Connection Lifecycle / Info
    CLIENT_HELLO: 'client_hello', // Client -> Host: Announce presence and name
    GAME_INFO: 'game_info',       // Host -> Client: Initial game setup details (questions, settings, players)
    PLAYER_LIST_UPDATE: 'player_list_update', // Host -> Client(s): Updated player list
    PLAYER_LEFT: 'player_left',    // Client -> Host: Voluntary disconnect
    ERROR: 'error',              // Generic error message

    // Lobby Phase Messages (Client -> Host)
    C_REQUEST_JOIN: 'c_requestJoin', // Client -> Host: Request to formally join after getting GAME_INFO
    C_UPDATE_NAME: 'c_updateName',   // Client -> Host: Update player name in lobby

    // Game Phase Messages
    GAME_START: 'game_start', // Host -> Client(s): Signal game begin
    GAME_OVER: 'game_over', // Host -> Client(s): Signal game end and send results
    ANSWER_SUBMITTED: 'answer_submitted', // Client -> Host: Submit an answer (if host needs to track/validate)
    CLIENT_FINISHED: 'client_finished', // Client -> Host: Signal local quiz completion with score

    // Possible future types (or handled differently):
    // GAME_STATE_UPDATE: 'game_state_update', // Host -> Client(s): For more complex real-time updates?
    // PLAYER_ACTION: 'player_action', // For other in-game actions

    // --- NEW TYPES ---
    C_SCORE_UPDATE: 'c_score_update',       // Client -> Host (During game)
    H_PLAYER_SCORES_UPDATE: 'h_player_scores_update', // Host -> Client(s): Updated scores during game
    H_START_MULTIPLAYER_GAME: 'h_start_multiplayer_game', // Host signals clients to start core game logic
    // --- Game Over Command (Host -> Client) ---
    H_COMMAND_GAME_OVER: 'h_command_game_over', // Host -> Client: Command to display final results
    // --- END NEW TYPES ---

};

// Optional: Add a check for duplicate values if desired during development
// const values = Object.values(MSG_TYPE);
// if (new Set(values).size !== values.length) {
//     console.error("Duplicate values found in MSG_TYPE!");
// } 