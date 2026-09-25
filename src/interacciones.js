// Hit-test (retícula), colocar objetos, agarrarlos y moverlos,
// con controles o con las manos.
import * as THREE from 'three';
import { FORMAS, COLORES, crearObjeto, crearFantasma, resaltar, liberarObjeto } from './objetos.js';

const DISTANCIA_SIN_SUPERFICIE = 0.4; // si no hay hit-test, se coloca a 40 cm del control
const MARGEN_AGARRE = 0.06; // qué tan cerca hay que estar para agarrar un objeto
const ALCANCE_RAYO = 5;

// Botones estándar de los controles del Quest (mapeo "xr-standard").
const BOTON_A_X = 4;
const BOTON_B_Y = 5;

// Gesto con las manos: juntar el pulgar con el dedo MEDIO.
// Toque rápido = cambiar forma. Mantener = borrar todo.
const DISTANCIA_JUNTOS = 0.015; // 1,5 cm: dedos juntos
const DISTANCIA_SEPARADOS = 0.03; // 3 cm: dedos separados otra vez
const TIEMPO_BORRAR = 1500; // milisegundos que hay que mantener el gesto para borrar

// Cambiar el tamaño de un objeto.
const ESCALA_MINIMA = 0.25;
const ESCALA_MAXIMA = 6;
const VELOCIDAD_JOYSTICK = 1.2; // cuánto crece por segundo con el joystick a fondo
const EJE_JOYSTICK_Y = 3; // eje vertical del joystick (mapeo "xr-standard")

function crearReticula() {

	const reticula = new THREE.Mesh(
		new THREE.RingGeometry( 0.05, 0.065, 40 ).rotateX( - Math.PI / 2 ),
		new THREE.MeshBasicMaterial( { color: 0xffffff, transparent: true, opacity: 0.9 } )
	);
	reticula.matrixAutoUpdate = false;
	reticula.visible = false;
	return reticula;

}

// Arco que se va llenando mientras se mantiene el gesto de borrar.
function crearIndicador() {

	const indicador = new THREE.Mesh(
		new THREE.RingGeometry( 0.018, 0.024, 32, 1, 0, 0.001 ),
		new THREE.MeshBasicMaterial( { color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false } )
	);
	indicador.renderOrder = 1;
	indicador.visible = false;
	indicador.userData.progreso = - 1;
	return indicador;

}

function actualizarIndicador( indicador, progreso ) {

	// Solo se rehace el arco cuando el progreso cambia de forma visible.
	const paso = Math.round( progreso * 40 ) / 40;
	if ( paso === indicador.userData.progreso ) return;
	indicador.userData.progreso = paso;

	indicador.geometry.dispose();
	indicador.geometry = new THREE.RingGeometry( 0.018, 0.024, 32, 1, Math.PI / 2, - Math.max( paso, 0.001 ) * Math.PI * 2 );
	indicador.material.color.setHex( paso >= 1 ? 0xd62828 : 0xffffff );

}

function crearLineaRayo() {

	const geometria = new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, - 1 ) ] );
	const linea = new THREE.Line( geometria, new THREE.LineBasicMaterial( { color: 0xffffff, transparent: true, opacity: 0.5 } ) );
	linea.scale.z = 1;
	return linea;

}

export class Interacciones {

	constructor( { renderer, escena, camara, alColocar, alBorrarTodo, alCambiarForma } ) {

		this.renderer = renderer;
		this.escena = escena;
		this.camara = camara;
		this.alColocar = alColocar || ( () => {} );
		this.alBorrarTodo = alBorrarTodo || ( () => {} );
		this.alCambiarForma = alCambiarForma || ( () => {} );

		this.objetos = [];
		this.indiceForma = 0;
		this.indiceColor = 0;

		this.fuenteHitVisor = null;

		this.raycaster = new THREE.Raycaster();
		this.raycaster.far = ALCANCE_RAYO;
		this._a = new THREE.Vector3();
		this._b = new THREE.Vector3();
		this._c = new THREE.Vector3();
		this.tiempoAnterior = 0;
		this._normal = new THREE.Vector3();
		this._escala = new THREE.Vector3();

		// Retícula que sigue la mirada (se usa solo si no hay controles ni manos).
		this.reticulaVisor = crearReticula();
		escena.add( this.reticulaVisor );

		// Dos controles o dos manos.
		this.controles = [];
		for ( let i = 0; i < 2; i ++ ) this.controles.push( this._prepararControl( i ) );

		this._actualizarFantasmas();

	}

	_prepararControl( i ) {

		const control = this.renderer.xr.getController( i );
		const mano = this.renderer.xr.getHand( i );
		this.escena.add( control );
		this.escena.add( mano ); // necesario para leer la posición de los dedos

		const linea = crearLineaRayo();
		control.add( linea );

		const reticula = crearReticula();
		this.escena.add( reticula );

		const indicador = crearIndicador();
		this.escena.add( indicador );

		control.userData = {
			mano,
			linea,
			reticula,
			fuenteEntrada: null,
			fuenteHit: null,
			agarrado: null,
			agarradoCon: null,
			escalando: null,
			botonesAntes: [],
			indicador,
			gesto: { activo: false, inicio: 0, borrado: false }
		};

		control.addEventListener( 'connected', ( evento ) => this._alConectar( control, evento.data ) );
		control.addEventListener( 'disconnected', () => this._alDesconectar( control ) );
		control.addEventListener( 'selectstart', () => this._alInicioSeleccion( control ) );
		control.addEventListener( 'selectend', () => this._alFinSeleccion( control, 'select' ) );
		control.addEventListener( 'squeezestart', () => this._alInicioAgarre( control ) );
		control.addEventListener( 'squeezeend', () => this._alFinSeleccion( control, 'squeeze' ) );

		return control;

	}

	// ---------- Sesión ----------

	iniciar( sesion ) {

		// Hit-test desde la cabeza (opcional: si no existe, la app sigue funcionando).
		if ( typeof sesion.requestHitTestSource === 'function' ) {

			sesion.requestReferenceSpace( 'viewer' )
				.then( ( espacioVisor ) => sesion.requestHitTestSource( { space: espacioVisor } ) )
				.then( ( fuente ) => { this.fuenteHitVisor = fuente; } )
				.catch( ( error ) => console.warn( 'Hit-test no disponible:', error ) );

		}

	}

	terminar() {

		if ( this.fuenteHitVisor ) this.fuenteHitVisor.cancel();
		this.fuenteHitVisor = null;
		this.reticulaVisor.visible = false;

		for ( const control of this.controles ) this._alDesconectar( control );

	}

	_alConectar( control, fuenteEntrada ) {

		const datos = control.userData;
		datos.fuenteEntrada = fuenteEntrada;
		datos.botonesAntes = [];
		datos.linea.visible = true;

		// Hit-test siguiendo el rayo del control o de la mano.
		const sesion = this.renderer.xr.getSession();
		if ( sesion && typeof sesion.requestHitTestSource === 'function' && fuenteEntrada.targetRaySpace ) {

			sesion.requestHitTestSource( { space: fuenteEntrada.targetRaySpace } )
				.then( ( fuente ) => {

					if ( datos.fuenteEntrada === fuenteEntrada ) datos.fuenteHit = fuente;
					else fuente.cancel();

				} )
				.catch( ( error ) => console.warn( 'Hit-test del control no disponible:', error ) );

		}

	}

	_alDesconectar( control ) {

		const datos = control.userData;
		this._soltar( control );
		if ( datos.fuenteHit ) datos.fuenteHit.cancel();
		datos.fuenteHit = null;
		datos.fuenteEntrada = null;
		datos.reticula.visible = false;
		datos.escalando = null;
		datos.gesto.activo = false;
		datos.indicador.visible = false;

	}

	_esMano( control ) {

		const fuente = control.userData.fuenteEntrada;
		return !! ( fuente && fuente.hand );

	}

	// ---------- Eventos de entrada ----------

	// Gatillo (controles) o pellizco (manos).
	_alInicioSeleccion( control ) {

		// Con la mano: pellizcar cerca de un objeto lo agarra.
		if ( this._esMano( control ) ) {

			const objeto = this._objetoCercano( this._puntoPellizco( control ) );
			if ( objeto ) {

				this._tomar( control, objeto, 'select' );
				return;

			}

		}

		// Si no, coloca un objeto nuevo.
		this._colocar( control );

	}

	// Botón de agarre (grip) de los controles.
	_alInicioAgarre( control ) {

		control.getWorldPosition( this._a );
		let objeto = this._objetoCercano( this._a );

		if ( ! objeto ) {

			// Agarre a distancia: el primer objeto que toque el rayo.
			this.raycaster.setFromXRController( control );
			const choques = this.raycaster.intersectObjects( this.objetos, false );
			if ( choques.length > 0 ) objeto = choques[ 0 ].object;

		}

		if ( objeto ) this._tomar( control, objeto, 'squeeze' );

	}

	_alFinSeleccion( control, tipo ) {

		const datos = control.userData;
		if ( datos.agarradoCon !== tipo ) return;

		if ( datos.escalando ) {

			datos.escalando = null;
			datos.agarradoCon = null;

		} else {

			this._soltar( control );

		}

	}

	// ---------- Acciones ----------

	_colocar( control ) {

		const datos = control.userData;
		let reticula = null;
		if ( datos.reticula.visible ) reticula = datos.reticula;
		else if ( this.reticulaVisor.visible ) reticula = this.reticulaVisor;

		const objeto = crearObjeto( this.indiceForma, COLORES[ this.indiceColor % COLORES.length ] );

		if ( reticula ) {

			// Sobre la superficie real, orientado según su inclinación.
			reticula.matrix.decompose( objeto.position, objeto.quaternion, this._escala );
			this._normal.set( 0, 1, 0 ).applyQuaternion( objeto.quaternion );
			this.alColocar( objeto.position, this._normal );

		} else {

			// Sin superficie detectada: frente al control, en el aire.
			control.getWorldPosition( objeto.position );
			control.getWorldDirection( this._a ).negate(); // el rayo apunta hacia -Z
			objeto.position.addScaledVector( this._a, DISTANCIA_SIN_SUPERFICIE );

		}

		this.escena.add( objeto );
		this.objetos.push( objeto );

		// El siguiente objeto tendrá otro color.
		this.indiceColor ++;
		this._actualizarFantasmas();

	}

	// Si el objeto ya lo sostiene la otra mano/control, se empieza a cambiar su tamaño;
	// si no, se agarra normalmente.
	_tomar( control, objeto, tipo ) {

		const otro = this.controles.find( ( c ) => c !== control && c.userData.agarrado === objeto );

		if ( otro ) {

			control.userData.escalando = {
				objeto,
				otro,
				escalaInicial: objeto.scale.x,
				distanciaInicial: Math.max( this._puntoAgarre( control ).distanceTo( this._puntoAgarre( otro, this._b ) ), 0.01 )
			};
			control.userData.agarradoCon = tipo;

		} else {

			this._agarrar( control, objeto, tipo );

		}

	}

	_agarrar( control, objeto, tipo ) {

		// Si otro control ya lo tenía, se lo quitamos.
		for ( const otro of this.controles ) {

			if ( otro.userData.agarrado === objeto ) this._soltar( otro );
			if ( otro.userData.escalando && otro.userData.escalando.objeto === objeto ) otro.userData.escalando = null;

		}

		control.attach( objeto ); // conserva su posición actual y lo mueve con el control
		control.userData.agarrado = objeto;
		control.userData.agarradoCon = tipo;
		resaltar( objeto, true );

	}

	_soltar( control ) {

		const objeto = control.userData.agarrado;
		if ( ! objeto ) return;

		this.escena.attach( objeto );
		resaltar( objeto, false );
		control.userData.agarrado = null;
		control.userData.agarradoCon = null;

	}

	cambiarForma() {

		this.indiceForma = ( this.indiceForma + 1 ) % FORMAS.length;
		this._actualizarFantasmas();
		this.alCambiarForma( FORMAS[ this.indiceForma ].nombre );

	}

	borrarTodo() {

		for ( const control of this.controles ) this._soltar( control );

		for ( const objeto of this.objetos ) {

			this.escena.remove( objeto );
			liberarObjeto( objeto );

		}

		this.objetos.length = 0;
		this.alBorrarTodo();

	}

	get nombreForma() {

		return FORMAS[ this.indiceForma ].nombre;

	}

	// ---------- Ayudantes ----------

	// Punto medio entre la punta del pulgar y del índice.
	_puntoPellizco( control, destino = this._a ) {

		const articulaciones = control.userData.mano.joints;
		const indice = articulaciones && articulaciones[ 'index-finger-tip' ];
		const pulgar = articulaciones && articulaciones[ 'thumb-tip' ];

		if ( indice && pulgar && indice.visible && pulgar.visible ) {

			indice.getWorldPosition( destino );
			pulgar.getWorldPosition( this._c );
			return destino.add( this._c ).multiplyScalar( 0.5 );

		}

		return control.getWorldPosition( destino );

	}

	// Punto con el que se sostiene: el pellizco (manos) o el control.
	_puntoAgarre( control, destino = this._a ) {

		if ( this._esMano( control ) ) return this._puntoPellizco( control, destino );
		return control.getWorldPosition( destino );

	}

	_aplicarEscala( objeto, escala ) {

		objeto.scale.setScalar( THREE.MathUtils.clamp( escala, ESCALA_MINIMA, ESCALA_MAXIMA ) );

	}

	// Dos manos (o dos controles) sobre el mismo objeto: separarlas agranda, juntarlas achica.
	_actualizarEscalaDosManos( control ) {

		const escalando = control.userData.escalando;
		if ( ! escalando ) return;

		// Si la otra mano soltó el objeto, se termina el cambio de tamaño.
		if ( escalando.otro.userData.agarrado !== escalando.objeto ) {

			control.userData.escalando = null;
			control.userData.agarradoCon = null;
			return;

		}

		const distancia = this._puntoAgarre( control ).distanceTo( this._puntoAgarre( escalando.otro, this._b ) );
		this._aplicarEscala( escalando.objeto, escalando.escalaInicial * distancia / escalando.distanciaInicial );

	}

	// Joystick arriba/abajo mientras se sostiene un objeto con el control.
	_leerJoystick( control, segundos ) {

		const datos = control.userData;
		const gamepad = datos.fuenteEntrada && datos.fuenteEntrada.gamepad;
		if ( ! datos.agarrado || ! gamepad || this._esMano( control ) ) return;

		const y = gamepad.axes[ EJE_JOYSTICK_Y ] || 0;
		if ( Math.abs( y ) < 0.2 ) return; // zona muerta

		// Arriba (valor negativo) agranda; abajo achica.
		const objeto = datos.agarrado;
		this._aplicarEscala( objeto, objeto.scale.x * Math.exp( - y * VELOCIDAD_JOYSTICK * segundos ) );

	}

	_objetoCercano( punto ) {

		let mejor = null;
		let mejorDistancia = Infinity;

		for ( const objeto of this.objetos ) {

			this._b.copy( objeto.geometry.boundingSphere.center );
			objeto.localToWorld( this._b );
			const distancia = this._b.distanceTo( punto ) - objeto.userData.radio * objeto.scale.x;

			if ( distancia < MARGEN_AGARRE && distancia < mejorDistancia ) {

				mejor = objeto;
				mejorDistancia = distancia;

			}

		}

		return mejor;

	}

	_actualizarFantasmas() {

		const color = COLORES[ this.indiceColor % COLORES.length ];
		const reticulas = [ this.reticulaVisor, ...this.controles.map( ( c ) => c.userData.reticula ) ];

		for ( const reticula of reticulas ) {

			const anterior = reticula.userData.fantasma;
			if ( anterior ) {

				reticula.remove( anterior );
				liberarObjeto( anterior );

			}

			const fantasma = crearFantasma( this.indiceForma, color );
			reticula.add( fantasma );
			reticula.userData.fantasma = fantasma;

		}

	}

	_actualizarHitTest( fuente, reticula, frame, espacio ) {

		reticula.visible = false;
		if ( ! fuente ) return;

		const resultados = frame.getHitTestResults( fuente );
		if ( resultados.length === 0 ) return;

		const pose = resultados[ 0 ].getPose( espacio );
		if ( ! pose ) return;

		reticula.matrix.fromArray( pose.transform.matrix );
		reticula.visible = true;

	}

	_leerBotones( control ) {

		const datos = control.userData;
		const gamepad = datos.fuenteEntrada && datos.fuenteEntrada.gamepad;
		if ( ! gamepad || this._esMano( control ) ) return;

		const presionado = ( i ) => !! ( gamepad.buttons[ i ] && gamepad.buttons[ i ].pressed );

		if ( presionado( BOTON_A_X ) && ! datos.botonesAntes[ BOTON_A_X ] ) this.cambiarForma();
		if ( presionado( BOTON_B_Y ) && ! datos.botonesAntes[ BOTON_B_Y ] ) this.borrarTodo();

		datos.botonesAntes[ BOTON_A_X ] = presionado( BOTON_A_X );
		datos.botonesAntes[ BOTON_B_Y ] = presionado( BOTON_B_Y );

	}

	// Gesto de la mano: pulgar + dedo medio.
	_leerGestoMano( control ) {

		const datos = control.userData;
		const gesto = datos.gesto;
		if ( ! this._esMano( control ) ) return;

		const articulaciones = datos.mano.joints;
		const pulgar = articulaciones[ 'thumb-tip' ];
		const medio = articulaciones[ 'middle-finger-tip' ];
		const indice = articulaciones[ 'index-finger-tip' ];

		if ( ! pulgar || ! medio || ! pulgar.visible || ! medio.visible ) {

			gesto.activo = false;
			datos.indicador.visible = false;
			return;

		}

		pulgar.getWorldPosition( this._a );
		medio.getWorldPosition( this._b );
		const distanciaMedio = this._a.distanceTo( this._b );
		const ahora = performance.now();

		if ( ! gesto.activo ) {

			// Para no confundirlo con el pellizco normal, el índice debe estar separado.
			let indiceSeparado = true;
			if ( indice && indice.visible ) {

				indice.getWorldPosition( this._b );
				indiceSeparado = this._a.distanceTo( this._b ) > DISTANCIA_SEPARADOS;

			}

			if ( distanciaMedio < DISTANCIA_JUNTOS && indiceSeparado && ! datos.agarrado && ! datos.escalando ) {

				gesto.activo = true;
				gesto.inicio = ahora;
				gesto.borrado = false;

			}

		} else if ( distanciaMedio > DISTANCIA_SEPARADOS ) {

			// Se soltó el gesto: si fue rápido, cambia la forma.
			gesto.activo = false;
			datos.indicador.visible = false;
			if ( ! gesto.borrado ) this.cambiarForma();
			return;

		}

		if ( ! gesto.activo ) return;

		// Mientras se mantiene, el arco se llena; al completarse se borra todo.
		const progreso = Math.min( ( ahora - gesto.inicio ) / TIEMPO_BORRAR, 1 );

		if ( progreso >= 1 && ! gesto.borrado ) {

			gesto.borrado = true;
			this.borrarTodo();

		}

		const indicador = datos.indicador;
		indicador.position.copy( this._a );
		this.camara.getWorldPosition( this._b );
		indicador.lookAt( this._b );
		actualizarIndicador( indicador, progreso );
		indicador.visible = true;

	}

	// Se llama en cada cuadro durante la sesión.
	actualizar( frame ) {

		if ( ! frame ) return;

		const espacio = this.renderer.xr.getReferenceSpace();
		const ahora = performance.now();
		const segundos = this.tiempoAnterior ? Math.min( ( ahora - this.tiempoAnterior ) / 1000, 0.1 ) : 0;
		this.tiempoAnterior = ahora;

		let hayControles = false;

		for ( const control of this.controles ) {

			const datos = control.userData;
			if ( ! datos.fuenteEntrada ) continue;
			hayControles = true;

			this._actualizarHitTest( datos.fuenteHit, datos.reticula, frame, espacio );

			// Mientras se sostiene un objeto no hace falta la retícula.
			if ( datos.agarrado || datos.escalando ) datos.reticula.visible = false;

			// El rayo llega hasta la retícula (o mide 1 m).
			if ( datos.reticula.visible ) {

				control.getWorldPosition( this._a );
				this._b.setFromMatrixPosition( datos.reticula.matrix );
				datos.linea.scale.z = this._a.distanceTo( this._b );

			} else {

				datos.linea.scale.z = 1;

			}

			this._leerBotones( control );
			this._leerJoystick( control, segundos );
			this._actualizarEscalaDosManos( control );
			this._leerGestoMano( control );

		}

		if ( hayControles ) this.reticulaVisor.visible = false;
		else this._actualizarHitTest( this.fuenteHitVisor, this.reticulaVisor, frame, espacio );

	}

}
