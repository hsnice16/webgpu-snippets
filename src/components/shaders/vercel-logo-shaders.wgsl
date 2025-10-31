@group(0) @binding(0)
var<uniform> modelViewProjectionMatrix: mat4x4<f32>;

struct VertexInput {
  @location(0) pos: vec3<f32>,
  @location(1) nrm: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) normal: vec3<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  let pos = vec4<f32>(in.pos, 1.0);
  var out: VertexOutput;

  out.clip_position = modelViewProjectionMatrix * pos;
  out.normal = normalize(in.nrm);

  return out;
}

@fragment
fn fs_main(in: VertexOutput, @builtin(front_facing) face: bool) -> @location(0) vec4<f32> {
  if(face) {
    let normal = normalize(in.normal);
    return vec4<f32>(normal, 1.0);
  }

  return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}