
import {mat4, vec3} from "./libs/gl-matrix/gl-matrix.js";

let numWorkgroups = 1;
let workgroupSize = 32;

let shaderCode = `
struct Uniforms {
	numWorkgroups   : u32,
	workgroupSize   : u32,
};

struct U32s {
	values : array<u32>,
};

struct F32s {
	values : array<f32>,
};

struct IndirectArgs{
	vertexCount   : atomic<u32>,
	instanceCount : u32,
	firstVertex   : u32,
	firstInstance : u32,
};

@binding(0) @group(0) var<uniform> uniforms                  : Uniforms;
@binding(1) @group(0) var<storage, read_write> positions     : F32s;
@binding(2) @group(0) var<storage, read_write> colors        : U32s;
@binding(3) @group(0) var<storage, read_write> indirectArgs  : IndirectArgs;

struct VertexInput {
	@builtin(instance_index)   instanceID : u32,
	@builtin(vertex_index)     vertexID   : u32,
};

struct VertexOutput {
	@builtin(position)   position : vec4<f32>,
	@location(0)         color    : vec4<f32>,
};

@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) invocationID : vec3<u32>){

	// each invocation produces one segment
	var sides = 12u;
	var trisPerSeg = sides * 2u;
	var verticesPerSec = trisPerSeg * 3u;

	var index = invocationID.x;
	var PI = 3.1415f;

	if(index == 0u){
		indirectArgs.instanceCount = 1u;
		indirectArgs.firstVertex   = 0u;
		indirectArgs.firstInstance = 0u;
	}

	// segment index in target buffer
	var targetIndex = atomicAdd(&indirectArgs.vertexCount, verticesPerSec) / verticesPerSec;

	_ = uniforms.numWorkgroups;

	var numThreads = uniforms.numWorkgroups * uniforms.workgroupSize;
	numThreads = ${numWorkgroups * workgroupSize}u;
	var u0 = f32(targetIndex + 0u) / f32(numThreads);
	var u1 = f32(targetIndex + 1u) / f32(numThreads);

	// var u = f32(targetIndex) / f32(numThreads);


	
	for(var i = 0u; i < sides; i++){

		var v0 = f32(i + 0u) / f32(sides);
		var v1 = f32(i + 1u) / f32(sides);

		var c0 = vec2<f32>(cos(2.0f * PI * v0), sin(2.0f * PI * v0));
		var c1 = vec2<f32>(cos(2.0f * PI * v1), sin(2.0f * PI * v1));

		var p3 = vec3<f32>(32.0f * u0, c0.x, c0.y);
		var p2 = vec3<f32>(32.0f * u1, c0.x, c0.y);
		var p1 = vec3<f32>(32.0f * u1, c1.x, c1.y);
		var p0 = vec3<f32>(32.0f * u0, c1.x, c1.y);

		// each side generates 
		// - two tris
		// - 6 vertices
		// - 18 floats
		var triOffset = 18u * i + targetIndex;
		positions.values[triOffset +  0] = p0.x;
		positions.values[triOffset +  1] = p0.y;
		positions.values[triOffset +  2] = p0.z;
 
		positions.values[triOffset +  3] = p1.x;
		positions.values[triOffset +  4] = p1.y;
		positions.values[triOffset +  5] = p1.z;
 
		positions.values[triOffset +  6] = p2.x;
		positions.values[triOffset +  7] = p2.y;
		positions.values[triOffset +  8] = p2.z;

		positions.values[triOffset +  9] = p0.x;
		positions.values[triOffset + 10] = p0.y;
		positions.values[triOffset + 11] = p0.z;

		positions.values[triOffset + 12] = p2.x;
		positions.values[triOffset + 13] = p2.y;
		positions.values[triOffset + 14] = p2.z;

		positions.values[triOffset + 15] = p3.x;
		positions.values[triOffset + 16] = p3.y;
		positions.values[triOffset + 17] = p3.z;

		colors.values[targetIndex + 6u * i + 0] = 0xff <<  0u;
		colors.values[targetIndex + 6u * i + 1] = 0xff <<  8u;
		colors.values[targetIndex + 6u * i + 2] = 0xff << 16u;
		colors.values[targetIndex + 6u * i + 3] = 0xff <<  0u;
		colors.values[targetIndex + 6u * i + 4] = 0xff <<  8u;
		colors.values[targetIndex + 6u * i + 5] = 0xff << 16u;
	}


	// var p0 = vec3<f32>(
	// 	cos(2.0f * PI * u0),
	// 	sin(2.0f * PI * u0),
	// 	0.0f,
	// );

	// var p1 = vec3<f32>(
	// 	cos(2.0f * PI * u1),
	// 	sin(2.0f * PI * u1),
	// 	0.0f,
	// );

	// var p2 = vec3<f32>(0.0f, 0.0f, 0.0f);

	// positions.values[9u * targetIndex + 0] = p0.x;
	// positions.values[9u * targetIndex + 1] = p0.y;
	// positions.values[9u * targetIndex + 2] = p0.z;

	// positions.values[9u * targetIndex + 3] = p1.x;
	// positions.values[9u * targetIndex + 4] = p1.y;
	// positions.values[9u * targetIndex + 5] = p1.z;

	// positions.values[9u * targetIndex + 6] = p2.x;
	// positions.values[9u * targetIndex + 7] = p2.y;
	// positions.values[9u * targetIndex + 8] = p2.z;

	// colors.values[3u * targetIndex + 0] = 0xff <<  0u;
	// colors.values[3u * targetIndex + 1] = 0xff <<  8u;
	// colors.values[3u * targetIndex + 2] = 0xff << 16u;

}
`;


const uniformBufferSize = 256;

let states = new Map();

function getState(model, renderer){

	if(!states.has(model)){
		let {device} = renderer;

		let module = device.createShaderModule({code: shaderCode});

		let pipeline = device.createComputePipeline({
			layout: "auto",
			compute: {
				module, 
				entryPoint: "main",
			},
		});

		let uniformBuffer = device.createBuffer({
			size: uniformBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		let bindGroup = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{binding: 0, resource: {buffer: uniformBuffer}},
				{binding: 1, resource: {buffer: model.positions}},
				{binding: 2, resource: {buffer: model.colors}},
				{binding: 3, resource: {buffer: model.indirect}},
			],
		});

		let state = {pipeline, uniformBuffer, bindGroup};

		states.set(model, state);

		return state;
	}else{
		return states.get(model);
	}


}

function update(state, renderer, model){

	let data = new ArrayBuffer(256);
	let view = new DataView(data);

	view.setUint32(0, numWorkgroups, true);
	view.setUint32(4, workgroupSize, true);

	renderer.device.queue.writeBuffer(
		state.uniformBuffer, 
		0, data, 0, data.byteLength);

}

function resetIndirect(state, renderer, model){

	let data = new ArrayBuffer(16);
	let view = new DataView(data);

	view.setUint32( 0, 0, true);
	view.setUint32( 4, 1, true);
	view.setUint32( 8, 0, true);
	view.setUint32(12, 0, true);

	renderer.device.queue.writeBuffer(
		model.indirect, 
		0, data, 0, data.byteLength);

}


export function computeYarn(model, view, renderer, commandEncoder){

	let state = getState(model, renderer);

	update(state, renderer, model);
	resetIndirect(state, renderer, model);

	let passEncoder = commandEncoder.beginComputePass();

	passEncoder.setPipeline(state.pipeline);
	passEncoder.setBindGroup(0, state.bindGroup);

	passEncoder.dispatchWorkgroups(numWorkgroups);
	passEncoder.end();


}