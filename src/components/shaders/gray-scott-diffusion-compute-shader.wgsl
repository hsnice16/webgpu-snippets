@group(0) @binding(0)
var tex_src: texture_storage_2d<rg32float, read>;

@group(0) @binding(1)
var tex_dst: texture_storage_2d<rg32float, write>;

@group(0) @binding(2)
var<uniform> draw_pos: vec3<f32>;

const image_size: i32 = 1024;

struct ComputeInput {
  @builtin(global_invocation_id) id: vec3<u32>,
};

@compute @workgroup_size(16, 16)
fn cs_main(in: ComputeInput) {
  var center_x: i32 = i32(in.id.x);
  var center_y: i32 = i32(in.id.y);

  if (draw_pos.z > 0.5) {
    var radius: f32 = sqrt(
      (f32(center_x) - draw_pos.x) * 
      (f32(center_x) - draw_pos.x) + 
      (f32(center_y) - draw_pos.y) * 
      (f32(center_y) - draw_pos.y)
    );

    if (radius < 5.0) {
      textureStore(tex_dst, vec2i(in.id.xy), vec4<f32>(0.0, 1.0, 0.0, 0.0));
      return;
    }
  }

  var data: vec2<f32> = vec2<f32>(0.0, 0.0);

  for (var y = -1; y <= 1; y++) {
    var access_y: i32 = center_y + y;

    if (access_y < 0) {
      access_y = image_size - 1;
    } else if (access_y >= image_size) {
      access_y = 0;
    }

    for (var x = -1; x <= 1; x++) {
      var access_x: i32 = center_x + x;

      if (access_x < 0) {
        access_x = image_size - 1;
      } else if (access_x >= image_size) {
        access_x = 0;
      }

      var rate = -1.0;

      if (x == 0 && y == 0) {
        rate = -1.0;
      } else if (x == 0 || y == 0) {
        rate = 0.2;
      } else {
        rate = 0.05;
      }

      data += textureLoad(tex_src, vec2i(access_x, access_y)).rg * rate;
    }
  }

  const f: f32 = 0.055;
  const k: f32 = 0.062;
  var original: vec2<f32> = textureLoad(tex_src, in.id.xy).rg;

  data = original + vec2<f32>(
    data.x - original.x * original.y * original.y + f * (1.0 - original.x),
    data.y * 0.5 + original.x * original.y * original.y - (k + f) * original.y
  );

  textureStore(tex_dst, vec2i(in.id.xy), vec4<f32>(data, 0.0, 0.0));
}