// Grid Calendar Implementation
const ROOMS = ['会議室(さくら)', '相談室(スミレ・コスモス)', 'テレワークルームA', 'テレワークルームB'];
const ROOM_COLORS = {
    '会議室(さくら)': 'room-sakura',
    '相談室(スミレ・コスモス)': 'room-violet', 
    'テレワークルームA': 'room-telework-a',
    'テレワークルームB': 'room-telework-b'
};

let currentWeekStart = new Date();
let currentEvents = [];
let adminMode = false;

// DOM element cache
const domCache = {};

function getCachedElement(id) {
    if (!domCache[id]) {
        domCache[id] = document.getElementById(id);
    }
    return domCache[id];
}

// Get Monday of current week
function getWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

// Format date for display
function formatDate(date) {
    return date.toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric'
    });
}

// Format week range
function formatWeekRange(start) {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
}

// Get day name in Japanese
function getDayName(dayIndex) {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[dayIndex];
}

// Initialize current week to Monday of this week
currentWeekStart = getWeekStart();

// Status message helper
function showStatus(message, type) {
    const badge = getCachedElement('statusBadge');
    if (badge) {
        badge.textContent = message;
        badge.className = `status-badge status-${type}`;
        badge.style.display = 'inline-block';
        
        setTimeout(() => {
            badge.style.display = 'none';
        }, 5000);
    }
    console.log(`[status] ${type.toUpperCase()}: ${message}`);
}

// Render calendar grid
function renderCalendar() {
    const calendar = getCachedElement('calendar');
    const weekInfo = getCachedElement('weekInfo');
    
    if (!calendar || !weekInfo) return;
    
    // Update week info
    weekInfo.textContent = formatWeekRange(currentWeekStart);
    
    // Clear calendar
    calendar.innerHTML = '';
    
    // Create header row
    const headerRow = document.createElement('div');
    headerRow.style.display = 'contents';
    
    // Empty top-left cell
    const emptyCell = document.createElement('div');
    emptyCell.className = 'room-header';
    emptyCell.textContent = '部屋';
    headerRow.appendChild(emptyCell);
    
    // Day headers
    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + i);
        
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        if (isToday(date)) dayHeader.classList.add('today');
        
        const dayName = document.createElement('div');
        dayName.className = 'day-name';
        dayName.textContent = getDayName(date.getDay());
        
        const dayDate = document.createElement('div');
        dayDate.className = 'day-date';
        dayDate.textContent = formatDate(date);
        
        dayHeader.appendChild(dayName);
        dayHeader.appendChild(dayDate);
        headerRow.appendChild(dayHeader);
    }
    
    calendar.appendChild(headerRow);
    
    // Create room rows
    ROOMS.forEach(room => {
        const roomRow = document.createElement('div');
        roomRow.style.display = 'contents';
        
        // Room name cell
        const roomCell = document.createElement('div');
        roomCell.className = 'room-cell';
        roomCell.textContent = room;
        roomRow.appendChild(roomCell);
        
        // Day cells for this room
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + i);
            
            const dayCell = document.createElement('div');
            dayCell.className = `calendar-cell ${ROOM_COLORS[room]}`;
            
            // Add events for this room and date
            const dayEvents = getEventsForRoomAndDate(room, date);
            dayEvents.forEach(event => {
                const eventEl = document.createElement('div');
                eventEl.className = 'event-item';
                
                const timeEl = document.createElement('div');
                timeEl.className = 'event-time';
                timeEl.textContent = formatEventTime(event);
                
                const titleEl = document.createElement('div');
                titleEl.className = 'event-title';
                titleEl.textContent = event.name;
                
                eventEl.appendChild(timeEl);
                eventEl.appendChild(titleEl);
                dayCell.appendChild(eventEl);
            });
            
            roomRow.appendChild(dayCell);
        }
        
        calendar.appendChild(roomRow);
    });
    
    // Show calendar
    calendar.style.display = 'grid';
    const loading = getCachedElement('loading');
    const noEvents = getCachedElement('noEvents');
    if (loading) loading.style.display = 'none';
    if (noEvents) noEvents.style.display = 'none';
}

// Check if date is today
function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

// Get events for specific room and date
function getEventsForRoomAndDate(room, date) {
    return currentEvents.filter(event => {
        const eventDate = new Date(event.start);
        return event.room === room && 
               eventDate.toDateString() === date.toDateString();
    }).sort((a, b) => new Date(a.start) - new Date(b.start));
}

// Format event time
function formatEventTime(event) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    return `${formatTime(start)}-${formatTime(end)}`;
}

// Format time as HH:MM
function formatTime(date) {
    return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

// Navigation functions
function goToPreviousWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderCalendar();
}

function goToNextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderCalendar();
}

function goToToday() {
    currentWeekStart = getWeekStart();
    renderCalendar();
}

// Fetch events from API
async function fetchEvents() {
    try {
        console.log('[api] GET /api/events');
        const response = await fetch('/api/events');
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        currentEvents = data.events || [];
        console.log(`[api] fetched ${currentEvents.length} events`);
        
        if (currentEvents.length === 0) {
            const noEvents = getCachedElement('noEvents');
            const loading = getCachedElement('loading');
            if (noEvents) noEvents.style.display = 'block';
            if (loading) loading.style.display = 'none';
        } else {
            renderCalendar();
        }
        
        // Update admin panel if visible
        if (adminMode) {
            refreshAdminEventsList();
        }
        
    } catch (error) {
        console.error('[api] Error fetching events:', error);
        showStatus('データの読み込みに失敗しました', 'error');
        const loading = getCachedElement('loading');
        if (loading) loading.style.display = 'none';
    }
}

// Delete all events
async function deleteAllEvents() {
    try {
        console.log('[api] DELETE /api/events - clearing all');
        const response = await fetch('/api/events', {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`DELETE failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('[api] DELETE all events result:', result);
        return result;
        
    } catch (error) {
        console.error('[api] Error deleting all events:', error);
        throw error;
    }
}

// Delete single event
async function deleteEvent(eventId) {
    try {
        console.log(`[admin] delete id=${eventId}`);
        const response = await fetch(`/api/events/${eventId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`DELETE failed: ${response.status}`);
        }
        
        console.log(`[admin] delete id=${eventId} → OK`);
        return true;
        
    } catch (error) {
        console.error(`[admin] Error deleting event ${eventId}:`, error);
        throw error;
    }
}

// CSV Upload function with replace mode
async function uploadCSV() {
    const fileInput = getCachedElement('csvFileInput');
    const uploadBtn = getCachedElement('csvUploadBtn');
    const file = fileInput ? fileInput.files[0] : null;
    
    if (!file) {
        alert('CSVファイルを選択してください');
        return;
    }
    
    console.log(`[csv] start upload - file: ${file.name}`);
    
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = '読み込み中...';
    }
    
    try {
        // Read file
        const text = await file.text();
        
        // Parse CSV
        if (typeof Papa === 'undefined') {
            throw new Error('PapaParse library not available');
        }
        
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: async function(results) {
                try {
                    console.log(`[csv] parsed ${results.data.length} rows`);
                    const validEvents = [];
                    const errorRows = [];
                    
                    results.data.forEach((row, index) => {
                        // Enhanced CSV parsing for LogoForm structure
                        let eventData = null;
                        
                        // Try different column mappings
                        if (row['部屋'] && row['氏名'] && row['開始'] && row['終了']) {
                            // Simple format
                            eventData = {
                                id: `csv_${Date.now()}_${index}`,
                                room: row['部屋'],
                                name: row['氏名'],
                                start: row['開始'],
                                end: row['終了']
                            };
                        } else if (row['5:date'] && (row['7:checkbox'] || row['8:checkbox'] || row['234:checkbox'] || row['235:checkbox'])) {
                            // LogoForm format - simplified parsing
                            const name = `${row['244:firstname'] || ''} ${row['244:lastname'] || ''}`.trim() || 
                                         `${row['91:firstname'] || ''} ${row['91:lastname'] || ''}`.trim() || 
                                         '予約者';
                            
                            // Find active room and time
                            let room = '';
                            let timeData = '';
                            
                            if (row['7:checkbox']) {
                                room = '会議室(さくら)';
                                timeData = row['7:checkbox'];
                            } else if (row['8:checkbox']) {
                                room = '相談室(スミレ・コスモス)';
                                timeData = row['8:checkbox'];
                            } else if (row['234:checkbox']) {
                                room = 'テレワークルームA';
                                timeData = row['234:checkbox'];
                            } else if (row['235:checkbox']) {
                                room = 'テレワークルームB';
                                timeData = row['235:checkbox'];
                            }
                            
                            if (room && timeData && timeData.includes('～')) {
                                const [startTime, endTime] = timeData.split('～');
                                const dateStr = row['5:date'];
                                
                                eventData = {
                                    id: `csv_${Date.now()}_${index}`,
                                    room: room,
                                    name: name,
                                    start: `${dateStr}T${startTime.trim()}:00`,
                                    end: `${dateStr}T${endTime.trim()}:00`
                                };
                            }
                        }
                        
                        if (eventData) {
                            validEvents.push(eventData);
                        } else {
                            errorRows.push(index + 1);
                        }
                    });
                    
                    console.log(`[csv] valid events: ${validEvents.length}, errors: ${errorRows.length}`);
                    
                    if (validEvents.length > 0) {
                        // Delete all existing events first
                        await deleteAllEvents();
                        console.log('[csv] DELETE all → status 200');
                        
                        // Upload new events with replace mode
                        const response = await fetch('/api/logo?bulk=1&replace=1', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ events: validEvents })
                        });
                        
                        if (response.ok) {
                            console.log(`[csv] bulk upload success - imported:${validEvents.length}`);
                            
                            let message = `${validEvents.length}件を取り込み、旧データを上書きしました`;
                            let statusType = 'success';
                            
                            if (errorRows.length > 0) {
                                message += ` (${errorRows.length}件スキップ)`;
                                statusType = 'warning';
                            }
                            
                            showStatus(message, statusType);
                            
                            // Refresh calendar and admin panel
                            await fetchEvents();
                            
                        } else {
                            throw new Error('Bulk upload failed');
                        }
                    } else {
                        showStatus('有効なデータが見つかりませんでした', 'error');
                    }
                    
                } catch (error) {
                    console.error('[csv] processing error:', error);
                    showStatus('CSV処理でエラーが発生しました', 'error');
                }
            }
        });
        
    } catch (error) {
        console.error('[csv] file read error:', error);
        showStatus('ファイルの読み込みに失敗しました', 'error');
    } finally {
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.textContent = '📄 CSV 取り込み';
        }
        if (fileInput) {
            fileInput.value = '';
        }
    }
}

// Admin panel functions
function toggleAdminMode() {
    adminMode = !adminMode;
    const adminPanel = getCachedElement('adminPanel');
    const adminToggle = getCachedElement('adminToggle');
    
    if (adminPanel && adminToggle) {
        adminPanel.style.display = adminMode ? 'block' : 'none';
        adminToggle.textContent = adminMode ? '📅 カレンダーへ' : '🔧 管理モード';
        
        if (adminMode) {
            refreshAdminEventsList();
        }
    }
}

function refreshAdminEventsList() {
    const eventsTable = getCachedElement('eventsTable');
    if (!eventsTable) return;
    
    if (currentEvents.length === 0) {
        eventsTable.innerHTML = '<p>イベントがありません</p>';
        return;
    }
    
    // Sort events by start time
    const sortedEvents = [...currentEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
    
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>開始日時</th>
                <th>部屋</th>
                <th>予約者</th>
                <th>時間</th>
                <th>操作</th>
            </tr>
        </thead>
        <tbody>
            ${sortedEvents.map(event => {
                const startDate = new Date(event.start);
                const endDate = new Date(event.end);
                
                return `
                    <tr class="event-row" data-event-id="${event.id}">
                        <td>${startDate.toLocaleDateString('ja-JP')} ${formatTime(startDate)}</td>
                        <td>${event.room}</td>
                        <td>${event.name}</td>
                        <td>${formatTime(startDate)}-${formatTime(endDate)}</td>
                        <td>
                            <button class="btn btn-danger delete-event-btn" data-event-id="${event.id}">
                                🗑️ 削除
                            </button>
                        </td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    `;
    
    eventsTable.innerHTML = '';
    eventsTable.appendChild(table);
    
    // Add delete button event listeners
    const deleteButtons = eventsTable.querySelectorAll('.delete-event-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const eventId = e.target.dataset.eventId;
            const row = e.target.closest('.event-row');
            
            if (confirm('このイベントを削除しますか？')) {
                try {
                    // Add deleting class for visual feedback
                    row.classList.add('deleting');
                    
                    await deleteEvent(eventId);
                    
                    // Fade out animation
                    row.classList.add('fade-out');
                    setTimeout(() => {
                        // Refresh data and re-render
                        fetchEvents();
                    }, 300);
                    
                } catch (error) {
                    row.classList.remove('deleting');
                    showStatus('削除に失敗しました', 'error');
                }
            }
        });
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Navigation buttons
    const prevWeekBtn = getCachedElement('prevWeekBtn');
    const nextWeekBtn = getCachedElement('nextWeekBtn');
    const todayBtn = getCachedElement('todayBtn');
    
    if (prevWeekBtn) prevWeekBtn.addEventListener('click', goToPreviousWeek);
    if (nextWeekBtn) nextWeekBtn.addEventListener('click', goToNextWeek);
    if (todayBtn) todayBtn.addEventListener('click', goToToday);
    
    // CSV Upload button
    const csvUploadBtn = getCachedElement('csvUploadBtn');
    if (csvUploadBtn) csvUploadBtn.addEventListener('click', uploadCSV);
    
    // Admin toggle
    const adminToggle = getCachedElement('adminToggle');
    if (adminToggle) adminToggle.addEventListener('click', toggleAdminMode);
    
    // Refresh button
    const refreshBtn = getCachedElement('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', fetchEvents);
    
    // Initialize calendar
    fetchEvents();
});