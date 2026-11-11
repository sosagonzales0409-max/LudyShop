// Copia el código REAL de la app (src/data, src/config/formato.js y
// src/context/StoreContext.js) a qa/arnes/app como módulos .mjs, compila el
// JSX de StoreContext y redirige lo nativo a sustitutos (qa/arnes/stubs):
//   react / react-native / PantallaCarga → sustitutos mínimos
//   @op-engineering/op-sqlite           → node:sqlite con la misma API
//   uuid                                 → UUIDv7 con node:crypto
// Así en Node corren las acciones, la cola de escritura y las consultas
// reales de la app. Se ejecuta solo desde los scripts de pruebas.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PROYECTO = resolve(AQUI, '..', '..');
const SRC = join(PROYECTO, 'src');
const APP = join(AQUI, 'app');
const require = createRequire(join(PROYECTO, 'package.json'));
const babel = require('@babel/core');

const STUBS = {
  'react': 'stubs/react.mjs',
  'react-native': 'stubs/react-native.mjs',
  'uuid': 'stubs/uuid.mjs',
  '@op-engineering/op-sqlite': 'stubs/op-sqlite.mjs',
  '@dr.pogodin/react-native-fs': 'stubs/react-native-fs.mjs',
  '../components/PantallaCarga': 'stubs/PantallaCarga.mjs',
  '../components/Toast': 'stubs/Toast.mjs',
};

export const construir = () => {
  rmSync(APP, { recursive: true, force: true });
  const archivos = [];
  const recorrer = dir => readdirSync(join(SRC, dir), { withFileTypes: true }).forEach(e => {
    if (e.isDirectory()) recorrer(`${dir}/${e.name}`);
    else if (e.name.endsWith('.js')) archivos.push(`${dir}/${e.name}`);
  });
  recorrer('data');
  archivos.push('config/formato.js', 'context/StoreContext.js');

  for (const rel of archivos) {
    let codigo = readFileSync(join(SRC, rel), 'utf8');
    if (rel.endsWith('StoreContext.js')) {
      codigo = babel.transformSync(codigo, {
        babelrc: false, configFile: false,
        plugins: [require.resolve('@babel/plugin-transform-react-jsx')],
      }).code;
    }
    const destino = join(APP, rel.replace(/\.js$/, '.mjs'));
    codigo = codigo.replace(/from\s+'([^']+)'/g, (m, ruta) => {
      if (STUBS[ruta]) {
        let r = relative(dirname(destino), join(AQUI, STUBS[ruta])).replace(/\\/g, '/');
        if (!r.startsWith('.')) r = `./${r}`;
        return `from '${r}'`;
      }
      if (ruta.startsWith('.')) return `from '${ruta}.mjs'`;
      throw new Error(`${rel}: import sin sustituto: ${ruta}`);
    });
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, codigo);
  }
  return archivos.length;
};

// Tienda "montada" sin React: StoreProvider real con setState síncrono.
// `bd` = ruta del archivo SQLite a usar (se crea si no existe).
export const montarTienda = async ({ bd, dev = false, sembrar = false }) => {
  globalThis.__DEV__ = dev;
  process.env.BD = bd;
  const { ruta } = await import('./stubs/op-sqlite.mjs');
  ruta.bd = bd;
  const { StoreProvider } = await import('./app/context/StoreContext.mjs');
  const db = await import('./app/data/db.mjs');
  const store = new StoreProvider({});
  store.setState = (upd, cb) => {
    const parcial = typeof upd === 'function' ? upd(store.state) : upd;
    store.state = { ...store.state, ...parcial };
    cb?.();
  };
  await store.arrancar();
  if (store.state.errorCarga) throw new Error(`arranque: ${store.state.errorCarga}`);
  // sembrar: siembra el año de datos aunque SEED_AUTOMATICO esté en false
  // (el arnés no debe depender de cómo dejaste la app para probar a mano).
  if (sembrar && !store.state.products.length) {
    const { sembrarAutomatico } = await import('./app/data/seed.mjs');
    await db.persistir(sembrarAutomatico, 'semilla');
    await store.recargarDesdeBD();
  }
  return { store, esperarEscrituras: db.esperarEscrituras, crudo: db.getDB().crudo };
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`construido: ${construir()} archivos en qa/arnes/app`);
}
