# Callback Arcade phone rooms

Open `/arcade` on the TV or the computer connected to it. Choose a phone-ready game, adjust its maps and rules, then select **Phone players** and create a room. Keep that TV tab open.

Each player scans the room QR code or opens `/arcade-games/phone/controller.html`, enters the displayed code and a name, and joins. A room supports up to ten phones. The TV starts and pauses the match; unused or disconnected seats use bots. Reopening the controller in the same browser restores that phone's seat while the room remains open.

Each phone shows controls for its game. Blind Crown also shows that player's private planning board. The shared TV is the public view. Use **End room** on the TV when finished.

The connection indicator reports request round-trip time. The room service retains inputs for up to 1.5 seconds; held controls clear when updates stop for half a second. This version uses the Site's room service to relay input, so delay varies with the connection; Scratch Match's timing is particularly sensitive. The TV runs the standalone simulation, while the service authenticates rooms and routes each phone's input. This mode does not submit competitive scores to the main party-game service.

## Phone actions

| Game | Phone controls |
| --- | --- |
| Royal Sumo | Move, hold/release Bash, Dash |
| Royal Ballistix | Move/aim, hold Magnet, Pulse |
| Royal Scratch Match | Four matching rune buttons |
| Royal Roller Ruckus | Steer with the track radar; Recover after a fall |
| Royal Twisted | Jump and hold Duck |
| Space Bash | Move, Grab/Throw, Kick, Jump |
| Blind Crown | Place, aim and lock on your private board |

If a connection drops, release the controls and reconnect. The room stops stale movement and temporarily gives disconnected seats to bots. A host tab that stops responding pauses phone input; keep the TV tab active for the match.
