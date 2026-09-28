/**
 * The gate's days (PLAN §4.4 II.7 `lookup`, `lookup-transfer`): 720 settings, spread evenly over the 11,638
 * settings of the UKW-A catalogue (6 orders of I, II, III; rings 01) whose card lists 2 to 5 settings, which are NOT
 * the first setting on their card, and whose card's first setting is not their double-step twin (a middle rotor on
 * its turnover steps with the left one at the first press, so e.g. II-I-III NQI and ORI encipher alike). So "take the
 * first card entry" never reads the day's traffic. Four base-36 digits per setting: orderIndex × 17,576 +
 * positionIndex (CATALOGUE_ORDERS, positionIndex in crypto/). __tests__/gates.test.ts rebuilds the catalogue and
 * re-derives every one of these properties.
 */
export const LOOKUP_CODES =
  '00fi028l03bo043d04t4057c05nx065s06q3076807rm085a08md094609g50a0t0afi0azp0bb60bhi0bo40bwb0c1z0c9y' +
  '0chs0cnz0cv50d1s0dew0doj0dxd0e8z0ei80epy0ewo0f3q0fau0fgq0fr30fvb0fzg0g6b0gd20gle0grd0gys0h5i0hbp' +
  '0hik0hmw0hst0hyt0i2l0i9e0ij40inj0itz0j1m0j7q0jdl0jht0jpa0jvu0k1s0k780kb00kf20kkk0kqb0kuz0kzl0l70' +
  '0lbv0liv0lq30lu80m0g0m8d0mbs0mgu0mln0mou0mu30myc0n290n5i0nas0nef0nhy0nnh0ntk0nxf0o0u0o4m0oao0oee' +
  '0oj80omu0osy0p2r0p4u0p950pcu0pfi0pk20pn00psk0pwr0q3g0q7n0qaq0qew0qkf0qrb0qvc0qzt0r4w0raa0rfx0rl4' +
  '0rns0rsi0s0r0s6d0sal0sgg0sn30sss0sxj0t5o0tap0tee0tlj0toj0tuh0tzu0u680u9k0udz0uik0uni0ur70uw00v03' +
  '0v350v7o0va70veh0vi50vmi0vqm0vtt0w0g0w4m0w8m0wcw0whh0wlh0wps0wvk0wxz0x2f0x770xed0xir0xmn0xsf0xw2' +
  '0xzt0y6a0yae0yda0yhb0yle0ypw0yuq0yxv0z260z510z740zb20zdj0zi30znq0zsh0zwm10111037107a10aj10g210jm' +
  '10mp10qa10sk10y0110q114u119g11cf11hu11lq11ol11rj11vc11zf122x127812az12g012j212n012pm12rb12uu12xz' +
  '1327135b138y13d813fx13jt13n813r213tj1413144m148314bh14ga14kr14n414pa14s414y5151z156s15b715gh15jk' +
  '15mn15r115x91610165p16a516dr16iw16lo16qo16tz16wf16zc173t178417c617fz17j617m517po17u917yq182o184c' +
  '188x18ce18ff18jg18lw18ow18u018wy190t195f197n19au19g919j719ld19pd19td19wa19zq1a361a7g1ab31afo1akc' +
  '1anu1arb1avk1axx1azx1b2f1b6l1bbv1bgv1blg1boj1btk1bw11c141c6d1c8p1cbh1cf31ci51clh1cp71csf1cvn1d00' +
  '1d2q1d671d8n1dcy1di31dkd1dn51dq51dve1e0m1e2a1e4b1e7b1ecb1eix1emp1eqc1esy1ew21ezu1f471f761faf1ff1' +
  '1fk31fmn1fpz1fuf1fyy1g1j1g4u1g7y1ga11gcn1gfk1gjg1gnf1gq71gu41gyw1h211h641ha11hdl1hhq1hjw1hmr1hp6' +
  '1hrf1huw1hzh1i291i531i831ib61ie31igq1iku1iny1irk1iu81iwt1iyp1j351j6g1j7t1jaw1jdu1jfp1jiu1jly1jov' +
  '1jr41jtu1jx91jzy1k2t1k511k7x1kb81kds1kfy1kig1kkm1knz1ksc1kud1ky61l0l1l481l8x1lcp1lgo1lls1lo71lq8' +
  '1ls81lv51lx01m0l1m2x1m5v1ma81mcl1meb1mgz1ml81mp91msd1mwn1mza1n111n461n8t1nb91nep1nim1nmi1noo1nrn' +
  '1nuz1ny41o1d1o3l1o5w1o8k1oaz1of41oi71ojx1on71oph1osw1owc1ozi1p1s1p6e1p961pcn1pg51pih1pls1po71pqq' +
  '1ptc1pxt1q0n1q3c1q611q8a1q9y1qdq1qhs1ql01qnl1qqk1qsz1qvn1qzb1r121r2t1r6k1r9q1rcu1reo1rjv1rn21rqm' +
  '1rsa1rua1rxu1s191s3v1s6a1s8g1sbq1ses1sj01skc1sm11soc1sqw1ssy1sve1sxy1t121t3q1t711ta21tcd1tgd1tih' +
  '1tkt1to71tqf1tsh1tvz1u071u1p1u491u6m1u981uca1uet1ugx1uk61um31up11uso1uum1uy31v0u1v3x1v6o1v9q1vc6' +
  '1vdj1vg21vi01vld1vp81vri1vtw1vvf1vxy1vzh1w0x1w4a1w6n1w9b1wbk1wfg1wgs1wj91wmv1wpm1wri1wtx1wvx1wzd' +
  '1x1z1x4p1x7l1xae1xcp1xe71xgs1xkl1xnn1xp71xrp1xu21xwy1xyc1xzk1y2z1y4m1y7t1yal1yce1yez1yit1yl01ynk' +
  '1yqy1ytl1yvw1yzs1z2w1z551z7u1zaf1zcm1zfb1zib1zlp1zpc1zrd1zt21zwc1zzf202m205w207a208n209s20bp20em' +
  '20gy20m420o620sq20vz20yp2117213r217y21a121c421ec21i321ls21oh21qn21sx21uh21x0220e222c225d227y229u' +
  '22bo22el22h122j822ld22nu22q122sl22u922yf230a233h236i239b23bj23ds23ft23ih23kr23on23r623td23uq23y9' +
  '2408242724502472248v24cp24fd24iv24lt24nq24pc24sc24uy24x024ze25222559257l25a325c625f425iw25la25nr' +
  '25pr25sb25tx25xz26082637266n269e26cw26fc26hu26k326p426rt26u226wg26z9271s274d277327bm27e427gz27jr' +
  '27nt27q227sa27uc27wl27zk28192839285c287s28ad28d728h828jm28m028pd28rd28uz28yn292g294j296r299c29b9'
