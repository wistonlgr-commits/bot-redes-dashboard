const jsonStr = '{{"nombre": "Juan", "dia_cita": "2026-08-25", "hora_cita": "10:00"}}';
let fixedStr = jsonStr.replace(/^\{\{/, '{').replace(/\}\}$/, '}');
fixedStr = fixedStr.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
console.log(JSON.parse(fixedStr));
