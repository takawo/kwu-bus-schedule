let scheduleData = null;
let customTime = null; // 編集された時刻を保持
let customDate = null; // 編集された日付を保持
let currentRoute = 'motoyama'; // 'motoyama' または 'university'
let currentScheduleType = 'normal'; // 'normal', 'special', 'saturday', 'none'

// URLパラメータからdebugModeを取得
function getDebugMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debugMode') === 'true';
}

const isDebugMode = getDebugMode();

// 日付からスケジュールタイプを判定
function getScheduleType(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 0-11 -> 1-12
    const day = date.getDate();
    const dayOfWeek = date.getDay(); // 0=日, 6=土

    // 日曜日は運行なし
    if (dayOfWeek === 0) {
        return 'none';
    }

    const dateNum = year * 10000 + month * 100 + day;

    // 特別ダイヤの期間をチェック（優先度が高い）
    const specialPeriods = [
        // 2025年
        { start: 20250401, end: 20250402 },
        { start: 20250404, end: 20250409 },
        { start: 20250710, end: 20250711 },
        { start: 20250716, end: 20250806 },
        { start: 20250818, end: 20250926 },
        { start: 20251222, end: 20251226 },
        // 2026年
        { start: 20260106, end: 20260107 },
        { start: 20260116, end: 20260116 },
        { start: 20260120, end: 20260331 }
    ];

    for (const period of specialPeriods) {
        if (dateNum >= period.start && dateNum <= period.end) {
            // 土・日・祝を除く（簡略化のため、土日のみチェック）
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                return 'special';
            }
        }
    }

    // 土曜日ダイヤ（3～5月のみ、第2土曜日と祝日は運休）
    if (dayOfWeek === 6 && (month === 3 || month === 4 || month === 5)) {
        // 第2土曜日の判定（月の最初の土曜日から数えて2番目）
        const firstDay = new Date(year, month - 1, 1);
        const firstDayOfWeek = firstDay.getDay();
        // 最初の土曜日を求める
        const daysUntilFirstSaturday = (6 - firstDayOfWeek + 7) % 7;
        const firstSaturday = daysUntilFirstSaturday === 0 ? 7 : daysUntilFirstSaturday;
        const secondSaturday = firstSaturday + 7;

        if (day === secondSaturday) {
            return 'none'; // 第2土曜日は運休
        }
        // 祝日の判定は簡略化（実際の祝日カレンダーが必要）
        return 'saturday';
    }

    // 平日ダイヤの期間をチェック
    const normalPeriods = [
        // 2025年
        { start: 20250410, end: 20250709 },
        { start: 20250714, end: 20250715 },
        { start: 20250929, end: 20251219 },
        // 2026年
        { start: 20260108, end: 20260115 },
        { start: 20260119, end: 20260119 }
    ];

    // 平日ダイヤの例外日（祝日だが運行する日）
    const normalExceptions = [20250429, 20251013, 20251103, 20251124];

    // 例外日をチェック（優先）
    if (normalExceptions.includes(dateNum)) {
        return 'normal';
    }

    // 平日ダイヤの期間をチェック
    for (const period of normalPeriods) {
        if (dateNum >= period.start && dateNum <= period.end) {
            // 土・日を除く
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                return 'normal';
            }
        }
    }

    // それ以外は運行なし
    return 'none';
}

// スケジュールデータを読み込む
async function loadSchedule(route = 'motoyama', scheduleType = null) {
    try {
        // スケジュールタイプが指定されていない場合は、選択された日付から判定
        if (!scheduleType) {
            const targetDate = customDate ? new Date(customDate) : new Date();
            scheduleType = getScheduleType(targetDate);
            currentScheduleType = scheduleType;
        }

        let fileName;
        if (scheduleType === 'none') {
            scheduleData = null;
            updateDisplay();
            updateRouteButtons();
            return;
        }

        const routePrefix = route === 'motoyama' ? 'bus_schedule_motoyama' : 'bus_schedule_daigaku';

        if (scheduleType === 'special') {
            fileName = `${routePrefix}_special.json`;
        } else if (scheduleType === 'saturday') {
            fileName = `${routePrefix}_saturday.json`;
        } else {
            fileName = `${routePrefix}.json`;
        }

        const response = await fetch(fileName);
        scheduleData = await response.json();
        currentRoute = route;
        currentScheduleType = scheduleType;
        updateDisplay();
        updateRouteButtons();
    } catch (error) {
        console.error('スケジュールデータの読み込みに失敗しました:', error);
        document.getElementById('nextBus').innerHTML =
            '<div class="no-service">データの読み込みに失敗しました</div>';
    }
}

// ルートボタンの状態を更新
function updateRouteButtons() {
    const motoyamaBtn = document.getElementById('routeMotoyama');
    const universityBtn = document.getElementById('routeUniversity');
    const subtitle = document.getElementById('subtitle');

    if (currentRoute === 'motoyama') {
        motoyamaBtn.classList.add('active');
        universityBtn.classList.remove('active');
        subtitle.textContent = 'のりば発 運行状況';
    } else {
        motoyamaBtn.classList.remove('active');
        universityBtn.classList.add('active');
        subtitle.textContent = '大学発本山スクールバス乗り場着 運行状況';
    }
}

// 時刻を文字列から分に変換
function timeToMinutes(timeStr) {
    const [hour, minute] = timeStr.split(':').map(Number);
    return hour * 60 + minute;
}

// 分を時刻文字列に変換
function minutesToTime(minutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${hour}:${minute.toString().padStart(2, '0')}`;
}

// 24時間表記を12時間表記に変換（表示用）
function formatTime12Hour(hour, minute) {
    const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    return `${displayHour}:${minute.toString().padStart(2, '0')}`;
}

// 時刻文字列（HH:MM形式）を12時間表記に変換
function formatTimeString12Hour(timeStr) {
    const [hour, minute] = timeStr.split(':').map(Number);
    return formatTime12Hour(hour, minute);
}

// 時刻範囲（HH:MM - HH:MM形式）を12時間表記に変換
function formatTimeRange12Hour(timeRangeStr) {
    const [start, end] = timeRangeStr.split(' - ');
    return `${formatTimeString12Hour(start)} - ${formatTimeString12Hour(end)}`;
}

// 現在時刻を取得
function getCurrentTime() {
    let now;

    // デバッグモードでない場合は常に現在時刻を使用
    if (!isDebugMode) {
        now = new Date();
    } else if (customDate) {
        // 編集された日付を使用
        now = new Date(customDate);
        if (customTime) {
            now.setHours(customTime.hour, customTime.minute, 0, 0);
        } else {
            // 日付のみ指定されている場合は現在時刻を使用
            const currentNow = new Date();
            now.setHours(currentNow.getHours(), currentNow.getMinutes(), currentNow.getSeconds(), 0);
        }
    } else if (customTime) {
        // 編集された時刻を使用
        now = new Date();
        now.setHours(customTime.hour, customTime.minute, 0, 0);
    } else {
        // 実際の現在時刻を使用
        now = new Date();
    }

    return {
        hour: now.getHours(),
        minute: now.getMinutes(),
        totalMinutes: now.getHours() * 60 + now.getMinutes(),
        date: now
    };
}

// 次のバスの時刻を計算
function findNextBus(currentTime) {
    const allDepartures = [];

    // すべての発車時刻を収集
    scheduleData.schedule.forEach(daySchedule => {
        // 定時発車
        daySchedule.fixed_departures.forEach(minute => {
            const totalMinutes = daySchedule.hour * 60 + minute;
            allDepartures.push({
                time: totalMinutes,
                type: 'fixed',
                displayTime: formatTime12Hour(daySchedule.hour, minute)
            });
        });

        // シャトル運行の開始時刻
        daySchedule.shuttle_service.forEach(shuttle => {
            const startMinutes = timeToMinutes(shuttle.start);
            allDepartures.push({
                time: startMinutes,
                type: 'shuttle',
                displayTime: formatTimeString12Hour(shuttle.start),
                endTime: shuttle.end,
                description: shuttle.description
            });
        });
    });

    // 時刻順にソート
    allDepartures.sort((a, b) => a.time - b.time);

    // 現在時刻より後の最初のバスを探す
    const nextBus = allDepartures.find(dep => dep.time > currentTime.totalMinutes);

    if (nextBus) {
        // 次のバスがシャトル運行の範囲内にあるかチェック
        // シャトル運行の開始時刻の場合、または定時発車がシャトル運行の範囲内にある場合
        const isInShuttleRange = nextBus.type === 'shuttle' || checkIfInShuttleRange(nextBus.time);
        return {
            ...nextBus,
            isInShuttleRange: isInShuttleRange
        };
    }

    // 今日の運行が終了している場合、翌日の最初のバスを返す
    if (allDepartures.length > 0) {
        const firstBus = allDepartures[0];
        // シャトル運行の開始時刻の場合、または定時発車がシャトル運行の範囲内にある場合
        const isInShuttleRange = firstBus.type === 'shuttle' || checkIfInShuttleRange(firstBus.time);
        return {
            ...firstBus,
            isTomorrow: true,
            isInShuttleRange: isInShuttleRange
        };
    }

    return null;
}

// 指定された時刻がシャトル運行の範囲内にあるかチェック
function checkIfInShuttleRange(timeMinutes) {
    for (const daySchedule of scheduleData.schedule) {
        for (const shuttle of daySchedule.shuttle_service) {
            const start = timeToMinutes(shuttle.start);
            const end = timeToMinutes(shuttle.end);

            // 時刻がシャトル運行の開始時刻から終了時刻の間にあるか（終了時刻を含む）
            // 終了時刻ちょうどの場合もシャトル運行中とみなす
            if (timeMinutes >= start && timeMinutes <= end) {
                return true;
            }
        }
    }
    return false;
}

// シャトル運行中かどうかを判定
function isInShuttleService(currentTime) {
    for (const daySchedule of scheduleData.schedule) {
        for (const shuttle of daySchedule.shuttle_service) {
            const start = timeToMinutes(shuttle.start);
            const end = timeToMinutes(shuttle.end);

            // 終了時刻ちょうどの場合もシャトル運行中とみなす
            if (currentTime.totalMinutes >= start && currentTime.totalMinutes <= end) {
                return {
                    active: true,
                    description: shuttle.description,
                    endTime: shuttle.end
                };
            }
        }
    }
    return { active: false };
}

// 今日の運行ダイヤを生成
function generateTodaySchedule(currentTime) {
    const scheduleItems = [];

    scheduleData.schedule.forEach(daySchedule => {
        // 定時発車
        daySchedule.fixed_departures.forEach(minute => {
            const totalMinutes = daySchedule.hour * 60 + minute;
            scheduleItems.push({
                time: totalMinutes,
                displayTime: formatTime12Hour(daySchedule.hour, minute),
                type: 'fixed',
                isPast: totalMinutes < currentTime.totalMinutes
            });
        });

        // シャトル運行
        daySchedule.shuttle_service.forEach(shuttle => {
            const startMinutes = timeToMinutes(shuttle.start);
            const endMinutes = timeToMinutes(shuttle.end);
            scheduleItems.push({
                time: startMinutes,
                displayTime: formatTimeRange12Hour(`${shuttle.start} - ${shuttle.end}`),
                type: 'shuttle',
                isPast: endMinutes <= currentTime.totalMinutes
            });
        });
    });

    // 時刻順にソート
    scheduleItems.sort((a, b) => a.time - b.time);

    return scheduleItems;
}

// 表示を更新
function updateDisplay() {
    const current = getCurrentTime();

    // スケジュールタイプを再判定
    const scheduleType = getScheduleType(current.date);
    if (scheduleType !== currentScheduleType) {
        loadSchedule(currentRoute, scheduleType);
        return;
    }

    if (!scheduleData) {
        // 運行なしの場合
        document.getElementById('nextBus').innerHTML = '<div class="no-service">この日は運行がありません</div>';
        document.getElementById('todaySchedule').innerHTML = '<div class="no-service">この日は運行がありません</div>';
        document.getElementById('scheduleHeader').textContent = '運行ダイヤ';
        document.getElementById('scheduleTypeBadge').textContent = '';
        return;
    }

    // 現在時刻を表示（12時間表記）
    const timeStr = `${formatTime12Hour(current.hour, current.minute)}:${current.date.getSeconds().toString().padStart(2, '0')}`;
    document.getElementById('currentTime').textContent = timeStr;

    const dateStr = current.date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });
    document.getElementById('currentDate').textContent = dateStr;

    // スケジュールタイプバッジを更新
    const scheduleTypeBadge = document.getElementById('scheduleTypeBadge');
    const scheduleHeader = document.getElementById('scheduleHeader');
    if (customDate) {
        scheduleHeader.textContent = `${current.date.getMonth() + 1}月${current.date.getDate()}日の運行ダイヤ`;
    } else {
        scheduleHeader.textContent = '今日の運行ダイヤ';
    }

    if (currentScheduleType === 'special') {
        scheduleTypeBadge.textContent = '特別ダイヤ';
        scheduleTypeBadge.className = 'schedule-type-badge special';
    } else if (currentScheduleType === 'saturday') {
        scheduleTypeBadge.textContent = '土曜日ダイヤ';
        scheduleTypeBadge.className = 'schedule-type-badge saturday';
    } else {
        scheduleTypeBadge.textContent = '';
        scheduleTypeBadge.className = 'schedule-type-badge';
    }

    // 次のバスを計算
    const nextBus = findNextBus(current);
    const shuttleStatus = isInShuttleService(current);

    // 次のバス表示
    const nextBusElement = document.getElementById('nextBus');

    // シャトル運行中の場合は特別な表示
    if (shuttleStatus.active) {
        const endTimeMinutes = timeToMinutes(shuttleStatus.endTime);
        const minutesUntil = endTimeMinutes - current.totalMinutes;
        const hoursUntil = Math.floor(minutesUntil / 60);
        const minsUntil = minutesUntil % 60;

        let countdownText = '';
        if (hoursUntil > 0) {
            countdownText = `あと ${hoursUntil}時間${minsUntil}分`;
        } else {
            countdownText = `あと ${minsUntil}分`;
        }

        nextBusElement.innerHTML = `
            <div class="next-bus-title">次のバス<span class="shuttle-badge-inline">シャトル運行</span></div>
            <div class="next-bus-time">${formatTimeString12Hour(shuttleStatus.endTime)} まで</div>
            <div class="next-bus-countdown">${countdownText}</div>
        `;
    } else if (nextBus) {
        const minutesUntil = nextBus.time - current.totalMinutes;
        const hoursUntil = Math.floor(minutesUntil / 60);
        const minsUntil = minutesUntil % 60;

        let countdownText = '';
        if (nextBus.isTomorrow) {
            countdownText = '（翌日）';
        } else if (hoursUntil > 0) {
            countdownText = `あと ${hoursUntil}時間${minsUntil}分`;
        } else {
            countdownText = `あと ${minsUntil}分`;
        }

        // シャトル運行バッジを表示する条件
        const showShuttleBadge = nextBus.type === 'shuttle' || nextBus.isInShuttleRange;

        nextBusElement.innerHTML = `
            <div class="next-bus-title">次のバス${showShuttleBadge ? '<span class="shuttle-badge-inline">シャトル運行</span>' : ''}</div>
            <div class="next-bus-time">${nextBus.displayTime}</div>
            <div class="next-bus-countdown">${countdownText}</div>
        `;
    } else {
        nextBusElement.innerHTML = '<div class="no-service">本日の運行は終了しました</div>';
    }

    // ステータス情報は不要のため削除

    // 今日の運行ダイヤ
    const todaySchedule = generateTodaySchedule(current);
    const scheduleElement = document.getElementById('todaySchedule');

    if (todaySchedule.length === 0) {
        scheduleElement.innerHTML = '<div class="no-service">本日の運行はありません</div>';
    } else {
        let foundNext = false;
        let nextItemIndex = -1;
        scheduleElement.innerHTML = todaySchedule.map((item, index) => {
            let className = 'schedule-item';
            if (item.isPast) {
                className += ' past';
            } else if (!foundNext && !item.isPast) {
                className += ' next';
                foundNext = true;
                nextItemIndex = index;
            }

            const typeClass = item.type === 'shuttle' ? 'shuttle-type' : '';
            const typeText = item.type === 'shuttle' ? 'シャトル運行' : '定時発車';

            return `
                <div class="${className}" data-schedule-index="${index}">
                    <div class="schedule-time">${item.displayTime}</div>
                    <div class="schedule-type ${typeClass}">${typeText}</div>
                </div>
            `;
        }).join('');

        // 次のバスの項目まで自動スクロール
        if (nextItemIndex >= 0) {
            setTimeout(() => {
                const nextItem = scheduleElement.querySelector(`[data-schedule-index="${nextItemIndex}"]`);
                if (nextItem) {
                    nextItem.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }, 100);
        }
    }
}

// デバッグコントロールの表示/非表示を切り替え
function toggleDebugControls() {
    const dateControls = document.querySelector('.date-controls');
    const timeControls = document.querySelector('.time-controls');

    if (isDebugMode) {
        dateControls.style.display = 'flex';
        timeControls.style.display = 'flex';
    } else {
        dateControls.style.display = 'none';
        timeControls.style.display = 'none';
        // デバッグモードでない場合はカスタム日付・時刻をリセット
        customDate = null;
        customTime = null;
        const customDateInput = document.getElementById('customDate');
        const customTimeInput = document.getElementById('customTime');
        if (customDateInput) customDateInput.value = '';
        if (customTimeInput) customTimeInput.value = '';
    }
}

// 日付入力のイベントリスナー
function setupDateControls() {
    const customDateInput = document.getElementById('customDate');
    const resetDateBtn = document.getElementById('resetDate');

    // デバッグモードでない場合はイベントリスナーを設定しない
    if (!isDebugMode) {
        return;
    }

    // 日付入力フィールドの変更
    customDateInput.addEventListener('change', (e) => {
        if (e.target.value) {
            customDate = e.target.value;
            loadSchedule(currentRoute);
        }
    });

    // リセットボタン
    resetDateBtn.addEventListener('click', () => {
        customDate = null;
        customDateInput.value = '';
        loadSchedule(currentRoute);
    });
}

// 時刻入力のイベントリスナー
function setupTimeControls() {
    const customTimeInput = document.getElementById('customTime');
    const resetBtn = document.getElementById('resetTime');

    // デバッグモードでない場合はイベントリスナーを設定しない
    if (!isDebugMode) {
        return;
    }

    // 時刻入力フィールドの変更
    customTimeInput.addEventListener('change', (e) => {
        const [hour, minute] = e.target.value.split(':').map(Number);
        if (hour !== undefined && minute !== undefined) {
            customTime = { hour, minute };
            updateDisplay();
        }
    });

    // リセットボタン
    resetBtn.addEventListener('click', () => {
        customTime = null;
        customTimeInput.value = '';
        updateDisplay();
    });
}

// ルート切り替えのイベントリスナー
function setupRouteSwitch() {
    const motoyamaBtn = document.getElementById('routeMotoyama');
    const universityBtn = document.getElementById('routeUniversity');

    motoyamaBtn.addEventListener('click', () => {
        if (currentRoute !== 'motoyama') {
            loadSchedule('motoyama', currentScheduleType);
        }
    });

    universityBtn.addEventListener('click', () => {
        if (currentRoute !== 'university') {
            loadSchedule('university', currentScheduleType);
        }
    });
}

// 初期化
toggleDebugControls();
loadSchedule();
setupDateControls();
setupTimeControls();
setupRouteSwitch();

// 1秒ごとに更新（デバッグモードでない場合、またはカスタム時刻が設定されていない場合のみ）
setInterval(() => {
    if (!isDebugMode || !customTime) {
        updateDisplay();
    }
}, 1000);

