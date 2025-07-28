import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  console.log('[kv] GET request received');
  
  // CORS許可ヘッダを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  
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
  
  // GETメソッドのみ許可
  if (req.method !== 'GET') {
    console.log('[kv] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // KVからイベントデータを取得（null防御）
    let events;
    try {
      events = await kv.get('events');
      console.log('[kv] kv.get result:', events);
      events = events || [];
    } catch (getError) {
      console.error('[kv] ❌ KV read ERROR:', getError.message);
      console.error('[kv] Stack:', getError.stack);
      return res.status(500).json({ error: 'KV read failed: ' + getError.message });
    }
    
    console.log('[kv] Raw events count:', events.length);
    
    // 期限切れイベントの自動削除（終了時刻が現在時刻より過去）
    const now = new Date();
    const validEvents = events.filter(event => {
      if (!event.end) {
        console.log('[kv] Event missing end time:', event.id);
        return false; // 終了時刻のないイベントは削除
      }
      
      const eventEndTime = new Date(event.end);
      const isValid = eventEndTime >= now;
      
      if (!isValid) {
        console.log('[kv] Expired event removed:', event.id, event.end);
      }
      
      return isValid;
    });
    
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
    console.log('[kv] Events data:', JSON.stringify(validEvents));

    res.status(200).json({ events: validEvents });
  } catch (error) {
    console.error('[kv] ❌ KV read ERROR:', error.message);
    console.error('[kv] Stack:', error.stack);
    res.status(500).json({ error: 'KV read failed: ' + error.message });
  }
}