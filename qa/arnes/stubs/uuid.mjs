import { randomUUID } from 'node:crypto';
// UUIDv7 simplificado: 48 bits de milisegundos + aleatorio (ordenable por tiempo)
let ultimo = 0, seq = 0;
export const v7 = () => {
  const ms = Date.now();
  seq = ms === ultimo ? seq + 1 : 0; ultimo = ms;
  const h = ms.toString(16).padStart(12, '0') + '7' + seq.toString(16).padStart(3, '0') + randomUUID().replace(/-/g, '').slice(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
