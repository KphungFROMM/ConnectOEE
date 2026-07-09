# 16 - Factory Deployment Security

Operational guide for deploying ConnectOEE on manufacturing floors with acceptable OT cybersecurity posture.

## Reference network topology

```
[Operator HMIs / Andon PCs]  --HTTPS:443-->  [ConnectOEE Windows Service + PostgreSQL]
                                                      |
                                           outbound EtherNet/IP only
                                                      v
                                              [PLC subnet Level 2]
```

**Firewall rules (minimum):**

| Rule | Action |
|------|--------|
| OT clients → ConnectOEE `:443` | Allow |
| ConnectOEE host → PLC subnet (EtherNet/IP) | Allow (outbound only) |
| OT VLAN → Internet | Deny |
| Plant LAN → Postgres `:5432` | Deny (co-locate DB or private subnet) |
| PLC subnet → ConnectOEE inbound | Deny (ConnectOEE initiates reads) |

## TLS / HTTPS

**Production default:** install the Windows Service on `https://0.0.0.0:443` with a PFX certificate:

```powershell
./scripts/install-service.ps1 `
  -BinPath "C:\ConnectOEE\publish\ConnectOEE.Api.exe" `
  -Url "https://0.0.0.0:443" `
  -CertificatePath "C:\ConnectOEE\certs\connectoee.pfx" `
  -CertificatePassword "..." `
  -ConnectionString "Host=localhost;...;SSL Mode=Prefer"
```

**Alternative:** terminate TLS at IIS or nginx and proxy to ConnectOEE on localhost HTTP. Document the proxy in your site security packet.

Set `Security:RequireHttps=true` in production (`appsettings.Production.json`).

## Secrets

| Secret | Where to set |
|--------|----------------|
| DB connection | Machine env `CONNECTOEE_CONNECTION` (install script) |
| JWT signing key | Machine env `Jwt__SigningKey` (32+ chars, random) |
| Backup encryption | Machine env `Security__BackupEncryptionKey` (base64, 32 bytes) |
| TLS PFX password | Machine env `Security__CertificatePassword` |

On Windows, prefer DPAPI-wrapped values prefixed with `dpapi:` (see `WindowsSecretProtector`).

**Never** commit production secrets to git. Replace the placeholder in `appsettings.json` before go-live.

## Application security controls (built-in)

| Control | Implementation |
|---------|----------------|
| RBAC | Server-side `[HasPermission]` on all sensitive APIs |
| Plant/line scope | `ScopeAccessService` on Live, Historian, Events, SignalR |
| SignalR auth | `[Authorize]` on `LiveHub`; kiosk cookie for displays |
| Kiosk sessions | Signed httpOnly cookie via `POST /api/dashboards/kiosk/{id}/session` |
| Session hygiene | 15 min idle timeout on `/operator` and `/admin`; refresh tokens in httpOnly cookie |
| Account lockout | 5 failures → 15 min lockout |
| Password policy | 8+ chars, upper, lower, digit (server + client) |
| MFA | TOTP for Admin via `/api/auth/mfa/*` |
| Rate limiting | 20 login attempts/min per instance |
| Security headers | CSP, X-Frame-Options, HSTS (production) |
| Audit | Append-only `AuditLogs` + middleware + Admin export |
| Encrypted backups | Optional AES-GCM when `Security:BackupEncryptionKey` set |

## Security commissioning

Before go-live, open **Admin → System → Security commissioning**. All checks must pass:

1. HTTPS enabled (or documented reverse-proxy TLS)
2. No users with `MustChangePassword` flag (change seeded accounts)
3. MFA enabled for every Admin account
4. Production JWT signing key configured

Also complete the line **Commissioning readiness** checks (tags, kiosk, PLC).

## Admin MFA enablement

Every Admin account must have TOTP MFA before go-live (security commissioning check `adminMfa`).

1. Sign in as each Admin user.
2. Call `GET /api/auth/mfa/setup` (authenticated) — returns `sharedKey` and `authenticatorUri` for the authenticator app.
3. Scan the URI in Microsoft Authenticator, Google Authenticator, or compatible TOTP app.
4. Submit the 6-digit code: `POST /api/auth/mfa/enable` with body `{ "code": "123456" }`.
5. Confirm **Admin → System → Security commissioning** shows **MFA enabled for all Admin accounts** as green.
6. Store recovery procedures per your IT policy (disable via `POST /api/auth/mfa/disable` with a valid code if a device is lost).

Set `Jwt__SigningKey` on the host before production (`32+` random characters). The API logs a startup warning if Production still uses the development placeholder from `appsettings.json`.

## Kiosk / Andon PCs

1. Publish a **Public Kiosk** dashboard bound to a line (Builder).
2. On the wall PC, open ConnectOEE login → **Display a dashboard**.
3. Select dashboard → **Open and remember** (establishes signed session cookie).
4. Configure **Microsoft Edge kiosk mode** (assigned access) to prevent browsing.
5. Tap once for browser full-screen.

Kiosk data is line-scoped and requires the session cookie — not open to anonymous LAN scraping.

## Compensating controls (until fully hardened)

If shipping before all checks are green:

1. Deploy on an **isolated OT VLAN**; firewall to HMIs/Andon only
2. **Change all seeded passwords** immediately (`supervisor`, `manager`, `operator`)
3. Co-locate Postgres; **do not expose port 5432** to the plant LAN
4. Block internet egress from ConnectOEE host and OT clients
5. Restrict PLC subnet so only ConnectOEE initiates EtherNet/IP
6. Use per-operator accounts (no shared `operator` login on HMIs)

## Windows host hardening (checklist)

- [ ] Automatic security updates enabled (or WSUS-managed)
- [ ] ConnectOEE service runs as a **least-privilege** local account (not Administrator)
- [ ] RDP disabled or restricted to jump host
- [ ] Windows Firewall: allow 443 inbound from OT VLAN only
- [ ] Antivirus exclusions documented for Postgres data dir + ConnectOEE logs (if required by IT)

## Certificate rotation

1. Obtain new PFX from AD CS or internal CA
2. Stop ConnectOEE service
3. Update `Security__CertificatePath` / PFX file
4. Start service; verify `/health` over HTTPS
5. Update Andon/kiosk bookmarks if hostname changes

## Backup & recovery

- On-demand backups: **Admin → System → Backup** (`pg_dump`, optional `.enc` encryption)
- Store encrypted backups off-host per IT policy
- Test restore on a staging VM quarterly

## Compliance overlays

| Standard | ConnectOEE alignment |
|----------|------------------------|
| IEC 62443 | Zone/conduit doc above; scope + audit + outbound-only PLC |
| ISO 27001 | Use security commissioning + audit export as evidence |
| FDA 21 CFR Part 11 | Requires additional IQ/OQ/PQ validation (not included) |

See also [15-commissioning-qa.md](15-commissioning-qa.md) and [05-rbac-security-audit.md](05-rbac-security-audit.md).
