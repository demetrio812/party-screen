# Security and privacy

## Intended use

Party Screen is a local prototype for a laptop and paired phones on a trusted Wi-Fi network. It is not designed for internet hosting or networks with untrusted participants. Keep the server behind your normal local firewall; do not port-forward it or expose it through a public tunnel.

## Existing protections

- A randomly generated six-digit pairing code and bearer token are created at each server start.
- Failed pairing attempts are limited per IP address.
- Host pairing details and host state updates require a loopback connection with a local Host header.
- Control and state APIs require the bearer token; foreign browser Origins are rejected.
- Only an explicit list of app assets is served. Arbitrary files, Python source, tests and environment files are not served.
- Command queues and request sizes have limits. Commands expire, and duplicate command IDs are suppressed within a bounded cache.
- API responses are not cached, and request logging is disabled.

## Important boundaries

- HTTP traffic is unencrypted. Anyone able to intercept it may obtain the pairing code or token and control the show.
- Pairing authorises control; it does not establish a person's identity. Paired phones share the same server token.
- The phone's Disconnect button clears that phone's stored token; it does not revoke copies. Restart the server to invalidate all current tokens.
- Local processes on the laptop can access the host pairing endpoint. The laptop itself must be trusted.
- The standard-library HTTP server is not hardened against hostile traffic or denial of service. Request size limits do not make it safe for public exposure.
- Browser storage and downloaded backups can include custom text. Review backups before sharing them.

## Publishing changes

Do not commit credentials, environment files, local backups, logs or personal media. The app does not require API keys. The repository ignore rules are a convenience, not a substitute for reviewing staged files and history.

If a credential is accidentally committed, revoke or rotate it first; removing it from the latest files does not remove it from history.

## Reporting a vulnerability

If the repository host offers private vulnerability reporting, use it. Otherwise contact the repository owner privately before disclosing exploitable details. Do not post credentials or personal data in public issues.
