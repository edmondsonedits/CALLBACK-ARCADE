/* ============================================================================
   ROYAL SUMO - VERSIONS  (four independent numbers, bumped for different reasons)

   build     the product release: title screen, file name, RoyalSumo.version.
   sim       the deterministic simulation. Same seed + same inputs must play out identically for a given `sim`.
               MAJOR  the input or state format changed incompatibly (old recordings no longer load)
               MINOR  behaviour changed on purpose: physics, AI, hazards, rules, RNG draw order
               PATCH  code changed but every recorded match still plays out bit-for-bit (new API, refactors)
             test/unit/golden.test.js fails if the simulation output changes while `sim` stays put.
   protocol  the external control surface: RoyalSumo.scenario / restart / multiplayer.*  (integer; bump when a
             call changes meaning or a field is removed. Additive fields and calls do not need a bump.)
   save      the browser-storage schemas (settings, slot table, career). Each blob also carries its own `v`.

   History
     build 1.0 - 1.2   sim 1.0.0 (never bumped while the game was tuned; the label was stale)
     build 1.3.0       sim 1.2.1  = the behaviour of build 1.2, plus seats (owner / name / look / skill per fighter)
                       protocol 2 = persistent slot table: setHumanSlot really changes the driver, ownership and names
                                    survive restarts, submitInput speaks the v0.21 command format and only drives
                                    remote seats, seeds given through the API reach the match.
   ========================================================================== */
export const VERSIONS=Object.freeze({build:'1.3.0',sim:'1.2.1',protocol:2,save:1});
