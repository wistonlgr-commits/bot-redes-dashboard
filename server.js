require('dotenv').config();

// CRITICAL: Polyfill WebSocket ANTES de importar Supabase
// Supabase Realtime requiere WebSocket nativo (Node 22+) o un polyfill global
const WebSocket = require('ws');
if (!globalThis.WebSocket) {
    globalThis.WebSocket = WebSocket;
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Sirve el dashboard.html y recursos

// Conexión a Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || ''; // Debe ser la Service Role Key para el backend
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    realtime: {
        transport: WebSocket
    }
});

// Helper para emitir a todos los clientes actualizando sus datos
async function broadcastData() {
    if (!supabaseUrl) return;
    try {
        const { data, error } = await supabase.from('leads').select('*').order('Ultima_Interaccion', { ascending: false });
        if (!error && data) {
            io.emit('actualizacion_completa', data);
        }
    } catch (error) {
        console.error("Error broadcasting data:", error);
    }
}

// Helper para calcular fecha de seguimiento de quincena (días 15 y 30)
function calcularAlertaQuincena() {
    const ahora = new Date();
    const dia = ahora.getDate();
    let mes = ahora.getMonth();
    let anio = ahora.getFullYear();
    let fechaAlerta = new Date();

    if (dia < 15) {
        // Antes del 15 -> Alerta el 15
        fechaAlerta = new Date(anio, mes, 15, 9, 0, 0);
    } else if (dia >= 15 && dia < 30) {
        // Entre el 15 y el 29 -> Alerta el 30
        fechaAlerta = new Date(anio, mes, 30, 9, 0, 0);
    } else {
        // Día 30 o 31 -> Alerta el 15 del mes siguiente
        if (mes === 11) { mes = 0; anio++; } else { mes++; }
        fechaAlerta = new Date(anio, mes, 15, 9, 0, 0);
    }
    return fechaAlerta;
}

// Endpoint para que el Frontend obtenga las credenciales públicas de Supabase
app.get('/api/config', (req, res) => {
    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
    });
});

// Ruta de prueba
app.get('/api/status', async (req, res) => {
    let dbStatus = 'disconnected';
    if (supabaseUrl) {
        const { error } = await supabase.from('bot_config').select('id').limit(1);
        dbStatus = error ? 'error' : 'connected';
    }
    res.json({ status: 'online', db: dbStatus, clients: io.engine.clientsCount });
});

// Endpoint para que n8n consulte si el bot debe responder o no
app.get('/api/bot-status', async (req, res) => {
    try {
        const phone = req.query.phone;
        
        // 1. Ver estado global del bot
        const { data: config } = await supabase.from('bot_config').select('is_active').eq('id', 1).single();
        let botActivo = config ? config.is_active : true; // Por defecto activo si no hay registro

        // 2. Si nos pasan el teléfono, verificar si esa conversación en específico está abierta por humano
        if (botActivo && phone) {
            // Normalizar telefono (n8n a veces manda @s.whatsapp.net o similar, extraemos solo números)
            const phoneStr = phone.replace(/[^0-9]/g, '');
            const { data: lead } = await supabase.from('leads').select('Conversacion_Abierta').ilike('phone_number', `%${phoneStr}%`).single();
            if (lead && lead.Conversacion_Abierta === true) {
                botActivo = false; // Pausar bot para este paciente
            }
        }

        res.json({ active: botActivo });
    } catch (error) {
        console.error("Error en bot-status:", error);
        res.json({ active: true }); // Failsafe
    }
});

// Endpoint para encender/apagar el bot global desde el Dashboard
app.post('/api/toggle-bot', async (req, res) => {
    try {
        const newState = req.body.active;
        await supabase.from('bot_config').upsert({ id: 1, is_active: newState });
        io.emit('bot_status_changed', newState);
        res.json({ success: true, active: newState });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para que el Frontend obtenga el estado global del bot
app.get('/api/bot-status-global', async (req, res) => {
    try {
        const { data: config } = await supabase.from('bot_config').select('is_active').eq('id', 1).single();
        res.json({ active: config ? config.is_active : true });
    } catch (error) {
        res.json({ active: true });
    }
});

// Endpoint para que el Frontend obtenga los datos
app.get('/api/data', async (req, res) => {
    try {
        const { data, error } = await supabase.from('leads').select('*').order('Ultima_Interaccion', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// WEBHOOK para n8n
app.post('/webhook/n8n', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        // Basic Security Check (Optional, configured via ENV)
        if (process.env.WEBHOOK_SECRET && authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = req.body;
        
        // Si n8n envía un objeto individual (flujo normal según tu JSON actualizado)
        if (data.Telefono) {
            // Ignorar por completo si es un grupo de WhatsApp
            if (data.Telefono.includes('@g.us')) {
                return res.status(200).json({ message: 'Mensajes de grupos (@g.us) ignorados por el sistema' });
            }

            let phoneStr = data.Telefono.replace(/[^0-9]/g, '');
            if (!phoneStr) return res.status(400).json({ error: 'No phone' });
            if (phoneStr.startsWith('0') && phoneStr.length === 11) phoneStr = '58' + phoneStr.substring(1);
            if (phoneStr.startsWith('580') && phoneStr.length === 13) phoneStr = '58' + phoneStr.substring(3);

            // Detectar fuente: Usar lo que envíe n8n explícitamente en "Fuente".
            // Si n8n nos manda todo el payload de WhatsApp anidado, buscamos el referral.
            let fuente = 'organico';
            if (data.Fuente) {
                fuente = data.Fuente.toLowerCase();
            } else if (data.referral || (data.message && data.message.referral)) {
                // Si encontramos la etiqueta de Ads (referral) de WhatsApp directamente
                const ref = data.referral || data.message.referral;
                if (ref.source_url && ref.source_url.includes('instagram')) {
                    fuente = 'instagram';
                } else {
                    fuente = 'facebook'; // por defecto si es ad pero no ig
                }
            }

            // Alerta Quincena
            const alerta = calcularAlertaQuincena();
            const tipoAlerta = (data.Dia_Cita && data.Dia_Cita.trim() !== '') ? 'SEGUIMIENTO_MEDICO' : 'VENTA';

            const upsertData = {
                phone_number: phoneStr,
                Nombre: data.Nombre,
                Ciudad: data.Ciudad,
                Motivo_Consulta: data.Motivo_Consulta,
                Temperatura: data.Temperatura,
                Resumen: data.Resumen,
                Dia_Cita: data.Dia_Cita,
                Hora_Cita: data.Hora_Cita,
                Ultima_Interaccion: new Date().toISOString(),
                Fuente: fuente,
                Fecha_Seguimiento: alerta.toISOString().split('T')[0],
                Tipo_Alerta: tipoAlerta,
                Estado_Alerta: 'PENDIENTE'
            };

            // Solo actualizar campos que tengan valor
            Object.keys(upsertData).forEach(key => {
                if (upsertData[key] === undefined || upsertData[key] === null || upsertData[key] === "") {
                    delete upsertData[key];
                }
            });

            // Upsert (Actualizar si existe por phone_number, insertar si no)
            const { error } = await supabase.from('leads').upsert(upsertData, { onConflict: 'phone_number' });
            
            if (error) throw error;

            broadcastData();
            console.log(`[Webhook] Procesado paciente: ${phoneStr}`);
        } else if (Array.isArray(data)) {
            // Legacy/Masivo (por si mandas el array de google sheets)
            for (const row of data) {
                if (row.Telefono) {
                    const phoneStr = row.Telefono.replace(/[^0-9]/g, '');
                    await supabase.from('leads').upsert({
                        phone_number: phoneStr,
                        Nombre: row.Nombre,
                        Ciudad: row.Ciudad,
                        Motivo_Consulta: row.Motivo_Consulta,
                        Temperatura: row.Temperatura,
                        Resumen: row.Resumen,
                        Dia_Cita: row.Dia_Cita,
                        Hora_Cita: row.Hora_Cita
                    }, { onConflict: 'phone_number' });
                }
            }
            broadcastData();
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error procesando webhook:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para guardar cambios desde el Dashboard
app.post('/api/update', async (req, res) => {
    try {
        const updatedRow = req.body;
        if (!updatedRow || !updatedRow.id) return res.status(400).json({ error: "Falta ID" });
        
        // Evitar error de columna inexistente
        delete updatedRow.Telefono;
        
        const { error } = await supabase.from('leads').update(updatedRow).eq('id', updatedRow.id);
        if (error) throw error;
        
        broadcastData();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para Acciones Masivas
app.post('/api/bulk-action', async (req, res) => {
    try {
        const { ids, action } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "Faltan IDs" });

        let updatePayload = {};
        let isDelete = false;

        switch (action) {
            case 'asignar_bot':
                updatePayload = { Estado_Alerta: 'PROGRAMADA_BOT' };
                break;
            case 'marcar_perdido':
                updatePayload = { Temperatura: 'FRIO' }; 
                break;
            case 'descartar_alerta':
                updatePayload = { Estado_Alerta: 'DESCARTADA' };
                break;
            case 'eliminar':
                isDelete = true;
                break;
            default:
                return res.status(400).json({ error: "Acción inválida" });
        }

        if (isDelete) {
            const { error } = await supabase.from('leads').delete().in('id', ids);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('leads').update(updatePayload).in('id', ids);
            if (error) throw error;
        }

        broadcastData();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error bulk action:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para agregar paciente manualmente
app.post('/api/add', async (req, res) => {
    try {
        const newRow = req.body;
        if (newRow.Telefono) {
            let num = newRow.Telefono.replace(/[^0-9]/g, '');
            if (num.startsWith('0') && num.length === 11) num = '58' + num.substring(1);
            if (num.startsWith('580') && num.length === 13) num = '58' + num.substring(3);
            newRow.phone_number = num;
        } else {
            return res.status(400).json({ error: "Teléfono es requerido" });
        }
        delete newRow.id; // Supabase autogenera el uuid
        delete newRow.Telefono; // EVITAR ERROR DE COLUMNA
        
        // Calcular campos de alerta
        const hoy = new Date();
        const quincena = calcularAlertaQuincena(hoy);
        newRow.Fecha_Seguimiento = quincena.toISOString().split('T')[0];
        newRow.Estado_Alerta = 'PENDIENTE';
        if (!newRow.Fuente) newRow.Fuente = 'organico';
        newRow.Ultima_Interaccion = hoy.toISOString();
        
        const { error } = await supabase.from('leads').insert(newRow);
        if (error) {
            if (error.code === '23505') {
                throw new Error("El paciente ya existe (este número de teléfono ya está registrado).");
            }
            throw error;
        }
        
        broadcastData();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para eliminar paciente
app.post('/api/delete', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: "Falta ID" });
        
        const { error } = await supabase.from('leads').delete().eq('id', id);
        if (error) throw error;

        broadcastData();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Configuración de WebSockets
io.on('connection', async (socket) => {
    console.log(`[Socket] Nuevo cliente conectado: ${socket.id}`);
    
    // Enviar datos actuales al conectar
    try {
        if (supabaseUrl) {
            const { data } = await supabase.from('leads').select('*').order('Ultima_Interaccion', { ascending: false });
            if (data) socket.emit('actualizacion_completa', data);
        }
    } catch(e) {}

    socket.on('disconnect', () => {
        console.log(`[Socket] Cliente desconectado: ${socket.id}`);
    });
});

// Escuchar cambios en tiempo real desde Supabase (Si otro servidor o dashboard hace cambios)
if (supabaseUrl) {
    supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
          broadcastData(); // Notifica a los sockets
      })
      .subscribe();
}

// Arrancar el servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=== Servidor Dashboard V2 Activo ===`);
    console.log(`Puerto: ${PORT} (0.0.0.0)`);
    if (!supabaseUrl) console.log("⚠️ ADVERTENCIA: No se han configurado credenciales de Supabase en .env");
});
