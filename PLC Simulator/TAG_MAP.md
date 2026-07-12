# ConnectOEE Tag Map — ConnectOEE_Sim

Use these paths in Admin → **Tag Mapping**. Prefer **UDT members** for MultiBool / DirectEnum; use **flat aliases** when you want SingleBool + simple DINTs (Fromm-style).

## Run-state ingest modes

| Mapping style | Example path | Mode |
|---------------|--------------|------|
| DirectEnum | `Bev_Filler.RunState` (DINT) | `DirectEnum` |
| MultiBool | `Bev_Filler.Status.Running` / `.Idle` / `.Faulted` | `MultiBool` |
| SingleBool | `Bev_Filler_Running` | `SingleBool` |

Counts: `CumulativeDelta` on DINT good/reject/rework.

---

## Plant / mock-catalog mirrors

| Role | Path | Type |
|------|------|------|
| RunState (bool) | `Line_Running` | BOOL |
| GoodCount | `Good_Count` | DINT |
| RejectCount | `Reject_Count` | DINT |
| DowntimeReason | `Fault_Code` | DINT |
| PartId | `Part_Id` | STRING |
| (display) | `Line_Speed` | REAL |
| MultiBool Running | `OEE_Data.Status.Running` | BOOL |
| MultiBool Faulted | `OEE_Data.Status.Faulted` | BOOL |
| MultiBool Idle | `OEE_Data.Status.Idle` | BOOL |
| Good | `OEE_Data.Counters.Good` | DINT |
| Reject | `OEE_Data.Counters.Reject` | DINT |
| Fault | `OEE_Data.FaultCode` | DINT |

`OEE_Data` mirrors **Bev_Filler** for quick MockTagCatalog-style demos.

---

## Beverage — continuous packaging

### Bev_Infeed (status only; no counts)

| Role | UDT path | Flat alias |
|------|----------|------------|
| RunState | `Bev_Infeed.RunState` | — |
| DowntimeReason | `Bev_Infeed.FaultCode` | — |
| PartId | `Bev_Infeed.PartId` | — |

### Bev_Filler (primary counts)

| Role | UDT path | Flat alias |
|------|----------|------------|
| RunState | `Bev_Filler.RunState` | `Bev_Filler_RunState` or `Bev_Filler_Running` |
| GoodCount | `Bev_Filler.Counters.Good` | `Bev_Filler_GoodCount` |
| RejectCount | `Bev_Filler.Counters.Reject` | `Bev_Filler_BadCount` |
| DowntimeReason | `Bev_Filler.FaultCode` | `Bev_Filler_FaultCode` |
| PartId | `Bev_Filler.PartId` / `Bev_Filler_PartId` | STRING (prefer flat `*_PartId` alias) |
| StartPermissive | `Bev_Filler.Cmd.StartPermissive` | — |
| Ack | `Bev_Filler.Cmd.Ack` | — |
| Reset | `Bev_Filler.Cmd.Reset` | — |

### Bev_Capper

| Role | UDT path |
|------|----------|
| RunState | `Bev_Capper.RunState` |
| DowntimeReason | `Bev_Capper.FaultCode` |
| PartId | `Bev_Capper.PartId` |

### Bev_Labeler (secondary counts)

| Role | UDT path | Flat alias |
|------|----------|------------|
| RunState | `Bev_Labeler.RunState` | `Bev_Labeler_Running` |
| GoodCount | `Bev_Labeler.Counters.Good` | `Bev_Labeler_GoodCount` |
| RejectCount | `Bev_Labeler.Counters.Reject` | `Bev_Labeler_BadCount` |
| DowntimeReason | `Bev_Labeler.FaultCode` | — |
| PartId | `Bev_Labeler.PartId` | — |

---

## Automotive — discrete assembly

### Auto_Weld

| Role | UDT path | Flat alias |
|------|----------|------------|
| RunState | `Auto_Weld.RunState` | `Auto_Weld_Running` |
| GoodCount | `Auto_Weld.Counters.Good` | `Auto_Weld_GoodCount` |
| RejectCount | `Auto_Weld.Counters.Reject` | `Auto_Weld_BadCount` |
| DowntimeReason | `Auto_Weld.FaultCode` | — |
| PartId | `Auto_Weld.PartId` | — |

### Auto_Assemble

| Role | UDT path | Flat alias |
|------|----------|------------|
| RunState | `Auto_Assemble.RunState` | `Auto_Assemble_Running` |
| GoodCount | `Auto_Assemble.Counters.Good` | `Auto_Assemble_GoodCount` |
| RejectCount | `Auto_Assemble.Counters.Reject` | `Auto_Assemble_BadCount` |
| DowntimeReason | `Auto_Assemble.FaultCode` | — |
| PartId | `Auto_Assemble.PartId` | — |

### Auto_Test (rework)

| Role | UDT path | Flat alias |
|------|----------|------------|
| RunState | `Auto_Test.RunState` | `Auto_Test_Running` |
| GoodCount | `Auto_Test.Counters.Good` | `Auto_Test_GoodCount` |
| RejectCount | `Auto_Test.Counters.Reject` | `Auto_Test_BadCount` |
| ReworkCount | `Auto_Test.Counters.Rework` | `Auto_Test_ReworkCount` |
| DowntimeReason | `Auto_Test.FaultCode` | — |
| PartId | `Auto_Test.PartId` | — |

---

## Food — batch process

| Machine | RunState | GoodCount | RejectCount | DowntimeReason | PartId |
|---------|----------|-----------|-------------|----------------|--------|
| Food_Mixer | `Food_Mixer.RunState` | `Food_Mixer.Counters.Good` | `Food_Mixer.Counters.Reject` | `Food_Mixer.FaultCode` | `Food_Mixer.PartId` |
| Food_Cooker | `Food_Cooker.RunState` | `Food_Cooker.Counters.Good` | `Food_Cooker.Counters.Reject` | `Food_Cooker.FaultCode` | `Food_Cooker.PartId` |
| Food_Packer | `Food_Packer.RunState` / `Food_Packer_RunState` | `Food_Packer.Counters.Good` / `Food_Packer_GoodCount` | `Food_Packer.Counters.Reject` / `Food_Packer_BadCount` | `Food_Packer.FaultCode` / `Food_Packer_FaultCode` | `Food_Packer.PartId` |

SKUs rotate: `SOUP-01` → `SAUCE-02` → `BROTH-03`. CIP drives PlannedDown periodically.

---

## Molding — injection presses

| Machine | RunState | GoodCount | RejectCount | DowntimeReason | PartId |
|---------|----------|-----------|-------------|----------------|--------|
| Mold_Press1 | `Mold_Press1.RunState` / `Mold_Press1_Running` | `Mold_Press1.Counters.Good` / `Mold_Press1_GoodCount` | `Mold_Press1.Counters.Reject` / `Mold_Press1_BadCount` | `Mold_Press1.FaultCode` | `Mold_Press1.PartId` (`CAP-BLK` / `CAP-WHT`) |
| Mold_Press2 | `Mold_Press2.RunState` / `Mold_Press2_Running` | `Mold_Press2.Counters.Good` / `Mold_Press2_GoodCount` | `Mold_Press2.Counters.Reject` / `Mold_Press2_BadCount` | `Mold_Press2.FaultCode` | `Mold_Press2.PartId` (`CAP-RED` / `CAP-BLU`) |

---

## Pharma — fill / finish

| Machine | RunState | GoodCount | RejectCount | ReworkCount | DowntimeReason | PartId |
|---------|----------|-----------|-------------|-------------|----------------|--------|
| Pharma_Filler | `Pharma_Filler.RunState` / `Pharma_Filler_Running` | `Pharma_Filler.Counters.Good` / `Pharma_Filler_GoodCount` | `Pharma_Filler.Counters.Reject` / `Pharma_Filler_BadCount` | — | `Pharma_Filler.FaultCode` | `Pharma_Filler.PartId` |
| Pharma_Inspector | `Pharma_Inspector.RunState` / `Pharma_Inspector_Running` | `Pharma_Inspector.Counters.Good` / `Pharma_Inspector_GoodCount` | `Pharma_Inspector.Counters.Reject` / `Pharma_Inspector_BadCount` | `Pharma_Inspector.Counters.Rework` / `Pharma_Inspector_ReworkCount` | `Pharma_Inspector.FaultCode` | `Pharma_Inspector.PartId` |
| Pharma_Cartoner | `Pharma_Cartoner.RunState` / `Pharma_Cartoner_Running` | `Pharma_Cartoner.Counters.Good` / `Pharma_Cartoner_GoodCount` | `Pharma_Cartoner.Counters.Reject` / `Pharma_Cartoner_BadCount` | — | `Pharma_Cartoner.FaultCode` | `Pharma_Cartoner.PartId` |

Lots: `LOT-1001`, `LOT-1002`, `LOT-2001`, `LOT-2002`.

---

## Film converting — continuous web

Unwind → Treat → Slitter → Rewind. Counts on **Slitter** and **Rewind** (length/cuts as part counts). Parent-roll SKU rotates.

| Machine | RunState | GoodCount | RejectCount | DowntimeReason | PartId |
|---------|----------|-----------|-------------|----------------|--------|
| Film_Unwind | `Film_Unwind.RunState` | `Film_Unwind.Counters.Good` (usually 0) | `Film_Unwind.Counters.Reject` | `Film_Unwind.FaultCode` | `Film_Unwind.PartId` |
| Film_Treat | `Film_Treat.RunState` | `Film_Treat.Counters.Good` (usually 0) | `Film_Treat.Counters.Reject` | `Film_Treat.FaultCode` | `Film_Treat.PartId` |
| Film_Slitter | `Film_Slitter.RunState` / `Film_Slitter_RunState` / `Film_Slitter_Running` | `Film_Slitter.Counters.Good` / `Film_Slitter_GoodCount` | `Film_Slitter.Counters.Reject` / `Film_Slitter_BadCount` | `Film_Slitter.FaultCode` / `Film_Slitter_FaultCode` | `Film_Slitter.PartId` |
| Film_Rewind | `Film_Rewind.RunState` / `Film_Rewind_Running` | `Film_Rewind.Counters.Good` / `Film_Rewind_GoodCount` | `Film_Rewind.Counters.Reject` / `Film_Rewind_BadCount` | `Film_Rewind.FaultCode` | `Film_Rewind.PartId` |

SKUs: `PE-12UM` → `PET-23UM` → `BOPP-18`. Web break ≈ breakdown; splice/roll change ≈ setup; tension loss ≈ starved.

Control tags (example): `Film_Slitter.Cmd.Ack` / `.Reset` / `.StartPermissive`

---

## Metal coil — strip webbing

Uncoil → Leveler → Shear → Recoil. Counts on **Shear** (blanks) and **Recoil**. Coil/gauge rotates.

| Machine | RunState | GoodCount | RejectCount | DowntimeReason | PartId |
|---------|----------|-----------|-------------|----------------|--------|
| Coil_Uncoil | `Coil_Uncoil.RunState` | `Coil_Uncoil.Counters.Good` (usually 0) | `Coil_Uncoil.Counters.Reject` | `Coil_Uncoil.FaultCode` | `Coil_Uncoil.PartId` |
| Coil_Leveler | `Coil_Leveler.RunState` | `Coil_Leveler.Counters.Good` (usually 0) | `Coil_Leveler.Counters.Reject` | `Coil_Leveler.FaultCode` | `Coil_Leveler.PartId` |
| Coil_Shear | `Coil_Shear.RunState` / `Coil_Shear_RunState` / `Coil_Shear_Running` | `Coil_Shear.Counters.Good` / `Coil_Shear_GoodCount` | `Coil_Shear.Counters.Reject` / `Coil_Shear_BadCount` | `Coil_Shear.FaultCode` / `Coil_Shear_FaultCode` | `Coil_Shear.PartId` |
| Coil_Recoil | `Coil_Recoil.RunState` / `Coil_Recoil_Running` | `Coil_Recoil.Counters.Good` / `Coil_Recoil_GoodCount` | `Coil_Recoil.Counters.Reject` / `Coil_Recoil_BadCount` | `Coil_Recoil.FaultCode` | `Coil_Recoil.PartId` |

Coils: `CRS-0.8` → `SS-1.2` → `AL-1.0`. Tip break/jam ≈ breakdown; coil change ≈ setup; waiting coil ≈ starved.

Control tags (example): `Coil_Shear.Cmd.Ack` / `.Reset` / `.StartPermissive`

---

## Recommended ConnectOEE hierarchy

| Line | Machines |
|------|----------|
| Beverage Line | Infeed, Filler, Capper, Labeler |
| Automotive Line | Weld, Assemble, Test |
| Food Line | Mixer, Cooker, Packer |
| Molding Line | Press 1, Press 2 |
| Pharma Line | Filler, Inspector, Cartoner |
| Film Converting Line | Unwind, Treat, Slitter, Rewind |
| Metal Coil Line | Uncoil, Leveler, Shear, Recoil |

For continuous beverage / film / coil topology, map **Good/Reject on the pacing machine** (Filler, Slitter, Shear) and optionally the end-of-line station; map RunState on all stations.

