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
  
  // 環境変数チェックとデバッグ出力
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  
  if (!kvUrl || !kvToken) {
    console.error('[kv] ❌ ENV not set - URL:', !!kvUrl, 'TOKEN:', !!kvToken);
    return res.status(500).json({ error: 'ENV not set' });
  }
  
  console.log('[kv] ENV URL =', kvUrl);
  console.log('[kv] ENV TOKEN =', kvToken ? kvToken.slice(0, 8) + '...' : 'undefined');
  
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
    let events;
    try {
      events = await kv.get('events');
      console.log('[kv] kv.get result:', events);
      events = events || [];
    } catch (getError) {
      console.error('[kv] ❌ KV get ERROR:', getError.message);
      console.error('[kv] Stack:', getError.stack);
      events = [];
    }
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
    console.log('[kv] New event created:', JSON.stringify(event));

    // 同じ回答IDがあれば上書き、無ければ追加
    const existingIndex = events.findIndex(e => e.id === eventId);
    if (existingIndex >= 0) {
      events[existingIndex] = event;
      console.log('[kv] Updated event ID:', eventId);
    } else {
      events.push(event);
      console.log('[kv] Added event ID:', eventId);
    }
    console.log('[kv] Events to save:', JSON.stringify(events));

    // KVに保存
    let setResult;
    try {
      setResult = await kv.set('events', events);
      console.log('[kv] kv.set result:', setResult);
    } catch (setError) {
      console.error('[kv] ❌ KV save ERROR:', setError.message);
      console.error('[kv] Stack:', setError.stack);
      return res.status(500).json({ error: 'KV save failed: ' + setError.message });
    }

    // Upstash直接GET検証
    try {
      const verifyUrl = `${kvUrl}/get/events`;
      const verifyResponse = await fetch(verifyUrl, {
        headers: {
          'Authorization': `Bearer ${kvToken}`
        }
      });
      const verifyData = await verifyResponse.json();
      console.log('[kv] VERIFY get/events →', JSON.stringify(verifyData));
      
      if (verifyData.result) {
        const verifyEvents = verifyData.result || [];
        console.log('[kv] ✅ KV save SUCCESS:', verifyEvents.length, 'events');
      } else {
        console.error('[kv] ❌ KV save ERROR: verification failed - no result in response');
        return res.status(500).json({ error: 'Save verification failed - no data found' });
      }
    } catch (verifyError) {
      console.error('[kv] ❌ KV save ERROR: verification request failed:', verifyError.message);
      console.error('[kv] Stack:', verifyError.stack);
      return res.status(500).json({ error: 'Save verification failed: ' + verifyError.message });
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[kv] ❌ KV save ERROR:', error.message);
    console.error('[kv] Stack:', error.stack);
    res.status(500).json({ error: 'Request processing failed: ' + error.message });
  }
}