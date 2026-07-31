# Administration Manager Structural Refactor

Move User and Vendor editor-sheet presentation out of the Administration
workspace manager. The manager remains responsible for capabilities, selected
entity state, action invocation, and refresh behavior. No RBAC, user lifecycle,
vendor lifecycle, or audit behavior changes.

Motion: retain existing sheet and local tap behavior only; no page or tab
content animation is added.
