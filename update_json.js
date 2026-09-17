const fs = require('fs');
let data = JSON.parse(fs.readFileSync('se puede mejorar,,,.json', 'utf8'));

const gemini = data.nodes.find(n => n.name.includes('Cerebro'));
if (gemini && gemini.parameters.messages && gemini.parameters.messages.values && gemini.parameters.messages.values[0]) {
    let prompt = gemini.parameters.messages.values[0].content;
    
    // Add humanization
    prompt = prompt.replace(
        "EXTREMADAMENTE CORTO. Maximo 2 o 3 oraciones por mensaje. Cero parrafos largos.",
        "HUMANO Y NATURAL: Tus respuestas deben sonar súper naturales, como una secretaria humana real (no como un robot). Usa lenguaje fluido y amable. En vez de enlistar cosas rígidamente o sonar mecánica, usa frases como '¡Perfecto! Con todo gusto', 'Para poder apartarle el turno...', '¿Me ayudas con...?', etc. Sigue siendo muy concisa (máximo 2-3 oraciones), pero cálida y empática."
    );
    
    // Change model
    gemini.parameters.model = 'models/gemini-1.5-flash';

    gemini.parameters.messages.values[0].content = prompt;

    fs.writeFileSync('se puede mejorar,,,.json', JSON.stringify(data, null, 2));
    console.log('JSON updated successfully with friendly prompt!');
} else {
    console.log('Failed to find prompt in JSON.');
}
