
function sanitizeTimes(text) {
  if (!text || typeof text !== 'string') return text;
  let cleaned = text;
  cleaned = cleaned.replace(/(\b(?:1[0-2]|0?[1-9])):(?:15|20|30|45)(\s*(?:am|pm|a\.m\.|p\.m\.|AM|PM|A\.M\.|P\.M\.))/gi, '\');
  cleaned = cleaned.replace(/(?<![\d\-])(\b(?:[01]?\d|2[0-3])):(?:15|20|30|45)\b(?![\d:\-])/g, '');
  cleaned = cleaned.replace(/(\b(?:1[0-2]|0?[1-9]))\s+y\s+(?:media|30)\b/gi, '');
  return cleaned;
}

const tests = [
  'El agendamiento es a las 10:30 am',
  'Te confirmo a las 09:30',
  'Cita a las 4 y media',
  'Nos vemos a las 16:30 pm',
  'Fecha 2026-07-26',
  'A las 11:00 am',
  'A las 8:15',
  'A las 5:45 pm'
];

tests.forEach(t => console.log(t, '-->', sanitizeTimes(t)));
