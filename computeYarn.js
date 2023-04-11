
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

fn sample(t : f32) -> vec3<f32> {

	var h = 1.0f;

	var x = t;
	var y = h * cos(t);
	var z = 0.0f;

	return vec3<f32>(x, y, z);
}

@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) invocationID : vec3<u32>){

	var r = 0.1f;
	var scale = 0.5f;

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

	var up = vec3<f32>(0.0f, 1.0f, 0.0f);
	var l0 = sample(5.0f * u0);
	var l1 = sample(5.0f * u1);
	var dir = normalize(l1 - l0);
	var N = normalize(cross(dir, up));
	// var N = normalize(cross(dir, up));
	var T = normalize(cross(N, dir));
	
	for(var i = 0u; i < sides; i++){

		var v0 = f32(i + 0u) / f32(sides);
		var v1 = f32(i + 1u) / f32(sides);

		// var c0 = r * vec3<f32>(cos(2.0f * PI * v0), sin(2.0f * PI * v0), 0.0f);
		// var c1 = r * vec3<f32>(cos(2.0f * PI * v1), sin(2.0f * PI * v1), 0.0f);

		// var c0 = N * cos(2.0f * PI * v0) + T * sin(2.0f * PI * v0);
		// var c1 = N * cos(2.0f * PI * v1) + T * sin(2.0f * PI * v1);

		T = normalize(vec3<f32>(dir.y, dir.x, dir.z));
		N = normalize(vec3<f32>(T.z, T.y, T.x));
		// var c0 = N * cos(2.0f * PI * v0);
		// var c1 = N * cos(2.0f * PI * v1);
		var c0 = T * cos(2.0f * PI * v0) + N * sin(2.0f * PI * v0);
		var c1 = T * cos(2.0f * PI * v1) + N * sin(2.0f * PI * v1);

		var p3 = l0 + vec3<f32>(0.0f, c0.y, c0.x);
		var p2 = l1 + vec3<f32>(0.0f, c0.y, c0.x);
		var p1 = l1 + vec3<f32>(0.0f, c1.y, c1.x);
		var p0 = l0 + vec3<f32>(0.0f, c1.y, c1.x);


		// p3 = p3 * scale;
		// p2 = p2 * scale;
		// p1 = p1 * scale;
		// p0 = p0 * scale;

		// var p3 = vec3<f32>(u0, c0.x, c0.y);
		// var p2 = vec3<f32>(u1, c0.x, c0.y);
		// var p1 = vec3<f32>(u1, c1.x, c1.y);
		// var p0 = vec3<f32>(u0, c1.x, c1.y);

		// each side generates 
		// - two tris
		// - 6 vertices
		// - 18 floats
		var triOffset = 18u * i + 3u * targetIndex * verticesPerSec;
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

		var color = u32(128.0f * cos(2.0f * PI * v0) + 128.0f);
		// var color = u32(255.0f * u0);

		var triOffset_col = 6u * i + targetIndex * verticesPerSec; 
		colors.values[triOffset_col + 0] = color;
		colors.values[triOffset_col + 1] = color;
		colors.values[triOffset_col + 2] = color;
		colors.values[triOffset_col + 3] = color;
		colors.values[triOffset_col + 4] = color;
		colors.values[triOffset_col + 5] = color;
	}

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