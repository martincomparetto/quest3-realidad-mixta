// Panel flotante con botones 3D que se usan dentro del visor
// (en el Quest 3 no se pueden ver botones HTML durante la sesión).
import * as THREE from 'three';

const ANCHO_BOTON = 0.16;
const ALTO_BOTON = 0.06;

function crearTexturaTexto( texto, fondo ) {

	const lienzo = document.createElement( 'canvas' );
	lienzo.width = 512;
	lienzo.height = 192;
	const ctx = lienzo.getContext( '2d' );

	ctx.fillStyle = fondo;
	if ( ctx.roundRect ) {

		ctx.beginPath();
		ctx.roundRect( 8, 8, lienzo.width - 16, lienzo.height - 16, 48 );
		ctx.fill();

	} else {

		ctx.fillRect( 8, 8, lienzo.width - 16, lienzo.height - 16 );

	}

	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 64px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText( texto, lienzo.width / 2, lienzo.height / 2 );

	const textura = new THREE.CanvasTexture( lienzo );
	textura.colorSpace = THREE.SRGBColorSpace;
	return textura;

}

function crearBoton( texto, fondo, accion ) {

	const material = new THREE.MeshBasicMaterial( { map: crearTexturaTexto( texto, fondo ), transparent: true } );
	const boton = new THREE.Mesh( new THREE.PlaneGeometry( ANCHO_BOTON, ALTO_BOTON ), material );
	boton.userData.accion = accion;
	return boton;

}

export class Panel {

	constructor( acciones ) {

		this.grupo = new THREE.Group();
		this.grupo.visible = false;

		this.botones = [
			crearBoton( 'Cambiar forma', '#1982c4', acciones.cambiarForma ),
			crearBoton( 'Borrar todo', '#d62828', acciones.borrarTodo )
		];

		this.botones.forEach( ( boton, i ) => {

			boton.position.x = ( i - 0.5 ) * ( ANCHO_BOTON + 0.02 );
			this.grupo.add( boton );

		} );

		this.siguiendo = false;
		this.ultimaPulsacion = 0;

		this._cabeza = new THREE.Vector3();
		this._frente = new THREE.Vector3();
		this._destino = new THREE.Vector3();
		this._punto = new THREE.Vector3();
		this._local = new THREE.Vector3();

	}

	// Calcula dónde debería estar el panel: frente al usuario, un poco abajo.
	_calcularDestino( camara ) {

		camara.getWorldPosition( this._cabeza );
		camara.getWorldDirection( this._frente );
		this._frente.y = 0;
		if ( this._frente.lengthSq() < 1e-6 ) this._frente.set( 0, 0, - 1 );
		this._frente.normalize();

		this._destino.copy( this._cabeza ).addScaledVector( this._frente, 0.55 );
		this._destino.y -= 0.3;

	}

	colocarFrente( camara ) {

		this._calcularDestino( camara );
		this.grupo.position.copy( this._destino );
		this._mirarA( this._cabeza );
		this.grupo.visible = true;

	}

	_mirarA( cabeza ) {

		this._punto.set( cabeza.x, this.grupo.position.y, cabeza.z );
		this.grupo.lookAt( this._punto );

	}

	// "Seguimiento perezoso": el panel solo se mueve cuando queda lejos
	// o fuera de la vista, para no molestar.
	actualizar( camara ) {

		if ( ! this.grupo.visible ) return;

		this._calcularDestino( camara );
		const distancia = this.grupo.position.distanceTo( this._destino );

		if ( distancia > 0.4 ) this.siguiendo = true;

		if ( this.siguiendo ) {

			this.grupo.position.lerp( this._destino, 0.08 );
			if ( distancia < 0.02 ) this.siguiendo = false;

		}

		this._mirarA( this._cabeza );

	}

	// Botón tocado por un rayo (controles o mano apuntando).
	botonEnRayo( raycaster ) {

		if ( ! this.grupo.visible ) return null;
		const choques = raycaster.intersectObjects( this.botones, false );
		return choques.length > 0 ? choques[ 0 ].object : null;

	}

	// Botón tocado directamente con la punta del dedo índice.
	botonEnPunto( puntoMundo ) {

		if ( ! this.grupo.visible ) return null;

		for ( const boton of this.botones ) {

			this._local.copy( puntoMundo );
			boton.worldToLocal( this._local );

			if ( Math.abs( this._local.x ) < ANCHO_BOTON / 2 &&
				Math.abs( this._local.y ) < ALTO_BOTON / 2 &&
				Math.abs( this._local.z ) < 0.02 ) return boton;

		}

		return null;

	}

	// Ejecuta la acción del botón (con una pequeña pausa para evitar dobles pulsaciones).
	pulsar( boton ) {

		const ahora = performance.now();
		if ( ahora - this.ultimaPulsacion < 600 ) return;
		this.ultimaPulsacion = ahora;

		boton.scale.setScalar( 0.9 );
		setTimeout( () => boton.scale.setScalar( 1 ), 150 );
		boton.userData.accion();

	}

}
