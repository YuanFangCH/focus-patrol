# Security

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could expose user
data, authentication tokens, or AI provider credentials. Contact the repository
owner privately through GitHub instead.

Include the affected endpoint or file, reproduction steps, impact, and any
suggested fix. Do not include real API keys, JWT secrets, user records, or
violation snapshots in the report.

## Credential handling

- Never commit `.env` files, SQLite databases, uploaded images, logs, or backups.
- Configure AI provider keys through the admin panel or local environment only.
- Replace the placeholder `JWT_SECRET` and `JWT_REFRESH_SECRET` values before any
  network-facing deployment.
- If a credential is exposed, rotate it immediately and invalidate existing
  sessions before continuing deployment.
