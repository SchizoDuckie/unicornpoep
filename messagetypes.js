// Define message type constants (can be placed in a shared location or early script load)
const MessageTypes = Object.freeze({
    // Client -> Host
    C_REQUEST_JOIN: 'c_requestJoin',
    C_CONFIRM_JOIN: 'c_confirmJoin',
    C_SUBMIT_ANSWER: 'c_submitAnswer',
    C_PLAYER_FINISHED: 'c_playerFinished',
    C_UPDATE_NAME: 'c_updateName',
    C_DISCONNECTING: 'c_disconnecting', // Optional graceful disconnect
    C_HEARTBEAT: 'c_heartbeat', // Client -> Host

    // Host -> Client
    H_GAME_INFO: 'h_gameInfo',
    H_GAME_IN_PROGRESS: 'h_gameInProgress',
    H_JOIN_REJECTED: 'h_joinRejected',
    H_WELCOME: 'h_welcome',
    H_PLAYER_JOINED: 'h_playerJoined',
    H_PLAYER_DISCONNECTED: 'h_playerDisconnected',
    H_START_COUNTDOWN: 'h_startCountdown',
    H_START_GAME: 'h_startGame', // Optional explicit start signal
    H_GAME_STATE_UPDATE: 'h_gameStateUpdate',
    // H_PLAYER_FINISHED_UPDATE: 'h_playerFinishedUpdate', // Merged into gameStateUpdate
    H_FINAL_RESULTS: 'h_finalResults',
    H_RECORD_HIGHSCORE: 'h_recordHighscore', // <<< NEW: For broadcasting winner details to save
    H_HEARTBEAT: 'h_heartbeat' // Host -> Client
});

// Make available globally if not using modules
// window.MessageTypes = MessageTypes;