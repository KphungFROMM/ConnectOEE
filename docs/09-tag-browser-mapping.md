# 09 - Live Tag Browser & Tag Mapping

When the driver supports tag enumeration, provide a full live tag browser. When it does not, fall back to manual entry.

## Live tag browser features

- Hierarchical browsing of controller tags, program tags, AOIs, and UDTs.
- Expand/collapse tree structure (virtualized for large controllers).
- Live value preview with timestamp + quality.
- Search and filter by name or type.
- Metadata panel: type, path, array size, description.
- Bind tags to logical signals via UI.
- Bind tags to widgets in the WYSIWYG builder.
- Real-time updates via SignalR.
- Fallback to manual entry if the driver does not support browsing.
- Only Admins/Supervisors can browse tags.

## Tag mapping UI

- Bind a discovered tag or UDT member to a `LogicalSignal` (run state, good count, reject count, speed, fault code, etc.).
- Validate type compatibility between tag and logical signal.
- Show current live value while mapping for confidence.
- Persist as `TagMapping`; changes are audited.

## UDT in the browser

- Nested UDTs render as expandable subtrees.
- UDT arrays and nested arrays are browsable and bindable.
- Member metadata and flattened historian path shown in the metadata panel.

See 08 for driver/UDT internals and 11 for widget binding.
