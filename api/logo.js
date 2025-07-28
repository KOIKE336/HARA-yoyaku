import { kv } from '@vercel/kv';

// 共通ヘルパー：リクエストボディ読み取り
async function readBody(req) {
  if (req.body) return req.body;
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => {
      try {
        resolve(JSON.parse(d || '{}'));
      } catch (e) {
        reject(e);
      }
    });
  });
}

export default async function handler(req, res) {
  console.log('[kv] POST request received');
  
  // 環境変数チェック
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.error('[kv] ❌ ENV not set');
    return res.status(500).json({ error: 'ENV not set' });
  }
  
  // POSTメソッドのみ許可
  if (req.method !== 'POST') {
    console.log('[kv] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // JSON取得（フォールバック付き）
    const data = await readBody(req);
    console.log('[kv] Request data:', JSON.stringify(data));
    
    // KVから既存データ取得（null防御）
    let events = await kv.get('events') || [];
    console.log('[kv] Current events count:', events.length);

    // 新しいイベント作成
    const eventId = data['回答ID'];
    if (!eventId) {
      console.error('[kv] Missing 回答ID');
      return res.status(400).json({ error: 'Missing 回答ID' });
    }

    const event = {
      id: eventId,
      room: data['部屋'],
      name: data['氏名'],
      start: data['開始'],
      end: data['終了']
    };

    // 同じ回答IDがあれば上書き、無ければ追加
    const existingIndex = events.findIndex(e => e.id === eventId);
    if (existingIndex >= 0) {
      events[existingIndex] = event;
      console.log('[kv] Updated event ID:', eventId);
    } else {
      events.push(event);
      console.log('[kv] Added event ID:', eventId);
    }

    // KVに保存
    try {
      await kv.set('events', events);
      console.log('[kv] KV set completed');
    } catch (setError) {
      console.error('[kv] ❌ KV save ERROR:', setError.message);
      console.error('[kv] Stack:', setError.stack);
      return res.status(500).json({ error: 'KV save failed' });
    }

    // 保存検証
    try {
      const verifyEvents = await kv.get('events') || [];
      if (verifyEvents.length !== events.length) {
        console.error('[kv] ❌ KV save ERROR: count mismatch - expected:', events.length, 'got:', verifyEvents.length);
        return res.status(500).json({ error: 'Save verification failed' });
      }
      console.log('[kv] ✅ KV save SUCCESS:', events.length, 'events');
    } catch (verifyError) {
      console.error('[kv] ❌ KV save ERROR: verification failed:', verifyError.message);
      console.error('[kv] Stack:', verifyError.stack);
      return res.status(500).json({ error: 'Save verification failed' });
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[kv] ❌ KV save ERROR:', error.message);
    console.error('[kv] Stack:', error.stack);
    res.status(500).json({ error: 'Request processing failed' });
  }
}