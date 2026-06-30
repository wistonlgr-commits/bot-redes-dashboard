const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Sirve el dashboard.html y recursos

// Caché en memoria para cuando alguien abre el dashboard
let cacheDatos = [];
// Estado global del Bot
let botActivo = true;

// Ruta de prueba
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', clients: io.engine.clientsCount, botActivo });
});

// Endpoint para que n8n consulte si el bot debe responder o no
app.get('/api/bot-status', (req, res) => {
    res.json({ active: botActivo });
});

// Endpoint para encender/apagar el bot desde el Dashboard
app.post('/api/toggle-bot', (req, res) => {
    try {
        botActivo = req.body.active;
        io.emit('bot_status_changed', botActivo);
        res.json({ success: true, active: botActivo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para que el Frontend obtenga los datos al cargar por primera vez
app.get('/api/data', (req, res) => {
    res.json(cacheDatos);
});

// WEBHOOK para n8n
// n8n debe hacer un POST aquí con el array de datos leídos de Sheets
app.post('/webhook/n8n', (req, res) => {
    try {
        const data = req.body;
        
        // Asumimos que n8n envía un Array completo (todas las filas del sheet)
        if (Array.isArray(data)) {
            // Asignar ID único a cada registro basado en el teléfono o random
            data.forEach((row, i) => {
                row.id = row.Telefono ? row.Telefono.replace(/[^0-9]/g, '') + "_" + i : crypto.randomUUID();
            });
            cacheDatos = data;
            // Emitimos evento a todos los clientes conectados (navegadores)
            io.emit('actualizacion_completa', cacheDatos);
            console.log(`[Webhook] Recibidas ${data.length} filas. Broadcast enviado.`);
        } else {
            // Si n8n envía solo un objeto (un paciente nuevo o actualizado)
            if (!data.Telefono || data.Telefono.trim() === "") {
                console.log('[Webhook] Ignorado: Datos vacíos sin teléfono');
                return res.status(200).json({ success: true, message: 'Ignorado por falta de teléfono' });
            }
            if (!data.id) data.id = data.Telefono.replace(/[^0-9]/g, '');
            const idx = cacheDatos.findIndex(r => r.id === data.id);
            if (idx !== -1) {
                // Actualizar solo los campos que no estén vacíos para no borrar datos existentes
                const oldData = cacheDatos[idx];
                const newData = { ...oldData };
                for (let key in data) {
                    if (data[key] !== "" && data[key] !== null && data[key] !== undefined) {
                        newData[key] = data[key];
                    }
                }
                cacheDatos[idx] = newData;
            } else {
                cacheDatos.push(data);
            }
            
            io.emit('actualizacion_completa', cacheDatos);
            console.log('[Webhook] Recibido y procesado dato individual');
        }

        res.status(200).json({ success: true, message: 'Datos recibidos y emitidos' });
    } catch (error) {
        console.error('Error procesando webhook:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para guardar cambios desde el Dashboard
app.post('/api/update', (req, res) => {
    try {
        const updatedRow = req.body;
        if (!updatedRow || !updatedRow.id) return res.status(400).json({ error: "Falta ID" });
        
        const index = cacheDatos.findIndex(r => r.id === updatedRow.id);
        if (index !== -1) {
            cacheDatos[index] = { ...cacheDatos[index], ...updatedRow };
            io.emit('actualizacion_completa', cacheDatos); // Refresca en todos lados
            res.json({ success: true, data: cacheDatos[index] });
        } else {
            res.status(404).json({ error: "No encontrado" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para agregar paciente manualmente
app.post('/api/add', (req, res) => {
    try {
        const newRow = req.body;
        // Generar un id (usando telefono o random)
        newRow.id = newRow.Telefono ? newRow.Telefono.replace(/[^0-9]/g, '') : crypto.randomUUID();
        
        // Evitar duplicados si existe el mismo id
        const index = cacheDatos.findIndex(r => r.id === newRow.id);
        if (index !== -1) {
            cacheDatos[index] = { ...cacheDatos[index], ...newRow };
        } else {
            cacheDatos.push(newRow);
        }
        
        io.emit('actualizacion_completa', cacheDatos);
        res.json({ success: true, data: newRow });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para eliminar paciente
app.post('/api/delete', (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: "Falta ID" });
        
        cacheDatos = cacheDatos.filter(r => r.id !== id);
        io.emit('actualizacion_completa', cacheDatos);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Configuración de WebSockets
io.on('connection', (socket) => {
    console.log(`[Socket] Nuevo cliente conectado: ${socket.id}`);
    
    // Opcional: enviarle los datos actuales tan pronto se conecta
    if (cacheDatos.length > 0) {
        socket.emit('actualizacion_completa', cacheDatos);
    }

    socket.on('disconnect', () => {
        console.log(`[Socket] Cliente desconectado: ${socket.id}`);
    });
});

// Arrancar el servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`=== Servidor Dashboard Activo ===`);
    console.log(`Puerto: ${PORT}`);
    console.log(`URL Webhook para n8n: http://<tu-servidor-coolify>:${PORT}/webhook/n8n`);
});
