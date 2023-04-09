
import {mat4, vec3} from "./libs/gl-matrix/gl-matrix.js";

let shaderCode = `
struct Uniforms {
	world           : mat4x4<f32>,
	view            : mat4x4<f32>,
	proj            : mat4x4<f32>,
	screen_width    : f32,
	screen_height   : f32,
};

struct U32s {
	values : array<u32>,
};

struct F32s {
	values : array<f32>,
};


@binding(0) @group(0) var<uniform> uniforms        : Uniforms;
@binding(1) @group(0) var<storage, read> positions : F32s;
@binding(2) @group(0) var<storage, read> colors    : U32s;

struct VertexInput {
	@builtin(instance_index)   instanceID : u32,
	@builtin(vertex_index)     vertexID   : u32,
};

struct VertexOutput {
	@builtin(position)   position : vec4<f32>,
	@location(0)         color    : vec4<f32>,
};

@vertex
fn main_vertex(vertex : VertexInput) -> VertexOutput {

	var position = vec4<f32>(
		positions.values[3u * vertex.vertexID + 0u],
		positions.values[3u * vertex.vertexID + 1u],
		positions.values[3u * vertex.vertexID + 2u],
		1.0
	);

	position = uniforms.proj * uniforms.view * uniforms.world * position;

	var color_u32 = colors.values[vertex.vertexID];
	var color = vec4<f32>(
		f32((color_u32 >>  0u) & 0xFFu) / 255.0,
		f32((color_u32 >>  8u) & 0xFFu) / 255.0,
		f32((color_u32 >> 16u) & 0xFFu) / 255.0,
		f32((color_u32 >> 24u) & 0xFFu) / 255.0,
	);

	var output : VertexOutput;
	output.position = position;
	output.color = color;

	return output;
}

struct FragmentInput {
	@location(0) color : vec4<f32>,
};

struct FragmentOutput {
	@location(0) color : vec4<f32>,
};

@fragment
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

		let layout = device.createBindGroupLayout({
			label: "mesh layout",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {type: 'uniform'},
				},{
					binding: 1,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {type: 'read-only-storage'},
				},{
					binding: 2,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {type: 'read-only-storage'},
				}
			],
		});

		let pipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({
				bindGroupLayouts: [layout]
			}),
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

		device.queue.writeBuffer(vboPositions, 0, points.positions.buffer, 0, points.positions.byteLength);
		device.queue.writeBuffer(vboColors, 0, points.colors.buffer, 0, points.colors.byteLength);

		let bindGroup = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{binding: 0, resource: {buffer: uniformBuffer}},
				{binding: 1, resource: {buffer: vboPositions}},
				{binding: 2, resource: {buffer: vboColors}},
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

	f32.set(world, 0);
	f32.set(view, 16);
	f32.set(proj, 32);

	renderer.device.queue.writeBuffer(
		state.uniformBuffer, 
		0, data, 0, data.byteLength);

}


export function renderMesh(geometry, view, renderer, passEncoder){

	let state = getState(geometry, renderer);

	update(state, view, renderer);

	passEncoder.setPipeline(state.pipeline);
	passEncoder.setBindGroup(0, state.bindGroup);

	let vboPositions = renderer.getGpuBuffer(geometry.positions);
	let vboColors = renderer.getGpuBuffer(geometry.colors);
	let vboIndices = renderer.getGpuBuffer(geometry.indices);

	passEncoder.setVertexBuffer(0, vboPositions);
	passEncoder.setVertexBuffer(1, vboColors);

	passEncoder.setIndexBuffer(vboIndices, "uint32", 0, geometry.indices.byteLength);

	let numIndices = geometry.indices.length;
	passEncoder.drawIndexed(numIndices);
}