import { kv } from '@vercel/kv';

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
    console.log('[kv] Request data:', JSON.stringify(data));
    console.log('[kv] Is bulk import:', isBulkImport);
    
    // 現在のイベントデータを取得
    const events = await kv.get('events') || [];
    console.log('[kv] Current events before processing:', events.length);

    if (isBulkImport) {
      // CSV一括処理モード
      console.log('[kv] 🚨 BULK IMPORT MODE ACTIVATED');
      
      if (!data.events || !Array.isArray(data.events)) {
        console.error('[kv] ❌ Bulk import: events array missing or invalid');
        return res.status(400).json({ error: 'Missing or invalid events array for bulk import' });
      }
      
      console.log('[kv] 🚨 Processing', data.events.length, 'events for bulk import');
      let importedCount = 0;
      
      // 各イベントを処理 - forEach を for...of に変更して同期処理を確実にする
      for (const [index, eventData] of data.events.entries()) {
        console.log(`[kv] 🚨 Processing bulk event ${index + 1}:`, eventData);
        
        if (!eventData.id || !eventData.room || !eventData.name || !eventData.start || !eventData.end) {
          console.warn(`[kv] ❌ Skipping invalid event ${index + 1}: missing required fields`);
          continue;
        }
        
        const event = {
          id: eventData.id,
          room: eventData.room,
          name: eventData.name,
          start: eventData.start,
          end: eventData.end
        };
        
        const existingIndex = events.findIndex(e => e.id === event.id);
        if (existingIndex >= 0) {
          events[existingIndex] = event;
          console.log(`[kv] 🚨 Updated existing event: ${event.id}`);
        } else {
          events.push(event);
          console.log(`[kv] 🚨 Added new event: ${event.id}`);
        }
        
        importedCount++;
      }
      
      // KV書き込みにエラーハンドリングを追加
      try {
        await kv.set('events', events);
        console.log('[kv] ✅ BULK IMPORT SUCCESS:', importedCount, 'events imported, total:', events.length);
      } catch (kvError) {
        console.error('[kv] ❌ KV WRITE ERROR during bulk import:', kvError.message);
        console.error('[kv] ❌ KV WRITE Stack trace:', kvError.stack);
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
        total: events.length 
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