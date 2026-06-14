/**
 * eventLog.js — Interaction history log
 *
 * Maintains a rolling memory of the last 50 interactions
 * and formats a brief natural language summary of the user's action
 * for the AI enemy system.
 */

// Memory array to hold last 50 events
const eventLog = [];

/**
 * Adds an interaction event to the rolling memory.
 * @param {Object} event — unified event { type, source, confidence, timestamp }
 */
export function addEvent(event) {
    const entry = {
        type: event.type,
        source: event.source,
        timestamp: event.timestamp || Date.now()
    };
    eventLog.unshift(entry); // add to beginning

    // Maintain size limit of 50
    if (eventLog.length > 50) {
        eventLog.pop();
    }
}

/**
 * Retrieves events that occurred within the last N seconds.
 * Adds the 'secondsAgo' key dynamically.
 */
export function getRecentEvents(seconds) {
    const now = Date.now();
    const cutoff = now - (seconds * 1000);
    return eventLog
        .filter(entry => entry.timestamp >= cutoff)
        .map(entry => ({
            ...entry,
            secondsAgo: Math.max(0, Math.round((now - entry.timestamp) / 1000))
        }));
}

// Maps programmatic action types to user-friendly English descriptions
const ACTION_DESCRIPTIONS = {
    // Face actions
    'SMILE': 'smiled',
    'BLINK': 'blinked',
    'MOUTH_OPEN': 'opened their mouth',
    'LEFT_EYEBROW_RAISE': 'raised left eyebrow',
    'RIGHT_EYEBROW_RAISE': 'raised right eyebrow',
    'HEAD_NOD_UP': 'nodded up',
    'HEAD_NOD_DOWN': 'nodded down',
    'HEAD_TILT_LEFT': 'tilted head left',
    'HEAD_TILT_RIGHT': 'tilted head right',
    
    // Body actions
    'ARMS_RAISED': 'raised both arms',
    'LEFT_PUNCH': 'threw left punch',
    'RIGHT_PUNCH': 'threw right punch',
    'CROUCH': 'crouched',
    'LEAN_LEFT': 'leaned left',
    'LEAN_RIGHT': 'leaned right',
    
    // Hand gestures
    'FIST': 'formed a fist',
    'OPEN_PALM': 'showed an open palm',
    'POINT': 'pointed',
    'PINCH': 'pinched',
    'PEACE': 'made a peace sign',
    'THUMBS_UP': 'gave a thumbs up',
    'THUMBS_DOWN': 'gave a thumbs down',
    'GUN_SHAPE': 'formed a gun shape',
    'OK_SIGN': 'made an OK sign',
    'THREE_FINGERS': 'held up three fingers',
    'FOUR_FINGERS': 'held up four fingers',
    'CALL_ME': 'made a call me sign'
};

/**
 * Generates a plain English summary of the player's recent movements (last 5 seconds)
 * under 100 words.
 */
export function getSummary() {
    const recent = getRecentEvents(5); // last 5 seconds

    if (recent.length === 0) {
        return 'Player has been mostly idle for 5 seconds.';
    }

    // Process unique actions from newest to oldest
    const statements = [];
    const seenActions = new Set();

    recent.forEach((evt) => {
        if (seenActions.has(evt.type)) return;
        seenActions.add(evt.type);

        const desc = ACTION_DESCRIPTIONS[evt.type] || `performed ${evt.type}`;
        const timeText = evt.secondsAgo === 0 ? 'just now' : `${evt.secondsAgo} second${evt.secondsAgo > 1 ? 's' : ''} ago`;
        statements.push(`Player ${desc} ${timeText}.`);
    });

    // Join statements and truncate if necessary to keep it under 100 words
    let summaryString = statements.join(' ');
    const words = summaryString.split(' ');
    if (words.length > 90) {
        summaryString = words.slice(0, 90).join(' ') + '...';
    }

    return summaryString;
}

/**
 * Helper to expose the full event log array (for read-only operations)
 */
export function getFullLog() {
    return eventLog;
}
