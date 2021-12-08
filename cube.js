

function createCube(){

	let vertices = new Float32Array([
		-1, -1, -1,    // 0
		 1, -1, -1,    // 1
		 1, -1,  1,    // 2
		-1, -1,  1,    // 3
		-1,  1, -1,    // 4
		 1,  1, -1,    // 5
		 1,  1,  1,    // 6
		-1,  1,  1,    // 7
	]);

	let colors = new Uint8Array(4 * 8);
	for(let i = 0; i < 8; i++){
		let x = vertices[3 * i + 0];
		let y = vertices[3 * i + 1];
		let z = vertices[3 * i + 2];

		colors[4 * i + 0] = 255 * (x + 1) / 2;
		colors[4 * i + 1] = 255 * (y + 1) / 2;
		colors[4 * i + 2] = 255 * (z + 1) / 2;
		colors[4 * i + 3] = 255;
	}

	let indices = new Uint32Array([
		
		// BOTTOM
		0, 1, 2,   0, 2, 3,

		// TOP
		4, 5, 6,   4, 6, 7,

		// FRONT
		3, 2, 6,   3, 6, 7,

		// BACK
		1, 0, 4,   1, 4, 5,

		// LEFT
		3, 0, 7,   0, 7, 4,

		// RIGHT
		2, 1, 6,   1, 6, 5
	]);

	

	let cube = {
		positions: vertices,
		indices, colors,
	}

	return cube;
}

export const cube = createCube();



export function createPointCube(n){

	let positions = new Float32Array(3 * n);
	let colors = new Uint8Array(4 * n);

	for(let i = 0; i < n; i++){

		positions[3 * i + 0] = Math.random() - 0.5;
		positions[3 * i + 1] = Math.random() - 0.5;
		positions[3 * i + 2] = Math.random() - 0.5;

		colors[4 * i + 0] = 255 * Math.random();
		colors[4 * i + 1] = 255 * Math.random();
		colors[4 * i + 2] = 255 * Math.random();
		colors[4 * i + 3] = 255;
	}

	let cube = {
		numPoints: n,
		positions, colors,
	};

	return cube;
}

