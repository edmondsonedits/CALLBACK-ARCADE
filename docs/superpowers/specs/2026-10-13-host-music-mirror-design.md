# Host music and simple mirrors

The user requested two existing songs at 20% volume, enabled by default, alternating with gentle fades. Music continues from the title through the intro, main host, mirror host, game categories and pre-game lobbies. It changes to the game's soundtrack only when the authoritative game actually starts. Phones remain silent. Each browser attempts autoplay and retries on a deliberate gesture when browser policy blocks it.

After “I am a host screen,” offer Main host and Mirror host. The main host shows a separate four-digit number labeled “Duplicate the host screen.” A mirror enters that number and follows the persistent lobby, menu selection and game changes. Both host screens play music; only the main host controls games.

A layout-owned player survives client navigation. Intro and background videos retain their visuals with muted audio. Game frames report phase changes, accepted only from the current same-origin frame.

Mirror access uses a distinct HttpOnly cookie backed by a hashed token. Numeric codes are allocated atomically and disclosed only to the main host. Main games reuse the existing display projection; Online Arcade mirrors read public state through GET and never drive simulation. Session menu choices persist under the existing session version guard.
