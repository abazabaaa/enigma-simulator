#!/usr/bin/env python3
"""Batch adapter for py-enigma 1.0.2 (Brian Neal, MIT, https://pypi.org/project/py-enigma/).

tools/oracles/generate.mjs runs this script with the interpreter that has py-enigma installed: the
git-ignored venv at tools/oracles/.venv if it exists, otherwise python3 (CI runs
`pip install py-enigma==1.0.2`). It uses the same JSON Lines protocol as ref_batch.py:

  stdin   one batch per line: a JSON array of cases {id, config, plaintext}
  stdout  one line per batch: {"oracle", "version", "results": [...]}, where each result is
          {id, ciphertext, finalPositions}, or {id, unsupported: code, detail} for a case py-enigma
          cannot represent (code is 'reflector', 'plugboard' or 'rotor')

    python3 tools/oracles/py_batch.py --version    # prints the installed version; exit 3 if missing

What py-enigma supports is read from the library itself, never hard-coded here:
  * reflectors: enigma.rotors.data.REFLECTORS holds B, C, B-Thin and C-Thin. UKW-A is absent, so
    Enigma I cases with UKW-A are reported as unsupported;
  * plugboard: enigma.plugboard.MAX_PAIRS is 10, the number of cables issued with a machine, so cases
    with 11-13 pairs are reported as unsupported;
  * rotors: enigma.rotors.data.ROTORS holds I-VIII, Beta and Gamma.
Only the documented key-sheet API is used: EnigmaMachine.from_key_sheet, set_display, key_press and
get_display.
"""
from __future__ import annotations

import json
import sys

ORACLE = 'pyEnigma'
DIST = 'py-enigma'

try:
    from importlib.metadata import PackageNotFoundError, version

    from enigma.machine import EnigmaMachine
    from enigma.plugboard import MAX_PAIRS
    from enigma.rotors.data import REFLECTORS, ROTORS
except ImportError as exc:  # pragma: no cover - exercised only when py-enigma is missing
    print('py-enigma is not importable by %s (%s).\n'
          'Install it with: cd tools/oracles && npm run setup:py\n'
          '            or: pip install py-enigma==1.0.2' % (sys.executable, exc), file=sys.stderr)
    sys.exit(3)

try:
    VERSION = version(DIST)
except PackageNotFoundError:  # pragma: no cover
    VERSION = 'unknown'

# The engine's reflector names -> py-enigma's names. 'A' maps to itself and is then absent from
# REFLECTORS, which marks those cases as unsupported.
REFLECTOR_NAMES = {'A': 'A', 'B': 'B', 'C': 'C', 'B-thin': 'B-Thin', 'C-thin': 'C-Thin'}


def unsupported(config: dict) -> tuple[str, str] | None:
    """(code, detail) when py-enigma cannot represent this configuration, else None."""
    reflector = REFLECTOR_NAMES.get(config['reflector'], config['reflector'])
    if reflector not in REFLECTORS:
        return 'reflector', 'UKW %s is not in py-enigma (it has %s)' % (
            config['reflector'], ', '.join(sorted(REFLECTORS)))
    if len(config['plugboard']) > MAX_PAIRS:
        return 'plugboard', '%d plugboard pairs > py-enigma MAX_PAIRS (%d)' % (len(config['plugboard']), MAX_PAIRS)
    missing = [r for r in config['rotors'] if r not in ROTORS]
    if missing:
        return 'rotor', 'rotors %s are not in py-enigma' % ' '.join(missing)
    return None


def run_case(case: dict) -> dict:
    config = case['config']
    skip = unsupported(config)
    if skip:
        return {'id': case['id'], 'unsupported': skip[0], 'detail': skip[1]}
    machine = EnigmaMachine.from_key_sheet(
        rotors=list(config['rotors']),
        ring_settings=[ord(r) - ord('A') for r in config['rings']],
        reflector=REFLECTOR_NAMES[config['reflector']],
        plugboard_settings=' '.join(config['plugboard']) or None,
    )
    machine.set_display(''.join(config['positions']))
    ciphertext = ''.join(machine.key_press(ch) for ch in case['plaintext'])
    return {'id': case['id'], 'ciphertext': ciphertext, 'finalPositions': machine.get_display()}


def main(argv: list[str]) -> int:
    if '--version' in argv:
        print(json.dumps({'oracle': ORACLE, 'version': VERSION, 'python': sys.executable}))
        return 0
    for line in sys.stdin:
        if not line.strip():
            continue
        batch = json.loads(line)
        results = [run_case(case) for case in batch]
        sys.stdout.write(json.dumps({'oracle': ORACLE, 'version': VERSION, 'results': results}) + '\n')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
