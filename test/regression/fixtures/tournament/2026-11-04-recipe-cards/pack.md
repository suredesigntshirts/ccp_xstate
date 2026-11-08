# Recipe cards (verifier's toy tournament)

Question: how should a tool turn a plain-text recipe into a printable card, and a week of recipes into a menu?

Two workflows, `card` and `menu`, each with model stages `parse` and `render`.

Floors, written before the run: scenarios S1 (a recipe with no quantities still renders) and S2 (a unicode
fraction is kept); contract test C1 (every rendered card names its source line for each step); hard constraint
H1 (zero runtime dependencies).
