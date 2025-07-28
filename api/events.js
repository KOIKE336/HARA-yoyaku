import { promises as fs } from 'fs';

const EVENTS_FILE = '/tmp/events.json';

export default async function handler(req, res) {
  console.log('[events] Method:', req.method, 'Instance ID:', process.env.AWS_LAMBDA_LOG_STREAM_NAME?.slice(-8) || 'local');
  
  // CORS許可ヘッダを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // GETメソッドのみ許可
  if (req.method !== 'GET') {
    console.log('[events] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let events = [];
    
    // ファイルから読み込み（Serverlessでは永続化されない）
    try {
      const fileContent = await fs.readFile(EVENTS_FILE, 'utf8');
      events = JSON.parse(fileContent);
      console.log('[events] ✅ File read SUCCESS:', events.length, 'events loaded from', EVENTS_FILE);
    } catch (error) {
      console.log('[events] ❌ File read FAILED:', error.message);
      console.log('[events] This is expected if no events have been saved yet');
      events = [];
    }

    // 30日フィルタリング（既存のロジックを維持）
    const HORIZON_DAYS = 30;
    const now = new Date();
    const endDate = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);
    
    console.log('[events] Filtering events from', now.toISOString().slice(0, 10), 'to', endDate.toISOString().slice(0, 10));
    
    const filteredEvents = events.filter(event => {
      if (!event.start) {
        console.log('[events] Event missing start time:', event.id);
        return false;
      }
      const eventDate = new Date(event.start);
      const isInRange = eventDate >= now && eventDate <= endDate;
      if (!isInRange) {
        console.log('[events] Filtered out (date out of range):', event.id, event.start?.slice(0, 10));
      }
      return isInRange;
    });

    console.log('[events] ✅ Returning', filteredEvents.length, 'filtered events (out of', events.length, 'total)');
    
    res.status(200).json({ events: filteredEvents });
  } catch (error) {
    console.error('[events] ❌ Unexpected error:', error);
    res.status(200).json({ events: [] });
  }
}