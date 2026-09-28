#!/usr/bin/env python3
"""Export the published Enigma test vectors to JSON for the TypeScript engine tests.

    python3 tools/export_vectors.py           # (re)write web/src/engine/__fixtures__/vectors.json
    python3 tools/export_vectors.py --check   # exit 1 if the committed JSON is stale

Every case is first re-verified with the independent oracle in tools/reference_enigma.py;
the export aborts if any published vector fails. Fields derived by the oracle rather than
quoted from a source (e.g. the ciphertext of a stepping case) are marked in `provenance`.

Case kinds (see web/src/engine/__tests__/vectors.test.ts for the TypeScript type):
  message      config + plaintext <-> ciphertext (+ finalPositions after the last key)
  stepping     config + plaintext, window positions after each key press
  rotor        a single rotor's forward mapping at a given ring/position
  equivalence  several configs that must produce identical output for `plaintext`
  property     a sweep for the Vitest suite to run (no-self-encryption, period)

Machine configs: rotors/rings/positions are listed LEFT to RIGHT (rightmost = fast rotor,
M4 Greek rotor first), rings and positions are letters (ring A = 01), plugboard is a list
of two-letter pairs.
"""
from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reference_enigma import VECTORS, check_vector  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'src', 'engine',
                   '__fixtures__', 'vectors.json')

COMMON = ('id', 'kind', 'title', 'source', 'notes')


def build_case(v: dict, derived: dict) -> dict:
    case = {k: v[k] for k in COMMON if k in v}
    kind = v['kind']
    if kind == 'message':
        case.update(config=v['config'], plaintext=v['plaintext'], ciphertext=v['ciphertext'],
                    finalPositions=derived['finalPositions'], provenance=v['provenance'])
    elif kind == 'stepping':
        case.update(config=v['config'], plaintext=v['plaintext'], ciphertext=derived['ciphertext'],
                    positionsAfterEachKey=v['expectedPositions'], provenance=v['provenance'])
    elif kind == 'rotor':
        case.update({k: v[k] for k in ('rotor', 'ring', 'position', 'direction', 'input', 'output')})
    elif kind == 'equivalence':
        case.update(configs=v['configs'], plaintext=v['plaintext'], ciphertext=derived['outputs'][0],
                    provenance=v['provenance'])
    elif kind == 'property':
        case.update(property=v['property'], description=v['description'], config=v['config'])
        for k in ('keypresses', 'expected'):
            if k in v:
                case[k] = v[k]
    else:
        raise ValueError('unknown kind ' + kind)
    return case


_SCALAR_LIST = re.compile(r'\[\s*((?:"[^"\n]*"|-?\d+)(?:,\s*(?:"[^"\n]*"|-?\d+))*)\s*\]')


def render(cases: list) -> str:
    text = json.dumps(cases, indent=2, ensure_ascii=False)
    # Keep short scalar arrays (rotors, rings, plug pairs, positions) on one line.
    text = _SCALAR_LIST.sub(lambda m: '[' + ', '.join(p.strip() for p in m.group(1).split(',')) + ']', text)
    return text + '\n'


def main(argv: list[str]) -> int:
    cases = []
    for v in VECTORS:
        ok, detail, derived = check_vector(v)
        if not ok:
            print('FAIL %s: %s -- refusing to export' % (v['id'], detail), file=sys.stderr)
            return 1
        cases.append(build_case(v, derived))
    text = render(cases)
    path = os.path.normpath(OUT)
    if '--check' in argv:
        try:
            with open(path, encoding='utf-8') as f:
                current = f.read()
        except FileNotFoundError:
            current = ''
        if current != text:
            print('STALE %s: run python3 tools/export_vectors.py' % path, file=sys.stderr)
            return 1
        print('OK %s is up to date (%d cases)' % (path, len(cases)))
        return 0
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print('wrote %d cases to %s' % (len(cases), path))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
