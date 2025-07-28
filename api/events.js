import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  console.log('[kv] GET request received');
  
  // CORS許可ヘッダを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // 環境変数チェックとデバッグ出力
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  
  if (!kvUrl || !kvToken) {
    console.error('[kv] ❌ ENV not set - URL:', !!kvUrl, 'TOKEN:', !!kvToken);
    return res.status(500).json({ error: 'ENV not set' });
  }
  
  console.log('[kv] ENV URL =', kvUrl);
  console.log('[kv] ENV TOKEN =', kvToken ? kvToken.slice(0, 8) + '...' : 'undefined');
  
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