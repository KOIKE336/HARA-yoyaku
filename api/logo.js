export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;
    
    if (!global.events) {
      global.events = [];
    }

    const eventId = data['回答ID'];
    const event = {
      id: eventId,
      room: data['部屋'],
      name: data['氏名'],
      start: data['開始'],
      end: data['終了']
    };

    const existingIndex = global.events.findIndex(e => e.id === eventId);
    if (existingIndex >= 0) {
      global.events[existingIndex] = event;
    } else {
      global.events.push(event);
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(400).json({ error: 'Invalid data' });
  }
}