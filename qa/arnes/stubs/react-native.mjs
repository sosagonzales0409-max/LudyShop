export const avisos = [];
export const Alert = { alert: (titulo, texto) => { avisos.push({ titulo, texto }); console.log(`   [Alert] ${titulo}: ${texto}`); } };
