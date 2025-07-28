import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { id } = req.query;
  
  console.log('[delete] Request received - Method:', req.method, 'ID:', id);
  
  // CORS許可ヘッダを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // プリフライトリクエスト対応
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // 環境変数チェック
  const urlSet = !!process.env.KV_REST_API_URL;
  const tokenSet = !!process.env.KV_REST_API_TOKEN;
  
  if (!urlSet || !tokenSet) {
    console.error('[delete] ❌ ENV not set - URL:', urlSet, 'TOKEN:', tokenSet);
    return res.status(500).json({ 
      error: 'ENV not set', 
      url: urlSet, 
      token: tokenSet 
    });
  }
  
  // DELETEメソッドのみ許可
  if (req.method !== 'DELETE') {
    console.log('[delete] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // IDの存在確認
  if (!id) {
    console.error('[delete] Missing event ID');
    return res.status(400).json({ error: 'Missing event ID' });
  }

  try {
    // KVから現在のイベントデータを取得
    const events = await kv.get('events') || [];
    console.log('[delete] Current events count:', events.length);
    
    // 削除対象のイベントを検索
    const targetIndex = events.findIndex(e => e.id.toString() === id.toString());
    
    if (targetIndex === -1) {
      console.log('[delete] Event not found with ID:', id);
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // イベントを削除
    const deletedEvent = events[targetIndex];
    events.splice(targetIndex, 1);
    
    console.log('[delete] Deleting event:', JSON.stringify(deletedEvent));
    
    // KVに保存
    await kv.set('events', events);
    console.log('[delete] ✅ KV delete SUCCESS:', events.length, 'events remaining');

    res.status(200).json({ 
      message: 'Event deleted successfully',
      deletedEvent,
      remainingCount: events.length
    });
  } catch (error) {
    console.error('[delete] ❌ KV delete ERROR:', error.message);
    console.error('[delete] Stack:', error.stack);
    res.status(500).json({ error: 'Delete failed: ' + error.message });
  }
}