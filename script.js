// MULTIPLIERS:
let fieldData;

let maxTime = new Date(); // Time cap
let minTime = new Date();
let addOnZero = false;
let stopOnZero = false;
let start;
let isPaused = false;
let pausedRemainingSeconds = 0; // frozen time during pause

function countdown(seconds) {
    if (seconds === 0) return;

    if (isPaused) {
        // If paused, add time to pausedRemainingSeconds
        pausedRemainingSeconds += seconds;

        // Limit pausedRemainingSeconds to not exceed maxTime
        const now = new Date();
        const maxPausedTime = Math.floor((maxTime - now) / 1000);
        if (pausedRemainingSeconds > maxPausedTime) {
            pausedRemainingSeconds = maxPausedTime;
        }

        saveState();
        return; // Don't update active timer or UI while paused
    }

    // If not paused, update start normally
    let toCountDown = start || new Date();

    if (stopOnZero && toCountDown < new Date()) return;

    if (addOnZero) {
        let a = [toCountDown, new Date()];
        a.sort((a, b) => Date.parse(a) - Date.parse(b));
        toCountDown = a[1];
    }

    toCountDown.setSeconds(toCountDown.getSeconds() + seconds);

    let a = [toCountDown, maxTime];
    a.sort((a, b) => Date.parse(a) - Date.parse(b));
    toCountDown = new Date(a[0].getTime());
    start = toCountDown;

    $('#countdown').countdown(toCountDown, function (event) {
        if (isPaused) return; // Don't update display if paused

        if (event.type === "finish") {
            $(this).html(fieldData.onComplete);
        } else {
            $(this).html(event.strftime('%H:%M:%S'));
        }
    });

    saveState();
}

function pauseTimer() {
    isPaused = true;
    const now = new Date();

    // Calculate remaining time and save in pausedRemainingSeconds
    pausedRemainingSeconds = Math.max(0, Math.floor((start - now) / 1000));

    $('#countdown').countdown('pause');

    // Update UI to show frozen time
    updateCountdownDisplay(pausedRemainingSeconds);

    saveState();
}

function updateCountdownDisplay(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    $('#countdown').html(`${h}:${m}:${s}`);
}

function resumeTimer() {
    isPaused = false;
    const now = new Date();
    start = new Date(now.getTime() + pausedRemainingSeconds * 1000);
    pausedRemainingSeconds = 0;

    $('#countdown').countdown('resume');

    countdown(1); // Update UI with running timer
    saveState();
}

window.addEventListener('onEventReceived', function (obj) {
    const listener = obj.detail.listener;

    if (listener === 'message') {
        const { text, nick, tags, channel } = obj.detail.event.data;
        const userstate = {
            'mod': parseInt(tags.mod),
            'sub': parseInt(tags.subscriber),
            'vip': (tags.badges.indexOf("vip") !== -1),
            'badges': {
                'broadcaster': (nick === channel),
            }
        };

        const allowed = (userstate.mod && fieldData['managePermissions'] === 'mods') ||
            userstate.badges.broadcaster ||
            fieldData.additionalUsers.includes(nick.toLowerCase());

        if (!allowed) return;

        if (text.startsWith(fieldData.addTimeCommand)) {
            const seconds = parseFloat(text.split(' ')[1]) * 60;
            if (!isNaN(seconds)) countdown(seconds);
            return;
        }

        if (text.trim() === '!pausesub') {
            pauseTimer();
            return;
        }

        if (text.trim() === '!resumesub') {
            resumeTimer();
            return;
        }
    }

    if (obj.detail.event && obj.detail.event.listener === 'widget-button') {
        if (obj.detail.event.field === 'resetTimer') {
            minTime = new Date();
            minTime.setMinutes(minTime.getMinutes() + fieldData.minTime);
            maxTime = new Date();
            maxTime.setMinutes(maxTime.getMinutes() + fieldData.maxTime);
            start = minTime;
            isPaused = false;
            pausedRemainingSeconds = 0;
            countdown(1);
        }

        if (obj.detail.event.field === 'addTime') {
            countdown(60);
        }

        if (obj.detail.event.field === 'pauseTimer') {
            if (!isPaused) pauseTimer();
            else resumeTimer();
        }

        return;
    } else if (listener.indexOf("-latest") === -1) return;

    const data = obj.detail.event;

    if (listener === 'follower-latest') {
        if (fieldData.followSeconds !== 0) countdown(fieldData.followSeconds);
    } else if (listener === 'subscriber-latest') {
        if (data.bulkGifted) return;

        if (parseInt(data.tier) === 2000) {
            if (fieldData.sub2Seconds !== 0) countdown(fieldData.sub2Seconds);
        } else if (parseInt(data.tier) === 3000) {
            if (fieldData.sub3Seconds !== 0) countdown(fieldData.sub3Seconds);
        } else {
            if (fieldData.sub1Seconds !== 0) countdown(fieldData.sub1Seconds);
        }
    } else if (listener === 'host-latest') {
        if (data['amount'] >= fieldData.hostMin && fieldData.hostSeconds !== 0) {
            countdown(fieldData.hostSeconds * data["amount"]);
        }
    } else if (listener === 'raid-latest') {
        if (data['amount'] >= fieldData.raidMin && fieldData.raidSeconds !== 0) {
            countdown(fieldData.raidSeconds * data["amount"]);
        }
    } else if (listener === 'cheer-latest') {
        if (data['amount'] >= fieldData.cheerMin && fieldData.cheerSeconds !== 0) {
            countdown(parseInt(fieldData.cheerSeconds * data["amount"] / 100));
        }
    } else if (listener === 'tip-latest') {
        if (data['amount'] >= fieldData.tipMin && fieldData.tipSeconds !== 0) {
            countdown(parseInt(fieldData.tipSeconds * data["amount"]));
        }
    } else if (listener === 'merch-latest') {
        if (fieldData.merchSeconds !== 0) {
            countdown(parseInt(fieldData.merchSeconds * data["amount"]));
        }
    }
});

window.addEventListener('onWidgetLoad', function (obj) {
    fieldData = obj.detail.fieldData;
    addOnZero = (fieldData.addOnZero === "add");
    stopOnZero = (fieldData.addOnZero === "stop");
    fieldData.additionalUsers = fieldData.additionalUsers.toLowerCase().split(',').map(el => el.trim());
    loadState();
});

function saveState() {
    SE_API.store.set('marathon', {
        current: start,
        maxTime: maxTime,
        minTime: minTime,
        isPaused: isPaused,
        pausedRemainingSeconds: pausedRemainingSeconds
    });
}

function loadState() {
    SE_API.store.get('marathon').then(obj => {
        if (obj !== null) {
            let current = new Date();

            if (fieldData.preserveTime === "save") {
                current = new Date(obj.current);
                minTime = new Date(obj.minTime);
                maxTime = new Date(obj.maxTime);
                isPaused = obj.isPaused || false;
                pausedRemainingSeconds = obj.pausedRemainingSeconds || 0;
            } else if (fieldData.preserveTime === "restart") {
                minTime = new Date();
                current = minTime;
                minTime.setMinutes(minTime.getMinutes() + fieldData.minTime);
                maxTime = new Date();
                maxTime.setMinutes(maxTime.getMinutes() + fieldData.maxTime);
                start = minTime;
                isPaused = false;
                pausedRemainingSeconds = 0;
            }

            if (isPaused) {
                // If paused, show frozen time
                updateCountdownDisplay(pausedRemainingSeconds);
            } else {
                if (current > 0) {
                    current = Math.max(current, minTime);
                    start = new Date(current);
                    countdown(1);
                } else {
                    start = minTime;
                    countdown(0);
                }
            }
        } else {
            start = minTime;
            countdown(0);
        }
    });
}
