// Use Redis client for Upstash compatibility
const kv = {
  async get(key) {
    const response = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
      headers: { 'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}` }
    });
    if (!response.ok) throw new Error(`KV GET failed: ${response.status}`);
    const result = await response.json();
    return result.result;
  },
  async set(key, value) {
    const response = await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(value)
    });
    if (!response.ok) throw new Error(`KV SET failed: ${response.status}`);
    return await response.json();
  }
};

export default async function handler(req, res) {
  console.log('[kv] POST request received');
  console.log('[kv] URL params:', req.url);
  console.log('[kv] Query params:', req.query);
  
  // CORS許可ヘッダを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // プリフライトリクエスト対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 環境変数チェック
  const urlSet = !!process.env.KV_REST_API_URL;
  const tokenSet = !!process.env.KV_REST_API_TOKEN;
  
  if (!urlSet || !tokenSet) {
    console.error('[kv] ❌ ENV not set - URL:', urlSet, 'TOKEN:', tokenSet);
    return res.status(500).json({ 
      error: 'ENV not set', 
      url: urlSet, 
      token: tokenSet 
    });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body || {};
    const isBulkImport = req.query.bulk === '1';
    const isReplaceMode = req.query.replace === '1';
    console.log('[logo] Request data:', JSON.stringify(data));
    console.log('[logo] Is bulk import:', isBulkImport);
    console.log('[logo] Replace mode:', isReplaceMode);
    
    // 現在のイベントデータを取得 (replace mode では空配列から開始)
    const events = isReplaceMode ? [] : (await kv.get('events') || []);
    console.log(`[logo] Starting with ${events.length} existing events (replace mode: ${isReplaceMode})`);

    if (isBulkImport) {
      // CSV一括処理モード
      console.log('[kv] 🚨 BULK IMPORT MODE ACTIVATED');
      
      if (!data.events || !Array.isArray(data.events)) {
        console.error('[logo] ❌ Bulk import: events array missing or invalid');
        return res.status(400).json({ error: 'Missing or invalid events array for bulk import' });
      }
      
      console.log(`[logo] Processing ${data.events.length} events for bulk import`);
      let importedCount = 0;
      
      // 各イベントを処理 - forEach を for...of に変更して同期処理を確実にする
      for (const [index, eventData] of data.events.entries()) {
        console.log(`[logo] Processing bulk event ${index + 1}:`, eventData);
        
        if (!eventData.id || !eventData.room || !eventData.name || !eventData.start || !eventData.end) {
          console.warn(`[logo] ❌ Skipping invalid event ${index + 1}: missing required fields`);
          continue;
        }
        
        const event = {
          id: eventData.id,
          room: eventData.room,
          name: eventData.name,
          start: eventData.start,
          end: eventData.end
        };
        
        // In replace mode, always add new events
        // In append mode, check for existing events
        if (isReplaceMode) {
          events.push(event);
          console.log(`[logo] Added new event in replace mode: ${event.id}`);
        } else {
          const existingIndex = events.findIndex(e => e.id === event.id);
          if (existingIndex >= 0) {
            events[existingIndex] = event;
            console.log(`[logo] Updated existing event: ${event.id}`);
          } else {
            events.push(event);
            console.log(`[logo] Added new event: ${event.id}`);
          }
        }
        
        importedCount++;
      }
      
      // KV書き込みにエラーハンドリングを追加
      try {
        await kv.set('events', events);
        const modeText = isReplaceMode ? 'REPLACE' : 'APPEND';
        console.log(`[logo] ✅ BULK IMPORT SUCCESS (${modeText}): ${importedCount} events imported, total: ${events.length}`);
      } catch (kvError) {
        console.error('[logo] ❌ KV WRITE ERROR during bulk import:', kvError.message);
        console.error('[logo] ❌ KV WRITE Stack trace:', kvError.stack);
        return res.status(500).json({ 
          error: 'Database write failed', 
          details: kvError.message,
          imported: 0,
          total: events.length 
        });
      }
      
      res.status(200).json({ 
        status: 'ok', 
        imported: importedCount,
        total: events.length,
        mode: isReplaceMode ? 'replace' : 'append'
      });
      
    } else {
      // 単一イベント処理モード（従来のLoGoフォーム用）
      console.log('[kv] 🚨 SINGLE EVENT MODE');
      
      const eventId = data['回答ID'];
      if (!eventId) {
        return res.status(400).json({ error: 'Missing 回答ID' });
      }

      const event = {
        id: eventId,
        room: data['部屋'],
        name: data['氏名'],
        start: data['開始'],
        end: data['終了']
      };

      const existingIndex = events.findIndex(e => e.id === eventId);
      if (existingIndex >= 0) {
        events[existingIndex] = event;
        console.log('[kv] 🚨 Updated existing single event:', eventId);
      } else {
        events.push(event);
        console.log('[kv] 🚨 Added new single event:', eventId);
      }

      await kv.set('events', events);
      console.log('[kv] ✅ SINGLE EVENT SUCCESS:', events.length, 'total events');

      res.status(200).json({ status: 'ok' });
    }
    
  } catch (error) {
    console.error('[kv] ❌ KV save ERROR:', error.message);
    console.error('[kv] Stack trace:', error.stack);
    res.status(500).json({ error: error.message });
  }
}