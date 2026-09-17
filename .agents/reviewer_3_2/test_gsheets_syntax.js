const $json = { resumen: "Paciente con varices" };
try {
  const res = eval('{\n  $json.resumen\n}');
  console.log("Result:", res);
} catch(e) {
  console.log("Syntax error when evaluating '=\\t{{ $json.resumen }}':", e.message);
}
