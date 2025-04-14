/**
 * Defines the possible overall states of the WebRTCManager.
 */
export const ConnectionStatus = {
    DISCONNECTED: 'disconnected',
    INITIALIZING_PEER: 'initializing-peer',
    AWAITING_CONNECTIONS: 'awaiting-connections', // Host ready
    CONNECTING_TO_HOST: 'connecting-to-host',
    CONNECTION_PENDING: 'connection-pending', // Client initiated, waiting for 'open'
    CONNECTED_HOST: 'connected-host',
    CONNECTED_CLIENT: 'connected-client',
    ERROR: 'error'
};

/**
 * Defines the possible states for an individual PeerJS DataConnection.
 */
export const DataConnectionState = {
    OPENING: 'opening',
    OPEN: 'open',
    CLOSING: 'closing',
    CLOSED: 'closed'
};

/**
 * Defines standardized reasons for disconnections.
 */
export const DisconnectionReason = {
    UNKNOWN: 'unknown',
    CLOSED_BY_REMOTE: 'closed',
    CONNECTION_ERROR: 'error',
    TIMEOUT: 'timeout',
    SHUTDOWN: 'shutdown',
    MANUAL_HOST_DISCONNECT: 'manual_host',
    MANUAL_CLIENT_DISCONNECT: 'manual_client', // If needed later
    PEER_UNAVAILABLE: 'peer-unavailable',
    SIGNALING_ERROR: 'signaling-error',
    MESSAGE_PARSE_ERROR: 'message_parse_error',
    DATA_HANDLER_ERROR: 'data_handler_error',
    SEND_ERROR_CLOSED: 'send-error-closed',
    INTERNAL_ERROR: 'internal_error',
    // Suffixes for clarity when errors happen during specific operations
    CLOSE_ERROR_SUFFIX: '_close_error',
    ALREADY_CLOSED_SUFFIX: '_already_closed'
};
