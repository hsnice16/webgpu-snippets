@group(0) @binding(0)
var<uniform> model_view_matrix: mat4x4<f32>;

@group(0) @binding(1)
var<uniform> projection_matrix: mat4x4<f32>;

@group(0) @binding(2)
var<uniform> normal_matrix: mat4x4<f32>;

@group(0) @binding(3)
var<uniform> light_direction: vec3<f32>;

@group(0) @binding(4)
var<uniform> view_direction: vec3<f32>;

const ambient_color: vec4<f32> = vec4<f32>(0.85, 0.85, 0.85, 1.0);
const diffuse_color: vec4<f32> = vec4<f32>(1.0, 1.0, 1.0, 1.0);
const specular_color: vec4<f32> = vec4<f32>(1.0, 1.0, 1.0, 1.0);

const shininess: f32 = 20.0;

const diffuse_constant: f32 = 1.0;
const specular_constant: f32 = 1.0;
const ambient_constant: f32 = 1.0;

fn specular(light_dir: vec3<f32>, view_dir: vec3<f32>, normal: vec3<f32>, specular_color: vec3<f32>, shininess: f32) -> vec3<f32> {
  var reflect_dir: vec3<f32> = reflect(-light_dir, normal);
  var spec_dot: f32 = max(dot(reflect_dir, view_dir), 0.0);
  return pow(spec_dot, shininess) * specular_color;
}

fn diffuse(light_dir: vec3<f32>, normal: vec3<f32>, diffuse_color: vec3<f32>) -> vec3<f32> {
  return max(dot(light_dir, normal), 0.0) * diffuse_color;
}

struct VertexInput {
  @location(0) pos: vec3<f32>,
  @location(1) nrm: vec3<f32>,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) view_dir: vec3<f32>,
  @location(2) light_dir: vec3<f32>
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  let pos = vec4<f32>(in.pos, 1.0);
  var out: VertexOutput;

  out.normal = normalize((normal_matrix * vec4<f32>(in.nrm, 0.0)).xyz);
  out.view_dir = normalize((vec4<f32>(-view_direction, 0.0)).xyz);
  out.light_dir = normalize((vec4<f32>(-light_direction, 0.0)).xyz);

  out.clip_position = projection_matrix * model_view_matrix * pos;
  return out;
}

@fragment
fn fs_main(in: VertexOutput, @builtin(front_facing) face: bool) -> @location(0) vec4<f32> {
  var light_dir: vec3<f32> = in.light_dir;
  var n: vec3<f32> = normalize(in.normal);
  var view_dir: vec3<f32> = in.view_dir;

  var radiance: vec3<f32> = ambient_color.rgb * ambient_constant + 
  diffuse(light_dir, n, diffuse_color.rgb) * diffuse_constant + 
  specular(light_dir, view_dir, n, specular_color.rgb, shininess) * specular_constant;

  return vec4<f32>(radiance, 1.0);
}