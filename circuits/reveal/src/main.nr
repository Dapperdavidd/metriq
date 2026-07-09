// circuits/reveal/src/main.nr
//
// Ring 3, the cut line. The winner proves it reached the quality target under the cap
// via a route matching a commitment posted before the run, WITHOUT revealing the route.
// Prove the win, hide the how.
//
// Public inputs are what the chain already knows (the commitment posted at open, the
// cap, the spend from Charged events, the quality target). The private witness is the
// route: which tier of each subtask was bought, its price, and its score.
//
// Hardening over the source-draft circuit: the commitment binds route AND prices AND
// scores (not just route + salt), so a prover cannot keep the committed route but swap
// in inflated scores. The pedersen preimage is the full private plan plus the salt.

fn main(
    // --- private witness ---
    route: [Field; 6], // 0 = skip, 1 = base, 2 = premium, per subtask
    prices: [Field; 6], // wei charged per step (0 if skipped)
    scores: [Field; 6], // quality points earned per step
    salt: Field,
    // --- public inputs ---
    commitment: pub Field, // hash posted before the run
    cap: pub Field,
    spent: pub Field, // already public from the Charged events
    quality_target: pub Field,
) {
    // 1) the private plan matches the earlier public commitment
    let preimage: [Field; 19] = [
        route[0], route[1], route[2], route[3], route[4], route[5],
        prices[0], prices[1], prices[2], prices[3], prices[4], prices[5],
        scores[0], scores[1], scores[2], scores[3], scores[4], scores[5],
        salt,
    ];
    let h = std::hash::pedersen_hash(preimage);
    assert(h == commitment);

    // 2) prices sum to the public spend and stay within the cap
    let mut total: Field = 0;
    let mut earned: Field = 0;
    for i in 0..6 {
        total = total + prices[i];
        earned = earned + scores[i];
    }
    assert(total == spent);
    assert(total as u64 <= cap as u64);

    // 3) the hidden route actually met the target
    assert(earned as u64 >= quality_target as u64);
}

#[test]
fn test_winning_route_passes() {
    // Adaptive's winning plan: premium ANALYZE (+ VERIFY), base elsewhere.
    // prices in wei; the commitment is recomputed from the same preimage.
    let route = [1, 1, 1, 2, 1, 1];
    let prices = [
        100000000000000000, // 0.10 FETCH base
        120000000000000000, // 0.12 CLEAN base
        100000000000000000, // 0.10 ENRICH base
        300000000000000000, // 0.30 ANALYZE premium
        150000000000000000, // 0.15 VERIFY
        200000000000000000, // 0.20 PUBLISH
    ];
    let scores = [10, 10, 10, 28, 8, 20];
    let salt = 12345;

    let preimage: [Field; 19] = [
        route[0], route[1], route[2], route[3], route[4], route[5],
        prices[0], prices[1], prices[2], prices[3], prices[4], prices[5],
        scores[0], scores[1], scores[2], scores[3], scores[4], scores[5],
        salt,
    ];
    let commitment = std::hash::pedersen_hash(preimage);

    // spent 0.97, cap 1.00, target 80: passes.
    main(route, prices, scores, salt, commitment, 1000000000000000000, 970000000000000000, 80);
}
