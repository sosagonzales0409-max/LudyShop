# Publicar en Play Store — LudyShop (V1)

Guía paso a paso para subir la app por primera vez. Está en orden: cada fase depende de la anterior.

> **Estado (23 oct 2026):** Fases 1–7 hechas. `.aab` (versionCode 1) subido a pruebas internas y cerradas, **en revisión de Google**. Sigue: Fase 8.2 (12+ testers, 14 días) y Fase 9.

> Las reglas de Google cambian (número de testers, API mínima, formularios). Si algo de esta guía no coincide con lo que ves en Play Console, **manda lo que diga la consola**.

| Fase | Qué | Dónde | Tiempo |
|---|---|---|---|
| [1](#fase-1--decisiones-que-no-se-pueden-cambiar-después) | Decisiones permanentes (id de la app, nombre) | Tú | 15 min |
| [2](#fase-2--llave-de-subida-firma) | Crear la llave de subida (firma) | PC | 15 min |
| [3](#fase-3--configurar-gradle-para-firmar) | Configurar Gradle para firmar | Código | 15 min |
| [4](#fase-4--generar-y-probar-el-build-de-publicación) | Generar el `.aab` y probar el build release | PC + teléfono | 30 min |
| [5](#fase-5--cuenta-de-desarrollador) | Cuenta de desarrollador de Google Play | Navegador | 1–3 días (verificación) |
| [6](#fase-6--material-de-la-ficha) | Material de la ficha (textos, ícono, capturas, política de privacidad) | Tú | 1–2 h |
| [7](#fase-7--crear-la-app-en-play-console) | Crear la app y llenar "Contenido de la app" | Play Console | 1 h |
| [8](#fase-8--pruebas-internas-y-cerradas) | Prueba interna y prueba cerrada (12 testers, 14 días) | Play Console | 2+ semanas |
| [9](#fase-9--producción) | Pedir acceso a producción y publicar | Play Console | ~1 semana |
| [10](#fase-10--actualizaciones-futuras) | Cómo subir actualizaciones | — | — |

---

## Fase 1 — Decisiones que no se pueden cambiar después

### 1.1 `applicationId` (el id de la app en la tienda)
✅ **Decidido (14 oct 2026): `com.ludyshop.app`** (`android/app/build.gradle`, línea `applicationId`). Antes era `com.mitienda`. **Una vez publicada, Google no deja cambiarlo nunca**: es la "dirección" de la app en la tienda y en el teléfono.

- Solo cambió `applicationId`. El `namespace "com.mitienda"` y la carpeta `java/com/mitienda/` se quedan así: son el paquete interno del código Kotlin (`MainActivity`) y no se ven en la tienda.
- QA_FINAL.md y `qa/extraer-bd.cmd` ya usan el id nuevo (`adb shell pm clear com.ludyshop.app`).
- **Efecto en tu teléfono:** Android trata el id nuevo como otra app. La versión vieja (`com.mitienda`) se queda instalada con sus datos. Para pasarlos: en la vieja **Exportar información**, en la nueva **Importar información**, y luego desinstala la vieja.

### 1.2 Nombre visible
El teléfono muestra **LudyShop** (`android/app/src/main/res/values/strings.xml`), pero dentro de la app la tienda se llama "Mi Tienda" por defecto y el respaldo se guarda como `MiTienda-respaldo-….db`. No es un error (el nombre de la tienda lo personaliza cada usuario), pero decide si quieres unificarlo.
- Busca "LudyShop" en Play Store para ver que no exista otra app con ese nombre. El nombre de la ficha sí se puede cambiar después.

### 1.3 Versión
En `build.gradle`: `versionCode 1` (número interno, **sube en cada subida**: 1, 2, 3…) y `versionName "1.0"` (lo que ve el usuario). Para la primera publicación así está bien.

---

## Fase 2 — Llave de subida (firma)

**Por qué:** Android solo instala actualizaciones firmadas con la misma llave que la versión anterior. Así nadie más puede publicar una "actualización" de tu app. Hoy el build release se firma con `debug.keystore`, una llave pública que trae cualquier proyecto de React Native, y Play Store la rechaza.

**Cómo funciona con Play App Signing (obligatorio en apps nuevas):**
- Tú firmas el `.aab` con tu **llave de subida (upload key)**.
- Google verifica que lo subiste tú, le quita esa firma y lo vuelve a firmar con la **llave de la app**, que guarda Google.
- Si pierdes la llave de subida, Google te la puede cambiar (con un trámite de soporte). Aun así, **no la pierdas**.

### 2.1 Abrir PowerShell en la carpeta correcta
```powershell
cd S:\PROYECTOS\Tienda\mitienda\android\app
```
`keytool` viene con el JDK que ya usas para compilar (Temurin 17, en `JAVA_HOME`). No hay que instalar nada.

### 2.2 Crear la llave
```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore ludyshop-upload.keystore -alias ludyshop-upload -keyalg RSA -keysize 2048 -validity 10000
```

| Parte | Qué significa |
|---|---|
| `-keystore ludyshop-upload.keystore` | El archivo que se crea (el "llavero") |
| `-alias ludyshop-upload` | Nombre de la llave dentro del archivo (un archivo puede guardar varias) |
| `-keyalg RSA -keysize 2048` | Tipo de llave que exige Google |
| `-validity 10000` | Vigencia en días (~27 años). Google pide que dure más allá de 2033. Para más margen: `18250` (~50 años) |

### 2.3 Responder las preguntas
- **Contraseña del almacén:** invéntala y anótala; se pide dos veces. **Evita `\` y `#`**, que dan problemas en el archivo de la Fase 3.
- **Nombre y apellido, unidad, organización, ciudad, estado, código de país (2 letras, p. ej. `MX`):** tus datos. No se muestran en la tienda.
- Al final: "¿Es correcto?" → `sí` (o `yes`, según el idioma del mensaje).
- PKCS12 **no** pide una segunda contraseña para la llave: la llave usa la misma que el almacén.

### 2.4 Comprobar
```powershell
keytool -list -v -keystore ludyshop-upload.keystore
```
Te pide la contraseña y muestra "Alias: ludyshop-upload" con tus datos.

### 2.5 Respaldar (ya mismo)
- Se creó `android/app/ludyshop-upload.keystore`. El `.gitignore` ya ignora `*.keystore` (excepto `debug.keystore`), así que **no se sube a GitHub**, y debe ser así: quien tenga el archivo y la contraseña puede firmar como tú. `git status` no debe mostrarlo.
- Copia el `.keystore` **y** la contraseña a un lugar seguro fuera de la PC: gestor de contraseñas, USB o Drive privado.

### 2.6 ¿Y cuando se cumplan los ~27 años?
Casi nada:
- **Android no revisa la fecha de vencimiento al instalar.** Solo comprueba que la firma sea válida y sea la misma llave de antes. Una firma "vencida" se sigue instalando y actualizando.
- **La que vence es tu llave de subida, no la de la app.** Lo que se instala en los teléfonos lo firma la llave de la app, que guarda Google. La tuya solo prueba que el archivo lo subiste tú.
- Si algún día Google la rechazara por vencida: generas una nueva con el mismo comando y en Play Console vas a *Configuración → Integridad de la app → Firma de apps → Solicitar restablecimiento de la llave de subida*. Es el mismo trámite que si la perdieras, y los usuarios no notan nada.
- El riesgo real no es el vencimiento: es **perder el archivo o la contraseña**, o que alguien más los obtenga. Por eso importa el respaldo de 2.5.

---

## Fase 3 — Configurar Gradle para firmar

**Idea:** Gradle es el programa que compila la app de Android. Hay que decirle qué llave usar en el build de publicación. **Las contraseñas no se escriben en archivos que estén en git** (ni `build.gradle` ni `android/gradle.properties`): van en un archivo aparte, `keystore.properties`, que git ignora, y `build.gradle` lo lee al compilar.

### 3.1 Archivo de contraseñas: `android/app/keystore.properties`
Va junto a la llave y está **ignorado por git** (`.gitignore`), igual que el `.keystore`. **No** se usa `android/gradle.properties` porque ese archivo sí está en git.

En VS Code: clic derecho en `android/app` → New File → `keystore.properties`. Contenido (con tu contraseña real en las dos últimas líneas):
```properties
storeFile=ludyshop-upload.keystore
keyAlias=ludyshop-upload
storePassword=tu-contraseña
keyPassword=tu-contraseña
```
- Sin espacios ni comillas alrededor del `=`.
- Evita ñ, acentos, `\` y `#` en la contraseña: los `.properties` se leen con una codificación antigua y darían "contraseña incorrecta".
- `storeFile` es relativo a `android/app/`, por eso basta con el nombre.
- Si cambias de PC, copia `ludyshop-upload.keystore` **y** `keystore.properties` desde tu respaldo a `android/app/`.

### 3.2 `android/app/build.gradle` ✅ hecho
Antes de `android {`, lee el archivo si existe:
```groovy
def keystorePropsFile = file("keystore.properties")
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) {
    keystorePropsFile.withInputStream { keystoreProps.load(it) }
}
```
Y los bloques `signingConfigs` y `buildTypes` quedan así:
```groovy
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (keystorePropsFile.exists()) {
                storeFile file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
            minifyEnabled enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
```
- **El `if`:** en una PC sin el archivo de contraseñas (otra computadora, el repo clonado en otro lado), el build de desarrollo sigue funcionando en vez de fallar.
- **El cambio clave** está en `buildTypes → release`: de `signingConfigs.debug` a `signingConfigs.release`.
- `minifyEnabled` (ProGuard/R8) puede quedar en `false` en la V1. Achica la app, pero puede romper librerías nativas si no se configura bien. Es una optimización para después.

### 3.3 Generar el `.aab` firmado
```powershell
cd S:\PROYECTOS\Tienda\mitienda\android
.\gradlew bundleRelease
```
Queda en `android\app\build\outputs\bundle\release\app-release.aab`.

### 3.4 Comprobar que se firmó con tu llave
```powershell
keytool -printcert -jarfile app\build\outputs\bundle\release\app-release.aab
```
En "Propietario" (u "Owner") deben salir **tus datos** de la Fase 2. Si dice `CN=Android Debug`, Gradle no encontró `android/app/keystore.properties`: revisa el nombre (que no sea `.txt`) y la ubicación.

### 3.5 Revisar y guardar en git
- `git status` **no** debe mostrar `keystore.properties` ni `ludyshop-upload.keystore`.
- `git diff android/app/build.gradle` → solo la lectura de `keystore.properties`, el bloque `release` de `signingConfigs`, el cambio de `signingConfig` y el `applicationId` de la Fase 1. Ninguna contraseña.

---

## Fase 4 — Generar y probar el build de publicación

### 4.1 Probar el build release en tu teléfono (antes de subir nada)
El build release es distinto del de desarrollo: el JavaScript va empaquetado dentro de la app (sin Metro), `__DEV__` es `false` y no hay semilla automática ni tarjeta "Desarrollo".

> ✅ Probado el 14 oct 2026 con el id viejo y la llave de pruebas. Después de las Fases 2–3 (id nuevo y tu llave) conviene repetir una pasada rápida: se instala como **otra app** junto a la vieja.

```powershell
cd S:\PROYECTOS\Tienda\mitienda
npx react-native run-android --mode release
```

Comprueba:
- [ ] Abre **sin Metro** (cierra la terminal de Metro antes) y arranca **vacía** (sin datos de ejemplo).
- [ ] En Configuración **no** aparece la tarjeta "DESARROLLO".
- [ ] Una venta, un crédito, una compra y Exportar/Importar funcionan.
- [ ] Cierra la app a la fuerza, reábrela: los datos siguen ahí.

### 4.2 Generar el `.aab`
Play Store ya no acepta `.apk` en apps nuevas. Pide **Android App Bundle (`.aab`)**: Google arma a partir de él un APK a la medida de cada teléfono (más chico). Un `.apk` release sirve para probar, pero no se sube.

Se genera y se verifica como en [3.3](#33-generar-el-aab-firmado) y [3.4](#34-comprobar-que-se-firmó-con-tu-llave). Resultado: `android/app/build/outputs/bundle/release/app-release.aab`. Ese es el archivo que se sube.

### 4.3 Requisitos técnicos que ya cumples (verificar al subir)
- **API objetivo:** `targetSdkVersion 36` (Android 16). Google exige una API reciente y la sube cada año. Play Console avisa si queda corta.
- **Páginas de memoria de 16 KB:** Google exige que las librerías nativas (`.so`) funcionen en teléfonos con páginas de 16 KB. React Native 0.83 lo cumple. Si Play Console marca alguna librería (op-sqlite, por ejemplo), actualízala. En Android Studio: *Build → Analyze APK* muestra un aviso de alineación por librería.

---

## Fase 5 — Cuenta de desarrollador

1. Entra a <https://play.google.com/console/signup> con la cuenta de Google que será dueña de la app. Conviene una dedicada, no la del trabajo.
2. Tipo de cuenta:
   - **Personal:** lo normal para una persona. Exige la **prueba cerrada** de la Fase 8 antes de producción.
   - **Organización:** solo si tienes empresa registrada (pide número D-U-N-S, gratuito pero tarda días).
3. Pago único de **25 USD** con tarjeta.
4. Verificación de identidad (INE o pasaporte) y de un teléfono. Puede tardar de horas a días.
5. Tu nombre y país quedarán públicos en la ficha como desarrollador. Con una cuenta personal, Google puede pedir también una dirección. Revisa qué se muestra.

---

## Fase 6 — Material de la ficha

| Material | Requisito | Nota |
|---|---|---|
| Nombre | Máx. 30 caracteres | "LudyShop: ventas y fiado" o similar |
| Descripción breve | Máx. 80 caracteres | Ej. "Ventas, inventario y fiado de tu tienda, sin internet." |
| Descripción completa | Máx. 4000 caracteres | Qué hace: ventas, crédito/fiado y abonos, inventario y stock bajo, granel, compras, corte del día, reportes, respaldo. Recalca **sin internet y sin cuentas** |
| Ícono | PNG 512×512, máx. 1 MB | El mismo diseño del ícono nuevo de la app, en alta resolución |
| Gráfico de funciones | PNG/JPG 1024×500 | Banner superior de la ficha |
| Capturas de teléfono | Mín. 2 (recomendado 4–8), 9:16 | Tómalas en el build release **con datos de ejemplo bonitos**: Ventas con carrito, Créditos, Inventario, Reportes, Corte |
| Política de privacidad | URL pública | Ver abajo |
| Correo de contacto | Obligatorio y público | Usa uno que revises |

**Capturas con datos:** el build release arranca vacío. Opciones: cárgale datos a mano, o exporta una copia desde el build de desarrollo (con la semilla) e **impórtala** en el release. Para eso sirve el respaldo.

**Política de privacidad:** Play Console la pide en todas las apps. La tuya es sencilla porque **no recolectas nada**. Puede decir:
- Los datos (productos, ventas, clientes y deudas) se guardan **solo en el teléfono**.
- La app no los envía a ningún servidor, no tiene cuentas, publicidad ni analítica.
- Los respaldos los exporta el usuario y él decide dónde guardarlos o con quién compartirlos.
- Desinstalar la app borra los datos.
- Correo de contacto.

Publícala en una URL pública gratuita: Google Sites, GitHub Pages (por ejemplo, un `privacidad.md` en un repo público) o Notion público. Tiene que ser accesible sin iniciar sesión.

---

## Fase 7 — Crear la app en Play Console

1. **Crear app** → nombre, idioma predeterminado **Español (Latinoamérica) – es-419**, tipo **App**, **Gratis**. "Gratis" no se puede cambiar a "de pago" después, pero sí se pueden agregar suscripciones (la versión Pro del roadmap).
2. **Panel → "Configura tu app"**. Google te lleva por cada formulario de *Contenido de la app*:

| Formulario | Qué responder (para esta app) |
|---|---|
| Política de privacidad | La URL de la Fase 6 |
| Acceso a la app | "Toda la funcionalidad está disponible sin restricciones" (no hay inicio de sesión) |
| Anuncios | No contiene anuncios |
| Clasificación del contenido | Cuestionario IARC: categoría "Utilidad/Productividad"; todo "No" (sin violencia, apuestas, chat, etc.) |
| Público objetivo | 18 años o más (es una herramienta de negocio; evita las reglas extra para niños) |
| Seguridad de los datos | **No se recolectan ni comparten datos.** "Recolectar" significa enviar fuera del teléfono; lo que solo se guarda localmente no cuenta |
| App de gobierno | No |
| Funciones financieras | La app **no** ofrece préstamos ni servicios financieros: solo registra ventas a crédito del propio negocio. Elige la opción de que no ofrece funciones financieras. Si el formulario duda, describe "registro de cuentas por cobrar de una tienda" |
| Salud | No |

3. **Ficha de Play Store principal**: textos, ícono, gráfico y capturas de la Fase 6. Categoría **Empresa** (o Productividad).

**Sobre el permiso `INTERNET`:** está en el `AndroidManifest.xml` porque la plantilla de React Native lo trae (Metro lo necesita en desarrollo). No obliga a declarar nada en "Seguridad de los datos": lo que cuenta es lo que la app **hace**, y la app no envía nada. Quitarlo del build release es opcional.

---

## Fase 8 — Pruebas internas y cerradas

**Por qué:** desde 2023, Google exige a las **cuentas personales nuevas** probar con personas reales antes de publicar, para frenar apps abandonadas o de baja calidad.

### 8.1 Prueba interna (opcional, inmediata)
*Probar → Pruebas internas → Crear versión* → sube el `app-release.aab`. Agrega tu correo como tester, abre el enlace de inscripción en el teléfono e instala **desde Play Store**. Así confirmas que la firma y la subida funcionan y que la app instalada desde la tienda arranca bien. No pasa revisión de Google (o es mínima).

### 8.2 Prueba cerrada (obligatoria con cuenta personal)
1. *Probar → Pruebas cerradas → Crear pista* → sube el mismo `.aab` (o uno nuevo con `versionCode` mayor).
2. Testers: una lista de correos de Gmail o un Grupo de Google. Requisito actual: **al menos 12 testers inscritos durante 14 días seguidos**. Revisa el número exacto en la consola.
3. Comparte el enlace de inscripción. Cada tester acepta y **la instala desde Play Store**. Conviene que la usen de verdad (familia, amigos, tenderos conocidos).
4. Esta versión **sí** pasa revisión de Google (horas a pocos días).
5. Si te reportan errores: corrige, sube `versionCode` y sube otra versión a la misma pista. Los 14 días no se reinician.

---

## Fase 9 — Producción

1. Cumplidos los 14 días, en el Panel aparece **"Solicitar acceso a producción"**. Contesta el cuestionario: cómo reclutaste testers, qué comentarios recibiste, qué cambiaste. Responde con detalle: aquí es donde más rechazan.
2. Google responde en ~7 días.
3. *Producción → Crear versión* → elige el `.aab` (puedes promover el de la prueba cerrada) → notas de la versión → **Revisar** → **Iniciar lanzamiento**.
4. **Lanzamiento escalonado** (recomendado): empieza con un % de usuarios (p. ej. 20 %) y súbelo al ver que no hay errores en *Calidad → Android vitals*.
5. Revisión de producción: de horas a ~7 días la primera vez.

---

## Fase 10 — Actualizaciones futuras

Cada vez que publiques un cambio:
1. Sube `versionCode` (+1) y, si quieres, `versionName` ("1.0.1", "1.1"…).
2. **Si cambiaste el esquema de la BD:** escribe una **migración nueva** en `src/data/migrations.js`. Una vez publicada la app, **ya no se puede editar la migración 1** ni pedir `pm clear`: los usuarios tienen datos reales.
3. `.\gradlew bundleRelease` → sube a prueba interna o cerrada → promueve a producción.
4. Firma siempre con la **misma llave de subida**.

---

## Pendientes técnicos recomendados (no bloquean la publicación)
- **T1 — Barra verde fija de 50 px:** en teléfonos con barra de estado o "notch" de otro tamaño, el encabezado puede quedar más alto o más bajo. Antes de las capturas, conviene probar en un emulador distinto (p. ej. Pixel con recorte de cámara) o resolverlo con `react-native-safe-area-context` (ya instalado).
- **`npm test`:** la prueba de la plantilla (`__tests__/App.test.tsx`) falla porque no simula op-sqlite. Las pruebas reales están en `qa/arnes`. Arreglarla o borrarla.
