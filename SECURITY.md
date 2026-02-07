# Security

## Reporting vulnerabilities

Please report security issues privately (do not open a public GitHub issue).

## v1 Known Risks / Notes

* The worker mounts the Docker socket to build and run deployments. This is a
  high-trust design and is **not** safe for untrusted code or multi-tenant use.
* Secrets:
  * Project env var values are encrypted at rest in Postgres.
  * The installer bootstraps the first admin via env vars; remove bootstrap
    credentials after first login.

