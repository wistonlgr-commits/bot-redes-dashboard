const fs = require('fs');
const lines = fs.readFileSync('C:/Users/Leor/.gemini/antigravity/brain/d6eef132-bbf1-49c6-8268-321da2907571/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');

for (const line of lines) {
    if (!line) continue;
    try {
        const obj = JSON.parse(line);
        if (obj.content && obj.content.includes('"name": "botredesv4"')) {
            const startStr = "aqui esta el json de n8n el cerebro ";
            const idx = obj.content.indexOf(startStr);
            if (idx !== -1) {
                let jsonStr = obj.content.substring(idx + startStr.length);
                const endIdx = jsonStr.indexOf('</USER_REQUEST>');
                if (endIdx !== -1) {
                    jsonStr = jsonStr.substring(0, endIdx).trim();
                }
                const parsed = JSON.parse(jsonStr);
                fs.writeFileSync('original.json', JSON.stringify(parsed, null, 2));
                console.log('Saved original.json!');
                process.exit(0);
            }
        }
    } catch(e) {}
}
console.log('Not found');
