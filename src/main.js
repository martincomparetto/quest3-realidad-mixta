// Escena, renderer y sesión WebXR de realidad mixta (passthrough del Quest 3).
import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { Interacciones } from './interacciones.js';

const inicio = document.getElementById( 'inicio' );
const botonEntrar = document.getElementById( 'entrar' );
const mensaje = document.getElementById( 'mensaje' );
const capaXR = document.getElementById( 'capa-xr' );
const avisoXR = document.getElementById( 'aviso-xr' );

function mostrarMensaje( texto ) {

	mensaje.textContent = texto;
	mensaje.hidden = false;

}

// ---------- Renderer y escena ----------

// alpha: true => el fondo es transparente y se ve la habitación real.
const renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor( 0x000000, 0 );
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
document.body.appendChild( renderer.domElement );

const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 30 );

// Iluminación: luz ambiente del cielo/suelo + una luz direccional que da sombras.
escena.add( new THREE.HemisphereLight( 0xffffff, 0x8888aa, 2 ) );

const luz = new THREE.DirectionalLight( 0xffffff, 2 );
luz.position.set( 0.5, 2, 0.5 );
luz.castShadow = true;
luz.shadow.mapSize.set( 1024, 1024 );
luz.shadow.camera.left = - 1.5;
luz.shadow.camera.right = 1.5;
luz.shadow.camera.top = 1.5;
luz.shadow.camera.bottom = - 1.5;
luz.shadow.camera.near = 0.1;
luz.shadow.camera.far = 5;
luz.shadow.bias = - 0.0005;
escena.add( luz );
escena.add( luz.target );

// Plano invisible que solo muestra las sombras sobre la superficie real.
const planoSombra = new THREE.Mesh(
	new THREE.PlaneGeometry( 4, 4 ).rotateX( - Math.PI / 2 ),
	new THREE.ShadowMaterial( { opacity: 0.3 } )
);
planoSombra.receiveShadow = true;
planoSombra.visible = false;
escena.add( planoSombra );

// Cuando se coloca un objeto sobre una superficie horizontal,
// el plano de sombra y la luz se mueven allí.
function alColocar( posicion, normal ) {

	if ( normal.y < 0.9 ) return; // pared o superficie inclinada: no movemos el plano

	planoSombra.position.set( posicion.x, posicion.y + 0.001, posicion.z );
	planoSombra.visible = true;

	luz.target.position.copy( planoSombra.position );
	luz.position.copy( planoSombra.position ).add( new THREE.Vector3( 0.5, 2, 0.5 ) );

}

// ---------- Interacciones ----------

let temporizadorAviso = null;

function avisar( texto ) {

	avisoXR.textContent = texto;
	clearTimeout( temporizadorAviso );
	temporizadorAviso = setTimeout( () => { avisoXR.textContent = ''; }, 2000 );

}

const interacciones = new Interacciones( {
	renderer,
	escena,
	camara,
	alColocar,
	alBorrarTodo: () => {

		planoSombra.visible = false;
		avisar( 'Objetos borrados' );

	},
	alCambiarForma: ( nombre ) => avisar( 'Forma: ' + nombre )
} );

// Botón HTML "Salir" durante la sesión (solo se ve en el emulador de PC y en móviles).
document.getElementById( 'btn-salir' ).addEventListener( 'click', () => {

	const sesion = renderer.xr.getSession();
	if ( sesion ) sesion.end();

} );

// Evita que un toque sobre los botones HTML también coloque un objeto.
capaXR.addEventListener( 'beforexrselect', ( evento ) => evento.preventDefault() );

// ---------- Sesión WebXR ----------

// ARButton siempre usa el espacio 'local'. Si el visor ofrece 'local-floor'
// (altura real del suelo), lo usamos; si no, seguimos con 'local'.
const setSessionOriginal = renderer.xr.setSession;
renderer.xr.setSession = function ( sesion ) {

	if ( sesion && Array.isArray( sesion.enabledFeatures ) && sesion.enabledFeatures.includes( 'local-floor' ) ) {

		renderer.xr.setReferenceSpaceType( 'local-floor' );

	}

	// .call() es necesario: la función original usa "this" por dentro.
	return setSessionOriginal.call( renderer.xr, sesion );

};

renderer.xr.addEventListener( 'sessionstart', () => {

	inicio.hidden = true;
	interacciones.iniciar( renderer.xr.getSession() );

} );

renderer.xr.addEventListener( 'sessionend', () => {

	interacciones.terminar();
	inicio.hidden = false;

} );

// Todas las funciones son opcionales: si el visor no ofrece alguna, la sesión igual arranca.
const opcionesSesion = {
	optionalFeatures: [ 'local-floor', 'hit-test', 'hand-tracking', 'anchors', 'plane-detection', 'dom-overlay' ],
	domOverlay: { root: capaXR }
};

async function comprobarSoporte() {

	if ( ! window.isSecureContext ) {

		mostrarMensaje( 'Esta página necesita abrirse con https:// para usar la realidad mixta.' );
		return;

	}

	let soportado = false;
	try {

		soportado = !! navigator.xr && await navigator.xr.isSessionSupported( 'immersive-ar' );

	} catch ( error ) {

		console.warn( error );

	}

	if ( ! soportado ) {

		mostrarMensaje( 'Este navegador no admite realidad mixta (WebXR "immersive-ar"). ' +
			'Abre esta página desde el navegador del Meta Quest 3 (Meta Quest Browser). ' +
			'En la PC puedes probarla con Chrome y la extensión "Immersive Web Emulator".' );
		return;

	}

	// Usamos el ARButton de Three.js, pero oculto: nuestro botón en español lo acciona.
	const botonAR = ARButton.createButton( renderer, opcionesSesion );
	botonAR.hidden = true;
	document.body.appendChild( botonAR );

	botonEntrar.disabled = false;
	botonEntrar.addEventListener( 'click', () => {

		if ( typeof botonAR.onclick === 'function' ) {

			mensaje.hidden = true;
			botonAR.onclick();

		} else {

			mostrarMensaje( 'Preparando la realidad mixta… vuelve a intentarlo en un segundo.' );

		}

	} );

}

// Si el visor rechaza la sesión (por ejemplo, permisos denegados), avisamos en español.
window.addEventListener( 'unhandledrejection', ( evento ) => {

	console.error( evento.reason );
	if ( ! renderer.xr.isPresenting ) {

		mostrarMensaje( 'No se pudo iniciar la realidad mixta. Revisa los permisos del navegador e inténtalo de nuevo.' );

	}

} );

comprobarSoporte();

// ---------- Bucle de dibujo ----------

window.addEventListener( 'resize', () => {

	camara.aspect = window.innerWidth / window.innerHeight;
	camara.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );

} );

renderer.setAnimationLoop( ( tiempo, frame ) => {

	if ( renderer.xr.isPresenting ) interacciones.actualizar( frame );
	renderer.render( escena, camara );

} );
