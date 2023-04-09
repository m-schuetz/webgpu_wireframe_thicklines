
export class Renderer{

	constructor(){
		this.adapter = null;
		this.device = null;
		this.context = null;
		this.format = null;
		this.depthFormat = "depth32float";
		
		this.texture = null;
		this.depth = null;
		this.typedBuffers = new Map();
	}

	getGpuBuffer(typedArray){
		let buffer = this.typedBuffers.get(typedArray);
		
		if(!buffer){
			let {device} = this;
			
			let vbo = device.createBuffer({
				size: typedArray.byteLength,
				usage: GPUBufferUsage.VERTEX 
					| GPUBufferUsage.INDEX  
					| GPUBufferUsage.COPY_DST 
					| GPUBufferUsage.COPY_SRC 
					| GPUBufferUsage.STORAGE,
				mappedAtCreation: true,
			});

			let type = typedArray.constructor;
			new type(vbo.getMappedRange()).set(typedArray);
			vbo.unmap();

			buffer = vbo;

			this.typedBuffers.set(typedArray, buffer);
		}

		return buffer;
	}
};

export async function createRenderer(canvas){

	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;

	let adapter = await navigator.gpu.requestAdapter();
	let device  = await adapter.requestDevice();
	let context = canvas.getContext('webgpu');

	context.configure({
		device,
		format: navigator.gpu.getPreferredCanvasFormat()
	});

	let texture = context.getCurrentTexture();
	let depth = device.createTexture({
		size: [canvas.width, canvas.height],
		format: 'depth32float',
		usage: GPUTextureUsage.RENDER_ATTACHMENT,
	});

	let renderer = new Renderer();
	renderer.adapter = adapter;
	renderer.device  = device;
	renderer.context = context;
	renderer.format = navigator.gpu.getPreferredCanvasFormat();
	renderer.texture = texture;
	renderer.depth   = depth;

	return renderer;
}