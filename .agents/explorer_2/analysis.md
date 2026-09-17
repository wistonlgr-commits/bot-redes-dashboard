# Informe de Análisis: Refactorización y Optimización del Nodo `Formatear Agenda` (Paso 2)

**Autor:** Explorer 2  
**Fecha:** 2026-07-26  
**Objetivo:** Diagnosticar el estado actual del nodo JavaScript `Formatear Agenda` (Nodo #15 en `flujo asistente de whatsapp.json` y `formatear_agenda_corregido.js`), analizar todas las reglas de bloqueo por clínicas externas y Supabase, identificar fallas de conversión de hora y media hora (`:30`), y formular el plan de refactorización definitivo para entregar a Gemini una lista positiva de horas exactas `:00` 100% disponibles.

---

## 1. Diagnóstico del Nodo Actual `Formatear Agenda`

En la arquitectura actual del workflow:
- El nodo **`Formatear Agenda`** se ejecuta después de consultar la base de datos Supabase (`Refrescar Datos de Supabase`).
- Recibe un arreglo de registros (`$input.all()`), donde cada elemento representa una cita o un registro de bloqueo con los campos `Dia_Cita` (YYYY-MM-DD) y `Hora_Cita` (string de hora).
- Genera un objeto `{ agenda_ocupada: txt }` que se inyecta directamente en la variable `[AGENDA_OCUPADA]` del System Prompt de Gemini (`Cerebro Inteligencia Artificial`).

### Fallas Estructurales Identificadas en el Código Actual:

1. **Parsing Ingenuo de Horas (Ignora Formato 12h AM/PM vs 24h):**
   - El código realiza un parseo mediante `time.split(':')` y `parseInt(parts[0], 10)`.
   - Si Supabase contiene `"04:00 pm"`, `parts[0]` es `"04"`, por lo que `parseInt` devuelve `4` (4:00 AM militar).
   - **Efecto:** Una cita agendada para las 4:00 PM (16:00) bloquea erróneamente la hora de las 4:00 AM (que de todas formas no existe en consulta) y **deja la hora 16:00 (4:00 PM) marcada como DISPONIBLE**, permitiendo sobre-agendamientos en la tarde.
   - De igual forma: `"05:00 pm"` se parsea a `5` en lugar de `17`; `"12:00 am"` se parsea a `12` en lugar de `0`.

2. **Paradigma Negativo (Entrega de Bloqueos en Lugar de Disponibilidad Positiva):**
   - El nodo genera líneas de texto prohibitivas como:
     `- 2026-07-27 ⛔ BLOQUEADO desde 12:00 pm en adelante (NO agendar en la tarde)`
     `- 2026-07-28 ⛔ OCUPADO de 09:00 a 10:00`
   - **Efecto:** Gemini debe realizar razonamiento matemático e inferencia lógica para determinar qué horas quedan libres. Al obligar al LLM a calcular complementos de conjuntos de horas, este alucina horas intermedias (`8:30 am`, `3:30 pm`) o ignora los bloqueos.

3. **Manejo Heredado de Fracciones de Hora (`:30` Legacy):**
   - El código actual contiene strings como `'BLOQUEADO de 12:00 pm a 3:30 pm (solo disponible antes de 12pm o después de 3:30pm)'`.
   - El System Prompt legacy también mencionaba citas a las 3:30 pm o 4:30 pm.
   - **Efecto:** Viola la regla estricta fijada en el Paso 1 de trabajar exclusivamente con **horas exactas en punto (`:00`)**.

4. **Error de Zona Horaria al Calcular `todayStr`:**
   - La instrucción `const now = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Caracas"}));` crea un objeto Date con valores de Caracas, pero luego ejecuta `.toISOString().split('T')[0]`.
   - Dado que `.toISOString()` convierte la fecha internamente a UTC (+4 horas respecto a Caracas), pasadas las 8:00 PM hora de Caracas el string `todayStr` cambia al día siguiente en UTC, descartando citas del día actual prematuramente.

---

## 2. Análisis Detallado de Reglas de Bloqueo de Clínicas y Horarios

### Reglas de Bloqueo por Clínicas Externas (Especificación Paso 2):
1. **Ambulatorio del Norte:** Martes y Jueves Mañana (08:00 am - 12:00 pm).
2. **Más Salud:** Lunes a Viernes Mañana (08:00 am - 12:00 pm).
3. **Prevaler:** Miércoles Tarde (12:00 pm - 04:00 pm / 12:00 - 16:00).
4. **Calicanto / Policlínica de Turmero:** Jueves Tarde (12:00 pm - 04:00 pm / 12:00 - 16:00).
5. **Viernes Tarde:** (04:00 pm - 06:00 pm / 16:00 - 18:00).
6. **Fines de Semana (Sábado y Domingo):** Bloqueados 100%.

### Ventanas Candidatas Estándar de Consulta Presencial/Online:
- **Turno Mañana (4 horas exactas):** `08:00`, `09:00`, `10:00`, `11:00`
- **Turno Tarde (2 horas exactas):** `16:00` (4:00 pm), `17:00` (5:00 pm)

### Matriz de Disponibilidad Base Teórica por Día de la Semana:
*(Antes de restar las citas individuales de Supabase)*

| Día de la Semana | Slots Candidatos Mañana | Slots Candidatos Tarde | Justificación de Bloqueos Fijos |
| :--- | :--- | :--- | :--- |
| **Lunes** | `08:00, 09:00, 10:00, 11:00` | Ninguno (`[]`) | Bloqueado tarde (Ambulatorio del Norte / Tarde presencial bloqueada) |
| **Martes** | `08:00, 09:00, 10:00, 11:00` | Ninguno (`[]`) | Bloqueado tarde (Más Salud Av. Aragua) |
| **Miércoles** | `08:00, 09:00, 10:00, 11:00` | `16:00, 17:00` | Prevaler bloquea 12:00-16:00. Tarde abre a las 16:00 |
| **Jueves** | `08:00, 09:00, 10:00, 11:00` | `16:00, 17:00` | Calicanto bloquea 12:00-16:00. Tarde abre a las 16:00 |
| **Viernes** | `08:00, 09:00, 10:00, 11:00` | Ninguno (`[]`) | Viernes tarde no laborable (16:00-18:00 bloqueado) |
| **Sábado** | Ninguno (`[]`) | Ninguno (`[]`) | Fin de semana (Bloqueado) |
| **Domingo** | Ninguno (`[]`) | Ninguno (`[]`) | Fin de semana (Bloqueado) |

*(Nota: En caso de que se aplique la variante estricta de Más Salud L-V Mañana o Ambulatorio Martes/Jueves Mañana, la matriz de slots se ajusta dinámicamente en el código JS restando dichos conjuntos).*

---

## 3. Análisis del Cálculo de Citas de Supabase

El procesamiento de registros provenientes de Supabase debe seguir la teoría de **Sustracción de Conjuntos**:

$$\text{Disponibilidad Real} = \text{Slots Candidatos Teóricos} \setminus \text{Slots Ocupados Supabase}$$

### Requisitos del Parser Numérico de Horas de Supabase:
1. **Detección de Modificadores AM/PM:**
   - Si la cadena contiene `pm` (o `PM`) y la hora numérica es menor a 12, sumar 12: `4:00 pm` $\rightarrow 4 + 12 = 16$.
   - Si la cadena contiene `am` (o `AM`) y la hora numérica es 12, convertir a 0: `12:00 am` $\rightarrow 0$.
   - Si la hora es `12:00 pm`, se mantiene como `12`.
   - Si la hora está en formato 24h (`16:00`), mantener `16`.
2. **Normalización a Formato `"HH:00"`:**
   - Convertir enteros `8, 9, 10, 11, 16, 17` a cadenas padded `"08:00"`, `"09:00"`, `"10:00"`, `"11:00"`, `"16:00"`, `"17:00"`.
3. **Manejo de Citas Legadas con Minutos (`:30`):**
   - Si un registro existente en Supabase indica `"04:30 pm"` o `"16:30"`, la hora base `16` queda ocupada, por lo que el slot `"16:00"` debe removerse de la disponibilidad para evitar solapamientos.
4. **Bloqueos Globales por Día:**
   - Si el campo `Hora_Cita` contiene palabras clave como `"todo el dia"`, `"toda la semana"`, `"bloqueado"`, `"vacaciones"`, se vacían todos los slots candidatos del día correspondiente.

---

## 4. Plan de Refactorización Estructurado del Código JavaScript

El nuevo código JS para el nodo `Formatear Agenda` sustituirá el texto de bloqueos por un **resumen positivo de disponibilidad explícita**.

### Algoritmo Propuesto (Paso a Paso):

```js
// 1. Obtener fecha actual en Caracas de forma limpia
const timezone = 'America/Caracas';
const now = new Date();
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }); // YYYY-MM-DD
const todayStr = dateFormatter.format(now);

// 2. Definir slots candidatos estándar (Horas en punto exactas)
const SLOTS_MANANA = ["08:00", "09:00", "10:00", "11:00"];
const SLOTS_TARDE = ["16:00", "17:00"];

// 3. Mapear ocupación enviada por Supabase
const ocupacionSupabase = {}; // { 'YYYY-MM-DD': Set(['08:00', ...]) }
const diasBloqueadosCompletos = new Set();

for (const item of $input.all()) {
    const date = item.json.Dia_Cita;
    const timeRaw = (item.json.Hora_Cita || '').trim();
    if (!date || date < todayStr) continue;

    const timeLower = timeRaw.toLowerCase();
    if (timeLower.includes('todo el dia') || timeLower.includes('toda la semana') || timeLower.includes('bloqueado')) {
        diasBloqueadosCompletos.add(date);
        continue;
    }

    // Normalizar hora a 24h
    const hora24Str = parseTimeToHH00(timeRaw);
    if (hora24Str) {
        if (!ocupacionSupabase[date]) ocupacionSupabase[date] = new Set();
        ocupacionSupabase[date].add(hora24Str);
    }
}

// Helper para parsear hora 12h/24h a HH:00
function parseTimeToHH00(raw) {
    if (!raw) return null;
    const str = raw.toLowerCase().trim();
    const isPM = str.includes('pm');
    const isAM = str.includes('am');
    const clean = str.replace(/(am|pm)/g, '').trim();
    const parts = clean.split(':');
    if (parts.length === 0) return null;
    let h = parseInt(parts[0], 10);
    if (isNaN(h)) return null;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h.toString().padStart(2, '0') + ':00';
}

// 4. Generar disponibilidad para los próximos 14 días
const reporteDisponibilidad = [];

for (let i = 0; i < 14; i++) {
    // Calcular fecha objetivo en Caracas
    const targetDateObj = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = dateFormatter.format(targetDateObj);
    
    // Obtener día de la semana (0 = Dom, 1 = Lun, ..., 6 = Sáb)
    const dayOfWeek = new Date(dateStr + 'T12:00:00-04:00').getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        reporteDisponibilidad.push(`- ${dateStr} (Fin de semana): NO LABORABLE`);
        continue;
    }

    if (diasBloqueadosCompletos.has(dateStr)) {
        reporteDisponibilidad.push(`- ${dateStr}: COMPLETAMENTE BLOQUEADO`);
        continue;
    }

    // Determinar candidatos base según día de la semana y reglas fijas
    let candManana = [...SLOTS_MANANA];
    let candTarde = [...SLOTS_TARDE];

    // Aplicar bloqueos fijos por clínicas
    if (dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 5) {
        // Lunes, Martes, Viernes: Tarde no disponible
        candTarde = [];
    }

    // Descontar citas ocupadas en Supabase
    const ocupadas = ocupacionSupabase[dateStr] || new Set();
    const dispManana = candManana.filter(h => !ocupadas.has(h));
    const dispTarde = candTarde.filter(h => !ocupadas.has(h));

    const mananaTxt = dispManana.length > 0 ? dispManana.join(', ') : 'Sin disponibilidad';
    const tardeTxt = dispTarde.length > 0 ? dispTarde.join(', ') : 'Sin disponibilidad';

    reporteDisponibilidad.push(`- ${dateStr}: MAÑANA: [${mananaTxt}] | TARDE: [${tardeTxt}]`);
}

return { agenda_disponible: reporteDisponibilidad.join('\n') };
```

---

## 5. Ventajas e Impacto del Nuevo Diseño

1. **Eliminación de Alucinaciones en Gemini:** Al entregarle a Gemini la lista exacta de horas libres (`[08:00, 10:00, 11:00]`), la IA solo necesita seleccionar dos de esas opciones. Ya no tiene que deducir si una hora está libre o no.
2. **Cumplimiento Estricto de Horas en Punto (`:00`):** El arreglo solo contiene horas enteras (`08:00`, `09:00`, `10:00`, `11:00`, `16:00`, `17:00`). Se elimina de raíz cualquier sugerencia de minutos o medias horas (`:30`).
3. **Robustez ante Supabase:** El parser 12h/24h previene el fallo crítico donde las 4:00 PM bloqueaban las 4:00 AM.
4. **Ahorro de Tokens:** El resumen positivo es directo y compacto, reduciendo el prompt de Gemini.

---

## 6. Plan de Verificación

Para validar la correcta ejecución del código refactorizado:
1. **Verificación de Parseo:** Probar entradas de Supabase en formatos `"04:00 pm"`, `"4:00 PM"`, `"16:00"`, `"08:00 am"`, `"12:00 pm"` y comprobar que se descuenten los slots correctos en 24h.
2. **Verificación de Días de la Semana:** Validar que Sábados y Domingos devuelvan "NO LABORABLE" y que Lunes, Martes y Viernes devuelvan "Sin disponibilidad" en la tarde.
3. **Verificación de Descuento de Supabase:** Insertar un registro simulado para un Miércoles a las `"16:00"` y verificar que la tarde de ese Miércoles solo reporte `[17:00]`.
