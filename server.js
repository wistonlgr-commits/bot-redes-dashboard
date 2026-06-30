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

// Ruta de prueba
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', clients: io.engine.clientsCount });
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
            // Si n8n envía solo una actualización individual (opcional)
            console.log('[Webhook] Recibido dato individual:', data);
            io.emit('actualizacion_individual', data);
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
