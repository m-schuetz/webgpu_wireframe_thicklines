
import {mat4, vec3} from "./libs/gl-matrix/gl-matrix.js";

let numWorkgroups = 3;
let workgroupSize = 128;

let shaderCode = `
struct Uniforms {
	numWorkgroups   : u32,
	workgroupSize   : u32,
	h               : f32,
	a               : f32,
	d               : f32,
	thickness       : f32,
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

struct Line{
	start  : vec3<f32>,
	end    : vec3<f32>,
	color  : u32,
};

@binding(0) @group(0) var<uniform> uniforms                  : Uniforms;
@binding(1) @group(0) var<storage, read_write> positions     : F32s;
@binding(2) @group(0) var<storage, read_write> colors        : U32s;
@binding(3) @group(0) var<storage, read_write> indirectArgs  : IndirectArgs;

@binding(4) @group(0) var<storage, read_write> indirectArgsLines  : IndirectArgs;
@binding(5) @group(0) var<storage, read_write> lines         : array<Line>;

struct VertexInput {
	@builtin(instance_index)   instanceID : u32,
	@builtin(vertex_index)     vertexID   : u32,
};

struct VertexOutput {
	@builtin(position)   position : vec4<f32>,
	@location(0)         color    : vec4<f32>,
};

fn sample(t : f32, h : f32, a : f32, d : f32) -> vec3<f32> {

	// var h = 1.0f;
	// var a = 1.0f;
	// var d = 1.0f;

	var x = t + a * sin(2.0f * t);
	var y = h * cos(t);
	var z = d * cos(2.0f * t);

	return vec3<f32>(x, y, z);
}

fn createYarn(threadID : u32, h : f32, a : f32, d : f32, offset : vec3<f32>){
	// var r = 1.0f;
	var r = uniforms.thickness;
	var scale = 1.0f;
	var factor = 40.0f;

	// each invocation produces one segment
	var sides = 24u;
	var trisPerSeg = sides * 2u;
	var verticesPerSec = trisPerSeg * 3u;

	// var index = invocationID.x;
	var index = threadID;
	var PI = 3.1415f;

	// segment index in target buffer
	var targetIndex = atomicAdd(&indirectArgs.vertexCount, verticesPerSec) / verticesPerSec;

	_ = uniforms.numWorkgroups;

	var numThreads = uniforms.numWorkgroups * uniforms.workgroupSize;
	numThreads = ${numWorkgroups * workgroupSize}u;
	var u0 = (f32(index) + 0.0f) / f32(numThreads);
	var u1 = (f32(index) + 1.5f) / f32(numThreads);

	var up = vec3<f32>(0.0f, 1.0f, 0.0f);
	var l0 = sample(factor * u0, h, a, d);
	var l1 = sample(factor * u1, h, a, d);

	var dir = normalize(l1 - l0);
	var N = normalize(cross(dir, up));
	var T = normalize(cross(N, dir));

	for(var i = 0u; i < sides; i++){

		var v0 = f32(i + 0u) / f32(sides);
		var v1 = f32(i + 1u) / f32(sides);

		var c0 = T * cos(2.0f * PI * v0) + N * sin(2.0f * PI * v0);
		var c1 = T * cos(2.0f * PI * v1) + N * sin(2.0f * PI * v1);

		var p3 = l0 + r * c0;
		var p2 = l1 + r * c0;
		var p1 = l1 + r * c1;
		var p0 = l0 + r * c1;

		p3 = scale * p3 + offset;
		p2 = scale * p2 + offset;
		p1 = scale * p1 + offset;
		p0 = scale * p0 + offset;

		// {
		// 	var line = Line();
		// 	line.start = l0 * scale;
		// 	line.end = l1 * scale;
		// 	line.color = 0x0000ff00;

		// 	var lineIndex = atomicAdd(&indirectArgsLines.vertexCount, 2u) / 2u;
		// 	lines[lineIndex] = line;
		// }

		// {
		// 	var line = Line();

		// 	var d = normalize(l1 - lm);
		// 	var n = vec3<f32>(d.x, d.z, d.y);

		// 	line.start = l0;
		// 	line.end = l0 + n;
		// 	line.color = 0x000000ff;

		// 	var lineIndex = atomicAdd(&indirectArgsLines.vertexCount, 2u) / 2u;
		// 	lines[lineIndex] = line;
		// }

		// {
		// 	var line = Line();
		// 	line.start = l0;
		// 	line.end = l0 + N;
		// 	line.color = 0x0000ffff;

		// 	var lineIndex = atomicAdd(&indirectArgsLines.vertexCount, 2u) / 2u;
		// 	lines[lineIndex] = line;
		// }

		// {
		// 	var line = Line();
		// 	line.start = l0;
		// 	line.end = l0 + T;
		// 	line.color = 0x00ff0000;

		// 	var lineIndex = atomicAdd(&indirectArgsLines.vertexCount, 2u) / 2u;
		// 	lines[lineIndex] = line;
		// }

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

		var d0 = p1 - p0;
		var d1 = p2 - p0;
		var N = normalize(cross(d0, d1));
		var light0 = vec3<f32>(10.0f, 10.0f, 10.0f);
		var light1 = vec3<f32>(-10.0f, 10.0f, -10.0f);
		
		var L0 = normalize(light0 - p0);
		var L1 = normalize(light1 - p0);

		var diff0 = clamp(dot(N, L0), 0.0f, 1.0f);
		var diff1 = clamp(dot(N, L1), 0.0f, 1.0f);
		var diff = clamp(diff0 + diff1, 0.0f, 1.0f);
		var ambient = vec3<f32>(0.2f, 0.2f, 0.2f);

		// var color = 
		// 	(u32(255.0f * N.x) <<  0u) +
		// 	(u32(255.0f * N.y) <<  8u) +
		// 	(u32(255.0f * N.z) << 16u);

		var color = 
			(u32(255.0f * diff + ambient.x) <<  0u) +
			(u32(255.0f * diff + ambient.y) <<  8u) +
			(u32(255.0f * diff + ambient.z) << 16u);

		var triOffset_col = 6u * i + targetIndex * verticesPerSec; 
		colors.values[triOffset_col + 0] = color;
		colors.values[triOffset_col + 1] = color;
		colors.values[triOffset_col + 2] = color;
		colors.values[triOffset_col + 3] = color;
		colors.values[triOffset_col + 4] = color;
		colors.values[triOffset_col + 5] = color;
	}
}

@compute @workgroup_size(${workgroupSize})
fn main(@builtin(global_invocation_id) invocationID : vec3<u32>){



	_ = indirectArgsLines.instanceCount;
	_ = lines[0];

	if(invocationID.x == 0u){
		indirectArgs.instanceCount = 1u;
		indirectArgs.firstVertex   = 0u;
		indirectArgs.firstInstance = 0u;
	}

	// createYarn(invocationID.x, 1.0f, 1.0f, 1.0f);
	// createYarn(invocationID.x, 2.0f, 1.0f, 1.0f);

	// var h = 4.0f;
	var h = uniforms.h;
	var a = uniforms.a;
	var d = uniforms.d;
	createYarn(invocationID.x, h, a, d, vec3<f32>(-20.0f, 0.0f * h - 5.0f, 0.0f));
	createYarn(invocationID.x, h, a, d, vec3<f32>(-20.0f, 1.0f * h - 5.0f, 0.0f));
	createYarn(invocationID.x, h, a, d, vec3<f32>(-20.0f, 2.0f * h - 5.0f, 0.0f));
	createYarn(invocationID.x, h, a, d, vec3<f32>(-20.0f, 3.0f * h - 5.0f, 0.0f));
}
`;


const uniformBufferSize = 256;

let states = new Map();

function getState(model, lines, renderer){

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
				{binding: 4, resource: {buffer: lines.indirect}},
				{binding: 5, resource: {buffer: lines.buffer}},
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

	let el_h = document.getElementById("val_h");
	let el_a = document.getElementById("val_a");
	let el_d = document.getElementById("val_d");
	let el_thickness = document.getElementById("val_thickness");

	let data = new ArrayBuffer(256);
	let view = new DataView(data);

	view.setUint32(  0, numWorkgroups, true);
	view.setUint32(  4, workgroupSize, true);
	view.setFloat32( 8, el_h.value, true);
	view.setFloat32(12, el_a.value, true);
	view.setFloat32(16, el_d.value, true);
	view.setFloat32(20, el_thickness.value, true);

	renderer.device.queue.writeBuffer(
		state.uniformBuffer, 
		0, data, 0, data.byteLength);

}

function resetIndirect(state, renderer, model, lines){

	let data = new ArrayBuffer(16);
	let view = new DataView(data);

	view.setUint32( 0, 0, true);
	view.setUint32( 4, 1, true);
	view.setUint32( 8, 0, true);
	view.setUint32(12, 0, true);

	renderer.device.queue.writeBuffer(
		model.indirect, 
		0, data, 0, data.byteLength);

	renderer.device.queue.writeBuffer(
		lines.indirect, 
		0, data, 0, data.byteLength);

}


export function computeYarn(model, lines, view, renderer, commandEncoder){

	let state = getState(model, lines, renderer);

	update(state, renderer, model);
	resetIndirect(state, renderer, model, lines);

	let passEncoder = commandEncoder.beginComputePass();

	passEncoder.setPipeline(state.pipeline);
	passEncoder.setBindGroup(0, state.bindGroup);

	passEncoder.dispatchWorkgroups(numWorkgroups);
	passEncoder.end();


}