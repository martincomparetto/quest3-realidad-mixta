// Creación de las formas virtuales que el usuario coloca en su habitación.
import * as THREE from 'three';

// Cada forma se construye con la base apoyada en y = 0,
// así queda "sentada" sobre la superficie donde se coloca.
export const FORMAS = [
	{ nombre: 'Cubo', crear: () => new THREE.BoxGeometry( 0.14, 0.14, 0.14 ).translate( 0, 0.07, 0 ) },
	{ nombre: 'Esfera', crear: () => new THREE.SphereGeometry( 0.08, 32, 16 ).translate( 0, 0.08, 0 ) },
	{ nombre: 'Cono', crear: () => new THREE.ConeGeometry( 0.08, 0.18, 32 ).translate( 0, 0.09, 0 ) },
	{ nombre: 'Cilindro', crear: () => new THREE.CylinderGeometry( 0.06, 0.06, 0.16, 32 ).translate( 0, 0.08, 0 ) },
	{ nombre: 'Dona', crear: () => new THREE.TorusGeometry( 0.06, 0.025, 16, 48 ).rotateX( Math.PI / 2 ).translate( 0, 0.025, 0 ) },
	{ nombre: 'Diamante', crear: () => new THREE.OctahedronGeometry( 0.08 ).translate( 0, 0.08, 0 ) }
];

export const COLORES = [ 0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93, 0xff924c, 0x2ec4b6 ];

// Crea un objeto sólido e iluminado.
export function crearObjeto( indiceForma, color ) {

	const forma = FORMAS[ indiceForma % FORMAS.length ];
	const material = new THREE.MeshStandardMaterial( { color, roughness: 0.4, metalness: 0.1 } );
	const malla = new THREE.Mesh( forma.crear(), material );
	malla.castShadow = true;
	malla.receiveShadow = true;
	malla.name = forma.nombre;

	malla.geometry.computeBoundingSphere();
	malla.userData.esObjeto = true;
	malla.userData.radio = malla.geometry.boundingSphere.radius;

	return malla;

}

// Versión semitransparente y más pequeña, para mostrar sobre la retícula
// qué forma y color se van a colocar.
export function crearFantasma( indiceForma, color ) {

	const forma = FORMAS[ indiceForma % FORMAS.length ];
	const material = new THREE.MeshStandardMaterial( { color, transparent: true, opacity: 0.45, depthWrite: false } );
	const malla = new THREE.Mesh( forma.crear(), material );
	malla.scale.setScalar( 0.5 );

	return malla;

}

// Resalta (o no) un objeto, por ejemplo mientras está agarrado.
export function resaltar( objeto, activo ) {

	objeto.material.emissive.setHex( activo ? 0x444444 : 0x000000 );

}

export function liberarObjeto( objeto ) {

	objeto.geometry.dispose();
	objeto.material.dispose();

}
