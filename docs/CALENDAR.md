# Calendar and meetings

Status: **manual meetings implemented in phase 4; OAuth calendar adapters are stubs**

## Current capabilities

- Manual meeting create / edit / cancel
- Participants and manual attendance recording
- Overlap detection against open work sessions
- Extensible calendar adapter interface

## Design goals for future OAuth

- Adapters for Google Calendar / Microsoft Outlook
- Encrypted OAuth tokens stored only on the server
- Avoid double-counting overlapping meeting and work intervals
- Planned meetings are not automatically treated as productive engineering output

## Limitations

- Google/Outlook OAuth is not live yet (`Null` / `Manual` adapters)
- Recurrence is not supported
- Bidirectional external calendar sync is not implemented
