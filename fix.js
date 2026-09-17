const fs = require('fs');
const file = 'C:/Users/Leor/Desktop/bot whatsapp/Cambio del dia de hoy.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// Fix IF node
const esMensajeValido = data.nodes.find(n => n.name === '¿Es mensaje válido?');
const cond = esMensajeValido.parameters.conditions.conditions.find(c => c.id === '4901ac0f-1be0-42b8-858f-aeafce11bb24');
cond.leftValue = '={{ (() => { const data = $(\'Recibir WhatsApp\').item.json.body?.data; if (!data) return false; if (data.messageType && [\'conversation\', \'extendedTextMessage\', \'templateButtonReplyMessage\', \'buttonResponseMessage\', \'listResponseMessage\', \'interactiveResponseMessage\'].includes(data.messageType)) return true; if (data.contextInfo && (data.contextInfo.externalAdReply || data.contextInfo.conversionSource)) return true; const msgKeys = Object.keys(data.message || {}); return msgKeys.some(k => [\'conversation\', \'extendedTextMessage\', \'templateButtonReplyMessage\', \'buttonResponseMessage\', \'listResponseMessage\', \'interactiveResponseMessage\'].includes(k)); })() }}';

// Fix fuente logic
const crearPaciente = data.nodes.find(n => n.name === 'Crear Nuevo Paciente');
const fuenteField = crearPaciente.parameters.fieldsUi.fieldValues.find(f => f.fieldId === 'Fuente');
fuenteField.fieldValue = '={{ (() => { try { const payload = $(\'Recibir WhatsApp\').item.json.body; let ctx = payload?.data?.contextInfo || payload?.data?.message?.extendedTextMessage?.contextInfo; if (ctx) { const ad = ctx.externalAdReply || ctx.adReply; let sourceStr = (ctx.conversionSource || \'\') + \' \' + (ad?.sourceUrl || \'\') + \' \' + (ad?.mediaUrl || \'\') + \' \' + (ad?.sourceType || \'\'); sourceStr = sourceStr.toUpperCase(); if (sourceStr.includes(\'INSTAGRAM\') || sourceStr.includes(\'IG_ADS\')) { return \'Instagram Ads\'; } if (sourceStr.includes(\'FACEBOOK\') || sourceStr.includes(\'FB_ADS\') || sourceStr.includes(\'FB.COM\') || sourceStr.includes(\'FB_\')) { return \'Facebook Ads\'; } if (ad || ctx.conversionSource) { return \'Anuncio (Meta)\'; } } } catch(e) {} return \'Orgánico\'; })() }}';

fs.writeFileSync('C:/Users/Leor/Desktop/bot whatsapp/Cambio del dia de hoy - Corregido.json', JSON.stringify(data, null, 2));
console.log('Fixed workflow saved to Cambio del dia de hoy - Corregido.json');
