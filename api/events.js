export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const HORIZON_DAYS = 30;
  const now = new Date();
  const endDate = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);

  let events = global.events || [];
  
  // Filter events within the next 30 days
  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.start);
    return eventDate >= now && eventDate <= endDate;
  });

  res.status(200).json({ events: filteredEvents });
}