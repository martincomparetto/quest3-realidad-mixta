# Quest 3 – Realidad Mixta (WebXR)

App de prueba de realidad mixta para Meta Quest 3, hecha como página web con WebXR y Three.js.
Se abre desde el navegador del Quest (Meta Quest Browser) y se publica en GitHub Pages.

## Objetivo
El usuario ve su habitación real (passthrough) y puede colocar objetos virtuales sobre superficies reales,
tomarlos y moverlos con los controles o con las manos.

## Restricciones técnicas
- **Sin paso de compilación.** Solo HTML/CSS/JS estático para que GitHub Pages lo sirva tal cual desde la raíz de `main`.
- Three.js cargado como módulo ES desde CDN (jsDelivr) con un `importmap`, con versión fija.
- Sesión WebXR `immersive-ar` (en Quest 3 esto activa el passthrough). Usar `ARButton` de los addons de Three.js.
- Fondo del renderer transparente (`alpha: true`) para que se vea el passthrough.
- Funcionalidades opcionales de la sesión: `hit-test`, `hand-tracking`, `local-floor`; opcionales también `anchors` y `plane-detection` si ayudan. La app no debe fallar si alguna no está disponible.
- Incluir un archivo `.nojekyll` en la raíz.
- Todo el texto visible para el usuario en **español**.

## Funcionalidades (primera versión)
1. Página de inicio con título, instrucciones breves y botón "Entrar en realidad mixta".
   Si el navegador no soporta `immersive-ar`, mostrar un mensaje claro que diga que se abra desde el navegador del Quest 3.
2. Retícula (anillo) que sigue las superficies reales usando hit-test.
3. Con el gatillo (controles) o el gesto de pellizco (manos), colocar un objeto en la retícula.
   Alternar entre algunas formas y colores (cubo, esfera, cono...) con materiales iluminados.
4. Tomar un objeto ya colocado con el botón de agarre (grip) o pellizcando cerca de él, moverlo y soltarlo.
5. Iluminación sencilla (hemisférica + direccional) y sombras suaves opcionales sobre un plano de sombra transparente.
6. Un botón o gesto para borrar todos los objetos.

## Estructura sugerida
- `index.html` – página, importmap y contenedor
- `src/main.js` – escena, renderer, sesión XR
- `src/interacciones.js` – hit-test, colocar, agarrar
- `src/objetos.js` – creación de formas
- `README.md` – qué es, cómo probarla en el Quest 3 y el enlace de GitHub Pages

## Cómo probar
- En el Quest 3: abrir `https://martincomparetto.github.io/quest3-realidad-mixta/` en Meta Quest Browser.
- En la PC: Chrome con la extensión "Immersive Web Emulator" de Meta para simular el visor.
- Servidor local para desarrollo: `npx serve .` (o cualquier servidor estático).

## Publicación
GitHub Pages: Settings → Pages → Deploy from a branch → `main` / `(root)`.
