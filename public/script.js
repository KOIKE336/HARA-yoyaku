// Emergency Admin Mode Handler (called directly from HTML)
window.toggleAdminModeHandler = function() {
    console.log('EMERGENCY: toggleAdminModeHandler called directly from HTML');
    
    const adminPanel = document.getElementById('adminPanel');
    const adminToggle = document.getElementById('adminToggle');
    
    if (!adminPanel || !adminToggle) {
        console.error('EMERGENCY: Required elements not found');
        console.log('adminPanel:', adminPanel);
        console.log('adminToggle:', adminToggle);
        return;
    }
    
    const isCurrentlyVisible = adminPanel.style.display === 'block';
    
    if (isCurrentlyVisible) {
        // Hide admin panel
        adminPanel.style.display = 'none';
        adminToggle.textContent = '🔧 管理モード';
        console.log('EMERGENCY: Admin panel hidden');
        
        // Show calendar
        const calendarNav = document.querySelector('.calendar-navigation');
        const calendarContainer = document.querySelector('.calendar-container');
        if (calendarNav) calendarNav.style.display = 'flex';
        if (calendarContainer) calendarContainer.style.display = 'block';
    } else {
        // Show admin panel
        adminPanel.style.display = 'block';
        adminToggle.textContent = '📅 カレンダーへ';
        console.log('EMERGENCY: Admin panel shown');
        
        // Hide calendar
        const calendarNav = document.querySelector('.calendar-navigation');
        const calendarContainer = document.querySelector('.calendar-container');
        if (calendarNav) calendarNav.style.display = 'none';
        if (calendarContainer) calendarContainer.style.display = 'none';
        
        // Create simple table manually
        const eventsTable = document.getElementById('eventsTable');
        if (eventsTable) {
            eventsTable.innerHTML = `
                <div style="padding: 20px; background: white; border: 1px solid #ddd; border-radius: 5px;">
                    <h4>管理機能テスト</h4>
                    <p>この管理パネルが表示されれば、基本機能は動作しています。</p>
                    <button onclick="alert('削除ボタンテスト成功!')" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        🗑️ テスト削除ボタン
                    </button>
                </div>
            `;
        }
    }
};

// Grid Calendar Implementation
const ROOMS = ['会議室(さくら)', '相談室(スミレ・コスモス)', 'テレワークルームA', 'テレワークルームB'];
const ROOM_COLORS = {
    '会議室(さくら)': 'room-sakura',
    '相談室(スミレ・コスモス)': 'room-violet',
    'テレワークルームA': 'room-telework-a',
    'テレワークルームB': 'room-telework-b'
};

let currentWeekStart = new Date();
let currentEvents = []; // This will hold the events fetched from the API
let adminMode = false;

// DOM element cache for performance
const domCache = {};

function getCachedElement(id) {
    if (!domCache[id]) {
        domCache[id] = document.getElementById(id);
    }
    return domCache[id];
}

// Get Monday of current week (adjusts to Sunday if week starts on Sunday)
function getWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay(); // 0 for Sunday, 1 for Monday, etc.
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(d.setDate(diff));
}

// Format date for display (e.g., 7/30)
function formatDate(date) {
    return date.toLocaleDateString('ja-JP', {
        month: 'numeric',
        day: 'numeric'
    });
}

// Format week range (e.g., 2025年7月28日 - 8月3日)
function formatWeekRange(start) {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startFormatter = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });
    const endFormatter = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' });

    return `${startFormatter.format(start)} - ${endFormatter.format(end)}`;
}

// Get day name in Japanese (日, 月, 火, ...)
function getDayName(dayIndex) {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[dayIndex];
}

// Check if a given date is today
function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

// Format time as HH:MM (e.g., 09:30)
function formatTime(date) {
    return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

// Format event time for display (e.g., 09:30-10:00)
function formatEventDisplayTime(startIso, endIso) {
    const start = new Date(startIso);
    const end = new Date(endIso);
    return `${formatTime(start)}〜${formatTime(end)}`;
}

// Render the calendar grid
function renderCalendar() {
    const calendar = getCachedElement('calendar');
    const weekInfo = getCachedElement('weekInfo');
    const loading = getCachedElement('loading');
    const noEvents = getCachedElement('noEvents');

    if (!calendar || !weekInfo || !loading || !noEvents) {
        console.error('Missing essential calendar DOM elements.');
        return;
    }

    weekInfo.textContent = formatWeekRange(currentWeekStart);
    calendar.innerHTML = ''; // Clear calendar content

    // Create header row
    const headerRow = document.createElement('div');
    headerRow.className = 'calendar-grid-header'; // Use a class for grid header
    headerRow.style.display = 'contents'; // Allows children to be direct grid items

    // Empty top-left cell for room header
    const emptyCell = document.createElement('div');
    emptyCell.className = 'room-header'; // Specific class for room header cell
    emptyCell.textContent = '部屋';
    headerRow.appendChild(emptyCell);

    // Day headers (横軸)
    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + i);

        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header'; // Specific class for day header cell
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

    // Create room rows (縦軸)
    ROOMS.forEach(room => {
        const roomRow = document.createElement('div');
        roomRow.className = 'calendar-grid-row'; // Use a class for grid row
        roomRow.style.display = 'contents'; // Allows children to be direct grid items

        // Room name cell
        const roomCell = document.createElement('div');
        roomCell.className = 'room-cell'; // Specific class for room name cell
        roomCell.textContent = room;
        roomRow.appendChild(roomCell);

        // Day cells for this room
        for (let i = 0; i < 7; i++) {
            const date = new Date(currentWeekStart);
            date.setDate(currentWeekStart.getDate() + i);

            const dayCell = document.createElement('div');
            dayCell.className = `calendar-cell ${ROOM_COLORS[room]}`;

            // Add events for this room and date
            const dayEvents = currentEvents.filter(event => {
                const eventStartDate = new Date(event.start);
                // Compare only date part, ignore time
                return event.room === room &&
                       eventStartDate.toDateString() === date.toDateString();
            }).sort((a, b) => new Date(a.start) - new Date(b.start)); // Sort by start time

            dayEvents.forEach(event => {
                const eventEl = document.createElement('div');
                eventEl.className = 'event-item';

                // Display Name and Time
                const nameEl = document.createElement('div');
                nameEl.className = 'event-title';
                nameEl.textContent = event.name; // event.name should be "名 姓" or "氏名"

                const timeEl = document.createElement('div');
                timeEl.className = 'event-time';
                timeEl.textContent = formatEventDisplayTime(event.start, event.end);

                eventEl.appendChild(timeEl);
                eventEl.appendChild(nameEl);
                dayCell.appendChild(eventEl);
            });
            roomRow.appendChild(dayCell);
        }
        calendar.appendChild(roomRow);
    });

    // Show calendar and hide loading/no events messages
    calendar.style.display = 'grid'; // Ensure grid display
    loading.style.display = 'none';
    noEvents.style.display = 'none';
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

// Fetch events from API and update currentEvents
async function fetchEvents() {
    showStatus('カレンダーデータを読み込み中...', 'info');
    try {
        const response = await fetch('/api/events');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API error: ${response.status}`);
        }
        const data = await response.json();
        currentEvents = data.events || []; // Update global events array

        if (currentEvents.length === 0) {
            showStatus('イベントデータがありません。', 'warning');
            getCachedElement('noEvents').style.display = 'block';
            getCachedElement('loading').style.display = 'none';
            getCachedElement('calendar').style.display = 'none'; // Hide calendar if no events
        } else {
            renderCalendar(); // Re-render calendar with new events
            showStatus('データを正常に読み込みました。', 'success');
        }

        // Update admin panel if visible
        if (adminMode) {
            setTimeout(() => refreshAdminEventsList(), 100);
        }
    } catch (error) {
        console.error('Error fetching events:', error);
        showStatus(`データの読み込みに失敗しました: ${error.message}`, 'error');
        getCachedElement('loading').style.display = 'none';
        getCachedElement('calendar').style.display = 'none'; // Hide calendar on error
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
    console.log('toggleAdminMode called, new adminMode:', adminMode);
    
    const adminPanel = document.getElementById('adminPanel');
    const adminToggle = document.getElementById('adminToggle');
    
    console.log('adminPanel element:', adminPanel);
    console.log('adminToggle element:', adminToggle);
    
    if (!adminPanel) {
        console.error('adminPanel element not found!');
        return;
    }
    
    if (!adminToggle) {
        console.error('adminToggle element not found!');
        return;
    }
    
    if (adminMode) {
        // Show admin panel
        adminPanel.style.display = 'block';
        adminToggle.textContent = '📅 カレンダーへ';
        console.log('Admin panel shown');
        
        // Hide calendar navigation and calendar container
        const calendarNav = document.querySelector('.calendar-navigation');
        const calendarContainer = document.querySelector('.calendar-container');
        if (calendarNav) calendarNav.style.display = 'none';
        if (calendarContainer) calendarContainer.style.display = 'none';
        
        // Refresh admin events list
        setTimeout(() => {
            refreshAdminEventsList();
        }, 200);
    } else {
        // Hide admin panel
        adminPanel.style.display = 'none';
        adminToggle.textContent = '🔧 管理モード';
        console.log('Admin panel hidden');
        
        // Show calendar navigation and calendar container
        const calendarNav = document.querySelector('.calendar-navigation');
        const calendarContainer = document.querySelector('.calendar-container');
        if (calendarNav) calendarNav.style.display = 'flex';
        if (calendarContainer) calendarContainer.style.display = 'block';
    }
}

function refreshAdminEventsList() {
    console.log('[ADMIN] refreshAdminEventsList START - events count:', currentEvents.length);
    console.log('[ADMIN] currentEvents data:', currentEvents);
    
    const eventsTable = document.getElementById('eventsTable');
    if (!eventsTable) {
        console.error('[ADMIN] eventsTable element not found');
        return;
    }
    
    console.log('[ADMIN] eventsTable element found:', eventsTable);
    
    // Clear existing content
    eventsTable.innerHTML = '';
    
    if (currentEvents.length === 0) {
        console.log('[ADMIN] No events, showing empty message');
        eventsTable.innerHTML = '<p style="text-align: center; padding: 20px; color: #666; font-size: 16px;">イベントがありません</p>';
        return;
    }
    
    // Sort events by start time
    const sortedEvents = [...currentEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
    console.log('[ADMIN] Sorted events:', sortedEvents.length);
    
    // Create each row manually to ensure button generation
    let tableContent = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left; font-weight: bold;">開始日時</th>
                    <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left; font-weight: bold;">部屋</th>
                    <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left; font-weight: bold;">予約者</th>
                    <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left; font-weight: bold;">時間</th>
                    <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left; font-weight: bold;">操作</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedEvents.forEach((event, index) => {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        
        console.log(`[ADMIN] Processing event ${index + 1}:`, event.id, event.name);
        
        tableContent += `
            <tr class="admin-event-row" data-event-id="${event.id}" style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 8px; border: 1px solid #dee2e6;">${startDate.toLocaleDateString('ja-JP')} ${formatTime(startDate)}</td>
                <td style="padding: 8px; border: 1px solid #dee2e6;">${event.room}</td>
                <td style="padding: 8px; border: 1px solid #dee2e6;">${event.name}</td>
                <td style="padding: 8px; border: 1px solid #dee2e6;">${formatTime(startDate)}-${formatTime(endDate)}</td>
                <td style="padding: 8px; border: 1px solid #dee2e6;">
                    <button 
                        class="admin-delete-btn" 
                        data-event-id="${event.id}" 
                        onclick="handleAdminDelete('${event.id}')"
                        style="
                            background-color: #dc3545 !important; 
                            color: white !important; 
                            border: none !important; 
                            padding: 6px 12px !important; 
                            border-radius: 4px !important; 
                            cursor: pointer !important; 
                            font-size: 12px !important;
                            font-weight: bold !important;
                            min-width: 60px !important;
                            display: inline-block !important;
                        ">
                        🗑️ 削除
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableContent += `
            </tbody>
        </table>
    `;
    
    console.log('[ADMIN] Setting table HTML...');
    eventsTable.innerHTML = tableContent;
    
    // Double check buttons are in DOM
    setTimeout(() => {
        const adminDeleteBtns = eventsTable.querySelectorAll('.admin-delete-btn');
        console.log('[ADMIN] DELETE BUTTONS FOUND:', adminDeleteBtns.length);
        
        if (adminDeleteBtns.length === 0) {
            console.error('[ADMIN] NO DELETE BUTTONS FOUND IN DOM!');
            console.log('[ADMIN] eventsTable innerHTML:', eventsTable.innerHTML);
        } else {
            console.log('[ADMIN] SUCCESS - Delete buttons are in DOM');
            adminDeleteBtns.forEach((btn, i) => {
                console.log(`[ADMIN] Button ${i}:`, btn.outerHTML);
            });
        }
    }, 200);
    
    console.log('[ADMIN] refreshAdminEventsList COMPLETE');
}

// Global function to handle admin delete (called by onclick)
window.handleAdminDelete = async function(eventId) {
    console.log('[ADMIN] handleAdminDelete called for event:', eventId);
    
    if (!confirm('このイベントを削除しますか？')) {
        return;
    }
    
    const button = document.querySelector(`[data-event-id="${eventId}"]`);
    const row = button ? button.closest('.admin-event-row') : null;
    
    try {
        if (button) {
            button.disabled = true;
            button.textContent = '削除中...';
            button.style.backgroundColor = '#6c757d';
        }
        
        await deleteEvent(eventId);
        console.log('[ADMIN] Event deleted successfully:', eventId);
        
        // Remove from currentEvents array
        const eventIndex = currentEvents.findIndex(event => event.id === eventId);
        if (eventIndex !== -1) {
            currentEvents.splice(eventIndex, 1);
            console.log('[ADMIN] Event removed from currentEvents array');
        }
        
        // Visual feedback and update
        if (row) {
            row.style.transition = 'opacity 0.3s ease';
            row.style.opacity = '0';
            
            setTimeout(() => {
                row.remove();
                renderCalendar(); // Update calendar
                showStatus('削除が完了しました', 'success');
                console.log('[ADMIN] UI updated after deletion');
            }, 300);
        } else {
            // Fallback: refresh the whole admin list
            refreshAdminEventsList();
            renderCalendar();
            showStatus('削除が完了しました', 'success');
        }
        
    } catch (error) {
        console.error('[ADMIN] Delete failed:', error);
        if (button) {
            button.disabled = false;
            button.textContent = '🗑️ 削除';
            button.style.backgroundColor = '#dc3545';
        }
        showStatus('削除に失敗しました', 'error');
    }
};

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

// Initialize current week to Monday of this week
currentWeekStart = getWeekStart();

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up event listeners...');
    
    // Navigation buttons
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    const todayBtn = document.getElementById('todayBtn');

    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', goToPreviousWeek);
        console.log('prevWeekBtn listener added');
    }
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', goToNextWeek);
        console.log('nextWeekBtn listener added');
    }
    if (todayBtn) {
        todayBtn.addEventListener('click', goToToday);
        console.log('todayBtn listener added');
    }

    // CSV Upload button
    const csvUploadBtn = document.getElementById('csvUploadBtn');
    if (csvUploadBtn) {
        csvUploadBtn.addEventListener('click', uploadCSV);
        console.log('csvUploadBtn listener added');
    } else {
        console.error('csvUploadBtn not found!');
    }

    // Admin toggle - most important!
    const adminToggle = document.getElementById('adminToggle');
    if (adminToggle) {
        // Remove any existing listeners
        adminToggle.onclick = null;
        // Add the emergency handler
        adminToggle.addEventListener('click', window.toggleAdminModeHandler);
        console.log('adminToggle EMERGENCY listener added successfully');
    } else {
        console.error('adminToggle not found!');
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchEvents);
        console.log('refreshBtn listener added');
    }

    // Test admin toggle manually
    setTimeout(() => {
        const adminToggleTest = document.getElementById('adminToggle');
        console.log('Admin toggle test after timeout:', adminToggleTest);
        if (adminToggleTest) {
            console.log('Admin toggle button text:', adminToggleTest.textContent);
        }
    }, 1000);

    // Initialize calendar
    fetchEvents();
});