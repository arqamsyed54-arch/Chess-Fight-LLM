"""Overnight pipeline: label with Stockfish, distill into the net, gate, report.
Run in background: py -m chess_fight_llm.pipeline
Writes checkpoints/distilled/pipeline_DONE.json when finished.
"""
from __future__ import annotations
import json, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def run(args: list[str], log_path: str):
    with open(log_path, "a") as log:
        log.write(f"$ {' '.join(args)}\n")
        log.flush()
        p = subprocess.run([sys.executable, "-m"] + args, cwd=ROOT,
                           stdout=log, stderr=subprocess.STDOUT)
    return p.returncode


def main():
    t0 = time.perf_counter()
    os.makedirs("checkpoints/distilled", exist_ok=True)
    log = "checkpoints/distilled/pipeline.log"
    labels = "data/sf_labels.jsonl"
    have = os.path.exists(labels) and sum(1 for _ in open(labels, encoding="utf-8")) > 1000
    if not have:
        rc = run(["chess_fight_llm.label", "--games", "150", "--depth", "10",
                  "--out", labels], log)
        if rc != 0:
            json.dump({"status": "label-failed", "rc": rc}, open("checkpoints/distilled/pipeline_DONE.json", "w"))
            return
    else:
        with open(log, "a") as lg:
            lg.write("labels exist, skipping generation\n")
    rc = run(["chess_fight_llm.distill", "--data", "data/sf_labels.jsonl",
              "--epochs", "5", "--batch", "32", "--resume", "--out", "checkpoints/distilled"], log)
    gate = {}
    try:
        gate = json.load(open("checkpoints/distilled/gate.json"))
    except OSError:
        pass
    json.dump({"status": "done" if rc == 0 else "train-failed", "rc": rc,
               "hours": round((time.perf_counter() - t0) / 3600, 2), "gate": gate},
              open("checkpoints/distilled/pipeline_DONE.json", "w"), indent=1)


if __name__ == "__main__":
    main()
