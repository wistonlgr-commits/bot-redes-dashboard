const payload = {
    Nombre: "Test Patient",
    Telefono: "0412-1234567",
    Ciudad: "Lima",
    Temperatura: "frio",
    Dia_Cita: "",
    Hora_Cita: "",
    Motivo_Consulta: "",
    Notas: "",
    Conversacion_Abierta: false
};

fetch("http://th8yc3molrrp9k4clquhxb9m.167.86.70.193.sslip.io/api/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
}).then(r => r.text()).then(console.log).catch(console.error);
