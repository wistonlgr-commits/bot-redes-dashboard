
        // --- INICIALIZACIÓN Y CONFIGURACIÓN ---
        let supabase = null;
        let localData = [];
        let globalBotActive = true;
        let socket = null;

        // ASEGURAR QUE EL FORMULARIO NO RECARGUE LA PÁGINA NUNCA
        async function intentarLogin() {
            const errDiv = document.getElementById('auth-error');
            if (!supabase) {
                errDiv.innerText = "Conectando al servidor... Espera unos segundos y vuelve a intentar.";
                errDiv.style.display = 'block';
                return;
            }
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            
            if(!email || !password) {
                errDiv.innerText = "Por favor ingresa correo y contraseña.";
                errDiv.style.display = 'block';
                return;
            }

            errDiv.style.display = 'none';
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    errDiv.innerText = error.message;
                    errDiv.style.display = 'block';
                } else {
                    checkSession();
                }
            } catch(err) {
                errDiv.innerText = "Error de conexión. Revisa tu internet.";
                errDiv.style.display = 'block';
            }
        }

        try {
            socket = io();
        } catch(e) {
            console.warn("Socket.io no cargó aún");
        }

        // Obtener config del servidor e inicializar
        async function initApp() {
            try {
                const res = await fetch('/api/config');
                const config = await res.json();
                
                if(config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
                    supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
                    checkSession();
                } else {
                    alert("Falta configuración de Supabase en el servidor (.env)");
                }
            } catch (error) {
                console.error("Error init:", error);
            }
        }

        // --- AUTENTICACIÓN ---
        async function checkSession() {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                document.getElementById('auth-screen').style.opacity = '0';
                setTimeout(() => document.getElementById('auth-screen').style.display = 'none', 500);
                loadDashboardData();
            } else {
                document.getElementById('auth-screen').style.display = 'flex';
                document.getElementById('auth-screen').style.opacity = '1';
            }
        }



        async function logout() {
            await supabase.auth.signOut();
            window.location.reload();
        }

        // Cambiar contraseña
        document.getElementById('password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPwd = document.getElementById('new-password').value;
            const msg = document.getElementById('pwd-msg');
            const { error } = await supabase.auth.updateUser({ password: newPwd });
            if (error) {
                msg.style.color = 'var(--danger)';
                msg.innerText = error.message;
            } else {
                msg.style.color = 'var(--accent)';
                msg.innerText = "Contraseña actualizada exitosamente.";
                document.getElementById('new-password').value = '';
            }
        });

        // --- UI & NAVEGACIÓN ---
        function toggleSidebar() {
            document.getElementById('info-sidebar').classList.toggle('hidden');
        }

        function switchView(viewId, element) {
            document.querySelectorAll('.view-pane').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            document.getElementById(viewId).classList.add('active');
            element.classList.add('active');
        }

        // --- CARGA DE DATOS Y RENDERIZADO ---
        async function loadDashboardData() {
            // Cargar datos por API (pasando token)
            try {
                const { data: { session } } = await supabase.auth.getSession();
                // Obtener estado global del bot
                const botRes = await fetch('/api/bot-status-global');
                const botData = await botRes.json();
                globalBotActive = botData.active;
                renderGlobalBotBtn();

                // Obtener pacientes
                const res = await fetch('/api/data', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
                localData = await res.json();
                renderUI();
                updateSync('Sincronizado', true);
            } catch (error) {
                console.error(error);
                updateSync('Error de conexión', false);
            }
        }

        function updateSync(text, isGood) {
            const badge = document.getElementById('sync-status');
            badge.innerHTML = isGood ? `<i class="fa-solid fa-circle-check"></i> ${text}` : `<i class="fa-solid fa-triangle-exclamation"></i> ${text}`;
            if(isGood) badge.classList.add('active'); else badge.classList.remove('active');
        }

        // Sockets para tiempo real
        if (socket) {
            socket.on('actualizacion_completa', (data) => {
                if (supabase) { // solo si está auth
                    localData = data;
                    renderUI();
                    updateSync('Sincronizado', true);
                }
            });
            
            socket.on('bot_status_changed', (status) => {
                globalBotActive = status;
                renderGlobalBotBtn();
            });
        }

        // --- RENDERIZADO (CALENDARIO Y TABLAS) ---
        function getTempColor(temp) {
            temp = (temp||'').toLowerCase();
            if(temp==='caliente') return 'var(--temp-caliente)';
            if(temp==='tibio') return 'var(--temp-tibio)';
            return 'var(--temp-frio)';
        }

        function renderUI() {
            // Limpiar
            const tbody = document.getElementById('table-body');
            const waitlist = document.getElementById('waitlist-list');
            const alertlist = document.getElementById('alert-list');
            
            tbody.innerHTML = ''; waitlist.innerHTML = ''; alertlist.innerHTML = '';
            document.querySelectorAll('.cal-event').forEach(e => e.remove());

            let citasCount = 0; let pendCount = 0;
            const hoy = new Date();

            localData.forEach(row => {
                const id = row.id;
                const nombre = row.Nombre || 'Sin Nombre';
                const temp = (row.Temperatura || 'frio').toLowerCase();
                const dia = (row.Dia_Cita || '').toLowerCase().trim();
                const hora = (row.Hora_Cita || '').toLowerCase().trim();
                const fuente = (row.Fuente || 'organico').toLowerCase();
                const tColor = getTempColor(temp);
                const init = nombre.substring(0,2).toUpperCase();

                // Logica Alerta Quincena
                let hasAlert = false;
                if (row.Alerta_Quincena) {
                    const alertDate = new Date(row.Alerta_Quincena);
                    // Si la alerta es hoy o ya pasó y no tiene cita
                    if (alertDate <= hoy && (!dia || dia === 'no')) {
                        hasAlert = true;
                    }
                }

                // Generar iconos de fuente
                let sourceIcon = '<i class="fa-brands fa-whatsapp"></i>';
                if(fuente==='facebook') sourceIcon = '<i class="fa-brands fa-facebook" style="color:#1877F2"></i>';
                if(fuente==='instagram') sourceIcon = '<i class="fa-brands fa-instagram" style="color:#E1306C"></i>';

                // Si tiene cita agendada
                if (dia && hora && dia !== 'no') {
                    citasCount++;
                    renderCalendarEvent(row, tColor);
                } else {
                    pendCount++;
                    const pillHtml = `
                        <div class="patient-pill" onclick="openModal('${id}')">
                            <div class="color-bar" style="background-color: ${tColor}"></div>
                            <div class="pill-content">
                                <div class="pill-avatar" style="background: ${tColor}">${init}</div>
                                <div class="pill-info">
                                    <div class="pill-name">${nombre} ${row.Conversacion_Abierta ? '<i class="fa-solid fa-headset" style="color:var(--primary-light); font-size:0.8rem" title="Bot Pausado"></i>' : ''}</div>
                                    <div class="pill-desc">${sourceIcon} ${row.phone_number || ''}</div>
                                </div>
                                ${hasAlert ? '<i class="fa-solid fa-bell alert-indicator"></i>' : ''}
                            </div>
                        </div>
                    `;
                    if (hasAlert) {
                        alertlist.innerHTML += pillHtml;
                    } else {
                        waitlist.innerHTML += pillHtml;
                    }
                }

                // Llenar tabla general
                let badgeClass = `badge badge-${temp}`;
                let dateTxt = (dia && hora && dia !== 'no') ? `${dia.toUpperCase()} ${hora}` : '<span style="color:var(--text-muted)">Pendiente</span>';
                
                tbody.innerHTML += `
                    <tr class="t-row">
                        <td>
                            <div style="display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="openModal('${id}')">
                                <div class="pill-avatar" style="background:${tColor}; width:32px; height:32px; font-size:0.75rem;">${init}</div>
                                <div>
                                    <div style="font-weight:600;">${nombre} ${hasAlert ? '<i class="fa-solid fa-bell alert-indicator" style="font-size:0.8rem"></i>' : ''}</div>
                                </div>
                            </div>
                        </td>
                        <td>${row.phone_number || '-'}</td>
                        <td><div class="badge badge-source">${sourceIcon} <span style="text-transform:capitalize; margin-left:4px;">${fuente}</span></div></td>
                        <td><div class="${badgeClass}">${temp}</div></td>
                        <td>${dateTxt}</td>
                        <td>
                            <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openModal('${id}')">
                                Gestionar
                            </button>
                        </td>
                    </tr>
                `;
            });

            document.getElementById('stat-citas').innerText = citasCount;
            document.getElementById('stat-pendientes').innerText = pendCount;
            
            if(alertlist.innerHTML === '') alertlist.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-top: 20px;">Todo al día</p>';
            if(waitlist.innerHTML === '') waitlist.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin-top: 20px;">Bandeja limpia</p>';
        }

        // Generar grilla de calendario
        const times = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
        const timeLabels = document.getElementById('time-labels');
        times.forEach(t => timeLabels.innerHTML += `<div class="cal-time-slot">${t}</div>`);
        ['col-lunes', 'col-martes', 'col-miercoles', 'col-jueves', 'col-viernes'].forEach(day => {
            const col = document.getElementById(day);
            times.forEach(() => col.innerHTML += `<div class="cal-cell"></div>`);
        });

        function renderCalendarEvent(row, color) {
            const dia = row.Dia_Cita.toLowerCase().replace('é', 'e');
            const hora = row.Hora_Cita.toLowerCase();
            let colId = '';
            if (dia.includes('lun')) colId = 'col-lunes';
            else if (dia.includes('mar')) colId = 'col-martes';
            else if (dia.includes('mie')) colId = 'col-miercoles';
            else if (dia.includes('jue')) colId = 'col-jueves';
            else if (dia.includes('vie')) colId = 'col-viernes';
            if (!colId) return; 

            let hourNum = 8; let minNum = 0;
            let timeMatch = hora.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
            if (timeMatch) {
                hourNum = parseInt(timeMatch[1], 10);
                minNum = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
                if (hora.includes('pm') && hourNum < 12) hourNum += 12;
                if (hora.includes('am') && hourNum === 12) hourNum = 0;
            }
            const topPx = ((hourNum - 8) * 80) + (minNum * (80/60)); 
            const col = document.getElementById(colId);
            
            if (col) {
                // Pequeña corrección visual si hay choques de horario, los superponemos un poco
                col.innerHTML += `
                    <div class="cal-event" style="top: ${topPx}px; height: 74px; background-color: ${color};" onclick="openModal('${row.id}')">
                        <div class="cal-event-time">${hora.toUpperCase()}</div>
                        <div class="cal-event-title">${row.Nombre}</div>
                    </div>
                `;
            }
        }

        function filterTable() {
            let input = document.getElementById("search-input").value.toLowerCase();
            document.querySelectorAll(".t-row").forEach(tr => {
                tr.style.display = tr.innerText.toLowerCase().includes(input) ? "" : "none";
            });
        }

        // --- LÓGICA DEL BOT GLOBAL ---
        function renderGlobalBotBtn() {
            const btn = document.getElementById('btn-global-bot');
            if (globalBotActive) {
                btn.className = "btn btn-bot";
                btn.innerHTML = '<i class="fa-solid fa-robot"></i> <span>Bot Activo</span>';
            } else {
                btn.className = "btn btn-bot off";
                btn.innerHTML = '<i class="fa-solid fa-power-off"></i> <span>Bot Apagado</span>';
            }
        }

        async function toggleGlobalBot() {
            try {
                const newState = !globalBotActive;
                await fetch('/api/toggle-bot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ active: newState })
                });
            } catch(e) { alert("Error de conexión"); }
        }

        // --- GESTIÓN DE MODAL Y CRUD ---
        function openModal(id = null) {
            document.getElementById('patient-modal').style.display = 'flex';
            
            if (!id) {
                // Nuevo
                document.getElementById('f-id').value = "";
                document.getElementById('f-nombre').value = "";
                document.getElementById('f-telefono').value = "";
                document.getElementById('f-telefono').removeAttribute('disabled');
                document.getElementById('f-ciudad').value = "";
                document.getElementById('f-temperatura').value = "frio";
                document.getElementById('f-dia').value = "";
                document.getElementById('f-hora').value = "";
                document.getElementById('f-motivo').value = "";
                document.getElementById('f-resumen').value = "";
                document.getElementById('f-notas').value = "";
                document.getElementById('f-pausar-bot').checked = false;
                return;
            }

            const row = localData.find(p => p.id === id);
            if (!row) return;
            
            document.getElementById('f-id').value = row.id;
            document.getElementById('f-nombre').value = row.Nombre || "";
            document.getElementById('f-telefono').value = row.phone_number || "";
            document.getElementById('f-telefono').setAttribute('disabled', 'true'); // No editar ID
            document.getElementById('f-ciudad').value = row.Ciudad || "";
            document.getElementById('f-temperatura').value = (row.Temperatura || "frio").toLowerCase();
            
            let d = (row.Dia_Cita || "").toLowerCase().replace('é', 'e');
            document.getElementById('f-dia').value = ["lunes","martes","miercoles","jueves","viernes"].includes(d) ? d : "";
            document.getElementById('f-hora').value = row.Hora_Cita || "";
            document.getElementById('f-motivo').value = row.Motivo_Consulta || "";
            document.getElementById('f-resumen').value = row.Resumen || "";
            document.getElementById('f-notas').value = row.Notas || "";
            document.getElementById('f-pausar-bot').checked = row.Conversacion_Abierta === true;
        }

        function closeModal() { document.getElementById('patient-modal').style.display = 'none'; }

        async function savePatient() {
            const data = {
                id: document.getElementById('f-id').value,
                Nombre: document.getElementById('f-nombre').value,
                Telefono: document.getElementById('f-telefono').value, // Solo para 'add'
                Ciudad: document.getElementById('f-ciudad').value,
                Temperatura: document.getElementById('f-temperatura').value,
                Dia_Cita: document.getElementById('f-dia').value,
                Hora_Cita: document.getElementById('f-hora').value,
                Motivo_Consulta: document.getElementById('f-motivo').value,
                Notas: document.getElementById('f-notas').value,
                Conversacion_Abierta: document.getElementById('f-pausar-bot').checked
            };

            const endpoint = data.id ? '/api/update' : '/api/add';
            try {
                updateSync('Guardando...', true);
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if(!res.ok) throw new Error("Error API");
                closeModal();
            } catch(e) {
                alert("Error al guardar");
                updateSync('Error', false);
            }
        }

        async function deletePatient() {
            const id = document.getElementById('f-id').value;
            if (!id) return closeModal();
            if (confirm("¿Eliminar permanentemente este expediente?")) {
                try {
                    await fetch('/api/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id })
                    });
                    closeModal();
                } catch(e) { alert("Error"); }
            }
        }

        window.onclick = function(e) { if (e.target == document.getElementById('patient-modal')) closeModal(); }

        // Start
        initApp();
    