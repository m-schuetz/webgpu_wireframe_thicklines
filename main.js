
import {createRenderer} from "./renderer.js";
import {renderPoints} from "./renderPoints.js";
import {renderMesh} from "./renderMesh.js";
import {renderWireframe} from "./renderWireframe.js";
import {renderWireframeThick} from "./renderWireframeThick.js";
import {cube, createPointCube } from "./cube.js";
import {bunny} from "./bunny.js";
import {mat4, vec3} from "./libs/gl-matrix/gl-matrix.js";

let renderer = null;

// let pointCube = createPointCube(50_000);

function loop(){

	let renderPassDescriptor = {
		colorAttachments: [
			{
				view: renderer.context.getCurrentTexture().createView(), 
				loadValue: { r: 0.1, g: 0.2, b: 0.3, a: 1.0 }
			}
		],
		depthStencilAttachment: {
			view: renderer.depth.createView(),
			depthLoadValue: 1,
			depthStoreOp: "store",
			stencilLoadValue: 0,
			stencilStoreOp: "store",
		},
		sampleCount: 1,
	};

	const commandEncoder = renderer.device.createCommandEncoder();
	const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

	let elMesh = document.getElementById("rendermode_mesh");
	let elWireframe = document.getElementById("rendermode_wireframe");
	let elWireframeThick = document.getElementById("rendermode_wireframe_thick");

	let model = bunny;

	let view = mat4.create();
	mat4.translate(view, view, vec3.fromValues(0, 0, -4));
	let now = performance.now() / 1000;
	mat4.rotate(view, view, now, vec3.fromValues(0, 1, 0));

	if(elMesh.checked){
		renderMesh(model, view, renderer, passEncoder);
	}else if(elWireframe.checked){
		renderWireframe(model, view, renderer, passEncoder);
	}else if(elWireframeThick.checked){
		renderWireframeThick(model, view, renderer, passEncoder);
	}

	passEncoder.endPass();
	let commandBuffer = commandEncoder.finish();
	renderer.device.queue.submit([commandBuffer]);


	requestAnimationFrame(loop);
}

export async function init(){

	let canvas = document.getElementById("canvas");
	renderer = await createRenderer(canvas);

	requestAnimationFrame(loop);

}

