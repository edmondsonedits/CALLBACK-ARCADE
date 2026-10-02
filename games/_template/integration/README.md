# Integration intake

Document the trusted simulation boundary, host lifecycle, player input schema, server validation, reconnect behavior, and test evidence here. Evidence entries in the manifest must point to real files in this folder or `tests/`.

For verified multiplayer evidence, copy `verification.example.json` to a record file, replace the example paths and digest with the exact manifest source paths and their SHA-256 values, and document only checks that actually passed. The generator verifies the JSON shape and hashes. The attestation is for automated checks only; it does not establish human playtesting.
