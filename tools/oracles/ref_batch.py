#!/usr/bin/env python3
"""Batch adapter for the in-repo reference oracle, tools/reference_enigma.py.

tools/oracles/generate.mjs runs this script. It imports reference_enigma.py through sys.path and never
modifies it.

Protocol (JSON Lines):
  stdin   one batch per line: a JSON array of cases {id, config, plaintext}, where config is
          {model, reflector, rotors, rings, positions, plugboard}. Rotors, rings and positions are
          listed LEFT to RIGHT. Rings and positions are letters, and the plugboard is a list of pairs.
  stdout  one line per batch: {"oracle", "version", "results": [...]}, where each result is
          {id, ciphertext, finalPositions, doubleSteps}.

The reference supports every model, rotor, reflector and plug count, so it never reports a case as
unsupported. doubleSteps counts the key presses on which the middle rotor stepped because of its OWN
notch (the double-step anomaly). generate.mjs uses it only for the coverage table.

    echo '[{"id":"x","config":{"model":"I","reflector":"B","rotors":["I","II","III"],
      "rings":["A","A","A"],"positions":["A","A","A"],"plugboard":[]},"plaintext":"AAAAA"}]' \\
      | python3 tools/oracles/ref_batch.py
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')))
import reference_enigma as ref  # noqa: E402

ORACLE = 'reference'
VERSION = 'tools/reference_enigma.py'


def run_case(case: dict) -> dict:
    e = ref.machine(case['config'])
    out = []
    double_steps = 0
    for ch in case['plaintext']:
        if e.rotors[-2].at_turnover():
            double_steps += 1
        out.append(e.key(ch))
    return {
        'id': case['id'],
        'ciphertext': ''.join(out),
        'finalPositions': e.window(),
        'doubleSteps': double_steps,
    }


def main() -> int:
    for line in sys.stdin:
        if not line.strip():
            continue
        batch = json.loads(line)
        results = [run_case(case) for case in batch]
        sys.stdout.write(json.dumps({'oracle': ORACLE, 'version': VERSION, 'results': results}) + '\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
