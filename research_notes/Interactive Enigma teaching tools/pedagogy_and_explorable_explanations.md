# Pedagogy of interactive, story-driven, mastery-gated technical explanations (Enigma + its cryptanalysis)

Scope: evidence-backed design guidance for an interactive web experience that (a) tells the story of breaking Enigma, (b) uses a 3D machine to make the permutation/cycle calculations concrete, and (c) gates progression on demonstrated understanding. Audience: adult self-taught programmer who wants to understand the calculations (permutations, cycles, why the catalog/bombe work), not just play.

Context from the repo (`/home/user/enigma-simulator/BreakingEnigma.ipynb`): the existing NSA notebook already uses a ticking-clock "midnight at Bletchley, new day key" scenario; the learner builds the AD/BE/CF permutations from doubled message-key indicators, computes cycle lengths, looks up a precomputed catalog keyed like `AD:21212 BE:6810 CF:4688`, narrows 105,456 candidate settings to 2, and then recovers the plugboard from four test messages. The notebook explicitly admits the anachronism (Rejewski's method predates Bletchley). These notes are written so the guidance maps onto those phases.

---

## Key Question 1: What techniques do the best explorable explanations use?

### Takeaway
The strongest exemplars share a small toolkit: one mechanism per scene built up component-by-component; reader-driven time (scrub/step) rather than autoplay; colour-coded, dimmed/highlighted parts; "predict before reveal"; withholding the explanation until the reader has generated the data; and a capstone that uses everything learned. The field's own review (Hohman et al., Distill 2020) warns that empirical evaluation of interactive articles is thin and that "not everything needs to be interactive."

### Cited Findings

**Nicky Case's design rules (primary source)**
- "Use interactivity only when interactivity works best, otherwise, supplement it with text & images"; interactives are "Best at showing _processes_, systems, models." — [Nicky Case, Explorable Explanations (2014)](https://blog.ncase.me/explorable-explanations/)
- Start with a hook that "provides an overview, motivates the explorer, but doesn't require a lot of upfront knowledge." — [same](https://blog.ncase.me/explorable-explanations/)
- Break systems into smaller mechanics and teach each "in isolation first before combining them." — [same](https://blog.ncase.me/explorable-explanations/)
- "Let the explorer create their own data points, and form their own model." — [same](https://blog.ncase.me/explorable-explanations/)
- "By _withholding_ an explanation, the explorable explanation can be more effective" when it motivates learners to discover the concept themselves. — [same](https://blog.ncase.me/explorable-explanations/)
- The ending should require "knowledge the explorer's learnt throughout the explanation"; include "homework problems" ranging from explicit to implicit; "Remember to test your explanation with people." — [same](https://blog.ncase.me/explorable-explanations/)
- Four later patterns: (1) **Puzzle It Out** — puzzles with multiple solutions where "teaching" and "assessment" merge so players *prove* understanding before progressing (SineRider, District); (2) **Place Your Bets!** — reader predicts before the reveal (NYT "You Draw It", Birthday Paradox), justified via Strogatz's observation that teaching fails when it "answers questions the student hasn't thought to ask"; (3) **Role Play** — interactive narrative dilemmas; (4) **Sandbox Mode** — open simulation, which "risks cognitive overload," so introduce simulation elements gradually before full sandbox access. — [Nicky Case, 4 More Design Patterns (2018)](https://blog.ncase.me/explorable-explanations-4-more-design-patterns/)

**Bret Victor (primary source)**
- Three devices: *reactive documents* (adjust the author's assumptions, see consequences), *explorable examples* ("By watching the result change as we adjust parameters, we can develop an intuition for the system's behavior"), and *contextual information* (verify claims in place). Goal: turn text from "information to be consumed" into "an environment to think in." — [Bret Victor, Explorable Explanations (2011)](http://worrydream.com/ExplorableExplanations/)
- Critique: sandboxes where users "figure it out for yourself" are "not explanations"; the author must supply the argument, interactivity supports it. — [same](http://worrydream.com/ExplorableExplanations/)
- *Learnable Programming* principles relevant to an in-browser code gate: "read the vocabulary", "follow the flow" ("The computer traces a path through the code... We see none of this"), "see the state" ("We write with blindfolds..."), "create by reacting" ("an external imagination"), "create by abstracting" ("Start concrete, start grounded... Then gradually generalize, level by level"). Critique: "Live coding, as a standalone feature, misses the point" — instant output without visible flow/state is insufficient. — [Bret Victor, Learnable Programming (2012)](http://worrydream.com/LearnableProgramming/)

**Bartosz Ciechanowski (primary source, "Mechanical Watch")**
- Opens with a hook then immediately a manipulable 3D model: "You can drag the device around to change your viewing angle, and you can use the slider to peek at what's going on inside." — [Ciechanowski, Mechanical Watch](https://ciechanow.ski/mechanical-watch/)
- Builds the mechanism one subsystem at a time (Power → Gears → Escapement → Balance → Mainplate...), introducing each component's purpose before showing interactions; obscuring parts are temporarily removed; "the names and parts will be **color-coded** for easy reference." — [same](https://ciechanow.ski/mechanical-watch/)
- Reader controls time: "you can scrub back and forth in time to see all the action as it happens"; a global pause control exists for animation. — [same](https://ciechanow.ski/mechanical-watch/)
- No quizzes or checks; the article ends with further-reading resources. — [same](https://ciechanow.ski/mechanical-watch/)
- Third-party descriptions: his pages "prompt users to interact with elements, such as dragging objects... or adjusting parameters to see real-time changes"; no primary interview on his methodology was found. — [CSS-Tricks](https://css-tricks.com/bartosz-ciechanowskis-interactive-blog-posts/); [Patreon](https://www.patreon.com/ciechanowski)

**Red Blob Games (Amit Patel)**
- Patel states he learns best "combining language with visual elements and interaction," wanting to learn "by playing with things," using game-dev problems as motivating examples. — [Red Blob Games](https://www.redblobgames.com/); [Amit Patel home page](http://www-cs-students.stanford.edu/~amitp/)
- He prioritises "visual" projects "small enough to fit on a web page," "the math and algorithms" over tool tutorials, and "what's timeless instead of what's ephemeral." — [Digital Seams interview](https://digitalseams.com/blog/amit-patel-on-making-things)

**Distill "Communicating with Interactive Articles" (Hohman et al. 2020) — a research review of the technique space**
- Five affordances: connecting people and data (animation for "state transitions, uncertainty, causality"); making systems playful (in-browser simulations, multiple representations); prompting self-reflection ("You Draw It" prediction, embedded quizzes, spaced repetition); personalizing reading (user-paced segments); reducing cognitive load ("Overview first, zoom and filter, then details-on-demand", tooltips, mouseover-highlighted equation terms linked to prose). — [Hohman et al., Distill 2020](https://distill.pub/2020/communicating-with-interactive-articles/)
- Evidence cited: self-explanation prompts improve learning; Kim et al. showed visualization prompts "encourage readers to engage in self explanation and improve their recall"; testing effect and feedback on quiz responses enhance retention. Social-comparison overlays in "You Draw It" were *not* shown to improve recall. — [same](https://distill.pub/2020/communicating-with-interactive-articles/)
- **Scroll vs click:** McKenna et al. found no significant engagement difference between scroll-based (scrollytelling) and step-based (slideshow) layouts on desktop, while Zhi et al. found better *comprehension* with slideshows; mobile is understudied. — [same](https://distill.pub/2020/communicating-with-interactive-articles/)
- Caveats: "Limited empirical evaluation of the effectiveness of interactive articles"; authoring approaches "building a website"; "Not everything needs to be interactive"; archival fragility of web tech. The NYT anecdote that few readers interact was contradicted by follow-up research finding readers use interactivity "when it is core to article's message." — [same](https://distill.pub/2020/communicating-with-interactive-articles/)

**3Blue1Brown / Brilliant**
- Sanderson emphasises "emotion, wonder and imagination" over usefulness; the channel foregrounds "the process of discovery and inquiry-based learning in mathematics, which Sanderson calls 'inventing math'". — [Stanford Daily (2020)](https://stanforddaily.com/2020/01/24/3blue1brown-creator-grant-sanderson-15-talks-engaging-with-math-using-stories-and-visuals/); [Wikipedia, 3Blue1Brown](https://en.wikipedia.org/wiki/3Blue1Brown)
- Brilliant: "learn by doing"; lessons are sequences of small problems with immediate feedback, "in-lesson celebrations when learners enter the correct answer, and moments of encouragement when learners are struggling"; coverage reports that on a wrong answer "the app gently rolls back." Brilliant's "6x more effective" claim is marketing without a cited study. — [Brilliant About](https://brilliant.org/about/); [Brilliant FAQ](https://brilliant.org/faq/); [ustwo case study](https://ustwo.com/work/brilliant/); [TeachThought](https://www.teachthought.com/education-posts/new-tool-for-stem/)

### Inferences
- The exemplars converge on a *scene grammar* that maps directly onto a 3D Enigma: (1) hook with the whole machine manipulable (drag to orbit, slider to open the case); (2) isolate one component per scene (plugboard, one rotor, reflector, stepping mechanism) with everything else dimmed; (3) reader-controlled time (scrub the signal path letter-by-letter; step keypresses); (4) colour-code every part consistently and re-use the colours in the math notation (e.g., rotor I's colour = the permutation symbol R1 in equations); (5) withhold the punchline (e.g., do not state "no letter encrypts to itself" — let the learner search for a counterexample first).
- Ciechanowski-style articles have no gates; that is why they feel effortless and why they do not verify understanding. A gated experience should borrow his scene structure and add Case's "Puzzle It Out" and "Place Your Bets" patterns at scene boundaries.
- For a gated experience, **click/step-driven progression is the better default**: gates need discrete, addressable states; the only comparative evidence (Zhi et al. via Distill) favours steppers for comprehension; scroll can still be used *within* an expository scene.
- Bret Victor's "see the state / follow the flow" implies the 3D machine should double as the visualiser for any code the learner writes: when their `rotor_map()` runs, animate the path it produced through the 3D rotors, so the code gate and the mechanism are one view (a linked view), not two.

### Gaps
- No primary interview or write-up by Ciechanowski describing his design method was found; techniques above are inferred from the article itself and third-party coverage.
- Distill's review is the only systematic evidence summary found; comparative studies of specific patterns (dimming, colour-linking notation to parts) in interactive articles were not located beyond the cited Kim et al. and self-explanation literature.

---

## Key Question 2: What does learning-science literature say about the techniques?

### Takeaway
Active/constructive engagement, retrieval practice, prediction-before-reveal, worked-then-faded examples, segmented and signalled multimedia, and mastery criteria all have meta-analytic support with medium-to-large effects; the main caveats are that mastery-learning gains shrink on standardised (transfer) tests, animation helps only when it is representational, and narrative helps most when the story is about real people and does not add extraneous detail.

### Cited Findings

**Active learning**
- Freeman et al. (2014), meta-analysis of 225 studies in undergraduate STEM: exam/concept-inventory performance rose by 0.47 SD under active learning (n = 158 studies); odds ratio for failing under traditional lecture was 1.95 (n = 67 studies), i.e., students in lectures were 55% more likely to receive D/F/withdraw. — [Freeman et al. 2014, PNAS](https://www.pnas.org/doi/abs/10.1073/pnas.1319030111); [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC4060683)
- ICAP framework (Chi & Wylie 2014): engagement modes ordered Interactive > Constructive > Active > Passive; a systematic review supported that constructive activities (generating outputs beyond the given material) outperform merely active manipulation. — [Chi & Wylie 2014, Educational Psychologist](https://www.tandfonline.com/doi/abs/10.1080/00461520.2014.965823); [PDF](https://education.asu.edu/sites/g/files/litvpz656/files/lcl/chiwylie2014icap_2.pdf)

**Retrieval practice / testing effect**
- Roediger & Karpicke (2006): after studying prose passages, students who took recall tests (no feedback) vs restudied showed better retention on delayed tests (2 days, 1 week) even though restudy was better at 5 minutes. — [Roediger & Karpicke 2006, Psychological Science](https://journals.sagepub.com/doi/10.1111/j.1467-9280.2006.01693.x); review: [Roediger & Karpicke 2006, Perspectives on Psych Science (PDF)](http://psychnet.wustl.edu/memory/wp-content/uploads/2018/04/Roediger-Karpicke-2006_PPS.pdf)
- Distill's review notes that feedback on quiz responses enhances testing benefits and that spaced repetition improves recall when repeated over time. — [Hohman et al. 2020](https://distill.pub/2020/communicating-with-interactive-articles/)
- Quantum Country (embedded spaced-repetition prompts in an essay): after ~30 minutes of review practice most readers can answer almost all of the essay's 112 questions across intervals of at least 2 weeks; after an hour, at least 5 weeks; after 1.5 hours, at least 9 weeks; cost is a 35–50% reading-time overhead; in 2019H1 only 29% of readers who finished the in-text level completed the 1-month review level. — [Matuschak notes: Effects of the mnemonic medium](https://notes.andymatuschak.org/zt1TyUANyt84UkQVBJjWEGZ3JUd2HP92r65); [Quantum Country](https://quantum.country/)

**Prediction before reveal (generation / errorful generation)**
- Brod (2021), "Predicting as a learning strategy": asking students to generate predictions before the correct answer improves learning; the mechanism is that "predicting boosts surprise about unexpected answers, which leads to enhanced attention to the correct answer and strengthens its encoding"; only generating predictions induced a pupil-dilation response to the correct answer that was associated with later retrieval success. — [Brod 2021, Psychonomic Bulletin & Review (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8642250/); follow-up: [Explicitly predicting outcomes enhances learning of expectancy-violating information (2022)](https://link.springer.com/article/10.3758/s13423-022-02124-x)

**Mastery learning / gating**
- Kulik, Kulik & Bangert-Drowns (1990), 108 controlled evaluations: positive effects on exam performance; stronger for weaker students (d = 0.61 less able vs 0.40 more able); Bloom's Learning-for-Mastery d = 0.59; but d = 0.50 on experimenter-made tests vs d = 0.08 on standardised tests. — [Kulik et al. 1990, Review of Educational Research](https://journals.sagepub.com/doi/10.3102/00346543060002265); summary with numbers: [Nintil, Bloom's two-sigma review](https://nintil.com/bloom-sigma/)
- Slavin (1987) best-evidence synthesis: effects "moderately positive on experimenter-made achievement measures closely tied to the objectives taught... and are essentially nil on standardized achievement measures"; when instructional time is controlled, effects diminish. — [Nintil summary](https://nintil.com/bloom-sigma/)
- Bloom's tutored condition required 90% mastery vs 80% for classroom mastery learning; mastery alone raised scores ~1.2 SD in the original study, tutoring added the rest. — [Nintil summary](https://nintil.com/bloom-sigma/); [Wikipedia: Bloom's 2 sigma problem](https://en.wikipedia.org/wiki/Bloom%27s_2_sigma_problem)
- Kulik & Kulik (1987) "Mastery Testing and Student Learning" meta-analysis exists (not read in this session). — [Kulik & Kulik 1987](https://journals.sagepub.com/doi/abs/10.2190/FG7X-7Q9V-JX8M-RDJP)

**Worked examples, fading, expertise reversal**
- Meta-analysis (2023) of the worked-example effect on mathematics: g = 0.48 (43 articles, 55 studies, 181 effect sizes). — [Educational Psychology Review 2023](https://link.springer.com/article/10.1007/s10648-023-09745-1)
- Expertise reversal: worked examples lose effectiveness as expertise grows; low-knowledge learners benefit more from studying examples, higher-knowledge learners from solving problems; 2025 meta-analysis pooled 176 effect sizes from 60 studies, 5,924 participants. — [Wikipedia: Expertise reversal effect](https://en.wikipedia.org/wiki/Expertise_reversal_effect); [A cornerstone of adaptivity — meta-analysis (2025)](https://www.sciencedirect.com/science/article/pii/S0959475225000660)
- Faded examples are recommended "in sequences to foster understanding in skill acquisition." — [Role of Fading and Feedback (PDF)](https://faculty.engineering.asu.edu/mre/wp-content/uploads/sites/31/2020/02/MoRO09.pdf)

**Multimedia / cognitive load (Mayer, Sweller)**
- Mayer's median effect sizes (secondary summary of Mayer's lab experiments): multimedia principle d = 1.67; coherence (exclude extraneous material) d = 0.70; signalling (highlight essentials) d = 0.46; redundancy d = 0.87; spatial contiguity d = 0.79; temporal contiguity d = 1.30; segmenting (learner-paced chunks) d = 0.70; pre-training (know names/behaviours of components first) d = 0.46; modality d = 0.72. Some summaries report segmenting 1.36 and pre-training 1.0 from other comparison sets. — [LITFL summary of CTML](https://litfl.com/cognitive-theory-of-multimedia-learning/); origin: [Mayer 2008, Applying the Science of Learning](https://www.researchgate.net/publication/23478495_Applying_the_Science_of_Learning_Evidence-Based_Principles_for_the_Design_of_Multimedia_Instruction); [Cambridge Handbook ch. 13 (segmenting/pre-training/modality)](https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-managing-essential-processing-in-multimedia-learning-segmenting-pretraining-and-modality-principles/DD24C2F48B9B1277CE59F78276110258)
- Animation vs static pictures (Höffler & Leutner 2007), 26 studies / 76 comparisons: overall d = 0.37 (95% CI 0.25–0.49); representational (not decorative) animation d = 0.40; highly realistic/video d = 0.76; procedural-motor knowledge d = 1.06. — [Höffler & Leutner 2007, Learning and Instruction](https://www.sciencedirect.com/science/article/abs/pii/S0959475207001077); [ERIC record](https://eric.ed.gov/?id=EJ780451)

**Desirable difficulties**
- Bjork & Bjork (2011): spacing, interleaving, generation, varied conditions, and testing rather than restudy lower immediate performance but raise long-term retention and transfer. — [Bjork & Bjork 2011 (ResearchGate)](https://www.researchgate.net/publication/284097727_Making_things_hard_on_yourself_but_in_a_good_way_Creating_desirable_difficulties_to_enhance_learning); practitioner summary: [UNH ITOW](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-introducing-desirable-difficulties-into-practice-and-instruction-bjork-and-bjork.pdf)

**Narrative and memory** (see also Q6)
- Mar, Li, Nguyen & Ta (2021), 150 effect sizes / 37 studies / 78 samples / 33,078 participants: stories better remembered and comprehended than expository texts, Hedges g = .55 (95% CI .31–.79); memory g = .72 vs comprehension g = .48 (n.s. difference); authors warn the result "should not be interpreted as a suggestion to force all information into a narrative form for pedagogical purposes"; publication bias likely for memory studies; I² = 98%. — [Mar et al. 2021, Psychonomic Bulletin & Review (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8219577/)
- Science-education meta-analysis (2024): 30 studies, 72 effect sizes, >5,300 students: narrative materials g = 0.16 (95% CI 0.03–0.30); personal or scientist-centred stories outperformed fictional stories. — [Impact of Narrative vs Expository Instruction in Science Education (ResearchGate)](https://www.researchgate.net/publication/384420142_Impact_of_Narrative_versus_Expository_Instruction_in_Science_Education_on_Recall_Understanding_and_Transfer_A_Meta-Analysis)

### Inferences
- The effect-size hierarchy suggests where to spend design effort for a 3D mechanism: keep every scene *representational* (the animation must show the causal path of current through the rotors, not a decorative spinning machine); put labels and equation terms *on* the 3D parts (spatial contiguity, d ≈ 0.8) rather than in a side panel; let the learner step the machine one keypress at a time (segmenting, d ≈ 0.7); dim non-active components and highlight the live wire (signalling, d ≈ 0.46); and teach component names before any calculation (pre-training).
- Mastery gates should measure the objectives you actually teach (where the evidence is strongest, d ≈ 0.5) but include at least one *transfer* check per act (a novel instance, a different rotor order, a small-alphabet toy machine) because that is where mastery learning is weakest.
- Retrieval > restudy only shows up after delay: a gate placed at the end of a scene mostly measures short-term recall. Add a brief delayed re-check at the start of the next act (or on return visits) to convert gates into retrieval practice; Quantum Country's data show this is where retention is created, at a real cost (35–50% time overhead, 29% continuation), so keep delayed checks short (2–3 items).
- Prediction-before-reveal is cheap and well supported: every 3D demonstration should first ask "which lamp lights?" or "does the middle rotor step?" before animating.
- Because the audience is a competent programmer (higher prior knowledge), use faded worked examples early (Phase 0–2) and switch to problem-first gates by Phase 3+ (expertise reversal).

### Gaps
- The exact retention percentages from Roediger & Karpicke (2006) Experiment 1 (commonly reported as ~56% testing vs ~42% restudy at one week) could not be verified in this session: the Sage page returned 403 and the Wikipedia article carries a cleanup notice for lacking quantitative effect sizes. Treat the specific numbers as unverified; the direction of the effect is confirmed by the abstract.
- Meta-analytic effect sizes for the testing effect (e.g., Rowland 2014, Adesope et al. 2017) were not retrieved.
- Mayer's effect sizes above come from a secondary summary (LITFL) and differ across sources; consult Mayer's *Multimedia Learning* (2nd/3rd ed.) for authoritative medians.

---

## Key Question 3: How do interactive courses gate progression without frustration? Which check types work? What are the failure modes?

### Takeaway
Effective systems combine (1) short, frequent checks embedded in the lesson, (2) mastery thresholds achieved over several correct answers rather than one, (3) hints that are withheld first and added only as needed, (4) gentle rollback instead of hard stops, and (5) spaced re-tests that also drive unlocking. Known failure modes are guessing, hint abuse, brute-forcing, and streak/heart mechanics that reward minimal effort.

### Cited Findings

**Khan Academy mastery**
- Skills move Attempted → Familiar (50 mastery points; some correct answers) → Proficient (80 points; more correct answers) → Mastered (100 points; must be Proficient *and* answer that skill correctly on the Unit Test). Only Proficient/Mastered count toward Unit/Course mastery. — [Khan Academy Help: How do mastery levels work?](https://support.khanacademy.org/hc/en-us/articles/5548760867853--How-do-Khan-Academy-s-Mastery-levels-work); [What are Course and Unit Mastery?](https://support.khanacademy.org/hc/en-us/articles/115002552631-What-are-Course-and-Unit-Mastery); [Mastery Challenges](https://support.khanacademy.org/hc/en-us/articles/360037494231-What-are-Mastery-Challenges)
- Khan Academy reports outcomes using "skills to proficient" as its learning metric. — [Khan Academy blog](https://blog.khanacademy.org/why-khan-academy-will-be-using-skills-to-proficient-to-measure-learning-outcomes/)

**Execute Program (Gary Bernhardt)**
- Lessons "interleave prose with live programming problems and integrate a spaced repetition memory system to repeat lessons' tasks over time"; courses are "primarily code examples, not text... hundreds of small examples, slowly increasing in complexity." — [Andy Matuschak notes: Execute Program](https://notes.andymatuschak.org/z2LGZ8cXBcQMP7YuAHbeVyCSLZoiMXvQNKCok); [Execute Program: Why EP](https://www.executeprogram.com/why-ep)
- Reviews are less frequent than natural-language SRS; the system "knows which lessons depend on other lessons and can use that information combined with review performance to intelligently unlock lessons only when learners are ready." — [Execute Program: Spaced Repetition](https://www.executeprogram.com/spaced-repetition)
- User report: ~20 min/day for a couple of weeks per course, "you have to wait for the reviews so you can't do the whole course in a day"; reviews ~10 min/day at first then approach zero; after the fourth correct review on day 64 an item is retired even "if it doesn't feel like it's stuck"; "related reviews all come on the same day, which makes them artificially easy"; no easy/hard self-rating. Yet "I can say with a straight face that I 'know' this stuff." — [mike.place review (2020)](https://mike.place/2020/executeprogram/)

**Brilliant**
- Every lesson is a sequence of small problems building on each other; wrong answers trigger explanation and a gentle rollback; feedback includes celebrations on correct answers and encouragement when struggling. — [ustwo case study](https://ustwo.com/work/brilliant/); [Brilliant FAQ](https://brilliant.org/faq/)

**Duolingo**
- Hearts: each mistake costs a heart; after five, the learner loses the exercise's progress and must wait hours for hearts to regenerate; streaks were found to be gamed by doing "the bare minimum lesson... just to keep the streak alive." — [Medium: Duolingo gamified learning](https://medium.com/design-bootcamp/duolingo-the-product-that-gamified-learning-and-made-it-addictive-6733f2b56307) (secondary source); guides on "beating" hearts exist — [duoplanet](https://duoplanet.com/how-to-beat-the-heart-system-on-duolingo/)

**Learn X the Hard Way**
- Zed Shaw: type sample code "precisely (no copy-and-paste!)"; "If you copy and paste, you might as well just not even do them. The point of these exercises is to train your hands, your brain, and your mind"; the method was modelled on Mickey Baker's jazz-guitar course, which "inverts how you're taught by having you do exercises, then explain them, then apply them." — [PyCon 2011 interview with Zed Shaw](https://pycon.blogspot.com/2011/02/title-pycon-2011-interview-with-zed.html); [Learn Python 3 the Hard Way (O'Reilly)](https://www.oreilly.com/library/view/learn-python-3/9780134693866/)

**Failure modes and the assistance dilemma (ITS literature)**
- "Gaming the system" (Baker et al.): "exploiting system properties rather than engaging in meaningful learning," via "systematic guessing or abusing hints"; consistently associated with lower learning gains. Hint abuse = "rapidly and repeatedly requesting system hints to directly obtain answers." — [Baker et al., Adapting to When Students Game an ITS](https://www.researchgate.net/publication/221413987_Adapting_to_When_Students_Game_an_Intelligent_Tutoring_System); [Understanding Gaming the System (arXiv 2026)](https://arxiv.org/pdf/2601.04487); [Measuring the Impact of Student Gaming Behaviors (arXiv)](https://arxiv.org/pdf/2512.18659)
- Koedinger & Aleven (2007) "assistance dilemma": giving help reduces frustration and time but "may lead to shallow learning"; withholding "can encourage students to learn by themselves, but may lead to frustration and wasted time." Their Cognitive Tutor approach: initially withhold solution information, then "interactively add information, only as needed, through yes/no feedback, explanatory hints, and dynamic problem selection." — [Koedinger & Aleven 2007, Educational Psychology Review](https://link.springer.com/article/10.1007/s10648-007-9049-0); [PDF](https://pact.cs.cmu.edu/pubs/Koedinger%20Aleven%2007.pdf)
- Parsons problems (drag code blocks into order) produced the same learning gains as writing or fixing code, in less time (Ericson, Margulieux & Rick 2017). — [Koli Calling 2017](https://dl.acm.org/doi/10.1145/3141880.3141895); [Guzdial summary](https://computinged.wordpress.com/2017/11/17/parsons-problems-have-same-learning-gains-as-writing-or-fixing-code-in-less-time-koli-calling-2017-preview/); adaptive Parsons vs writing code (CHI 2021) — [ACM](https://dl.acm.org/doi/fullHtml/10.1145/3411764.3445292)

### Inferences

**Check-type comparison for this project (my synthesis of the sources above)**
| Check type | Guess rate | Measures | Best use in Enigma course |
|---|---|---|---|
| Multiple choice (4 options) | 25% per attempt; trivially brute-forced | recognition | Only for misconception probes with distractors that encode the misconception (e.g., "the ring setting changes which letter appears in the window" vs "...shifts the wiring relative to the ring") |
| "Predict the output" (type the lamp letter / window letters after N presses) | ~1/26 per letter; multiplies across letters | mental model of signal path & stepping | Phase 0–1 (machine anatomy, stepping, double-step) — pair with "Place your bets" then animate |
| "Set the machine so that…" (manipulate 3D controls to satisfy a constraint) | low; many settings but constraint-checkable | causal understanding of settings | Phase 1 (ring vs position; make middle rotor turn over on the next press); Phase 6 (align a crib so no letter self-encrypts; wire a bombe menu) |
| "Compute this by hand" (cycle lengths of a given permutation; product of two permutations on a 6–8 letter alphabet) | low; free response | procedural + conceptual maths | Phase 3–4 (AD/BE/CF, cycle structure); use small alphabets first, full 26 later with the tool doing bookkeeping |
| Write code with hidden tests (doctest-style, randomised inputs) | very low; but outsourcable to an AI agent | ability to operationalise the mechanism | Phase 2–4 (`compose`, `inverse`, `cycle_lengths`, `build_AD(indicators)`), always paired with a prediction question so pasting code alone does not pass |
| Parsons (order the steps of the attack / order the signal path) | moderate | structural understanding, cheaply | Fast checks of the *sequence* of Rejewski's or Turing's method; lower time cost than coding (Ericson 2017) |

**Gate rules that are rigorous but not frustrating**
1. *Mastery over several items, not one*: mirror Khan Academy's Familiar → Proficient → Mastered ladder: pass = 2 of 3 fresh randomised instances correct (roughly the 80–90% mastery criteria in Bloom's studies). Never gate on a single question.
2. *Randomise instances*: every retry gets new rotor order/positions/indicators so a wrong answer cannot be re-entered by elimination (counters brute-forcing; cheap because the simulator in `machine.py` can generate instances).
3. *Withhold, then add assistance in steps* (Koedinger & Aleven): attempt 1 = no hint; attempt 2 = conceptual hint (which scene to revisit, highlighted in the 3D view); attempt 3 = worked example on a *different* instance; attempt 4 = reveal solution and require one more fresh instance. This is faded-worked-example scaffolding in reverse and prevents hint-to-answer abuse because the hint never reveals the current instance's answer.
4. *Gentle rollback, not hard lock* (Brilliant pattern): on failure, jump the 3D scene to the relevant component with the learner's own wrong answer visualised (e.g., animate the path they implied and show where it diverges) rather than a red X.
5. *Detect gaming*: flag sub-2-second answers and rapid hint chains (Baker's signature) and respond by switching to a "set the machine" item, which cannot be answered by rapid guessing.
6. *Spaced re-checks drive unlocking* (Execute Program pattern): Act N+1 opens with 2–3 retrieval items from Act N; use them for retention, not as a wall; if failed, offer the rollback path.
7. *Avoid punitive economies* (Duolingo hearts): no lives, no timers on mastery checks; keep the ticking clock in the *story layer*, not in the assessment layer.
8. *Type it yourself* (Zed Shaw): code gates should require the learner to write or complete the key function in an editor, but keep functions to under ~10 lines and provide the surrounding harness.

### Gaps
- No public design write-ups from Codecademy on "checkpoint" design or from Duolingo's research team on exercise-type efficacy were found in this session; the Duolingo statements come from secondary Medium coverage.
- Execute Program's own site is JS-rendered and returned no body text; specifics are from a third-party review and Andy Matuschak's notes.
- Quantitative comparisons of guessing/gaming rates across check types (MC vs free-response) were not retrieved; the guess-rate column above is arithmetic, not measured data.

---

## Key Question 4: How is Enigma taught today, what sequence works, and what misconceptions are common?

### Takeaway
Existing teaching splits into three tiers: museum/school sessions that demonstrate a real machine and role-play a codebreaking scenario; general cryptography courses that place Enigma after Caesar/Vigenère as "a polyalphabetic cipher whose alphabet changes every keypress"; and mathematical expositions (Rejewski, Tuma, IAS/Treatman slides) that teach Enigma as a composition of permutations and the break as a theorem about conjugate permutations. The documented mechanical pitfalls are ring setting vs rotor position, the middle rotor's double step, the reflector's no-self-encryption property, and the signal path order.

### Cited Findings

**Bletchley Park education**
- Sessions are "award-winning learning sessions tailored to pupils of any age" with "Exciting hands-on demonstrations" on "WW2, teamwork, codebreaking"; offered for KS1–KS5, FE, HE and youth groups, in the Block E Learning Centre; online sessions include a virtual tour, an Enigma demonstration and an activity-based workshop; outreach brings "a real, working Enigma machine" to schools. — [Bletchley Park Learning](https://www.bletchleypark.org.uk/learning/); [Enigma outreach sessions](https://rollofhonour.bletchleypark.org.uk/learn/outreach/enigma-outreach-sessions)
- KS3 workshop is "set in 1941 during the Battle of the Atlantic, where students take on the role of codebreakers to intercept and decipher German Naval communications in order to plan a strategy to get convoys safely to Liverpool." — [Bletchley Park Key Stage 3](https://www.bletchleypark.org.uk/event/key-stage-3/); [Higher Education sessions](https://www.bletchleypark.org.uk/event/higher-education/)

**CS Unplugged**
- Classic CS Unplugged has no dedicated Enigma activity; its cryptography material is "Cryptographic Protocols" and it links out to NOVA Online's Enigma-like encoder and "Mind of a Codebreaker." — [Classic CS Unplugged: Cryptographic Protocols](https://classic.csunplugged.org/activities/cryptographic-protocols/)

**Khan Academy / Crash Course**
- Khan Academy's "Journey into Cryptography" sequence: What is cryptography → Caesar cipher → polyalphabetic cipher → one-time pad → ... → "The Enigma encryption machine" as a WW2 case-study video. — [Khan Academy: The Enigma encryption machine](https://www.khanacademy.org/computing/computer-science/cryptography/crypt/v/case-study-ww2-encryption-machines); [course page](https://www.khanacademy.org/science/brit-cruise/cryptography)
- Crash Course CS #33 introduces Enigma as "a typewriter-like machine, with a keyboard and lampboard" with "configurable rotors," and explains that "every single time a letter was entered, the rotors advanced by one spot," so "A-A-A... might come out as B-D-K." — [Crash Course CS #33](https://thecrashcourse.com/courses/cryptography-crash-course-computer-science-33/)

**Simon Singh: Code Book / Black Chamber**
- Black Chamber order: Transposition (Rail Fence, Latin Square) → Substitution (Caesar, Kama-sutra, Pigpen, mono-alphabetic) → Codes, ciphers & keys → *Cracking* the substitution cipher (letter frequencies, cracking tool, Mary Queen of Scots) → Digraph/Homophonic/Playfair → Vigenère (square, tool, strength analysis) → *Cracking* Vigenère → "1900–2000". Each page has "an explanation of how the code works" plus "an interactive tool that will allow you to encrypt and decrypt messages," letter by letter or in one click. — [Black Chamber guide](https://www.simonsingh.net/The_Black_Chamber/chamberguide.html); [1900–2000 section](https://www.simonsingh.net/The_Black_Chamber/1900_2000.html)
- The Code Book CD-ROM (with Nicholas Mee) presented the text "in easily digested chunks illustrated with video clips, computer generated animations and interactive tools," with "a full Enigma Machine emulator" as its most impressive feature. — [Virtual Image: Code Book CD-ROM](https://www.virtualimage.co.uk/nickmee/html/the_code_book.html); [Simon Singh cryptography page](https://simonsingh.net/cryptography/)
- University lecture notes exist that follow The Code Book chapter by chapter. — [U. Alberta lecture notes on The Code Book](https://webdocs.cs.ualberta.ca/~hayward/crypto/lec.html)

**Mathematical / university-level treatments**
- Rejewski's own account: "An Application of the Theory of Permutations in Breaking the Enigma Cipher" (1980), and Jiří Tuma's "Permutation Groups and the Solution of German Enigma Cipher" (2003) present the break as: Enigma = composition of permutations; the doubled indicator yields products AD, BE, CF ("characteristics of the day"); the plugboard acts by conjugation, and conjugate permutations have the same cycle structure, so the cycle lengths identify rotor order/position independent of the plugboard. — [Rejewski 1980 (PDF)](https://cryptocellar.org/enigma/files/rew80.pdf); [Tuma 2003 (PDF)](https://cryptocellar.org/enigma/files/tuma2003.pdf); [Wikipedia: Marian Rejewski](https://en.wikipedia.org/wiki/Marian_Rejewski); [AMS Feature Column: Rejewski and the first break (not fetched; 403)](https://www.ams.org/publicoutreach/feature-column/fcarc-enigma)
- Course handouts count the configuration space (Cornell/U. Regina handout "The Theoretically Possible Number of Enigma Configurations"). — [Kozdron handout (PDF)](https://uregina.ca/~kozdron/Teaching/Cornell/135Summer06/Handouts/enigma.pdf)
- The repo's notebook points learners to IAS Women and Mathematics slides (Treatman) slides 150–180 for cycle lengths. — [Treatman slides (PDF)](https://www.math.ias.edu/files/wam/enigma_Treatman.pdf); [BreakingEnigma.ipynb](/home/user/enigma-simulator/BreakingEnigma.ipynb)

**Bombe teaching resources**
- Tony Sale's Virtual Bletchley Park explains the Turing/Welchman bombe and provides a "Turing Bomb in Action" demonstration; the Virtual Colossus project offers a browser-based **3D Turing-Welchman Bombe simulation** with a tutorial "that shows how to fit the drums and wire up a menu ready for operation"; the operator "assigns a set of three drums to each link in the menu and sets their offsets to the letters on the link." 101computing.net offers a simplified bombe simulator. — [Tony Sale: The Turing/Welchman Bombe](https://www.codesandciphers.org.uk/virtualbp/tbombe/thebmb.htm); [Turing Bomb in Action](https://www.codesandciphers.org.uk/anoraks/tools/intro.htm); [Virtual Bombe](https://bombe.virtualcolossus.co.uk/); [Virtual Bombe tutorial (PDF)](https://bombe.virtualcolossus.co.uk/bombe/VirtualTuringWelchmanBombeTutorial.pdf); [101computing bombe](https://www.101computing.net/turing-welchman-bombe/)

**Documented mechanical facts behind common confusions**
- Ring setting vs position: "The ring settings, or *Ringstellung*, are used to change the position of the alphabet ring relative to the internal wiring... Changing the ring setting will therefore change the positions of the wiring, relative to the turnover-point and start position." The rotor's *position* is the letter visible in the window. — [Wikipedia: Enigma rotor details](https://en.wikipedia.org/wiki/Enigma_rotor_details); [Ellsbury: How the Enigma was set up](http://www.ellsbury.com/enigma3.htm)
- Double stepping example (rotors with middle rotor II near its E notch): "AEW — right rotor steps, takes middle rotor (II) one step further, which is now in its own E-notch position"; "BFX — normal step of right rotor, double step of middle rotor, normal step of left rotor." Turnover notches: I = Q, II = E, III = V. — [Wikipedia: Enigma rotor details](https://en.wikipedia.org/wiki/Enigma_rotor_details)
- Signal path: "current is passed through the rotors, around the reflector, and back out through the rotors again"; the reflector means "No letter can map to itself, a cryptographic weakness caused by the same wires being used for forwards and backwards legs." — [Wikipedia: Enigma rotor details](https://en.wikipedia.org/wiki/Enigma_rotor_details); [Wikipedia: Reflector](https://en.wikipedia.org/wiki/Reflector_(cipher_machine))
- Cribs exploit no-self-encryption: "If you know (or guess) a plaintext word... you can eliminate all configurations where any crib letter would encrypt to itself." — [Cipher Museum: Enigma](https://ciphermuseum.com/ciphers/enigma.html)
- The repo notebook itself warns about two more conceptual pitfalls: in the AD/BE/CF permutations "a letter mapping to itself is ok in this scenario because this is a permutation map, not a direct map" (learners who have just learned "no letter maps to itself" for the *machine* over-generalise it to the *products*); and "you can use e.encipher and e.decipher interchangeably, since encryption and decryption are the same." — [BreakingEnigma.ipynb](/home/user/enigma-simulator/BreakingEnigma.ipynb)

### Inferences

**A sequence that matches how the subject is actually taught, ordered for this project**
1. *Anatomy and the one-keypress path* (keyboard → plugboard → right rotor → middle → left → reflector → back → plugboard → lamp), taught with names first (Mayer pre-training), on a 6-letter toy machine, then the real 26.
2. *Stepping* (right rotor every press, notch turnover, then the double step), *then* ring setting as "the wiring and notch slide together relative to the letters you see" — this is exactly the distinction Wikipedia/Ellsbury single out.
3. *Reciprocity and the reflector*: have the learner search the sandbox for a setting where A→A, fail, then derive why (the same wires go both ways); immediately foreshadow that this is what cribs and the bombe exploit.
4. *Enigma as permutations*: each keypress is E = S·(R₃R₂R₁)·U·(R₃R₂R₁)⁻¹·S⁻¹ with S the plugboard; the learner writes `compose` and `inverse` and verifies E is an involution with no fixed points (this ties Phase 3 to Phase 2).
5. *Indicator procedure → AD, BE, CF* (the repo's step), with the "letter maps to itself is fine here" pitfall addressed head-on.
6. *Cycle structure and Rejewski's theorem* (conjugation preserves cycle lengths ⇒ plugboard drops out), demonstrated by toggling a stecker pair in the 3D machine and re-deriving the cycles.
7. *Catalog lookup* (the repo's `AD:… BE:… CF:…` index; 105,456 → 2) and *plugboard recovery* from known plaintext.
8. *Bombe* (cribs, menus, loops, why a contradiction propagates), reusing the no-self-encryption fact from step 3 — with an optional embed/link to the Virtual Colossus 3D bombe, which already implements drum fitting and menu wiring.

**Misconception-targeted gate items**
- "Can a letter ever encrypt to itself?" → predict, then try to build a counterexample in the sandbox (gate passes on a correct *explanation selection* plus the failed search).
- Ring vs position: given Ringstellung and window letter, compute the wiring offset; then "set the machine so the middle rotor steps on the next keypress" (checks notch/ring interaction).
- Double step: "starting from A-D-V with rotors I-II-III, what are the window letters after 3 presses?" (free-response; passes only if the double step is applied).
- Signal direction: drag the rotors' order in the 3D view and predict the lamp; wrong direction gives a distinct wrong letter that the rollback can name.
- Products vs machine: "AD maps Y→Y — is that a bug?" (MC with the misconception as a distractor).

### Gaps
- No systematic study of *student* misconceptions about Enigma was found; the list above is inferred from the mechanical facts most references single out plus the repo notebook's own explicit warnings.
- Bletchley Park's pages describe sessions only at a high level; no lesson plans or sequencing rationale are public.
- The claim that a rotor steps *before* the electrical contact is made (so the first keypress already uses the advanced position) is standard in technical references (e.g., Rijmenants' Enigma tech page linked from the notebook) but was not verified in a fetched page this session.

---

## Key Question 5: For an audience that "codes with agents", what is the pedagogical value of implementing small pieces in-browser, and what tools make it feasible?

### Takeaway
Writing the small functions that *are* the mechanism (rotor map, compose/inverse, cycle lengths, build-AD-from-indicators) moves the learner from "active" to "constructive" engagement (ICAP) and exploits the generation effect; but code gates are the easiest to outsource to an AI agent, so each should be paired with a prediction or a "why" item and should visualise the code's effect in the 3D machine. Pyodide (Python in WebAssembly) makes hidden-test autograding in the browser practical with no server.

### Cited Findings
- ICAP: constructive engagement (producing outputs beyond what was presented) yields more learning than active manipulation, which beats passive viewing. — [Chi & Wylie 2014](https://www.tandfonline.com/doi/abs/10.1080/00461520.2014.965823)
- Generation: "actively produced information is better remembered than information that is just read"; errorful generation is a special case. — [Brod 2021 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8642250/)
- Bret Victor: a learnable programming environment must let the reader "follow the flow" and "see the state"; instant output alone "misses the point." — [Learnable Programming](http://worrydream.com/LearnableProgramming/)
- Zed Shaw: exercises train "your hands, your brain, and your mind"; copy-paste defeats the exercise; do → explain → apply. — [PyCon 2011 interview](https://pycon.blogspot.com/2011/02/title-pycon-2011-interview-with-zed.html)
- Parsons problems give the same learning gains as writing/fixing code in less time — a cheaper check when the target is the *structure* of an algorithm rather than syntax. — [Ericson et al. 2017](https://dl.acm.org/doi/10.1145/3141880.3141895)
- Execute Program's format — hundreds of tiny interactive code examples where the learner supplies the expected result — is a retrieval-practice form of coding check that takes seconds per item. — [Andy Matuschak notes: Execute Program](https://notes.andymatuschak.org/z2LGZ8cXBcQMP7YuAHbeVyCSLZoiMXvQNKCok)
- **Tools**: Pyodide "brings the CPython interpreter to the web via WebAssembly" with NumPy etc.; "code questions are graded by running solutions against a test suite in a web worker with Pyodide," giving "instant feedback and no need for server resources"; a Pyodide-in-LMS write-up covers both "interactive Python code examples inside text learning materials" and "verifying programming assignments." — [Pyodide blog issue #60 (LMS use)](https://github.com/pyodide/pyodide-blog/issues/60); [Online Python (Pyodide)](https://www.online-python.com/pyodide)
- Stanford's PyodideU paper describes running an entire CS1 course's Python in the browser via Pyodide. — [PyodideU (Stanford, PDF)](https://web.stanford.edu/~cpiech/bio/papers/pyodideU.pdf)
- TeachBooks/Sphinx-Thebe and JupyterLite provide notebook-style live code in web pages on top of Pyodide. — [TeachBooks: Run Python inside your book](https://teachbooks.io/manual/features/live_code.html)
- An open "pyodide-exercise" component ships "editable starter code, hidden or visible test cases, expected outputs, and progressive hints." — [pyodide-exercise (LobeHub listing)](https://lobehub.com/skills/mjunaidca-robolearn-pyodide-exercise)
- The repo already has the Python reference implementation (`components.py`, `machine.py`, `rejewski.py`) that could be shipped to Pyodide as the hidden oracle. — [/home/user/enigma-simulator/machine.py](/home/user/enigma-simulator/machine.py); [/home/user/enigma-simulator/rejewski.py](/home/user/enigma-simulator/rejewski.py)

### Inferences
- **Which pieces to make the learner implement** (each ≤ 10 lines, each a "mechanism-defining" function): `rotor_forward(c, wiring, pos, ring)`, `rotor_backward(...)`, `compose(p, q)`, `inverse(p)`, `enigma_keypress(state, c)` (assembled from provided parts), `build_AD(indicators)`, `cycle_lengths(perm)`, `characteristic_key(AD, BE, CF)` (the `AD:… BE:… CF:…` index string), and `is_consistent_crib(cipher, crib, offset)` (no self-encryption filter). Everything else (rotor tables, catalog generation, UI) is provided.
- **Doctest-style checking**: show 2–3 visible examples as the spec (Execute Program style), then run hidden randomised property tests in a Web Worker with a timeout: `compose(p, inverse(p)) == identity`, `enigma_keypress` is an involution with no fixed points across random settings, `cycle_lengths` sums to 26, `build_AD` agrees with the reference implementation on fresh indicator sets. Property-based hidden tests resist hard-coding.
- **Agent-resistance**: because this audience will paste in AI-generated code, do not let a green test suite alone open the gate. Require one of: (a) a *prediction* typed before running ("what will `cycle_lengths(AD)` return for this instance?"), (b) a one-line *explanation selection* ("why does toggling a stecker not change these lengths?"), or (c) a follow-up "set the machine" item derived from the code's output. The code then serves the learner as a tool (as the notebook intends: "feel free to write some code") while the gate measures understanding.
- **Linked view**: when the learner's `enigma_keypress` runs, animate its path in the 3D machine and diff it against the reference path on a mismatch (Victor's "see the state"); this turns a failing test into a rollback to the exact component that is wrong.
- Use Parsons items for *procedure ordering* checks ("order the steps of Rejewski's attack", "order the signal path") — cheaper for the learner and still diagnostic.

### Gaps
- No study was found that measures learning gains specifically when learners use AI agents to complete coding checks; the agent-resistance recommendations are design inferences from the gaming-the-system and generation literatures.
- JavaScript-side sandboxes (e.g., Web Worker `eval`, Sandpack, WebContainers) were not researched in this session; Pyodide is the only in-browser runner with sources here.

---

## Key Question 6: What narrative structures work for a historical "story mode", and what evidence supports narrative framing?

### Takeaway
Narrative reliably improves memory and comprehension of text (g ≈ .55 across 33k participants) and helps modestly in science instruction (g ≈ .16), with the strongest gains when the story is about *real* people rather than fictional ones; but meta-analysts warn against forcing all content into story form, and Mayer's coherence principle says extraneous detail hurts. The practical structure is acts framed around real codebreakers (Rejewski/Różycki/Zygalski; Turing/Welchman), each act ending in a "Puzzle It Out" capstone, with the repo's ticking-clock day-key scenario as the final act.

### Cited Findings
- Mar et al. (2021): stories better recalled and comprehended than essays, g = .55; non-adults benefited more than adults (n.s.); authors caution against forcing information into narrative form. — [Mar et al. 2021 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8219577/)
- Science-education meta-analysis (2024): narrative materials g = 0.16; "learning from personal or scientist-centered stories was more favorable than learning from fictional stories." — [Narrative vs Expository Instruction in Science Education meta-analysis](https://www.researchgate.net/publication/384420142_Impact_of_Narrative_versus_Expository_Instruction_in_Science_Education_on_Recall_Understanding_and_Transfer_A_Meta-Analysis)
- "Lost in narrative?": informative narratives can affect metacomprehension accuracy (learners may feel they understood more than they did). — [Learning and Instruction (ScienceDirect abstract)](https://www.sciencedirect.com/science/article/abs/pii/S0959475218303037)
- Mayer's coherence principle: excluding extraneous material improves learning (d ≈ 0.70). — [LITFL summary](https://litfl.com/cognitive-theory-of-multimedia-learning/)
- Nicky Case's Role Play pattern places the reader inside a scenario; the ending should require everything learned. — [4 More Design Patterns](https://blog.ncase.me/explorable-explanations-4-more-design-patterns/); [Explorable Explanations](https://blog.ncase.me/explorable-explanations/)
- Bletchley Park's own school workshop uses exactly this framing: 1941 Battle of the Atlantic, students "take on the role of codebreakers... to get convoys safely to Liverpool." — [Bletchley Park KS3](https://www.bletchleypark.org.uk/event/key-stage-3/)
- 3Blue1Brown's stated approach starts with "a concrete puzzle, surprising pattern, or visual tension, then gradually connecting the visible motion to algebraic or analytic structure," emphasising "emotion, wonder and imagination." — [Stanford Daily 2020](https://stanforddaily.com/2020/01/24/3blue1brown-creator-grant-sanderson-15-talks-engaging-with-math-using-stories-and-visuals/)
- The repo's scenario ("It's midnight at Bletchley... the German army Enigma operators have just switched over to a new day key... Let's get cracking") is a Role-Play/ticking-clock frame and already admits its anachronism (Rejewski's method predates Bletchley; Bletchley used more advanced methods). — [BreakingEnigma.ipynb](/home/user/enigma-simulator/BreakingEnigma.ipynb)
- Historical anchors for characters: Rejewski's 1980 first-person account of the permutation attack; Różycki (clock method); Welchman's identification/exploitation of the no-self-encryption weakness and the diagonal board. — [Rejewski 1980](https://cryptocellar.org/enigma/files/rew80.pdf); [Wikipedia: Jerzy Różycki](https://en.wikipedia.org/wiki/Jerzy_R%C3%B3%C5%BCycki); [Wikipedia: Clock (cryptography)](https://en.wikipedia.org/wiki/Clock_(cryptography)); [Wikipedia: Reflector (cipher machine)](https://en.wikipedia.org/wiki/Reflector_(cipher_machine))

### Inferences
- **Recommended act structure** (real people, not invented characters, per the 2024 science-ed moderator result):
  - *Act I — Warsaw, 1932–33 (Rejewski, with Różycki and Zygalski)*: the doubled indicator, AD/BE/CF, the theorem that the plugboard drops out of cycle structure, the cyclometer/catalog. Capstone: the repo's catalog lookup (105,456 → 2).
  - *Act II — Bletchley, 1939–40 (Turing, Welchman)*: cribs, no-self-encryption, menus and loops, the bombe and diagonal board. Capstone: align a crib and wire a menu that produces the correct stop.
  - *Act III — "The day key" (the repo's midnight scenario)*: pure Puzzle-It-Out with no new concepts; the learner runs the full attack on fresh data. Present the anachronism openly as a "training exercise" framing (as the notebook does) so history and mechanism are not confused.
- **Keep story and mechanism in separate layers**: story beats are short interstitials between mechanism scenes (respecting coherence; Mar et al.'s caution); never narrate over a calculation scene. The ticking clock provides motivation at act boundaries but should not time the mastery checks (see Q3).
- **Use prediction as the narrative engine**: each act's central question is posed as a bet before the reveal ("Rejewski had no rotor wirings and no machine. What could he possibly compute from six-letter headers?"), which is both the Strogatz/Case pattern and Brod's surprise mechanism.
- **Guard metacomprehension**: because narratives can inflate the feeling of understanding, every act must end with a non-narrative gate (compute/set-the-machine) rather than a story quiz.

### Gaps
- No studies were found on narrative framing specifically for adult self-taught programmers or for interactive (non-text) narrative; the meta-analyses are text-based and skew toward younger learners.
- No evaluation of Bletchley Park's role-play workshops (learning outcomes) is public.

---

## Consolidated recommendation table: gate type per phase

| Phase (maps to repo notebook) | Primary gate | Secondary/delayed check | Evidence rationale |
|---|---|---|---|
| 0. Anatomy & one-keypress path | Predict-the-lamp on a 6-letter toy machine, then full machine (free response, 2 of 3 fresh instances) | Parsons: order the signal path | Pre-training (Mayer), prediction-before-reveal (Brod), representational animation (Höffler & Leutner) |
| 1. Stepping, notches, double step, ring vs position | "Set the machine so the middle rotor steps on the next press"; predict window letters after N presses | MC misconception probe (ring-setting distractor) | Signalling/segmenting; misconception-targeted items (Wikipedia/Ellsbury facts) |
| 2. Reflector, reciprocity, no fixed points | Sandbox search for A→A (fails) + explanation selection; code: `compose`, `inverse`, involution test | Delayed 2-item recall at start of Act I | Withholding (Case), generation (Brod), ICAP constructive |
| 3. Indicators → AD/BE/CF | Code `build_AD(indicators)` with hidden randomised tests + typed prediction for one instance; hand-compute on 8 indicators | Parsons: order the steps of Rejewski's attack | Worked-then-faded examples; agent-resistance pairing |
| 4. Cycle structure / plugboard drops out | Hand-compute cycle lengths on a small permutation; code `cycle_lengths`; "Place your bet" on whether toggling a stecker changes lengths, then verify in 3D | Delayed recall at start of Act II | Testing effect; expertise reversal (problem-first now) |
| 5. Catalog lookup → 2 candidates → plugboard recovery | Build the `AD:… BE:… CF:…` key; disambiguate using known plaintext; "set the plugboard so the test message decrypts" | — | Mastery on taught objectives (Kulik) + transfer instance |
| 6. Cribs, menus, bombe | "Set the machine": align a crib with no self-encryption; wire a menu with a loop; predict the stop | Optional: Virtual Colossus 3D bombe walkthrough | No-self-encryption reused from Phase 2; Puzzle It Out |
| Act III capstone (the day key) | Full attack on fresh data, no hints until attempt 3 | — | Case: ending must use everything learned; Freeman: active learning |

Cross-cutting rules: randomise every instance; 2-of-3 mastery; hints withheld then added (Koedinger & Aleven); gentle rollback into the 3D scene (Brilliant); flag <2 s answers and hint chains (Baker); no hearts/timers on assessment (Duolingo lesson); step-driven progression with scroll only inside scenes (Distill/Zhi et al.); type the code yourself but keep functions tiny (Shaw, Execute Program); short delayed re-checks at act boundaries (Roediger & Karpicke; Quantum Country).
