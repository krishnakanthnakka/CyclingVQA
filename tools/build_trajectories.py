#!/usr/bin/env python3
"""Extracts N example trajectories per task, across all leaderboard models, from
the merged eval results, resizes the associated stimulus images for the web, and
writes JSON manifests consumed by trajectories.html.

Source of truth per task: results/<task>/<version>/merged_eval_results_judged.json
— a dict keyed by question_index, each entry holding every model's prediction
for that question (predicted_choice letter + full reasoning "cot").

Run from anywhere; paths are resolved relative to this file.
"""
import json
import re
from pathlib import Path

from PIL import Image

LETTER_PREFIX_RE = re.compile(r"^[A-Za-z][.):,-]\s*")


def normalize(s: str) -> str:
    return " ".join(s.lower().split())


def extract_reasoning(mp: dict, choice_text: str) -> str:
    """Prefer the explicit thinking trace ('cot'); most Instruct-type models
    leave it blank and instead fold a short justification into 'answer' right
    after the letter, e.g. "B, because the sign …" — use that as a fallback,
    but drop it if all that's left after the letter is just the choice text
    restated (no actual added reasoning)."""
    cot = (mp.get("cot") or "").strip()
    if len(cot) > 1:
        return cot

    answer = (mp.get("answer") or "").strip()
    stripped = LETTER_PREFIX_RE.sub("", answer, count=1).strip()
    if not stripped or normalize(stripped) == normalize(choice_text):
        return ""
    return stripped

REPO_ROOT = Path(__file__).resolve().parents[4]
RESULTS_DIR = REPO_ROOT / "results"
SITE_DIR = Path(__file__).resolve().parents[1]
IMG_OUT_DIR = SITE_DIR / "static" / "trajectories"
DATA_DIR = SITE_DIR / "static" / "data"

N_EXAMPLES = 10  # bump (or set to None for "all") once image hosting is sorted
MAX_WIDTH_SINGLE = 900
MAX_WIDTH_PAIR = 1400
JPEG_QUALITY = 78
MAX_REASONING_CHARS = 2000

# (folder, version, code, label) — order matches the leaderboard columns.
TASKS = [
    ("Spatial_Scene_Understanding", "V2.0", "SU", "Spatial Understanding"),
    ("Traffic_sign_localization", "V7.0", "TSG", "Traffic Sign Grounding"),
    ("Temporal_ordering", "V2.0", "TO", "Temporal Ordering"),
    ("Region_based_Traffic_sign_recognition", "V11.0", "TSR+S", "Traffic Sign Recognition (+Spatial)"),
    ("RefExp", "V3.0", "RED", "Referring Expression Detection"),
    ("Traffic_sign_recognition", "V6.0", "TSR", "Traffic Sign Recognition"),
    ("Bicycle_lane_prediction", "V3.0", "LR", "Lane Recognition"),
    ("Sign_action_association", "V3.0", "SAA", "Sign-Action Association"),
]

# folder/model key in results/ -> (display name matching the leaderboard, group, rank)
MODELS = {
    "gemini-2.5-flash": ("Gemini-2.5-Flash", "proprietary", 1),
    "gpt-5.1": ("GPT-5.1", "proprietary", 2),
    "Qwen3-VL-8B-Instruct": ("Qwen3-VL (8B)", "generalist", 3),
    "Ovis2.5-9B": ("Ovis2.5-9B", "generalist", 4),
    "Perception-LM-8B": ("PerceptionLM (8B)", "spatial", 5),
    "InternVL3_5-8B": ("InternVL3.5-8B", "generalist", 6),
    "Ovis2.5-2B": ("Ovis2.5-2B", "generalist", 7),
    "Qwen3-VL-2B-Instruct": ("Qwen3-VL (2B)", "generalist", 8),
    "Cosmos-Reason2-8B": ("Cosmos-Reason2", "driving", 9),
    "SenseNova-SI-1.1-InternVL3-8B": ("SenseNova", "spatial", 13),
    "Perception-LM-3B": ("PerceptionLM (3B)", "spatial", 16),
    "Eagle2.5-8B": ("Eagle2.5-8B", "generalist", 12),
    "Phi-4-multimodal-instruct": ("Phi-4", "generalist", 14),
    "InternVL3-8B": ("InternVL3", "generalist", 15),
    "InternVL3_5-2B": ("InternVL3.5-2B", "generalist", 17),
    "Qwen2.5-VL-7B-Instruct": ("Qwen2.5-VL", "generalist", 18),
    "Qwen2_5vl-7b-fm-tuned": ("FoundationMotion", "generalist", 19),
    "DriveLMMo1": ("DriveLMMo1", "driving", 20),
    "VST-7B-RL": ("VST", "spatial", 21),
    "Molmo2-8B": ("Molmo2-8B", "generalist", 22),
    "Cosmos-Reason1-7B": ("Cosmos-Reason1", "driving", 23),
    "llava-onevision-qwen2-7b-si-hf": ("LLaVA-OneVision", "generalist", 24),
    "ReCogDrive-VLM-DriveLM": ("ReCogDrive", "driving", 25),
    "DriveMM": ("DriveMM", "driving", 26),
    "SpatialReasoner": ("SpatialReasoner", "spatial", 27),
    "llama3-llava-next-8b-hf": ("LLaVA-Next", "generalist", 28),
    "dolphins": ("Dolphins", "driving", 30),
    "llava-v1.6-mistral-7b-hf": ("LLaVA-1.6", "generalist", 29),
    "SpatialThinker-7B": ("SpatialThinker", "spatial", 11),
}

DEFAULT_SELECTED = {
    "gemini-2.5-flash", "gpt-5.1", "Qwen3-VL-8B-Instruct",
    "Ovis2.5-9B", "Perception-LM-8B", "Cosmos-Reason2-8B",
}

GROUP_LABELS = {
    "proprietary": "Proprietary VLMs",
    "generalist": "Generalist VLMs",
    "spatial": "Spatial-Aware VLMs",
    "driving": "Driving-Centric VLMs",
}


def resize_and_save(src: Path, dst: Path, max_width: int) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = im.convert("RGB")
        if im.width > max_width:
            ratio = max_width / im.width
            im = im.resize((max_width, round(im.height * ratio)), Image.LANCZOS)
        im.save(dst, "JPEG", quality=JPEG_QUALITY, optimize=True)


def letter_to_index(letter):
    if not letter or len(letter) != 1 or not letter.isalpha():
        return None
    idx = ord(letter.upper()) - ord("A")
    return idx


def build_models_json():
    models = [
        {"key": key, "display": display, "group": group, "rank": rank, "default": key in DEFAULT_SELECTED}
        for key, (display, group, rank) in MODELS.items()
    ]
    models.sort(key=lambda m: m["rank"])
    groups = [{"key": g, "label": label} for g, label in GROUP_LABELS.items()]
    return {"models": models, "groups": groups}


def main():
    manifest = []
    for folder, version, code, label in TASKS:
        task_dir = RESULTS_DIR / folder / version
        merged = json.loads((task_dir / "merged_eval_results_judged.json").read_text())
        image_inputs_dir = task_dir / "image_inputs"

        keys = sorted(merged.keys(), key=int)[:N_EXAMPLES]
        slug = folder.lower()

        examples = []
        for qk in keys:
            e = merged[qk]
            qi = e["question_index"]
            choices = e["choices"]
            gt_idx = letter_to_index(e["gt_choice"])
            gt_text = choices[gt_idx] if gt_idx is not None and gt_idx < len(choices) else e["gt_choice"]

            image_name = e["image_name_final"]
            src = image_inputs_dir / image_name
            out_name = f"{qi}.jpg"
            out_rel_dir = f"static/trajectories/{slug}"
            max_w = MAX_WIDTH_PAIR if folder == "Temporal_ordering" else MAX_WIDTH_SINGLE
            resize_and_save(src, SITE_DIR / out_rel_dir / out_name, max_w)

            predictions = {}
            for model_key in MODELS:
                mp = e["model_predictions"].get(model_key)
                if mp is None:
                    continue
                pred_letter = mp.get("predicted_choice") or mp.get("answer")
                pred_idx = letter_to_index(pred_letter)
                pred_text = choices[pred_idx] if pred_idx is not None and pred_idx < len(choices) else pred_letter
                reasoning = extract_reasoning(mp, pred_text or "")
                if len(reasoning) > MAX_REASONING_CHARS:
                    reasoning = reasoning[:MAX_REASONING_CHARS].rsplit(" ", 1)[0] + "…"
                predictions[model_key] = {
                    "choice": pred_text,
                    "correct": pred_idx is not None and pred_idx == gt_idx,
                    "reasoning": reasoning,
                }

            examples.append({
                "index": qi,
                "images": [f"{out_rel_dir}/{out_name}"],
                "question": e["question"],
                "choices": choices,
                "gt_answer": gt_text,
                "predictions": predictions,
            })

        manifest.append({"code": code, "label": label, "slug": slug, "examples": examples})
        print(f"{code:6s} {label:38s} -> {len(examples)} examples x {len(MODELS)} models")

    (DATA_DIR / "trajectories.json").write_text(json.dumps(manifest))
    (DATA_DIR / "models.json").write_text(json.dumps(build_models_json(), indent=2))
    print(f"\nWrote {DATA_DIR / 'trajectories.json'}")
    print(f"Wrote {DATA_DIR / 'models.json'}")


if __name__ == "__main__":
    main()
