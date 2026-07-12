# ConnectOEE PLC Simulator (Studio 5000)

Autonomous multi-industry plant program for testing **ConnectOEE** over Rockwell EtherNet/IP. No operator input required — machines run, stop, fault, change SKUs, and accumulate counts on their own.

## Files

| File | Purpose |
|------|---------|
| `ConnectOEE_Sim.L5X` | Full Logix project (import into Studio 5000 v37) |
| `ConnectOEE_Sim.ACD` | Original blank ACD (optional; prefer L5X after generation) |
| `TAG_MAP.md` | ConnectOEE SignalRole → tag path cheat sheet |
| `commission-sim-plant.ps1` | Creates plant/lines/machines + maps tags via ConnectOEE API |
| `tools/Generate-ConnectOEESimL5X.ps1` | Regenerates the L5X from the machine catalog |

## Plant overview

One CompactLogix (`1769-L36ERM`) controller with **23 machines** across seven industry areas:

1. **Beverage bottling (continuous)** — Infeed → Filler → Capper → Labeler (starved/blocked cascade)
2. **Automotive assembly (discrete)** — Weld → Assemble → Test
3. **Food process (batch)** — Mixer → Cooker → Packer (SKU rotation + CIP planned down)
4. **Injection molding** — Press1 / Press2 (independent; mold-change PartId)
5. **Pharma fill/finish** — Filler → Inspector → Cartoner (lots, CIP, rework on Inspector)
6. **Film converting (web)** — Unwind → Treat → Slitter → Rewind (web break / splice / roll change)
7. **Metal coil webbing** — Uncoil → Leveler → Shear → Recoil (coil change, tip break, blank counts)

Shared AOI: `Sim_Machine` (Structured Text state machine, 100 ms SimTask tick).

### Webbing-specific behavior

| Line | Continuous web pattern | Typical stops | Counts on | PartId examples |
|------|------------------------|---------------|-----------|-----------------|
| Film | Parent roll → treat → slit → rewind | Web break (100s), splice/setup (200s), tension/starved (300s) | Slitter + Rewind | `PE-12UM`, `PET-23UM`, `BOPP-18` |
| Coil | Uncoil → level → shear → recoil | Tip break/jam (100s), coil change (200s), waiting coil (300s) | Shear + Recoil | `CRS-0.8`, `SS-1.2`, `AL-1.0` |

## Import / run

1. Open **Studio 5000 Logix Designer** (v37 recommended; matches export).
2. **File → Open** is for `.ACD` only. For the L5X:
   - Create/open a blank `1769-L36ERM` v37 project, **or**
   - Use **File → Import** / open the L5X if your workflow supports full-controller L5X open.
3. Download to **Studio 5000 Emulate / SoftLogix**, or a real L36ERM.
4. Put controller in **Run**. Leave `Plant_Running = 1` (default).
5. Note the controller Ethernet IP for ConnectOEE (Admin → PLC Connections → Rockwell EtherNet/IP, path usually `1,0`).

### Studio ST notes

AOI calls use Logix positional syntax only (no named `:=` arguments):

```text
Sim_Machine(AOI_Bev_Filler, Bev_Filler, Plant_Rng);
```

Optional force bits are written on the AOI instance tag first (`AOI_Bev_Filler.ForceStarved := ...`), then the AOI is called. SKU/`PartId` updates copy from controller `Sku_*` STRING tags (not string literals).

### Emulate tips

- No I/O modules are required; simulation is tag/timer based.
- If Studio reports AOI/ST license warnings, you still need an ST-capable license to edit ST routines; download/run usually works with the imported logic.
- If import fails on one construct, re-export from Studio after a partial import and compare — then re-run `tools/Generate-ConnectOEESimL5X.ps1` with fixes if needed.

### Regenerating the L5X

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\Generate-ConnectOEESimL5X.ps1
```

## ConnectOEE wiring

1. Start ConnectOEE API (default `http://localhost:5080`).
2. Ensure the Rockwell driver can reach the Emulate/controller IP.
3. Either map tags manually using [TAG_MAP.md](TAG_MAP.md), or run:

```powershell
.\commission-sim-plant.ps1 -PlcEndpoint "192.168.1.10"
```

Optional: `-PlcPath "1,0"` (default), `-BaseUrl "http://localhost:5080"`.

## Control tags (Operator Station)

On any `Sim_Machine_t` instance:

| Member | Effect |
|--------|--------|
| `Cmd.StartPermissive` | `0` parks machine Idle |
| `Cmd.Ack` (pulse) | Clears fault latch → Running |
| `Cmd.Reset` (pulse) | Clears fault → Idle |

Example: `Bev_Filler.Cmd.Ack` or `Film_Slitter.Cmd.Ack`

## Run-state enum (`*.RunState`)

| Value | Meaning |
|------|---------|
| 1 | Running |
| 2 | Idle |
| 3 | Down (breakdown) |
| 4 | PlannedDown (CIP) |
| 5 | Setup / changeover |
| 6 | Starved |
| 7 | Blocked |

Fault codes use ConnectOEE bands (1–99 small stop, 100–199 breakdown, 200–299 setup, 300–399 starved/blocked).

## Stop the plant

Set controller tag `Plant_Running` to `0` — all area routines drop `StartPermissive`.
