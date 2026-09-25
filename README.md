# Quest 3 – Realidad Mixta

App de prueba de realidad mixta para **Meta Quest 3**, hecha como página web con WebXR y Three.js.
Ves tu habitación real (passthrough) y puedes colocar objetos virtuales sobre mesas, el suelo o las paredes,
tomarlos y moverlos con los controles o con las manos.

👉 **Abrir la app:** https://martincomparetto.github.io/quest3-realidad-mixta/

## Cómo probarla en el Quest 3

1. Ponte el visor y abre **Meta Quest Browser** (el navegador del Quest).
2. Entra en https://martincomparetto.github.io/quest3-realidad-mixta/
3. Pulsa **"Entrar en realidad mixta"** y acepta los permisos que pida el navegador.
4. Consejo: si tienes configurado el espacio de tu habitación (Configuración → Espacio físico), el anillo se ajusta mejor a las superficies.

## Controles

| Acción | Con controles | Con las manos |
| --- | --- | --- |
| Colocar un objeto en el anillo | Gatillo | Pellizcar (índice + pulgar) |
| Tomar y mover un objeto | Mantener el botón de agarre (grip) | Pellizcar cerca del objeto y mover la mano |
| Soltar | Soltar el agarre | Separar los dedos |
| Cambiar de forma | Botón **A** o **X**, o el panel flotante | Tocar "Cambiar forma" en el panel |
| Borrar todo | Botón **B** o **Y**, o el panel flotante | Tocar "Borrar todo" en el panel |

Cada objeto nuevo sale de otro color. El objeto semitransparente sobre el anillo muestra lo próximo que vas a colocar.
El panel flotante aparece frente a ti y te sigue si te alejas; puedes tocarlo con el dedo o apuntarlo y pulsar el gatillo.

## Cómo probarla en la PC

1. Instala en Chrome la extensión **Immersive Web Emulator** (de Meta).
2. Abre la página (la de GitHub Pages o tu servidor local), abre las herramientas de desarrollador (F12)
   y elige la pestaña **WebXR**; selecciona el dispositivo "Meta Quest 3".
3. Pulsa "Entrar en realidad mixta". En el emulador también aparecen botones en pantalla (Cambiar forma, Borrar todo, Salir).

### Servidor local

WebXR necesita `https://` o `localhost`. Desde la carpeta del proyecto:

```bash
npx serve .
```

y abre la dirección que muestra (por ejemplo http://localhost:3000).

## Cómo está hecha

Sin paso de compilación: son archivos HTML/JS que GitHub Pages sirve tal cual.
Three.js (versión 0.170.0) se carga desde jsDelivr con un `importmap`.

- `index.html` – página de inicio, importmap y botones
- `src/main.js` – escena, luces, sombras y sesión WebXR (`immersive-ar`)
- `src/interacciones.js` – hit-test (anillo), colocar, agarrar y mover
- `src/objetos.js` – formas y colores
- `src/panel.js` – panel flotante con botones 3D

Funciones de WebXR que se piden como **opcionales** (si el visor no tiene alguna, la app sigue funcionando):
`hit-test`, `local-floor`, `hand-tracking`, `anchors`, `plane-detection` y `dom-overlay`.

## Publicación (GitHub Pages)

En GitHub: **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
