# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration holds: the Dawarich address and the API key of a user,
kept by Gladys in the integration configuration (never logged, never written to
`/data`). `/data` holds a small JSON file with the Dawarich user id, the ISO
codes of the countries already visited and the silence thresholds already
fired by the scene triggers — no coordinates, no place names. The container
only talks to the Dawarich address, over HTTP or HTTPS, and only reads (user,
statistics, points, visited countries): it never writes to Dawarich.

Location data is sensitive: coordinates and place names never reach the logs,
at any level, and the coordinates of the last position are published to Gladys
only when the user turns the option on.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and Dawarich itself (see the
[Dawarich repository](https://github.com/Freika/dawarich)).
