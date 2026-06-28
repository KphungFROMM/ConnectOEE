# 06 - OEE Engine: Rich Metrics & Downtime Analytics

Beyond core A/P/Q/OEE, the engine computes a full reliability and loss-analysis metric set, calculated live and persisted at every rollup tier (hour/shift/day/week/month) so they are queryable, trendable, and reportable.

> Note: "MLTD" is not a standard acronym; it is assumed below to mean **Mean Lost Time per Downtime**. Confirm if a different metric was intended.

## Core OEE & production

- **Availability %**, **Performance %**, **Quality %**, **OEE %**.
- **TEEP %** (adds calendar/loading utilization).
- Good / Reject / Total counts, **Scrap %**, **Yield %**, **FPY** (first-pass yield).
- Ideal vs actual cycle time, actual rate vs ideal rate.
- **Performance loss** and **availability loss** minutes (loss attribution by Six Big Losses).

## Reliability / downtime metrics

Computed per machine, line, shift, reason, and fault code:

- **MTTR** - Mean Time To Repair (total down duration / number of downtime events).
- **MTBF** - Mean Time Between Failures (total uptime / number of failures).
- **MTTF** - Mean Time To Failure (non-repairable / first-failure framing).
- **MTTD** - Mean Time To Detect/acknowledge (event start -> operator acknowledgment).
- **Mean Lost Time per Downtime (assumed "MLTD")** - average lost production time per stop.
- **Failure rate (lambda)** and **availability from reliability** = MTBF / (MTBF + MTTR).
- Downtime **frequency** (stops/hour), **MTBF vs MTTR trend**, planned vs unplanned downtime split.

## Downtime breakdowns & loss model

- **Six Big Losses** categorization: breakdowns, setup/adjustments, small stops, reduced speed, startup rejects, production rejects.
- Top reasons / top categories, Pareto analysis.
- Downtime by shift / operator / machine / reason / fault code.
- Micro-stop vs major-stop classification (configurable threshold).
- Unattributed-downtime tracking.

## Surfacing

These metrics are:

- Exposed via the query engine (see 12).
- Surfaced on dashboards/template widgets (e.g. Maintenance/Fault Focus, Downtime Analysis - see 10).
- Included in reports (see 12).

## Implementation notes

- Metrics are computed live in the ingestion/OEE engine and persisted per rollup tier.
- Shift-boundary handling (see 07) ensures correct bucketing across midnight and shift changes.
- Comment non-obvious math: availability vs performance loss attribution, ideal-rate derivation, fault debounce.
