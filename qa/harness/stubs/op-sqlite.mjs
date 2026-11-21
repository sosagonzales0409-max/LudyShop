import { DatabaseSync } from 'node:sqlite';
// Sustituto de op-sqlite sobre node:sqlite con la MISMA forma de API:
// execute → { rows, rowsAffected }; transaction(fn) → BEGIN/COMMIT/ROLLBACK
// y descarta lo que devuelva fn (igual que op-sqlite).
export const ruta = { bd: process.env.BD ?? 'prueba.db' };
export const open = () => {
  const db = new DatabaseSync(ruta.bd);
  const execute = async (sql, params = []) => {
    const st = db.prepare(sql);
    if (st.columns().length) return { rows: st.all(...params), rowsAffected: 0 };
    const r = st.run(...params);
    return { rows: [], rowsAffected: Number(r.changes) };
  };
  return {
    execute,
    crudo: db,
    transaction: async fn => {
      db.exec('BEGIN');
      try { await fn({ execute }); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
};
