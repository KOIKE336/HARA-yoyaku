const HORIZON_DAYS = 30;
const ROOMS = ['会議室(さくら)', '相談室(スミレ・コスモス)', 'テレワークルームA', 'テレワークルームB'];

// Room colors for visual distinction
const ROOM_COLORS = {
    '会議室(さくら)': { bg: 'rgba(255, 182, 193, 0.3)', border: '#ff69b4' },
    '相談室(スミレ・コスモス)': { bg: 'rgba(147, 112, 219, 0.3)', border: '#9370db' },
    'テレワークルームA': { bg: 'rgba(135, 206, 235, 0.3)', border: '#87ceeb' },
    'テレワークルームB': { bg: 'rgba(144, 238, 144, 0.3)', border: '#90ee90' }
};

let currentEvents = [];

function generateDates() {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < HORIZON_DAYS; i++) {
        const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
        dates.push(date);
    }
    
    return dates;
}

function formatDate(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayName = dayNames[date.getDay()];
    
    return `${month}/${day}(${dayName})`;
}

function formatTime(dateString) {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function isSameDate(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

function getEventsForRoomAndDate(room, date) {
    return currentEvents.filter(event => {
        const eventDate = new Date(event.start);
        return event.room === room && isSameDate(eventDate, date);
    });
}

function renderCalendar() {
    const dates = generateDates();
    const headerRow = document.getElementById('headerRow');
    const calendarBody = document.getElementById('calendarBody');
    const calendarTable = document.getElementById('calendarTable');
    const noEvents = document.getElementById('noEvents');
    const loading = document.getElementById('loading');
    
    // Clear existing content
    headerRow.innerHTML = '<th class="room-header">施設</th>';
    calendarBody.innerHTML = '';
    
    // Hide loading
    loading.style.display = 'none';
    
    // Check if we have any events
    if (currentEvents.length === 0) {
        calendarTable.style.display = 'none';
        noEvents.style.display = 'block';
        return;
    }
    
    noEvents.style.display = 'none';
    calendarTable.style.display = 'table';
    
    // Generate header row with dates
    dates.forEach(date => {
        const th = document.createElement('th');
        th.textContent = formatDate(date);
        headerRow.appendChild(th);
    });
    
    // Generate rows for each room
    ROOMS.forEach(room => {
        const row = document.createElement('tr');
        
        // Room name cell
        const roomCell = document.createElement('td');
        roomCell.className = 'room-header';
        roomCell.textContent = room;
        row.appendChild(roomCell);
        
        // Date cells
        dates.forEach(date => {
            const dateCell = document.createElement('td');
            dateCell.className = 'date-cell';
            
            const events = getEventsForRoomAndDate(room, date);
            
            events.forEach(event => {
                const eventDiv = document.createElement('div');
                eventDiv.className = 'event-item';
                
                const colors = ROOM_COLORS[room] || { bg: 'rgba(0, 123, 255, 0.1)', border: '#007bff' };
                eventDiv.style.backgroundColor = colors.bg;
                eventDiv.style.borderLeftColor = colors.border;
                
                const startTime = formatTime(event.start);
                const endTime = formatTime(event.end);
                
                eventDiv.innerHTML = `${event.name}<br>${startTime}-${endTime}`;
                dateCell.appendChild(eventDiv);
            });
            
            row.appendChild(dateCell);
        });
        
        calendarBody.appendChild(row);
    });
}

async function fetchEvents() {
    try {
        const response = await fetch('/api/events');
        const data = await response.json();
        currentEvents = data.events || [];
        renderCalendar();
    } catch (error) {
        console.error('Error fetching events:', error);
        document.getElementById('loading').textContent = 'エラーが発生しました';
    }
}

function uploadCSV() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('CSVファイルを選択してください');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            // Detect encoding and convert to UTF-8 if needed
            const arrayBuffer = e.target.result;
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
            
            // Parse CSV
            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    const events = results.data.map((row, index) => {
                        return {
                            id: `csv_${index}`,
                            room: row['部屋'] || row['施設'] || row['room'],
                            name: row['氏名'] || row['予約者'] || row['name'],
                            start: row['開始'] || row['開始時刻'] || row['start'],
                            end: row['終了'] || row['終了時刻'] || row['end']
                        };
                    }).filter(event => event.room && event.name && event.start && event.end);
                    
                    currentEvents = events;
                    renderCalendar();
                    alert(`${events.length}件の予約データを読み込みました`);
                },
                error: function(error) {
                    console.error('CSV parse error:', error);
                    alert('CSVファイルの解析に失敗しました');
                }
            });
        } catch (error) {
            console.error('File read error:', error);
            alert('ファイルの読み込みに失敗しました');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    fetchEvents();
    
    // Auto-refresh every 30 seconds
    setInterval(fetchEvents, 30000);
});