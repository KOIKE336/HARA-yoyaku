console.log('🚀 [app] LATEST script.js loaded (version 20250130210000) - CACHE BUSTED!');
console.log('🚀 [app] This is the NEW VERSION - NOT deprecated!');

const HORIZON_DAYS = 30;
const ROOMS = ['会議室(さくら)', '相談室(スミレ・コスモス)', 'テレワークルームA', 'テレワークルームB'];

const ROOM_COLORS = {
    '会議室(さくら)': '#ff69b4',
    '相談室(スミレ・コスモス)': '#9370db',
    'テレワークルームA': '#87ceeb',
    'テレワークルームB': '#90ee90'
};

let calendar;
let currentEvents = [];
let adminMode = false;

document.addEventListener('DOMContentLoaded', () => {
    console.log('[app] init start');
    
    if (typeof toastui === 'undefined') {
        console.error('[app] Toast UI Calendar not loaded');
        return;
    }
    
    initCalendar();
    bindUI();
    fetchEvents();
    
    setInterval(fetchEvents, 30000);
    
    console.log('[app] init done');
});

const initCalendar = () => {
    const calendarEl = document.getElementById('calendar');
    
    calendar = new toastui.Calendar(calendarEl, {
        defaultView: 'month',
        useCreationPopup: false,
        useDetailPopup: true,
        calendars: ROOMS.map((room) => ({
            id: room,
            name: room,
            backgroundColor: ROOM_COLORS[room] || '#007bff',
            borderColor: ROOM_COLORS[room] || '#007bff',
            dragBgColor: ROOM_COLORS[room] || '#007bff'
        })),
        template: {
            monthDayname: (dayname) => `<span class="toastui-calendar-weekday-name">${dayname.label}</span>`
        }
    });
};

const bindUI = () => {
    console.log('[app] Starting UI binding...');
    
    const csvUploadBtn = document.getElementById('csvUploadBtn');
    const adminToggle = document.getElementById('adminToggle');
    const refreshBtn = document.getElementById('refreshBtn');
    
    console.log('[app] CSV button:', csvUploadBtn);
    console.log('[app] Admin toggle:', adminToggle);
    console.log('[app] Refresh button:', refreshBtn);
    
    if (csvUploadBtn) {
        console.log('[app] CSV button found. Attaching listener.');
        csvUploadBtn.addEventListener('click', () => {
            console.log('[csv] CSV upload button clicked.');
            uploadCSV();
        });
    } else {
        console.error('[app] CSV button not found!');
    }
    
    if (adminToggle) {
        console.log('[app] Admin toggle found. Attaching listener.');
        adminToggle.addEventListener('click', () => {
            console.log('[admin] Admin mode button clicked.');
            toggleAdminMode();
        });
    } else {
        console.error('[app] Admin toggle not found!');
    }
    
    if (refreshBtn) {
        console.log('[app] Refresh button found. Attaching listener.');
        refreshBtn.addEventListener('click', () => {
            console.log('[admin] Refresh button clicked.');
            refreshEventsList();
        });
    } else {
        console.error('[app] Refresh button not found!');
    }
    
    console.log('[app] UI binding complete.');
};

const filterEventsBy30Days = (events) => {
    const now = new Date();
    const endDate = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);
    
    return events.filter(event => {
        const eventDate = new Date(event.start);
        return eventDate >= now && eventDate <= endDate;
    });
};

const convertToCalendarEvents = (apiEvents) => {
    return apiEvents.map(event => {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        
        return {
            id: event.id.toString(),
            calendarId: event.room,
            title: `${event.name}`,
            category: 'time',
            start: startDate,
            end: endDate,
            backgroundColor: ROOM_COLORS[event.room] || '#007bff',
            borderColor: ROOM_COLORS[event.room] || '#007bff',
            color: '#ffffff'
        };
    });
};

const fetchEvents = async () => {
    try {
        const response = await fetch('/api/events');
        const data = await response.json();
        
        if (!data.events || !Array.isArray(data.events)) {
            showNoEvents();
            return;
        }
        
        currentEvents = data.events;
        const filteredEvents = filterEventsBy30Days(currentEvents);
        
        document.getElementById('loading').style.display = 'none';
        
        if (filteredEvents.length === 0) {
            showNoEvents();
            return;
        }
        
        document.getElementById('noEvents').style.display = 'none';
        document.getElementById('calendar').style.display = 'block';
        
        const calendarEvents = convertToCalendarEvents(filteredEvents);
        
        calendar.clear();
        calendar.createEvents(calendarEvents);
        
    } catch (error) {
        console.error('[calendar] Error fetching events:', error);
        document.getElementById('loading').textContent = 'エラーが発生しました';
    }
};

const showNoEvents = () => {
    document.getElementById('calendar').style.display = 'none';
    document.getElementById('noEvents').style.display = 'block';
};

const showStatusBadge = (message, type) => {
    const badge = document.getElementById('statusBadge');
    badge.textContent = message;
    badge.className = `status-badge status-${type}`;
    badge.style.display = 'inline-block';
    
    setTimeout(() => {
        badge.style.display = 'none';
    }, 5000);
};

const validateCSVRow = (row) => {
    const errors = [];
    
    const room = row['部屋'] || row['施設'];
    const name = row['氏名'] || row['予約者'];
    const start = row['開始'] || row['開始時刻'];
    const end = row['終了'] || row['終了時刻'];
    
    if (!room) errors.push('部屋/施設が未入力');
    if (!name) errors.push('氏名/予約者が未入力');
    if (!start) errors.push('開始/開始時刻が未入力');
    if (!end) errors.push('終了/終了時刻が未入力');
    
    if (start && isNaN(Date.parse(start))) {
        errors.push('開始日時の形式が不正');
    }
    if (end && isNaN(Date.parse(end))) {
        errors.push('終了日時の形式が不正');
    }
    
    return {
        valid: errors.length === 0,
        errors,
        data: { room, name, start, end }
    };
};

const uploadCSV = async () => {
    console.log('[csv] uploadCSV function called.');
    
    const fileInput = document.getElementById('csvFile');
    const uploadBtn = document.getElementById('csvUploadBtn');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('CSVファイルを選択してください');
        return;
    }
    
    uploadBtn.disabled = true;
    uploadBtn.textContent = '読み込み中...';
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        let text;
        if (typeof Encoding !== 'undefined') {
            const detectedEncoding = Encoding.detect(uint8Array);
            
            if (detectedEncoding === 'SJIS' || detectedEncoding === 'EUCJP') {
                const unicodeArray = Encoding.convert(uint8Array, {
                    to: 'UNICODE',
                    from: detectedEncoding
                });
                text = Encoding.codeToString(unicodeArray);
            } else {
                text = new TextDecoder('utf-8').decode(arrayBuffer);
            }
        } else {
            text = new TextDecoder('utf-8').decode(arrayBuffer);
        }
        
        if (typeof Papa === 'undefined') {
            showStatusBadge('PapaParseライブラリが読み込まれていません', 'error');
            return;
        }
        
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const validEvents = [];
                const errors = [];
                
                results.data.forEach((row, index) => {
                    const validation = validateCSVRow(row);
                    
                    if (validation.valid) {
                        validEvents.push({
                            id: `csv_${Date.now()}_${index}`,
                            room: validation.data.room,
                            name: validation.data.name,
                            start: new Date(validation.data.start).toISOString(),
                            end: new Date(validation.data.end).toISOString()
                        });
                    } else {
                        errors.push({
                            line: index + 2,
                            errors: validation.errors,
                            data: row
                        });
                    }
                });
                
                if (validEvents.length === 0) {
                    showStatusBadge('取り込み可能なデータがありません', 'error');
                    return;
                }
                
                try {
                    const response = await fetch('/api/logo?bulk=1', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ events: validEvents })
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        if (errors.length > 0) {
                            showStatusBadge(`${result.imported}件取り込み完了 / ${errors.length}件スキップ`, 'warning');
                        } else {
                            showStatusBadge(`${result.imported}件取り込み完了`, 'success');
                        }
                        
                        await fetchEvents();
                        fileInput.value = '';
                    } else {
                        if (response.status === 422) {
                            showStatusBadge('CSVエラー: 詳細はコンソール', 'error');
                        } else {
                            showStatusBadge('サーバエラーが発生しました', 'error');
                        }
                    }
                    
                } catch (fetchError) {
                    console.error('[csv] Network error:', fetchError);
                    showStatusBadge('サーバとの通信エラーが発生しました', 'error');
                }
            },
            error: (parseError) => {
                console.error('[csv] Parse error:', parseError);
                showStatusBadge('CSVファイルの解析に失敗しました', 'error');
            }
        });
        
    } catch (readError) {
        console.error('[csv] File read error:', readError);
        showStatusBadge('ファイルの読み込みに失敗しました', 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '📄 CSV 取り込み';
    }
};

const toggleAdminMode = () => {
    console.log('[admin] toggleAdminMode function called.');
    
    const adminPanel = document.getElementById('adminPanel');
    const adminToggle = document.getElementById('adminToggle');
    
    adminMode = !adminMode;
    adminPanel.style.display = adminMode ? 'block' : 'none';
    adminToggle.textContent = adminMode ? '📅 カレンダー' : '🔧 管理モード';
    adminToggle.classList.toggle('active', adminMode);
    
    if (adminMode) {
        refreshEventsList();
    }
};

const refreshEventsList = async () => {
    const eventsList = document.getElementById('eventsList');
    eventsList.innerHTML = '<p>読み込み中...</p>';
    
    try {
        const response = await fetch('/api/events');
        const data = await response.json();
        
        if (!data.events || data.events.length === 0) {
            eventsList.innerHTML = '<p>イベントがありません</p>';
            return;
        }
        
        const sortedEvents = data.events.sort((a, b) => new Date(a.start) - new Date(b.start));
        
        eventsList.innerHTML = sortedEvents.map(event => {
            const startTime = new Date(event.start).toLocaleString('ja-JP');
            const endTime = new Date(event.end).toLocaleString('ja-JP');
            
            return `
                <div class="event-item-admin">
                    <div class="event-info">
                        <div><strong>${event.name}</strong> @ ${event.room}</div>
                        <div class="event-meta">ID: ${event.id} | ${startTime} ～ ${endTime}</div>
                    </div>
                    <button class="delete-btn" onclick="deleteEvent('${event.id}')">🗑️ 削除</button>
                </div>
            `;
        }).join('');
        
    } catch (listError) {
        console.error('[admin] Error loading events:', listError);
        eventsList.innerHTML = '<p>エラーが発生しました</p>';
    }
};

const deleteEvent = async (eventId) => {
    if (!confirm(`イベント ID: ${eventId} を削除しますか？`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/events/${eventId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showStatusBadge(`イベントを削除しました (残り: ${result.remainingCount}件)`, 'success');
            
            refreshEventsList();
            fetchEvents();
        } else {
            showStatusBadge(`削除に失敗しました: ${result.error}`, 'error');
        }
        
    } catch (deleteError) {
        console.error('[admin] Delete error:', deleteError);
        showStatusBadge('削除中にエラーが発生しました', 'error');
    }
};