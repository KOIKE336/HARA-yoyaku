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
    
    console.log('[kv] ✅ KV read SUCCESS:', events.length, 'events');
    console.log('[kv] Events data:', JSON.stringify(events));

    res.status(200).json({ events });
  } catch (error) {
    console.error('[kv] ❌ KV read ERROR:', error.message);
    console.error('[kv] Stack:', error.stack);
    res.status(500).json({ error: 'KV read failed: ' + error.message });
  }
}