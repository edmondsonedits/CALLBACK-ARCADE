# Magic Arena rules

Magic Arena is a two-seat simultaneous-choice duel played in the King Prompter room. The first two eligible controllers selected when the host starts are the duelists; additional room participants watch as spectators. The host reveals each round and advances the match.

## Balance

- Each duelist starts with 6 health and 2 energy. Energy is capped at 3.
- **Strike** spends 1 energy and deals 2 damage unless the opponent chose Guard.
- **Guard** blocks a Strike and restores 1 energy.
- **Focus** restores 2 energy and leaves the duelist vulnerable to Strike.
- Both choices resolve at once. Damage is applied together, so two lethal Strikes can produce a draw.
- A knockout ends the match immediately. Otherwise, play lasts up to five rounds. The higher remaining health wins; if health is tied, higher energy wins; equal health and energy produce a draw.
- A missing move at the 30-second deadline becomes Focus. This is resolved by the room's deadline recovery, even if no client is connected.
- Moves are private to their owner while choices are open. Host, opponent, and spectator snapshots contain no unresolved action.

All choices, deadlines, resource changes, and results are validated and resolved by King Prompter's room engine and persisted with the room. The title uses no Open Party Lab runtime, content, or assets.
