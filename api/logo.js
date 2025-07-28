import { promises as fs } from 'fs';

const EVENTS_FILE = '/tmp/events.json';

export default async function handler(req, res) {
  console.log('[logo] Method:', req.method, 'Instance ID:', process.env.AWS_LAMBDA_LOG_STREAM_NAME?.slice(-8) || 'local');
  
  // POSTメソッドのみ許可
  if (req.method !== 'POST') {
    console.log('[logo] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ボディ取得（フォールバック付き）
    const data = req.body || (await new Promise(r => {
      let d = '';
      req.on('data', c => d += c);
      req.on('end', () => r(JSON.parse(d || '{}')));
    }));
    
    console.log('[logo] payload:', JSON.stringify(data));
    
    // 既存のevents.jsonを読み込み（Serverlessでは毎回ファイルから読む）
    let events = [];
    try {
      const fileContent = await fs.readFile(EVENTS_FILE, 'utf8');
      events = JSON.parse(fileContent);
      console.log('[logo] Loaded events from file:', events.length, 'records');
    } catch (error) {
      console.log('[logo] File not found, starting with empty array');
      events = [];
    }

    // 新しいイベントデータを作成
    const eventId = data['回答ID'];
    if (!eventId) {
      console.error('[logo] Missing 回答ID in payload');
      return res.status(400).json({ error: 'Missing 回答ID' });
    }

    const event = {
      id: eventId,
      room: data['部屋'],
      name: data['氏名'],
      start: data['開始'],
      end: data['終了']
    };

    console.log('[logo] Creating event:', JSON.stringify(event));

    // 同じ回答IDがあれば上書き、なければ追加
    const existingIndex = events.findIndex(e => e.id === eventId);
    if (existingIndex >= 0) {
      console.log('[logo] Updating existing event at index:', existingIndex);
      events[existingIndex] = event;
    } else {
      console.log('[logo] Adding new event, total will be:', events.length + 1);
      events.push(event);
    }

    // ファイルに保存（同期的に確実に書き込み）
    try {
      await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf8');
      console.log('[logo] ✅ File write SUCCESS:', events.length, 'events saved to', EVENTS_FILE);
      
      // 書き込み後の確認読み込み
      const verifyContent = await fs.readFile(EVENTS_FILE, 'utf8');
      const verifyEvents = JSON.parse(verifyContent);
      console.log('[logo] ✅ File write VERIFIED:', verifyEvents.length, 'events can be read back');
    } catch (writeError) {
      console.error('[logo] ❌ File write FAILED:', writeError);
      return res.status(500).json({ error: 'File write failed' });
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[logo] Error processing webhook:', error);
    res.status(400).json({ error: 'Invalid data', details: error.message });
  }
}