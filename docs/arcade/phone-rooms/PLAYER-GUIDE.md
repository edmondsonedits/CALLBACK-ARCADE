# Callback Arcade phone rooms

Open `/arcade` on the TV or the computer connected to it. Choose a phone-ready game, adjust its maps and rules, then select **Phone players** and create a room. Keep that TV tab open.

Each player scans the room QR code or opens `/arcade-games/phone/controller.html`, enters the displayed code and a name, and joins. A room supports up to ten phones. The TV starts and pauses the match; unused or disconnected seats use bots. Reopening the controller in the same browser restores that phone's seat while the room remains open.

Each phone shows controls for its game. Blind Crown also shows that player's private planning board. The shared TV is the public view. Use **End room** on the TV when finished.

The connection indicator reports request round-trip time. This version uses the Site's room service to relay input, so delay varies with the connection; Scratch Match's timing is particularly sensitive. The TV runs the standalone simulation, while the service authenticates rooms and routes each phone's input. This mode does not submit competitive scores to the main party-game service.
