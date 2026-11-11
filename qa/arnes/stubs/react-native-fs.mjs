// Sustituto de @dr.pogodin/react-native-fs para el arnés (Node).
// Solo lo que usa src/data/respaldo.js, con node:fs sobre una carpeta
// temporal: así respaldo.js se puede cargar (y, si una prueba lo usa,
// exportar/importar copias) sin el módulo nativo.
import { mkdirSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = join(tmpdir(), 'mitienda-arnes');
export const DocumentDirectoryPath = join(BASE, 'documentos');
export const CachesDirectoryPath = join(BASE, 'cache');
mkdirSync(DocumentDirectoryPath, { recursive: true });
mkdirSync(CachesDirectoryPath, { recursive: true });

// Misma forma que StatResult / ReadDirItem de la librería.
const describir = (ruta, s, name) => ({
  name,
  path: ruta,
  size: s.size,
  mtime: s.mtime,
  ctime: s.ctime,
  isFile: () => s.isFile(),
  isDirectory: () => s.isDirectory(),
});

export const exists = ruta => fs.access(ruta).then(() => true, () => false);
export const unlink = ruta => fs.rm(ruta, { recursive: true, force: true });
export const moveFile = (de, a) => fs.rename(de, a);
export const copyFile = (de, a) => fs.copyFile(de, a);
export const stat = async ruta => describir(ruta, await fs.stat(ruta), ruta.split(/[\\/]/).pop());
export const readDir = async dir => Promise.all(
  (await fs.readdir(dir)).map(async name => {
    const ruta = join(dir, name);
    return describir(ruta, await fs.stat(ruta), name);
  }),
);
