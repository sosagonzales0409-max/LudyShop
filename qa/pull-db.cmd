@echo off
REM ─── Extrae la base de datos del teléfono y genera la hoja de valores esperados ───
REM Uso: doble clic, o desde la terminal:  qa\pull-db.cmd
REM Requisitos: teléfono conectado por USB con depuración activada, app de
REM desarrollo instalada (run-as solo funciona con builds debug) y Node 22+.
REM Se usa cmd y no PowerShell a propósito: la redirección ">" de PowerShell 5.1
REM convierte la salida a texto y CORROMPE un archivo binario como la BD.
setlocal
cd /d "%~dp0"
if not exist data mkdir data

echo Cerrando la app para que no escriba mientras se copia...
adb shell am force-stop com.ludyshop.app

del /q data\mitienda.db data\mitienda.db-wal data\mitienda.db-shm 2>nul
echo Copiando databases/mitienda.db ...
adb exec-out run-as com.ludyshop.app cat databases/mitienda.db > data\mitienda.db
REM El WAL guarda las ultimas escrituras que aun no pasan al archivo principal:
REM hay que copiarlo tambien (si no existe, queda vacio y SQLite lo ignora).
adb exec-out run-as com.ludyshop.app sh -c "test -f databases/mitienda.db-wal && cat databases/mitienda.db-wal" > data\mitienda.db-wal

for %%A in (data\mitienda.db) do if %%~zA LSS 4096 (
  echo.
  echo ERROR: la copia esta vacia o incompleta. Revisa "adb devices" y que la app sea la de desarrollo.
  exit /b 1
)

echo.
echo Generando la hoja de valores esperados...
node expected-values.mjs data\mitienda.db data\VALORES_ESPERADOS.md || exit /b 1
echo.
echo Cruzando la hoja con las consultas de la app...
node harness\check-oracle.mjs data\mitienda.db data\VALORES_ESPERADOS.md || exit /b 1
echo.
echo Listo: abre qa\data\VALORES_ESPERADOS.md y compara con el telefono (vuelve a abrir la app).
endlocal
