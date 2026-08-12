# 06 · Security, Roles & Permissions — الأمن والصلاحيات

## 6.1 Roles
| Role | Arabic | Capabilities |
|---|---|---|
| **Administrator** | مدير النظام | Everything: users, roles, settings, option lists, geometry, delete. |
| **Editor / Planner** | مخطط | Edit plot attributes & geometry, rename, link destinations; no user/role admin, no hard delete. |
| **Contributor** | مساهم | Add/edit attributes, documents, opportunities; **no delete, no geometry edits**. |
| **Viewer** | مستعرض | Read-only map, search, dashboards, export current view. |

## 6.2 Permission matrix (V1 → V2)

| Action | Admin | Editor | Contributor | Viewer |
|---|:--:|:--:|:--:|:--:|
| View map / search / dashboards | ✅ | ✅ | ✅ | ✅ |
| Export current view | ✅ | ✅ | ✅ | ✅ |
| Edit plot attributes | ✅ | ✅ | ✅ | — |
| Rename plot | ✅ | ✅ | — | — |
| Edit / reshape geometry | ✅ | ✅ | — | — |
| Create / delete plot | ✅ | ✅ (create) | — | — |
| Manage documents / opportunities | ✅ | ✅ | ✅ | — |
| Manage land-use / sectors / statuses | ✅ | — | — | — |
| Manage users & roles | ✅ | — | — | — |
| View audit log | ✅ | ✅ (own scope) | — | — |
| System settings | ✅ | — | — | — |

Permissions are enforced **server-side** (NestJS guards) on every route; the UI merely
reflects them. Never trust the client.

## 6.3 Authentication
- **V1:** email/password against `users` (bcrypt/argon2), JWT access + refresh, or
  Auth.js. Session cookie `HttpOnly; Secure; SameSite=Strict`.
- **V2:** **Keycloak** OIDC — SSO, MFA, password policy, group→role mapping; the API
  validates JWTs (JWKS) and maps claims to the role model above.

## 6.4 Authorization design
- Route guard checks `role`; policy handlers check fine-grained `permission` (e.g.
  `plot:geometry:update`). Roles map to permission sets in one place (`packages/types`).
- Object-level checks where needed (e.g. a Contributor edits only records they own, if
  that policy is enabled).

## 6.5 Auditing
- A NestJS interceptor logs every mutating request to `audit_log` with actor, action,
  `before`/`after` JSON, timestamp and IP. The log is append-only; no update/delete.
- Plot changes additionally snapshot to `plot_versions` for full rollback.

## 6.6 Data & transport security
- TLS everywhere (proxy terminates HTTPS; internal mTLS optional in V2).
- Secrets via environment/secret store (never in code or images); rotated.
- DB least-privilege roles (`app_rw`, `tiles_ro`, `migrator`).
- Input validation (DTOs + PostGIS constraints); parameterised queries only.
- File uploads: type/size validation, virus scan hook (V2), presigned MinIO URLs,
  private buckets.
- Rate limiting and CORS allow-list at the API/proxy.

## 6.7 Privacy & compliance
- Personal data limited to platform users (name, email, role); minimised and access-controlled.
- Align with Saudi PDPL: purpose limitation, access control, retention policy, audit.
- Backups encrypted at rest; access to production data logged.

## 6.8 Hardening checklist (OWASP-aligned)
Broken access control → server-side RBAC + object checks · Injection → parameterised
queries/DTOs · Auth failures → strong hashing, lockout, MFA (V2) · SSRF/file → validated
uploads, no user-supplied URLs to internal services · Logging → central, tamper-evident ·
Dependencies → automated CVE scanning in CI.
