const fs = require('fs');
let content = fs.readFileSync('public/index.html', 'utf8');

// Modificar filtro para excluir bloqueos de todos los conteos
content = content.replace(/if \(temp === 'bloqueo'\) return;/g, "if (temp === 'bloqueo' || temp === 'eliminado') return;");

// Añadir Papelera al menú
content = content.replace(/<option value="bloqueo">Bloqueos de Agenda<\/option>/g, '<option value="bloqueo">Bloqueos de Agenda</option>\n                            <option value="eliminado">Papelera (Eliminados)</option>');

// Lógica de filtro en la tabla
content = content.replace(/let matchesFilter = true;/g, "let matchesFilter = (filterType === 'eliminado') ? true : !tr.children[4].innerText.toLowerCase().includes('eliminado');");
content = content.replace(/if \(filterType === 'frio' \|\| filterType === 'tibio' \|\| filterType === 'caliente' \|\| filterType === 'bloqueo'\)/g, "if (filterType === 'frio' || filterType === 'tibio' || filterType === 'caliente' || filterType === 'bloqueo' || filterType === 'eliminado')");

// Ocultar de calendario (evitar renderizar si es eliminado)
content = content.replace(/if \(colIds\.length === 0\) return;/g, "if (colIds.length === 0 || temp === 'eliminado') return;");

fs.writeFileSync('public/index.html', content);
console.log('Done!');
