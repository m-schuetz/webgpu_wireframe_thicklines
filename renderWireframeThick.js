
import {mat4, vec3} from "./libs/gl-matrix/gl-matrix.js";

let shaderCode = `
[[block]] struct Uniforms {
	world           : mat4x4<f32>;
	view            : mat4x4<f32>;
	proj            : mat4x4<f32>;
	screen_width    : f32;        
	screen_height   : f32;        
};

[[block]] struct U32s {
	values : [[stride(4)]] array<u32>;
};

[[block]] struct F32s {
	values : [[stride(4)]] array<f32>;
};

[[binding(0), group(0)]] var<uniform> uniforms : Uniforms;
[[binding(1), group(0)]] var<storage, read> positions : F32s;
[[binding(2), group(0)]] var<storage, read> colors : U32s;
[[binding(3), group(0)]] var<storage, read> indices : U32s;

struct VertexInput {
	[[builtin(instance_index)]] instanceID : u32;
	[[builtin(vertex_index)]] vertexID : u32;
};

struct VertexOutput {
	[[builtin(position)]] position : vec4<f32>;
	[[location(0)]] color : vec4<f32>;
};



[[stage(vertex)]]
fn main_vertex(vertex : VertexInput) -> VertexOutput {
	
	var lineWidth = 5.0;

	var localToElement = array<u32, 6>(0u, 1u, 1u, 2u, 2u, 0u);

	var triangleIndex = vertex.vertexID / 18u;        // 18 vertices per triangle
	var localVertexIndex = vertex.vertexID % 18u;     // 18 vertices
	var localLineIndex = localVertexIndex / 6u;       // 3 lines, 6 vertices per line, 2 triangles per line

	var startElementIndex = indices.values[3u * triangleIndex + localLineIndex + 0u];
	var endElementIndex = indices.values[3u * triangleIndex + (localLineIndex + 1u) % 3u];

	var start = vec4<f32>(
		positions.values[3u * startElementIndex + 0u],
		positions.values[3u * startElementIndex + 1u],
		positions.values[3u * startElementIndex + 2u],
		1.0
	);

	var end = vec4<f32>(
		positions.values[3u * endElementIndex + 0u],
		positions.values[3u * endElementIndex + 1u],
		positions.values[3u * endElementIndex + 2u],
		1.0
	);

	var localIndex = vertex.vertexID % 6u;

	var position = start;
	var currElementIndex = startElementIndex;
	if(localIndex == 0u || localIndex == 3u|| localIndex == 5u){
		position = start;
		currElementIndex = startElementIndex;
	}else{
		position = end;
		currElementIndex = endElementIndex;
	}
	
	var worldPos = uniforms.world * position;
	var viewPos = uniforms.view * worldPos;
	var projPos = uniforms.proj * viewPos;

	var dirScreen : vec2<f32>;
	{
		var projStart = uniforms.proj * uniforms.view * uniforms.world * start;
		var projEnd = uniforms.proj * uniforms.view * uniforms.world * end;

		var screenStart = projStart.xy / projStart.w;
		var screenEnd = projEnd.xy / projEnd.w;

		dirScreen = normalize(screenEnd - screenStart);
	}

	{ // apply pixel offsets to the 6 vertices of the quad

		var pxOffset = vec2<f32>(1.0, 0.0);

		// move vertices of quad sidewards
		if(localIndex == 0u || localIndex == 1u || localIndex == 3u){
			pxOffset = vec2<f32>(dirScreen.y, -dirScreen.x);
		}else{
			pxOffset = vec2<f32>(-dirScreen.y, dirScreen.x);
		}

		// move vertices of quad outwards
		if(localIndex == 0u || localIndex == 3u || localIndex == 5u){
			pxOffset = pxOffset - dirScreen;
		}else{
			pxOffset = pxOffset + dirScreen;
		}

		var screenDimensions = vec2<f32>(uniforms.screen_width, uniforms.screen_height);
		var adjusted = projPos.xy / projPos.w + lineWidth * pxOffset / screenDimensions;
		projPos = vec4<f32>(adjusted * projPos.w, projPos.zw);
	}

	var color_u32 = colors.values[currElementIndex];
	var color = vec4<f32>(
		f32((color_u32 >>  0u) & 0xFFu) / 255.0,
		f32((color_u32 >>  8u) & 0xFFu) / 255.0,
		f32((color_u32 >> 16u) & 0xFFu) / 255.0,
		f32((color_u32 >> 24u) & 0xFFu) / 255.0,
	);
	// var color = vec4<f32>(0.0, 1.0, 0.0, 1.0);

	var output : VertexOutput;
	output.position = projPos;
	output.color = color;

	return output;
}

struct FragmentInput {
	[[location(0)]] color : vec4<f32>;
};

struct FragmentOutput {
	[[location(0)]] color : vec4<f32>;
};

[[stage(fragment)]]
fn main_fragment(fragment : FragmentInput) -> FragmentOutput {

	var output : FragmentOutput;
	output.color = fragment.color;

	return output;
}
`;


const uniformBufferSize = 256;

let states = new Map();

function getState(points, renderer){

	if(!states.has(points)){
		let {device} = renderer;

		let module = device.createShaderModule({code: shaderCode});

		let pipeline = device.createRenderPipeline({
			vertex: {
				module,
				entryPoint: "main_vertex",
				buffers: []
			},
			fragment: {
				module,
				entryPoint: "main_fragment",
				targets: [{format: renderer.format}],
			},
			primitive: {
				topology: 'triangle-list',
				cullMode: 'none',
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: renderer.depthFormat,
			},
		});

		let uniformBuffer = device.createBuffer({
			size: uniformBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		let vboPositions = device.createBuffer({
			size: points.positions.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		let vboColors = device.createBuffer({
			size: points.colors.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		let vboIndices = device.createBuffer({
			size: points.indices.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		device.queue.writeBuffer(vboPositions, 0, points.positions.buffer, 0, points.positions.byteLength);
		device.queue.writeBuffer(vboColors, 0, points.colors.buffer, 0, points.colors.byteLength);
		device.queue.writeBuffer(vboIndices, 0, points.indices.buffer, 0, points.indices.byteLength);

		let bindGroup = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{binding: 0, resource: {buffer: uniformBuffer}},
				{binding: 1, resource: {buffer: vboPositions}},
				{binding: 2, resource: {buffer: vboColors}},
				{binding: 3, resource: {buffer: vboIndices}},
			],
		});

		let state = {pipeline, uniformBuffer, bindGroup};

		states.set(points, state);

		return state;
	}else{
		return states.get(points);
	}


}

function update(state, view, renderer){

	let world = mat4.create();

	

	let canvas = renderer.context.canvas;
	let aspect = canvas.clientWidth / canvas.clientHeight;
	let proj = mat4.create();
	mat4.perspective(proj, (2 * Math.PI) / 5, aspect, 1, 100.0);

	let data = new ArrayBuffer(256);
	let f32 = new Float32Array(data);
	let dataView = new DataView(data);

	f32.set(world, 0);
	f32.set(view, 16);
	f32.set(proj, 32);

	dataView.setFloat32(3 * 64 + 0, canvas.clientWidth, true);
	dataView.setFloat32(3 * 64 + 4, canvas.clientHeight, true);

	renderer.device.queue.writeBuffer(
		state.uniformBuffer, 
		0, data, 0, data.byteLength);

}


export function renderWireframeThick(geometry, view, renderer, passEncoder){

	let state = getState(geometry, renderer);

	update(state, view, renderer);

	passEncoder.setPipeline(state.pipeline);
	passEncoder.setBindGroup(0, state.bindGroup);

	let numTriangles = geometry.indices.length / 3;
	passEncoder.draw(3 * 6 * numTriangles, 1, 0, 0);
}