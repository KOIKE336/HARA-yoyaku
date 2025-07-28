import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  console.log('[kv] POST request received');
  
  // 環境変数チェック
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.error('[kv] ❌ ENV not set');
    return res.status(500).json({ error: 'ENV not set' });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body || {};
    console.log('[kv] Request data:', JSON.stringify(data));
    
    const events = await kv.get('events') || [];
    console.log('[kv] Current events:', events.length);

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
    } else {
      events.push(event);
    }

    await kv.set('events', events);
    console.log('[kv] ✅ KV save SUCCESS:', events.length, 'events');

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[kv] ❌ KV save ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
}