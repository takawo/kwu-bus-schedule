let scheduleData = null;
let customTime = null; // 編集された時刻を保持
let currentRoute = 'motoyama'; // 'motoyama' または 'university'

// スケジュールデータを読み込む
async function loadSchedule(route = 'motoyama') {
    try {
        const fileName = route === 'motoyama' ? 'bus_schedule.json' : 'bus_schedule_university.json';
        const response = await fetch(fileName);
        scheduleData = await response.json();
        currentRoute = route;
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

// 現在時刻を取得
function getCurrentTime() {
    let now;

    if (customTime) {
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
                displayTime: `${daySchedule.hour}:${minute.toString().padStart(2, '0')}`
            });
        });

        // シャトル運行の開始時刻
        daySchedule.shuttle_service.forEach(shuttle => {
            const startMinutes = timeToMinutes(shuttle.start);
            allDepartures.push({
                time: startMinutes,
                type: 'shuttle',
                displayTime: shuttle.start,
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
                displayTime: `${daySchedule.hour}:${minute.toString().padStart(2, '0')}`,
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
                displayTime: `${shuttle.start} - ${shuttle.end}`,
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
    if (!scheduleData) return;

    const current = getCurrentTime();

    // 現在時刻を表示
    const timeStr = `${current.hour.toString().padStart(2, '0')}:${current.minute.toString().padStart(2, '0')}:${current.date.getSeconds().toString().padStart(2, '0')}`;
    document.getElementById('currentTime').textContent = timeStr;

    const dateStr = current.date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });
    document.getElementById('currentDate').textContent = dateStr;

    // 次のバスを計算
    const nextBus = findNextBus(current);
    const shuttleStatus = isInShuttleService(current);

    // 次のバス表示
    const nextBusElement = document.getElementById('nextBus');

    // シャトル運行中の場合は特別な表示
    if (shuttleStatus.active) {
        nextBusElement.innerHTML = `
            <div class="next-bus-title">現在</div>
            <div class="shuttle-badge">シャトル運行</div>
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
            <div class="next-bus-title">次のバス</div>
            <div class="next-bus-time">${nextBus.displayTime}</div>
            <div class="next-bus-countdown">${countdownText}</div>
            ${showShuttleBadge ? '<div class="shuttle-badge">シャトル運行</div>' : ''}
        `;
    } else {
        nextBusElement.innerHTML = '<div class="no-service">本日の運行は終了しました</div>';
    }

    // ステータス情報（シャトル運行中は非表示）
    const statusElement = document.getElementById('statusInfo');
    if (shuttleStatus.active) {
        statusElement.className = 'status-info';
        statusElement.innerHTML = '';
    } else {
        statusElement.className = 'status-info';
        statusElement.innerHTML = `
            <div class="status-text">
                現在、定時運行中です
            </div>
        `;
    }

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

// 時刻入力のイベントリスナー
function setupTimeControls() {
    const customTimeInput = document.getElementById('customTime');
    const resetBtn = document.getElementById('resetTime');

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
            loadSchedule('motoyama');
        }
    });
    
    universityBtn.addEventListener('click', () => {
        if (currentRoute !== 'university') {
            loadSchedule('university');
        }
    });
}

// 初期化
loadSchedule();
setupTimeControls();
setupRouteSwitch();

// 1秒ごとに更新（カスタム時刻が設定されていない場合のみ）
setInterval(() => {
    if (!customTime) {
        updateDisplay();
    }
}, 1000);

