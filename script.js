// MULTIPLIERS:
let fieldData;

let maxTime = new Date(); 
let minTime = new Date();
let addOnZero = false;
let stopOnZero = false;
let start;
let isPaused = false;
let pausedRemainingSeconds = 0; 
let timerInterval = null; 

function countdown(seconds) {
    if (seconds === 0) return;

    if (isPaused) {
        pausedRemainingSeconds += seconds;

        const now = new Date();
        const maxPausedTime = Math.floor((maxTime - now) / 1000);
        if (pausedRemainingSeconds > maxPausedTime) {
            pausedRemainingSeconds = maxPausedTime;
        }

        saveState();
        return; 
    }

    let toCountDown = start || new Date();

    if (stopOnZero && toCountDown < new Date()) return;

    if (addOnZero) {
        let a = [toCountDown, new Date()];
        a.sort((a, b) => Date.parse(a) - Date.parse(b));
        toCountDown = a[1];
    }

    toCountDown.setTime(toCountDown.getTime() + seconds * 1000);

    let a = [toCountDown, maxTime];
    a.sort((a, b) => Date.parse(a) - Date.parse(b));
    toCountDown = new Date(a[0].getTime());
    start = toCountDown;

    if (timerInterval) {
        clearInterval(timerInterval);
    }

   
    startCustomTimer();

    saveState();
}

function startCustomTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    timerInterval = setInterval(() => {
        if (isPaused) return; 

        const now = new Date();
        const totalSeconds = Math.floor((start - now) / 1000);
        
        if (totalSeconds <= 0) {
            // Timer finished
            clearInterval(timerInterval);
            timerInterval = null;
            $('#countdown').html(fieldData.onComplete);
            updateCountdownDisplay(0);
        } else {
            updateCountdownDisplay(totalSeconds);
        }
    }, 1000);
}

function pauseTimer() {
    isPaused = true;
    const now = new Date();

    pausedRemainingSeconds = Math.max(0, Math.floor((start - now) / 1000));

    // Stop the custom timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    updateCountdownDisplay(pausedRemainingSeconds);

    saveState();
}

function updateCountdownDisplay(seconds) {
    const hours = Math.floor(seconds / 3600);
    const h = hours.toString().padStart(2, '0'); 
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    $('#countdown').html(`${h}:${m}:${s}`);
}

function resumeTimer() {
    isPaused = false;
    const now = new Date();
    start = new Date(now.getTime() + pausedRemainingSeconds * 1000);
    
    // Start the custom timer
    startCustomTimer();
    
    pausedRemainingSeconds = 0;
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

window.addEventListener('beforeunload', function() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
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
                updateCountdownDisplay(pausedRemainingSeconds);
            } else {
                if (current > 0) {
                    current = Math.max(current, minTime);
                    start = new Date(current);
                    startCustomTimer();
                } else {
                    start = minTime;
                    updateCountdownDisplay(0);
                }
            }
        } else {
            start = minTime;
            updateCountdownDisplay(0);
        }
    });
}
