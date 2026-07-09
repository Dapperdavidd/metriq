# circuits/reveal (Ring 3, behind the July 12 checkpoint)

The Noir commit-reveal circuit lives here. It is built only if the core demo is
stable at the checkpoint. Cutting Ring 3 removes exactly one frontend component
(`ProofTick`) and nothing else, so this directory staying empty costs the demo
nothing.

`nargo` is not installed yet; it will be installed only if Ring 3 is greenlit.
See System Design section 10.
