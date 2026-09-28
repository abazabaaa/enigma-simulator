#!/usr/bin/env python3
"""Independent, dependency-free reference implementation of the Enigma I / M3 / M4.

This is the oracle for the web app's TypeScript engine (web/src/engine). It is
deliberately small and written independently of the TypeScript code so that the
two can cross-check each other.

    python3 tools/reference_enigma.py      # prints PASS/FAIL lines, exits 1 on any FAIL

The published test vectors live in VECTORS below; tools/export_vectors.py turns
them into web/src/engine/__fixtures__/vectors.json for the Vitest suite.

Conventions (same as the research note "technical_and_historical_ground_truth.md"):
  * rotors are listed LEFT to RIGHT as the operator sees them; the RIGHTMOST rotor
    is the fast rotor; on the M4 the leftmost (4th) rotor is the Greek rotor
    (Beta/Gamma), which never steps;
  * letters are 0-indexed (A=0 .. Z=25); ring settings are letters (A = 01);
  * a key press first STEPS the rotors, then the current flows
    plugboard -> ETW -> right..left (-> Greek) -> reflector -> back -> ETW -> plugboard;
  * turnover letters are the letters visible in the WINDOW when the next key press
    carries the neighbouring rotor (Q for rotor I, i.e. the Q->R step carries).

Wiring sources: Cryptomuseum https://www.cryptomuseum.com/crypto/enigma/wiring.htm,
Rijmenants https://www.ciphermachinesandcryptology.com/en/enigmatech.htm,
Wikipedia https://en.wikipedia.org/wiki/Enigma_rotor_details (all three agree).
"""
from __future__ import annotations

import sys
from math import factorial

A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

# ---------------------------------------------------------------------------
# Sources quoted by the vectors (see the research note for the exact quotes)
# ---------------------------------------------------------------------------
SRC_WIKI_ROTORS = 'https://en.wikipedia.org/wiki/Enigma_rotor_details'
SRC_WIKI_ENIGMA = 'https://en.wikipedia.org/wiki/Enigma_machine'
SRC_WIKI_M4 = 'https://en.wikipedia.org/wiki/Enigma-M4'
SRC_WIKI_CRYPTANALYSIS = 'https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma'
SRC_RIJMENANTS = 'https://www.ciphermachinesandcryptology.com/en/enigmatech.htm'
SRC_RIJMENANTS_M4 = 'https://www.ciphermachinesandcryptology.com/en/m4project.htm'
SRC_CRYPTOMUSEUM_M4 = 'https://www.cryptomuseum.com/crypto/enigma/m4/index.htm'
SRC_1930 = 'https://cryptocellar.org/enigma/e-message-1930.html'
SRC_SARCNET = 'https://www.sarcnet.org/the-enigma-project.html'
SRC_PYENIGMA = 'https://py-enigma.readthedocs.io/en/latest/overview.html'
SRC_SCHARNHORST = 'https://www.cryptocellar.org/bgac/scharnhorst.html'
SRC_CHRISTENSEN = 'https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf'

# ---------------------------------------------------------------------------
# Wiring: rotor -> (wiring A..Z, turnover window letters)
# ---------------------------------------------------------------------------
ROTORS = {
    'I': ('EKMFLGDQVZNTOWYHXUSPAIBRCJ', 'Q'),
    'II': ('AJDKSIRUXBLHWTMCQGZNPYFVOE', 'E'),
    'III': ('BDFHJLCPRTXVZNYEIWGAKMUSQO', 'V'),
    'IV': ('ESOVPZJAYQUIRHXLNFTGKDCMWB', 'J'),
    'V': ('VZBRGITYUPSDNHLXAWMJQOFECK', 'Z'),
    'VI': ('JPGVOUMFYQBENHZRDKASXLICTW', 'ZM'),
    'VII': ('NZJHGRCXMYSWBOUFAIVLPEKQDT', 'ZM'),
    'VIII': ('FKQHTLXOCBJSPDZRAMEWNIUYGV', 'ZM'),
    'Beta': ('LEYJVCNIXWPBQMDRTAKZGFUHOS', ''),
    'Gamma': ('FSOKANUERHMBTIYCWLQPZXVGJD', ''),
}
REFLECTORS = {
    'A': 'EJMZALYXVBWFCRQUONTSPIKHGD',
    'B': 'YRUHQSLDPXNGOKMIEBFZCWVJAT',
    'C': 'FVPJIAOYEDRZXWGCTKUQSBNMHL',
    'B-thin': 'ENKQAUYWJICOPBLMDXZVFTHRGS',
    'C-thin': 'RDOBJNTKVEHMLFCWZAXGYIPSUQ',
}


def _index(x) -> int:
    """Letter ('A'..'Z') or 0-based int -> 0-based int."""
    return x if isinstance(x, int) else A.index(x)


class Rotor:
    def __init__(self, name: str, ring, pos):
        self.name = name
        self.wiring, self.turnovers = ROTORS[name]
        self.inverse = ''.join(A[self.wiring.index(c)] for c in A)
        self.ring = _index(ring)
        self.pos = _index(pos)

    def at_turnover(self) -> bool:
        # The notch sits on the alphabet ring, so the test uses the WINDOW letter.
        return A[self.pos] in self.turnovers

    def step(self) -> None:
        self.pos = (self.pos + 1) % 26

    def fwd(self, c: int) -> int:
        o = (self.pos - self.ring) % 26
        return (A.index(self.wiring[(c + o) % 26]) - o) % 26

    def bwd(self, c: int) -> int:
        o = (self.pos - self.ring) % 26
        return (A.index(self.inverse[(c + o) % 26]) - o) % 26


class Enigma:
    def __init__(self, rotors, rings, positions, reflector='B', plugboard=''):
        # rotors are listed LEFT to RIGHT; the rightmost is the fast rotor.
        self.rotors = [Rotor(n, rg, p) for n, rg, p in zip(rotors, rings, positions)]
        self.reflector = REFLECTORS[reflector]
        self.plugs = {c: c for c in A}
        pairs = plugboard.split() if isinstance(plugboard, str) else list(plugboard)
        for p in pairs:
            self.plugs[p[0]] = p[1]
            self.plugs[p[1]] = p[0]

    def window(self) -> str:
        return ''.join(A[r.pos] for r in self.rotors)

    def step(self) -> None:
        right, middle, left = self.rotors[-1], self.rotors[-2], self.rotors[-3]
        step_middle = right.at_turnover() or middle.at_turnover()  # 2nd term = double step
        step_left = middle.at_turnover()
        right.step()
        if step_middle:
            middle.step()
        if step_left:
            left.step()
        # On the M4 the Greek rotor (self.rotors[0] when there are 4) never steps.

    def encode(self, ch: str) -> str:
        """Send current through the machine WITHOUT stepping."""
        c = A.index(self.plugs[ch])        # plugboard, then ETW (identity on I/M3/M4)
        for r in reversed(self.rotors):    # right -> left (-> Greek rotor on M4)
            c = r.fwd(c)
        c = A.index(self.reflector[c])     # reflector
        for r in self.rotors:              # (Greek ->) left -> right
            c = r.bwd(c)
        return self.plugs[A[c]]            # ETW, plugboard, lamp

    def key(self, ch: str) -> str:
        self.step()                        # stepping happens BEFORE the current flows
        return self.encode(ch)

    def run(self, text: str) -> str:
        return ''.join(self.key(ch) for ch in text.upper() if ch in A)


# ---------------------------------------------------------------------------
# Published vectors (exported to JSON by tools/export_vectors.py)
# ---------------------------------------------------------------------------
def cfg(model, reflector, rotors, rings, positions, plugboard=''):
    return {
        'model': model,
        'reflector': reflector,
        'rotors': list(rotors),
        'rings': list(rings),
        'positions': list(positions),
        'plugboard': plugboard.split(),
    }


def machine(c) -> Enigma:
    return Enigma(c['rotors'], c['rings'], c['positions'], c['reflector'], c['plugboard'])


DEFAULT = cfg('I', 'B', ['I', 'II', 'III'], 'AAA', 'AAA')
PLUGS_1930 = 'AM FI NV PS TU WZ'
PLUGS_BARBAROSSA = 'AV BS CG DL FU HZ IN KM OW RX'
PLUGS_U264 = 'AT BL DF GJ HM NW OP QY RZ VX'
PLUGS_SCHARNHORST = 'AN EZ HK IJ LR MQ OT PV SW UX'
PUBLISHED_TEXT = {'plaintext': 'published', 'ciphertext': 'published', 'finalPositions': 'reference'}

VECTORS = [
    # --- whole messages -----------------------------------------------------
    dict(id='wikipedia-default-key', kind='message', source=SRC_WIKI_ROTORS,
         title='Default key: rotors I II III, UKW-B, rings AAA, start AAA',
         config=DEFAULT, plaintext='AAAAA', ciphertext='BDZGO', provenance=PUBLISHED_TEXT),
    dict(id='wikipedia-rings-bbb', kind='message', source=SRC_WIKI_ROTORS,
         title='Ring settings BBB (02 02 02), start AAA',
         config=cfg('I', 'B', ['I', 'II', 'III'], 'BBB', 'AAA'),
         plaintext='AAAAA', ciphertext='EWTYX', provenance=PUBLISHED_TEXT),
    dict(id='manual-1930-indicator', kind='message', source=SRC_1930,
         title='1930 manual: doubled indicator enciphered at the Grundstellung FOL',
         notes='Wheel order II I III, Ringstellung 24 13 22 = XMV, UKW-A, Stecker AM FI NV PS TU WZ.',
         config=cfg('I', 'A', ['II', 'I', 'III'], 'XMV', 'FOL', PLUGS_1930),
         plaintext='ABLABL', ciphertext='PKPJXI', provenance=PUBLISHED_TEXT),
    dict(id='manual-1930-body', kind='message', source=SRC_1930,
         title='1930 manual: message body at the message key ABL',
         notes='Q stands for CH and X for a full stop/space, per the manual.',
         config=cfg('I', 'A', ['II', 'I', 'III'], 'XMV', 'ABL', PLUGS_1930),
         plaintext='FEINDLIQEINFANTERIEKOLONNEBEOBAQTETXANFANGSUEDAUSGANGBAERWALDEXENDEDREIKMOSTWAERTSNEUSTADT',
         ciphertext='GCDSEAHUGWTQGRKVLFGXUCALXVYMIGMMNMFDXTGNVHVRMMEVOUYFZSLRHDRRXFJWCFHUHMUNZEFRDISIKBGPMYVXUZ',
         provenance=PUBLISHED_TEXT),
    dict(id='barbarossa-part-1', kind='message', source=SRC_SARCNET,
         title='Operation Barbarossa, 7 July 1941, part 1 (first 30 letters) at BLA',
         notes='Rotors II IV V, rings 02 21 12 = BUL, UKW-B, 10 plugs. Originally Franklin Heath sample messages.',
         config=cfg('I', 'B', ['II', 'IV', 'V'], 'BUL', 'BLA', PLUGS_BARBAROSSA),
         plaintext='AUFKLXABTEILUNGXVONXKURTINOWAX', ciphertext='EDPUDNRGYSZRCXNUYTPOMRMBOFKTBZ',
         provenance=PUBLISHED_TEXT),
    dict(id='barbarossa-part-2', kind='message', source=SRC_SARCNET,
         title='Operation Barbarossa, 7 July 1941, part 2 (first 30 letters) at LSD',
         config=cfg('I', 'B', ['II', 'IV', 'V'], 'BUL', 'LSD', PLUGS_BARBAROSSA),
         plaintext='DREIGEHTLANGSAMABERSIQERVORWAE', ciphertext='SFBWDNJUSEGQOBHKRTAREEZMWKPPRB',
         provenance=PUBLISHED_TEXT),
    dict(id='py-enigma-message-key', kind='message', source=SRC_PYENIGMA,
         title='py-enigma example: message key BLA enciphered at display WXC',
         config=cfg('I', 'B', ['II', 'IV', 'V'], 'BUL', 'WXC', PLUGS_BARBAROSSA),
         plaintext='BLA', ciphertext='KCH', provenance=PUBLISHED_TEXT),
    dict(id='py-enigma-body', kind='message', source=SRC_PYENIGMA,
         title='py-enigma example: message body at BLA',
         config=cfg('I', 'B', ['II', 'IV', 'V'], 'BUL', 'BLA', PLUGS_BARBAROSSA),
         plaintext='THEXRUSSIANSXAREXCOMINGX', ciphertext='NIBLFMYMLLUFWCASCSSNVHAZ',
         provenance=PUBLISHED_TEXT),
    dict(id='u264-m4', kind='message', source=SRC_RIJMENANTS_M4,
         title='Kriegsmarine M4, U-264 (Looks), 25 Nov 1942 (first 40 letters)',
         notes='Beta II IV I, UKW B-thin, rings AAAV, start VJNA.',
         config=cfg('M4', 'B-thin', ['Beta', 'II', 'IV', 'I'], 'AAAV', 'VJNA', PLUGS_U264),
         plaintext='VONVONJLOOKSJHFFTTTEINSEINSDREIZWOYYQNNS',
         ciphertext='NCZWVUSXPNYMINHZXMQXSFWXWLKJAHSHNMCOCCAK', provenance=PUBLISHED_TEXT),
    dict(id='scharnhorst', kind='message', source=SRC_SCHARNHORST,
         title="Scharnhorst's last signal, 26 Dec 1943 (double-notched rotors VI and VIII)",
         notes='Wheel order 368 = III VI VIII, rings AHM, UKW-B, Spruchschluessel UZV.',
         config=cfg('M3', 'B', ['III', 'VI', 'VIII'], 'AHM', 'UZV', PLUGS_SCHARNHORST),
         plaintext='STEUEREJTANAFJORDJANSTANDORTQUAAACCCVIERNEUNNEUNZWOFAHRTZWONULSMXXSCHARNHORSTHCO',
         ciphertext='YKAENZAPMSCHZBFOCUVMRMDPYCOFHADZIZMEFXTHFLOLPZLFGGBOTGOXGRETDWTJIQHLMXVJWKZUASTR',
         provenance=PUBLISHED_TEXT),
    # --- stepping -----------------------------------------------------------
    dict(id='wikipedia-normal-step', kind='stepping', source=SRC_WIKI_ROTORS,
         title='Normal stepping from AAU: AAV ABW ABX',
         config=cfg('I', 'B', ['I', 'II', 'III'], 'AAA', 'AAU'),
         plaintext='AAA', expectedPositions=['AAV', 'ABW', 'ABX'],
         provenance={'expectedPositions': 'published', 'ciphertext': 'reference'}),
    dict(id='wikipedia-double-step', kind='stepping', source=SRC_WIKI_ROTORS,
         title='Double step from ADU: ADV AEW BFX BFY',
         config=cfg('I', 'B', ['I', 'II', 'III'], 'AAA', 'ADU'),
         plaintext='AAAA', expectedPositions=['ADV', 'AEW', 'BFX', 'BFY'],
         provenance={'expectedPositions': 'published', 'ciphertext': 'reference'}),
    dict(id='rijmenants-double-step', kind='stepping', source=SRC_RIJMENANTS,
         title='Double step with rotors III II I from KDO: KDP KDQ KER LFS LFT LFU',
         config=cfg('I', 'B', ['III', 'II', 'I'], 'AAA', 'KDO'),
         plaintext='AAAAAA', expectedPositions=['KDP', 'KDQ', 'KER', 'LFS', 'LFT', 'LFU'],
         provenance={'expectedPositions': 'published', 'ciphertext': 'reference'}),
    # --- single rotor (unit level) -------------------------------------------
    dict(id='wikipedia-rotor-I-ring-A', kind='rotor', source=SRC_WIKI_ROTORS,
         title='Rotor I at position A, ring A: A -> E (forward, single rotor)',
         rotor='I', ring='A', position='A', direction='forward', input='A', output='E'),
    dict(id='wikipedia-rotor-I-ring-B', kind='rotor', source=SRC_WIKI_ROTORS,
         title='Rotor I at position A, ring B (02): A -> K (forward, single rotor)',
         rotor='I', ring='B', position='A', direction='forward', input='A', output='K'),
    # --- equivalences ---------------------------------------------------------
    dict(id='m4-beta-bthin-equals-m3-b', kind='equivalence', source=SRC_CRYPTOMUSEUM_M4,
         title='M4 with Beta at A (ring A) and UKW B-thin equals a 3-rotor machine with UKW-B',
         notes='Also stated in ' + SRC_WIKI_M4 + '. AAAAA must still give BDZGO.',
         configs=[cfg('M4', 'B-thin', ['Beta', 'I', 'II', 'III'], 'AAAA', 'AAAA'),
                  cfg('M3', 'B', ['I', 'II', 'III'], 'AAA', 'AAA')],
         plaintext='AAAAAHELLOWORLD', provenance={'equivalence': 'published', 'ciphertext': 'reference'}),
    dict(id='m4-gamma-cthin-equals-m3-c', kind='equivalence', source=SRC_WIKI_M4,
         title='M4 with Gamma at A (ring A) and UKW C-thin equals a 3-rotor machine with UKW-C',
         notes='Exercised with rings, plugs and double-notched rotors so every stage is covered.',
         configs=[cfg('M4', 'C-thin', ['Gamma', 'III', 'VI', 'VIII'], 'AAHM', 'AUZV', PLUGS_SCHARNHORST),
                  cfg('M3', 'C', ['III', 'VI', 'VIII'], 'AHM', 'UZV', PLUGS_SCHARNHORST)],
         plaintext='DERFUEHRERISTTOTXDERKAMPFGEHTWEITER',
         provenance={'equivalence': 'published', 'ciphertext': 'reference'}),
    # --- properties -------------------------------------------------------------
    dict(id='no-self-encryption-sweep', kind='property', property='no-self-encryption',
         source=SRC_WIKI_ENIGMA,
         title='No letter ever enciphers to itself (2000 consecutive positions x 26 letters)',
         description=('Start from the config, press a key 2000 times; at every rotor position reached '
                      '(after stepping), each of the 26 letters must encipher to a different letter.'),
         config=DEFAULT, keypresses=2000),
    dict(id='period-16900', kind='property', property='period', source=SRC_WIKI_ENIGMA,
         title='Rotors I II III have a stepping period of 26 x 25 x 26 = 16,900 (not 17,576)',
         description='Press keys from AAA until the window shows AAA again; count the key presses.',
         config=DEFAULT, expected=16900),
]


def _compute(v):
    """Compute derived fields (ciphertext/positions) for a vector with the oracle."""
    kind = v['kind']
    if kind == 'message':
        e = machine(v['config'])
        return {'ciphertext': e.run(v['plaintext']), 'finalPositions': e.window()}
    if kind == 'stepping':
        e = machine(v['config'])
        out, seen = [], []
        for ch in v['plaintext']:
            out.append(e.key(ch))
            seen.append(e.window())
        return {'ciphertext': ''.join(out), 'positions': seen}
    if kind == 'rotor':
        r = Rotor(v['rotor'], v['ring'], v['position'])
        f = r.fwd if v['direction'] == 'forward' else r.bwd
        return {'output': A[f(A.index(v['input']))]}
    if kind == 'equivalence':
        return {'outputs': [machine(c).run(v['plaintext']) for c in v['configs']]}
    if kind == 'property' and v['property'] == 'no-self-encryption':
        e = machine(v['config'])
        for _ in range(v['keypresses']):
            e.step()
            for ch in A:
                if e.encode(ch) == ch:
                    return {'ok': False, 'where': e.window() + ':' + ch}
        return {'ok': True}
    if kind == 'property' and v['property'] == 'period':
        e = machine(v['config'])
        start, n = e.window(), 0
        while True:
            e.step()
            n += 1
            if e.window() == start:
                return {'period': n}
    raise ValueError('unknown vector kind: %r' % kind)


def check_vector(v):
    """Return (ok, detail, derived) for one vector."""
    d = _compute(v)
    kind = v['kind']
    if kind == 'message':
        back = machine(v['config']).run(v['ciphertext'])
        ok = d['ciphertext'] == v['ciphertext'] and back == v['plaintext']
        detail = d['ciphertext'] if ok else 'got %s / back %s' % (d['ciphertext'], back)
    elif kind == 'stepping':
        ok = d['positions'] == v['expectedPositions']
        detail = ' '.join(d['positions'])
    elif kind == 'rotor':
        ok = d['output'] == v['output']
        detail = '%s -> %s' % (v['input'], d['output'])
    elif kind == 'equivalence':
        ok = len(set(d['outputs'])) == 1
        detail = ' == '.join(d['outputs'])
    elif v['property'] == 'no-self-encryption':
        ok = d['ok']
        detail = 'no fixed point' if ok else 'fixed point at ' + d['where']
    else:
        ok = d['period'] == v['expected']
        detail = 'period %d' % d['period']
    return ok, detail, d


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------
_failures = 0


def report(label, ok, detail):
    global _failures
    if not ok:
        _failures += 1
    print(('PASS ' if ok else 'FAIL ') + label + ': ' + detail)


def check(label, got, expected):
    report(label, got == expected, str(got) + ('' if got == expected else '  expected ' + str(expected)))


def plugboard_settings(leads: int) -> int:
    """26! / ((26 - 2L)! L! 2^L) -- Wikipedia, Cryptanalysis of the Enigma."""
    return factorial(26) // (factorial(26 - 2 * leads) * factorial(leads) * 2 ** leads)


def partitions(n: int, m: int | None = None) -> int:
    if m is None:
        m = n
    if n == 0:
        return 1
    return sum(partitions(n - k, k) for k in range(1, min(n, m) + 1))


def cycle_string(mapping: dict, order: str) -> str:
    seen, out = set(), []
    for k in order:
        if k in seen:
            continue
        cyc, n = [k], mapping[k]
        seen.add(k)
        while n != k:
            cyc.append(n)
            seen.add(n)
            n = mapping[n]
        out.append('(' + ''.join(cyc) + ')')
    return ''.join(out)


def main() -> int:
    # Every published vector (message, stepping, rotor, equivalence, property).
    for v in VECTORS:
        ok, detail, _ = check_vector(v)
        report(v['id'], ok, detail)

    # Stepping happens BEFORE encoding: one key press from ADU shows ADV (not AEV).
    e = Enigma(['I', 'II', 'III'], 'AAA', 'ADU')
    e.key('A')
    check('one key press from ADU shows', e.window(), 'ADV')

    # Rule check: double-notched rotor VIII on the right carries at both Z->A and M->N.
    e = Enigma(['I', 'II', 'VIII'], 'AAA', 'AAY')
    seq = []
    for _ in range(16):
        e.step()
        seq.append(e.window())
    check('rotor VIII double notch from AAY', ' '.join(seq),
          'AAZ ABA ABB ABC ABD ABE ABF ABG ABH ABI ABJ ABK ABL ABM ACN ACO')

    # Key-space arithmetic (Wikipedia, Cryptanalysis of the Enigma; Rijmenants; Christensen).
    check('plugboard, 6 leads', plugboard_settings(6), 100_391_791_500)
    check('plugboard, 10 leads', plugboard_settings(10), 150_738_274_937_250)
    check('plugboard, 11 leads (maximum)', max(range(14), key=plugboard_settings), 11)
    check('plugboard, 13 leads', plugboard_settings(13), 7_905_853_580_625)
    check('60 x 17576 x pb(10)', 60 * 17576 * plugboard_settings(10), 158_962_555_217_826_360_000)
    check('... x 676 ring settings', 60 * 17576 * 676 * plugboard_settings(10),
          107_458_687_327_250_619_360_000)
    check('6 wheel orders x 17576 positions', 6 * 17576, 105_456)
    check('partitions of 13 (possible cycle types of AD)', partitions(13), 101)

    # Rejewski's theorem toy example, composing LEFT to RIGHT (apply X, then Y).
    X = {'a': 'b', 'b': 'a', 'c': 'd', 'd': 'c', 'e': 'f', 'f': 'e'}
    Y = {'b': 'c', 'c': 'b', 'd': 'e', 'e': 'd', 'f': 'a', 'a': 'f'}
    XY = {k: Y[X[k]] for k in X}
    check('toy (ab)(cd)(ef)(bc)(de)(fa)', cycle_string(XY, 'abcdef'), '(ace)(bfd)')

    # Christensen's AD recovered from 65 indicators (source: SRC_CHRISTENSEN).
    AD = 'ACBVIKZTJMXHUQDFLWSENPRGOY'
    ad = {A[i].lower(): AD[i].lower() for i in range(26)}
    check('Christensen AD cycles', cycle_string(ad, A.lower()),
          '(a)(bc)(dvpfkxgzyo)(eijmunqlht)(rw)(s)')

    print('%d failure(s)' % _failures if _failures else 'ALL PASS')
    return 1 if _failures else 0


if __name__ == '__main__':
    sys.exit(main())
