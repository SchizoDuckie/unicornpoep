export const MSG_TYPE = {
    // Generic/System
    PING: '__ping__',         // Heartbeat check
    PONG: '__pong__',         // Heartbeat response
    FEEDBACK: 'feedback',     // General feedback message (info, warn, error)
    PLAYER_LIST_UPDATE: 'player_list_update', // Sent by host during lobby/game

    // Client -> Host (Lobby)
    CLIENT_HELLO: 'client_hello',     // Initial connection message with client name
    C_REQUEST_JOIN: 'c_requestJoin', // Client confirms joining after seeing game info
    CLIENT_READY: 'client_ready',   // Client indicates readiness in lobby (if applicable)
    C_REQUEST_REMATCH: 'c_request_rematch', // Client wants to play again

    // Host -> Client (Lobby)
    GAME_INFO: 'game_info',         // Host sends game settings/questions to client
    H_JOIN_ACCEPTED: 'h_join_accepted', // Host confirms client join (optional)
    H_JOIN_REJECTED: 'h_join_rejected', // Host rejects client join (e.g., lobby full)
    H_REMATCH_ACCEPTED: 'h_rematch_accepted', // Host confirms rematch will start
    H_REMATCH_REJECTED: 'h_rematch_rejected', // Host rejects rematch request
    H_RESTARTING_LOBBY: 'h_restarting_lobby', // Host signals lobby is restarting for rematch

    // Host -> Client (Game Start/End)
    GAME_START: 'game_start',       // Host signals game is starting
    GAME_OVER: 'game_over',         // Host signals game end and sends results
    H_PLAYER_SCORES_UPDATE: 'h_playerScoresUpdate', // Host sends score updates during game

    // Client -> Host (Game)
    C_SCORE_UPDATE: 'c_scoreUpdate',   // Client sends its score update to host
    ANSWER_SUBMITTED: 'answer_submitted', // Client sends its answer (more complex games)
    CLIENT_FINISHED: 'client_finished', // Client signals they finished all questions
    CLIENT_LEFT: 'client_left',       // Client voluntarily leaves mid-game
}; 