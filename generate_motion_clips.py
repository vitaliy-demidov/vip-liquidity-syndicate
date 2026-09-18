import os
import sys
import math
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

MEDIA_DIR = Path("/Users/vitalij/Downloads/контент разборы виральность/vip-liquidity-syndicate/media")
TEMP_DIR = MEDIA_DIR / "temp_frames"

WIDTH, HEIGHT = 1920, 1080
FPS = 60
DURATION_SEC = 3
TOTAL_FRAMES = FPS * DURATION_SEC

def ensure_temp_dir():
    if TEMP_DIR.exists():
        shutil.rmtree(TEMP_DIR)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)

def render_scene(img_path, output_mp4, cx_ratio, cy_ratio, max_zoom, name):
    print(f"Rendering {name}...")
    ensure_temp_dir()
    src = Image.open(img_path).convert("RGBA")
    sw, sh = src.size

    for f in range(TOTAL_FRAMES):
        t = f / TOTAL_FRAMES
        ease = 0.5 - 0.5 * math.cos(math.pi * t)
        scale = 1.0 + max_zoom * ease
        
        cx = sw * cx_ratio
        cy = sh * cy_ratio
        
        crop_w = sw / scale
        crop_h = sh / scale
        x1 = max(0, cx - crop_w / 2)
        y1 = max(0, cy - crop_h / 2)
        x2 = min(sw, x1 + crop_w)
        y2 = min(sh, y1 + crop_h)
        
        cropped = src.crop((int(x1), int(y1), int(x2), int(y2)))
        frame = cropped.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
        frame.convert("RGB").save(TEMP_DIR / f"frame_{f:04d}.png")
    
    cmd = [
        "/opt/homebrew/bin/ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", str(TEMP_DIR / "frame_%04d.png"),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-g", "5",
        "-keyint_min", "5",
        "-sc_threshold", "0",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        str(output_mp4)
    ]
    subprocess.run(cmd, check=True)
    print(f"{name} rendered successfully to {output_mp4}")

def main():
    s1 = MEDIA_DIR / "scene1_still.jpg"
    s2 = MEDIA_DIR / "scene2_still.jpg"
    s3 = MEDIA_DIR / "scene3_still.jpg"
    s4 = MEDIA_DIR / "scene4_still.jpg"
    
    render_scene(s1, MEDIA_DIR / "scene1_hook.mp4", 0.48, 0.58, 0.12, "Scene 1: Hook")
    render_scene(s2, MEDIA_DIR / "scene2_trust.mp4", 0.55, 0.60, 0.08, "Scene 2: Trust")
    render_scene(s3, MEDIA_DIR / "scene3_action.mp4", 0.38, 0.52, 0.10, "Scene 3: Action")
    render_scene(s4, MEDIA_DIR / "scene4_payout.mp4", 0.52, 0.48, 0.09, "Scene 4: Payout")
    
    # Master concat
    concat_list = MEDIA_DIR / "concat_list.txt"
    with open(concat_list, "w") as f:
        for i in range(1, 5):
            f.write(f"file 'scene{i}_{['hook','trust','action','payout'][i-1]}.mp4'\n")
            
    master_cmd = [
        "/opt/homebrew/bin/ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_list),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-g", "5",
        "-keyint_min", "5",
        "-sc_threshold", "0",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        str(MEDIA_DIR / "master_narrative_scrub.mp4")
    ]
    subprocess.run(master_cmd, check=True)
    if concat_list.exists():
        concat_list.unlink()
    if TEMP_DIR.exists():
        shutil.rmtree(TEMP_DIR)
    print("ALL 4 SCENES + MASTER SCRUB VIDEO GENERATED WITH GOP=5!")

if __name__ == "__main__":
    main()
