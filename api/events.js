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
  console.log(`[events] ${req.method} request received`);
  
  try {
  
  // CORS許可ヘッダを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
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
  
  // DELETE endpoint for clearing all events or single event
  if (req.method === 'DELETE') {
    console.log('[events] DELETE request - clearing all events');
    
    // Check if this is a single event delete (has event ID in URL)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/');
    const eventId = pathParts[pathParts.length - 1];
    
    if (eventId && eventId !== 'events') {
      // Single event delete
      try {
        let events = await kv.get('events') || [];
        console.log('[delete] Raw events from KV:', events);
        
        // Ensure events is always an array
        if (!events) {
          events = [];
        } else if (typeof events === 'string') {
          try {
            events = JSON.parse(events);
          } catch (parseError) {
            console.error('[delete] JSON parse error:', parseError);
            events = [];
          }
        } else if (!Array.isArray(events)) {
          console.log('[delete] Events is not array, converting:', events);
          events = [];
        }
        
        const filteredEvents = events.filter(event => event.id !== eventId);
        
        if (filteredEvents.length === events.length) {
          return res.status(404).json({ error: 'Event not found' });
        }
        
        await kv.set('events', filteredEvents);
        console.log(`[events] Deleted event ${eventId}, remaining: ${filteredEvents.length}`);
        console.log(`[events] Remaining event IDs:`, filteredEvents.map(e => e.id));
        
        return res.status(200).json({ 
          deleted: true, 
          eventId: eventId,
          remaining: filteredEvents.length 
        });
        
      } catch (error) {
        console.error('[events] Single delete error:', error);
        return res.status(500).json({ error: error.message });
      }
    } else {
      // Clear all events
      try {
        await kv.set('events', []);
        console.log('[events] All events cleared');
        
        return res.status(200).json({ 
          cleared: true,
          message: 'All events deleted successfully'
        });
        
      } catch (error) {
        console.error('[events] Clear all error:', error);
        return res.status(500).json({ error: error.message });
      }
    }
  }

  // GETメソッドのみ許可（その他）
  if (req.method !== 'GET') {
    console.log('[events] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // KVからイベントデータを取得（null防御）
    let events;
    try {
      console.log('[kv] Starting kv.get operation...');
      events = await kv.get('events');
      console.log('[kv] kv.get result:', events);
      console.log('[kv] Type of events:', typeof events);
      console.log('[kv] Events is null?', events === null);
      console.log('[kv] Events is undefined?', events === undefined);
      
      // Ensure events is always an array
      if (!events) {
        events = [];
      } else if (typeof events === 'string') {
        try {
          events = JSON.parse(events);
        } catch (parseError) {
          console.error('[kv] JSON parse error:', parseError);
          events = [];
        }
      } else if (!Array.isArray(events)) {
        console.log('[kv] Events is not array, converting:', events);
        events = [];
      }
      
      console.log('[kv] Final events array length:', events.length);
    } catch (getError) {
      console.error('[kv] ❌ KV read ERROR:', getError.message);
      console.error('[kv] Stack:', getError.stack);
      return res.status(500).json({ error: 'KV read failed: ' + getError.message });
    }
    
    console.log('[kv] Raw events count:', events.length);
    
    // 期限切れイベントの自動削除（終了時刻が現在時刻より過去）
    // Note: 1週間以上古いイベントのみ削除（テストデータ保護のため）
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    console.log('[kv] Current date:', now.toISOString().split('T')[0]);
    console.log('[kv] One week ago date:', oneWeekAgo.toISOString().split('T')[0]);
    console.log('[kv] Checking expiry: now =', now.toISOString(), 'oneWeekAgo =', oneWeekAgo.toISOString());
    console.log('[kv] Raw events before expiry check:', events.map(e => ({id: e.id, end: e.end})));
    
    const validEvents = events.filter(event => {
      if (!event.end) {
        console.log('[kv] Event missing end time:', event.id);
        return false; // 終了時刻のないイベントは削除
      }
      
      try {
        const eventEndTime = new Date(event.end);
        if (isNaN(eventEndTime.getTime())) {
          console.log('[kv] Invalid date for event:', event.id, event.end);
          return false;
        }
        
        const isValid = eventEndTime >= oneWeekAgo;  // 1週間以内は保持
        
        if (!isValid) {
          console.log('[kv] Expired event removed (older than 1 week):', event.id, event.end, 'eventEndTime:', eventEndTime.toISOString());
        } else {
          console.log('[kv] Event kept:', event.id, event.end, 'eventEndTime:', eventEndTime.toISOString());
        }
        
        return isValid;
      } catch (dateError) {
        console.error('[kv] Date processing error for event:', event.id, dateError.message);
        return false;
      }
    });
    
    console.log('[kv] Events after expiry filter:', validEvents.map(e => ({id: e.id, end: e.end})));
    
    // 期限切れイベントが削除された場合、KVを更新
    if (validEvents.length !== events.length) {
      const removedCount = events.length - validEvents.length;
      console.log('[kv] Cleaning up', removedCount, 'expired events');
      
      try {
        await kv.set('events', validEvents);
        console.log('[kv] ✅ Cleanup SUCCESS:', validEvents.length, 'events remaining');
      } catch (cleanupError) {
        console.error('[kv] ❌ Cleanup ERROR:', cleanupError.message);
        // クリーンアップに失敗しても読み取りは継続
      }
    }
    
    console.log('[kv] ✅ KV read SUCCESS:', validEvents.length, 'events');
    
    try {
      console.log('[kv] Valid events IDs:', validEvents.map(e => e && e.id ? e.id : 'INVALID_EVENT'));
      console.log('[kv] Events data length:', JSON.stringify(validEvents).length);
      
      // Validate events structure before sending
      const validatedEvents = validEvents.filter(event => {
        if (!event || typeof event !== 'object') {
          console.error('[kv] Invalid event object:', event);
          return false;
        }
        if (!event.id || !event.room || !event.name) {
          console.error('[kv] Event missing required fields:', event);
          return false;
        }
        return true;
      });
      
      console.log('[kv] Validated events count:', validatedEvents.length);
      res.status(200).json({ events: validatedEvents });
    } catch (jsonError) {
      console.error('[kv] JSON serialization error:', jsonError.message);
      res.status(500).json({ error: 'JSON serialization failed: ' + jsonError.message });
    }
  } catch (error) {
    console.error('[kv] ❌ KV read ERROR:', error.message);
    console.error('[kv] Stack:', error.stack);
    res.status(500).json({ error: 'KV read failed: ' + error.message });
  }
  
  } catch (globalError) {
    console.error('[events] ❌ GLOBAL ERROR:', globalError.message);
    console.error('[events] ❌ Stack trace:', globalError.stack);
    res.status(500).json({ error: 'Internal server error: ' + globalError.message });
  }
}