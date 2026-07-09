# Reset ConnectOEE to a brand-new install state (keeps roles, permissions, dashboard/report templates).
# Usage: .\scripts\reset-fresh-install.ps1

$ErrorActionPreference = "Stop"

$sql = @'
DELETE FROM "UserPlantScopes";
DELETE FROM "AspNetUserRoles";
DELETE FROM "AspNetUserClaims";
DELETE FROM "AspNetUserLogins";
DELETE FROM "AspNetUserTokens";
DELETE FROM "AspNetUsers";

DELETE FROM "Widgets";
DELETE FROM "DashboardVersions";
DELETE FROM "Dashboards";
DELETE FROM "ReportRuns";
DELETE FROM "ReportSchedules";
DELETE FROM "MachineControlMaps";
DELETE FROM "TagMappings";
DELETE FROM "TagDefinitions";
DELETE FROM "LogicalSignals";
DELETE FROM "FaultCodeMaps";
DELETE FROM "MachineProductionStates";
DELETE FROM "ProductionRuns";
DELETE FROM "ProductRecipes";
DELETE FROM "ProductionSchedules";
DELETE FROM "ShiftCrews";
DELETE FROM "DowntimeEvents";
DELETE FROM "FaultOccurrences";
DELETE FROM "StateTransitions";
DELETE FROM ts_counts;
DELETE FROM ts_states;
DELETE FROM ts_speeds;
DELETE FROM "ShiftInstances";
DELETE FROM "ShiftAssignments";
DELETE FROM "ShiftDefinitions";
DELETE FROM "ShiftPatterns";
DELETE FROM "ShiftCalendars";
DELETE FROM "OeeConfigs";
DELETE FROM "Machines";
DELETE FROM "PlcConnections";
DELETE FROM "Lines";
DELETE FROM "Departments";
DELETE FROM "Plants";
DELETE FROM "AuditLogs";
'@

Write-Host "Resetting ConnectOEE tenant data (users + hierarchy + runtime)..."
echo $sql | docker exec -i connectoee-db psql -U connectoee -d connectoee -v ON_ERROR_STOP=1
Write-Host "Done. Restart the API and open http://localhost:5173 - you should land on the setup wizard."
