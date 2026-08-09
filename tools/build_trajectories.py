#!/usr/bin/env python3
"""Extracts N example trajectories per task from gemini-2.5-flash eval results,
resizes the associated stimulus images for the web, and writes a JSON manifest
consumed by trajectories.html.

Run from anywhere; paths are resolved relative to this file.
"""
import json
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[4]
RESULTS_DIR = REPO_ROOT / "results"
SITE_DIR = Path(__file__).resolve().parents[1]
IMG_OUT_DIR = SITE_DIR / "static" / "trajectories"
DATA_OUT = SITE_DIR / "static" / "data" / "trajectories.json"

MODEL = "gemini-2.5-flash"
N_EXAMPLES = 10
MAX_WIDTH_SINGLE = 900
MAX_WIDTH_PAIR = 1400
JPEG_QUALITY = 78

# (folder, version, code, label, kind) — order matches the leaderboard columns.
TASKS = [
    ("Spatial_Scene_Understanding", "V2.0", "SU", "Spatial Understanding", "single"),
    ("Traffic_sign_localization", "V7.0", "TSG", "Traffic Sign Grounding", "single"),
    ("Temporal_ordering", "V2.0", "TO", "Temporal Ordering", "pair"),
    ("Region_based_Traffic_sign_recognition", "V11.0", "TSR+S", "Traffic Sign Recognition (+Spatial)", "single"),
    ("RefExp", "V3.0", "RED", "Referring Expression Detection", "single"),
    ("Traffic_sign_recognition", "V6.0", "TSR", "Traffic Sign Recognition", "single"),
    ("Bicycle_lane_prediction", "V3.0", "LR", "Lane Recognition", "single"),
    ("Sign_action_association", "V3.0", "SAA", "Sign-Action Association", "single"),
]


def resize_and_save(src: Path, dst: Path, max_width: int) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = im.convert("RGB")
        if im.width > max_width:
            ratio = max_width / im.width
            im = im.resize((max_width, round(im.height * ratio)), Image.LANCZOS)
        im.save(dst, "JPEG", quality=JPEG_QUALITY, optimize=True)


def main() -> None:
    manifest = []
    for folder, version, code, label, kind in TASKS:
        task_dir = RESULTS_DIR / folder / version
        results_path = task_dir / MODEL / "eval_results_judged.json"
        image_inputs_dir = task_dir / "image_inputs"
        entries = json.loads(results_path.read_text())
        entries = sorted(entries, key=lambda e: e["question_index"])[:N_EXAMPLES]

        slug = folder.lower()
        examples = []
        for e in entries:
            qi = e["question_index"]
            out_rel_dir = f"static/trajectories/{slug}"

            if kind == "pair":
                src = image_inputs_dir / f"{qi}.png"
                out_name = f"{qi}.jpg"
                resize_and_save(src, SITE_DIR / out_rel_dir / out_name, MAX_WIDTH_PAIR)
                images = [f"{out_rel_dir}/{out_name}"]
            else:
                src = image_inputs_dir / f"{qi}_{e['filename']}"
                out_name = f"{qi}.jpg"
                resize_and_save(src, SITE_DIR / out_rel_dir / out_name, MAX_WIDTH_SINGLE)
                images = [f"{out_rel_dir}/{out_name}"]

            predicted_choice = e.get("predicted_choice")
            if predicted_choice not in e["choices"] and e.get("pred_choice") in e["choices"]:
                predicted_choice = e["pred_choice"]

            examples.append({
                "index": qi,
                "images": images,
                "question": e["question"],
                "choices": e["choices"],
                "gt_answer": e["gt_answer"],
                "predicted_choice": predicted_choice,
                "predicted_answer": e.get("predicted_answer_string", ""),
                "correct": bool(e["correct"]),
            })

        manifest.append({"code": code, "label": label, "slug": slug, "examples": examples})
        print(f"{code:6s} {label:38s} -> {len(examples)} examples")

    DATA_OUT.parent.mkdir(parents=True, exist_ok=True)
    DATA_OUT.write_text(json.dumps(manifest, indent=2))
    print(f"\nWrote {DATA_OUT}")


if __name__ == "__main__":
    main()
