const fs = require('fs');

const inputPath = 'c:\\\\Users\\\\Leor\\\\Desktop\\\\bot whatsapp\\\\flujo que consume muchos tokens.json';
const outputPath = 'c:\\\\Users\\\\Leor\\\\Desktop\\\\bot whatsapp\\\\flujo_optimizado.json';

try {
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  
  for (let node of data.nodes) {
    // Modify prompt to format history as text
    if (node.name === 'Cerebro Inteligencia Artificial' && node.parameters?.messages?.values) {
      let content = node.parameters.messages.values[0].content;
      
      const oldHistoryCode = `{{ (() => { const h = $node["Refrescar Datos de Supabase"].json.chat_history || []; const str = JSON.stringify(h); return str.split(String.fromCharCode(123)).join(String.fromCharCode(123, 123)).split(String.fromCharCode(125)).join(String.fromCharCode(125, 125)); })() }}`;
      
      const newHistoryCode = `{{ (() => { const h = $node["Refrescar Datos de Supabase"].json.chat_history || []; return h.map(m => (m.role === 'user' ? 'Paciente: ' : 'Asistente: ') + m.content).join('\\n'); })() }}`;
      
      if (content.includes(oldHistoryCode)) {
        content = content.replace(oldHistoryCode, newHistoryCode);
      } else {
        // Fallback replacement if exact string match fails due to escaping differences
        content = content.replace(
          /\{\{\s*\(\(\)\s*=>\s*\{\s*const h = \$node\["Refrescar Datos de Supabase"\].*?\}\)\(\)\s*\}\}/,
          newHistoryCode
        );
      }
      node.parameters.messages.values[0].content = content;
    }
    
    // Modify history truncation in Formatear Respuesta
    if (node.name === 'Formatear Respuesta' && node.parameters?.jsCode) {
      let code = node.parameters.jsCode;
      // Change 20 to 8
      code = code.replace(/if \(history\.length > 20\) history = history\.slice\(history\.length - 20\);/g, 'if (history.length > 8) history = history.slice(history.length - 8);');
      node.parameters.jsCode = code;
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Optimized flow saved to ' + outputPath);
} catch (e) {
  console.error('Error:', e);
}
