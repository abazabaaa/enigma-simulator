/**
 * The 65 doubled indicators of one day (PLAN §4.3 F20): Christensen, "Polish Mathematicians Finding Patterns in
 * Enigma Messages" (Mathematics Magazine), from Bauer; https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf
 *
 * Transcribed VERBATIM, in the source's order, as six-letter strings (the source writes 'AUQ AMN'). That includes
 * 'SYZSCW' (the 63rd), which contradicts the four copies of 'SYXSCW': both send the 3rd letter to W, so CF would
 * map Z→W and X→W. `products()` reports it in `conflicts` and resolves it by majority. The consistent majority
 * gives Rejewski's published products (vector 13):
 *   AD = (a)(bc)(dvpfkxgzyo)(eijmunqlht)(rw)(s)   10 10 2 2 1 1
 *   BE = (axt)(blfqveoum)(cgy)(d)(hjpswizrn)(k)   9 9 3 3 1 1
 *   CF = (abviktjgfcqny)(duzrehlxwpsmo)          13 13
 */
export const REJEWSKI_65: readonly string[] = Object.freeze([
  'AUQAMN', 'INDJHU', 'PVJFEG', 'SJMSPO', 'WTMRAO', 'BNHCHL', 'JWFMIC', 'QGALYB', 'SJMSPO', 'WTMRAO',
  'BCTCGJ', 'JWFMIC', 'QGALYB', 'SJMSPO', 'WTMRAO', 'CIKBZT', 'KHBXJV', 'RJLWPX', 'SUGSMF', 'WKIRKK',
  'DDBVDV', 'KHBXJV', 'RJLWPX', 'SUGSMF', 'XRSGNM', 'EJPIPS', 'LDRHDE', 'RJLWPX', 'TMNEBY', 'XRSGNM',
  'FBRKLE', 'LDRHDE', 'RJLWPX', 'TMNEBY', 'XOIGUK', 'GPBZSV', 'MAWUXP', 'RFCWQQ', 'TAAEXB', 'XYWGCP',
  'HNOTHD', 'MAWUXP', 'SYXSCW', 'USENWH', 'YPCOSQ', 'HNOTHD', 'NXDQTU', 'SYXSCW', 'VIIPZK', 'YPCOSQ',
  'HXVTTI', 'NXDQTU', 'SYXSCW', 'VIIPZK', 'ZZYYRA', 'IKGJKF', 'NLUQFZ', 'SYXSCW', 'VQZPVR', 'ZEFYOC',
  'IKGJKF', 'OBUDLZ', 'SYZSCW', 'VQZPVR', 'ZSJYWG',
])
