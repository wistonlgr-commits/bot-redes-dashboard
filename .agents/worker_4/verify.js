const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../flujo asistente de whatsapp.json');
console.log('Reading file:', filePath);

try {
  const content = fs.readFileSync(filePath, 'utf8');
  const wf = JSON.parse(content);
  console.log('SUCCESS: File is 100% valid JSON.');

  // Validate n8n graph structure
  if (!Array.isArray(wf.nodes)) {
    throw new Error('Missing nodes array');
  }
  if (typeof wf.connections !== 'object') {
    throw new Error('Missing connections object');
  }

  console.log(`Total nodes: ${wf.nodes.length}`);
  const nodeNames = wf.nodes.map(n => n.name);
  console.log('Node names:', nodeNames);

  // Check required nodes for Paso 4
  const fmtNode = wf.nodes.find(n => n.name === 'Formatear Respuesta');
  if (!fmtNode) throw new Error('Formatear Respuesta node missing');
  
  const ifNode = wf.nodes.find(n => n.name === '¿Existe Incidencia de Calidad?');
  if (!ifNode) throw new Error('¿Existe Incidencia de Calidad? node missing');

  const supaNode = wf.nodes.find(n => n.name === 'Registrar Incidencia (Supabase)');
  if (!supaNode) throw new Error('Registrar Incidencia (Supabase) node missing');

  // Verify JS code in Formatear Respuesta
  const jsCode = fmtNode.parameters.jsCode;
  const requiredProps = ['has_quality_incident', 'tipo_incidencia', 'respuesta_raw', 'entrada_paciente', 'metadata_log'];
  for (const prop of requiredProps) {
    if (!jsCode.includes(prop)) {
      throw new Error(`Formatear Respuesta JS code missing telemetry property: ${prop}`);
    }
  }
  console.log('SUCCESS: Formatear Respuesta contains all 5 required quality telemetry properties.');

  // Verify IF node configuration
  if (ifNode.type !== 'n8n-nodes-base.if') throw new Error('¿Existe Incidencia de Calidad? is not an IF node');
  const ifConds = JSON.stringify(ifNode.parameters.conditions);
  if (!ifConds.includes('has_quality_incident')) {
    throw new Error('¿Existe Incidencia de Calidad? IF condition does not check $json.has_quality_incident');
  }
  console.log('SUCCESS: ¿Existe Incidencia de Calidad? correctly checks $json.has_quality_incident.');

  // Verify Supabase node configuration
  if (supaNode.type !== 'n8n-nodes-base.supabase') throw new Error('Registrar Incidencia (Supabase) is not a Supabase node');
  if (supaNode.parameters.tableId !== 'bot_quality_logs') throw new Error('Table ID is not bot_quality_logs');
  if (supaNode.credentials.supabaseApi.id !== 'gidwrNK4lcuu0fQR') throw new Error('Credentials ID is not gidwrNK4lcuu0fQR');
  if (supaNode.onError !== 'continueRegularOutput') throw new Error('onError is not continueRegularOutput');
  console.log('SUCCESS: Registrar Incidencia (Supabase) is correctly configured.');

  // Verify connections
  const fmtConns = wf.connections['Formatear Respuesta'];
  if (!fmtConns || !fmtConns.main || !fmtConns.main[0]) throw new Error('Missing Formatear Respuesta connections');
  const fmtTargets = fmtConns.main[0].map(c => c.node);
  if (!fmtTargets.includes('¿Existe Incidencia de Calidad?')) throw new Error('Formatear Respuesta is not connected to ¿Existe Incidencia de Calidad?');
  
  const ifConns = wf.connections['¿Existe Incidencia de Calidad?'];
  if (!ifConns || !ifConns.main || !ifConns.main[0]) throw new Error('Missing ¿Existe Incidencia de Calidad? connections');
  const ifTargets = ifConns.main[0].map(c => c.node);
  if (!ifTargets.includes('Registrar Incidencia (Supabase)')) throw new Error('¿Existe Incidencia de Calidad? is not connected to Registrar Incidencia (Supabase)');

  console.log('SUCCESS: n8n workflow graph connections are 100% valid and correctly wired.');
  console.log('PASO 4 VERIFICATION PASSED PERFECTLY!');
} catch (err) {
  console.error('VERIFICATION ERROR:', err.message);
  process.exit(1);
}
