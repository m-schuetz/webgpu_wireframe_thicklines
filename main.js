
import {createRenderer} from "./renderer.js";
import {renderPoints} from "./renderPoints.js";
import {renderMesh} from "./renderMesh.js";
import {renderWireframe} from "./renderWireframe.js";
import {cube, createPointCube } from "./cube.js";

let renderer = null;

// let pointCube = createPointCube(50_000);

function loop(){

	let view = renderer.context.getCurrentTexture().createView();

	let renderPassDescriptor = {
		colorAttachments: [
			{view, loadValue: { r: 0.1, g: 0.2, b: 0.3, a: 1.0 }}
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

	// renderPoints(pointCube, renderer, passEncoder);
	// renderMesh(cube, renderer, passEncoder);
	renderWireframe(cube, renderer, passEncoder);

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

