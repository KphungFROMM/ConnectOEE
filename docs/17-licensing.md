# ConnectOEE Licensing

ConnectOEE uses the same **offline HMAC-SHA256 license key** model as ConnectModbusTools and ConnectPIDTuner. Keys are generated with the internal **Connect License Generator** tool (`ConnectLicenseGen`).

## Key format

```
CONNECT-OEE-{base64url(JSON_payload)}.{base64url(HMAC-SHA256 signature)}
```

Paste the full key in **Admin → License → Activate license**.

## Editions

| Edition | Behavior |
|---------|----------|
| **Trial** | 14 days from first server start; feature limits apply |
| **Full** | Valid activated key; all features unlocked |
| **Expired** | Trial ended or key past `Expires` date |
| **Personal** | Debug builds only (full features) |

## Trial limits

| Feature | Trial | Full |
|---------|-------|------|
| Plants | 1 | Unlimited |
| Lines | 2 | Unlimited |
| PLC drivers | Mock only | Mock + Rockwell |
| PDF reports | Disabled | Enabled |
| Scheduled reports | Disabled | Enabled |
| Kiosk dashboards | 1 | Unlimited |

## Storage

License state is stored at `{ContentRootPath}/data/license.json` on the server (key hash only — the raw key is not persisted).

## Development override

In Debug builds, `PersonalLicenseService` grants full features automatically. To test trial/expired behavior in Debug, set:

```
CONNECTOEE_DEV_LICENSE=0
```

and use Release configuration, or delete `data/license.json` and adjust trial dates in the stored state.

## Connect Suite

A Connect Suite bundle from ConnectLicenseGen includes separate keys for Modbus Tools, PID Tuner, and ConnectOEE. Each product requires its own key.

## Security

- No cloud activation, accounts, or phone-home
- Signing secret is compiled into `ConnectOEE.Core` (obfuscated)
- Rotating secrets requires coordinated updates to ConnectLicenseGen and ConnectOEE
