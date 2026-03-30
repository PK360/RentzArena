# Rentz Arena Backlog


## Trello-Ready Breakdown

Use this section as the board-input layer for Trello. Each `TR-*` item below is sized like a Trello card, grouped by epic, and aligned to the current repo state:
- multiplayer lobby flow and trick-taking table already exist
- backend auth groundwork already exists, but the final sign-in approach is still open
- ruleset parsing and isolated preview endpoints already exist
- real account session handling, Friends, Library, and Ruleset Rater are still partial or placeholder-heavy

Suggested Trello labels:
- Priority: `High Priority`, `Medium Priority`, `Low Priority`
- Area: `UI`, `API`, `Realtime`, `Auth`, `Rulesets`, `Social`, `Security`, `QA`, `Ops`
- Status: `Ready`, `Doing`, `Blocked`, `Review`, `Done`

Suggested Trello lists:
- `Backlog`
- `Bugs`
- `Ready next`
- `In Progress`
- `Testing`
- `Review`
- `Done`


## Suggested Sprint Plan

Assumption:
- 2-week sprints
- small team sequence: foundation first, then social and rulesets, then polish and release hardening

### Sprint 1 - Auth and Session Foundation
Goal: Ship a real account session flow and remove guest versus account ambiguity before building social features.
Cards: `TR-01`, `TR-02`, `TR-03`, `TR-04`, `TR-05`, `TR-06`, `TR-07`, `TR-43`, `TR-44`

### Sprint 2 - Friends, Presence, and Core Social Flow
Goal: Make the friends system usable end to end, including presence and direct room invites.
Cards: `TR-08`, `TR-09`, `TR-10`, `TR-11`, `TR-12`, `TR-13`, `TR-39`, `TR-45`

### Sprint 3 - Ruleset Authoring and Personal Library
Goal: Let creators preview, save, organize, and navigate their own rulesets cleanly.
Cards: `TR-28`, `TR-29`, `TR-30`, `TR-31`, `TR-36`, `TR-37`, `TR-38`

### Sprint 4 - Lobby Durability and Match Persistence
Goal: Make live matches resilient through better lobby controls, persistence, reconnect, and backend coverage.
Cards: `TR-16`, `TR-17`, `TR-18`, `TR-19`, `TR-20`, `TR-27`, `TR-46`

### Sprint 5 - Ruleset-Driven Gameplay and Ruleset Rater
Goal: Connect selected rulesets to real matches and open up public sharing and rating through the Ruleset Rater.
Cards: `TR-22`, `TR-23`, `TR-24`, `TR-25`, `TR-32`, `TR-33`, `TR-34`, `TR-35`

### Sprint 6 - History, Discovery, Polish, and Release Readiness
Goal: Finish public discovery, match history, notification and UX polish, then close out testing and release work.
Cards: `TR-14`, `TR-15`, `TR-21`, `TR-26`, `TR-40`, `TR-41`, `TR-42`, `TR-47`, `TR-48`, `TR-49`

### Epic A - Accounts and Session

#### TR-01 - Build the Account Login Form
Priority: `High Priority`
Area: `UI`, `Auth`
Maps to: `RA-01`

Trello checklist:
- Add the account credentials or provider entry fields to the Login page.
- Connect the form to the chosen authentication backend flow.
- Show loading, success, and inline error states.
- Keep the UI flexible enough to support the final auth method without major redesign.

#### TR-02 - Add Frontend Flow for Auth Completion and Session Bootstrap
Priority: `High Priority`
Area: `UI`, `Auth`
Maps to: `RA-01`

Trello checklist:
- Handle the post-login completion state on the client.
- Exchange the successful auth result for an app session.
- Show success, failure, and expired-session states clearly.
- Redirect into the signed-in app state after successful authentication.

#### TR-03 - Add a Real Session Mechanism After Auth Verification
Priority: `High Priority`
Area: `API`, `Auth`
Maps to: `RA-01`, `RA-19`

Trello checklist:
- Decide between cookie session and token-based session.
- Return a durable authenticated session after successful login.
- Add a `GET /api/auth/me` or equivalent session validation endpoint.
- Ensure unauthenticated and expired-session responses are explicit.

#### TR-04 - Restore the Signed-In Session on Refresh
Priority: `High Priority`
Area: `UI`, `Auth`
Maps to: `RA-01`

Trello checklist:
- Read the persisted session when the app boots.
- Rehydrate the authenticated profile before showing protected account pages.
- Clear invalid session data safely.
- Send the user back to Login when restore fails.

#### TR-05 - Separate Guest and Account Flows Cleanly Across the UI
Priority: `High Priority`
Area: `UI`
Maps to: `RA-01`

Trello checklist:
- Keep guest naming only in the Play flow.
- Keep account login only in the Login flow.
- Make it obvious which identity is active in the header and lobby.
- Prevent guest actions from looking like persistent account actions.

#### TR-06 - Replace Socket Mock Authentication With Verified Identity
Priority: `High Priority`
Area: `API`, `UI`, `Realtime`
Maps to: `RA-01`, `RA-19`

Trello checklist:
- Stop trusting arbitrary socket `authenticate` payloads.
- Attach verified user identity to socket connections.
- Reject room actions from unauthenticated or invalid sessions.
- Keep guest play supported with a deliberate guest path if desired.

#### TR-07 - Add Logout and Expired Session Handling
Priority: `High Priority`
Area: `UI`, `API`, `Auth`
Maps to: `RA-01`, `RA-19`

Trello checklist:
- Add a proper logout action.
- Clear session state across tabs or reconnects.
- Show a friendly message when the session expires.
- Avoid leaving stale profile data in local storage.

### Epic B - Social Graph, Presence, and Invites

#### TR-08 - Design Friend Relationship and Request State Model
Priority: `High Priority`
Area: `API`, `Social`
Maps to: `RA-02`, `RA-03`

Trello checklist:
- Decide how to represent pending, accepted, rejected, and blocked relationships.
- Extend the user model or add a dedicated friend-request model.
- Document duplicate prevention and mutual friendship rules.
- Define response payloads for the frontend friends page.

#### TR-09 - Add Friend Search by Friend Code
Priority: `High Priority`
Area: `API`, `UI`, `Social`
Maps to: `RA-02`

Trello checklist:
- Create a backend endpoint to search by exact friend code.
- Build the Friends page search form.
- Show player identity safely without leaking unnecessary data.
- Prevent adding yourself or re-adding an existing friend.

#### TR-10 - Build Send, Accept, Reject, and Cancel Friend Request Flows
Priority: `High Priority`
Area: `API`, `UI`, `Social`
Maps to: `RA-02`

Trello checklist:
- Add API endpoints for request lifecycle actions.
- Show pending, accepted, rejected, and canceled states in the UI.
- Make duplicate and stale actions idempotent.
- Refresh Friends page state without requiring a hard reload.

#### TR-11 - Build the Friends List Screen
Priority: `High Priority`
Area: `UI`, `Social`
Maps to: `RA-03`

Trello checklist:
- Replace the Friends placeholder with a real list view.
- Show display name, friend code, and relationship status.
- Separate incoming requests, outgoing requests, and accepted friends.
- Add empty, loading, and error states.

#### TR-12 - Publish Online, Lobby, and In-Game Presence
Priority: `High Priority`
Area: `API`, `Realtime`, `Social`
Maps to: `RA-03`

Trello checklist:
- Track whether a friend is offline, online, in a lobby, or in a game.
- Push presence updates over socket events.
- Decide how presence behaves for guests and disconnected users.
- Make sure presence does not flap on quick reconnects.

#### TR-13 - Add Direct Friend Invites to Private Rooms
Priority: `High Priority`
Area: `UI`, `API`, `Realtime`, `Social`
Maps to: `RA-04`

Trello checklist:
- Let hosts invite friends from the lobby.
- Deliver invite events to online friends.
- Show accepted, declined, expired, and timed-out states.
- Open the correct room when an invite is accepted.

### Epic C - Rooms, Lobby Lifecycle, and Match Persistence

#### TR-14 - Add Room Visibility Selection on Lobby Creation
Priority: `Medium Priority`
Area: `UI`, `API`
Maps to: `RA-14`

Trello checklist:
- Let the host choose `private`, `friends`, or `public`.
- Store the selected visibility with the game or lobby record.
- Reflect the visibility choice in the lobby UI.
- Enforce visibility rules on room discovery and join.

#### TR-15 - Build Browse and Join Flows for Public and Friends-Only Rooms
Priority: `Medium Priority`
Area: `UI`, `API`, `Realtime`
Maps to: `RA-14`

Trello checklist:
- Add a backend room discovery endpoint or socket event.
- Show joinable rooms in the app.
- Filter room visibility based on viewer relationship.
- Prevent users from joining rooms they should not see.

#### TR-16 - Improve Lobby Controls and State Management
Priority: `High Priority`
Area: `UI`, `Realtime`
Maps to: `RA-11`

Trello checklist:
- Add leave-room action for players.
- Show ready state clearly for every seat.
- Show host controls and host transfer behavior clearly.
- Show selected ruleset summary before match start.

#### TR-17 - Persist Game Records When a Match Starts
Priority: `High Priority`
Area: `API`, `Realtime`
Maps to: `RA-05`, `RA-12`

Trello checklist:
- Create the `Game` document on successful match start.
- Store host, players, room code, visibility, and selected ruleset.
- Save initial hands, turn state, and shared snapshot fields needed for recovery.
- Keep DB shape aligned with the in-memory game structure.

#### TR-18 - Persist In-Progress Match State During Play
Priority: `High Priority`
Area: `API`, `Realtime`
Maps to: `RA-05`, `RA-12`

Trello checklist:
- Update the stored game after card plays and trick resolution.
- Persist connection state per player.
- Persist collected hands, points, and final standings data.
- Avoid excessive writes or race conditions during rapid events.

#### TR-19 - Reconnect a Player Into an Active Match
Priority: `High Priority`
Area: `API`, `UI`, `Realtime`
Maps to: `RA-05`

Trello checklist:
- Let a returning player reclaim the correct seat.
- Restore hand, turn, collected hands, and current trick state.
- Show reconnecting or disconnected state to the room.
- Prevent duplicate seat ownership after reconnect.

#### TR-20 - Define Disconnect Timeout and Host Migration Rules
Priority: `High Priority`
Area: `API`, `Realtime`
Maps to: `RA-05`

Trello checklist:
- Decide how long a disconnected player can reclaim a seat.
- Decide what happens if the host disconnects in lobby or in match.
- Avoid deleting active lobbies or games too aggressively.
- Emit clear events so the frontend can explain what happened.

#### TR-21 - Save Finished Matches and Archive Standings
Priority: `Medium Priority`
Area: `API`
Maps to: `RA-12`, `RA-13`

Trello checklist:
- Mark completed games as `finished`.
- Persist final standings, ruleset, and player summary data.
- Store enough hand history to support replay or summary views.
- Make completed matches queryable per user.

### Epic D - Gameplay and Rules Engine Integration

#### TR-22 - Let the Host Choose the Ruleset Before Starting
Priority: `Medium Priority`
Area: `UI`, `API`
Maps to: `RA-11`

Trello checklist:
- Add ruleset selection UI in the lobby.
- Allow choosing from drafts, saved rulesets, or rulesets discovered through the Ruleset Rater.
- Persist the selected ruleset with the match.
- Show all players which ruleset is active.

#### TR-23 - Apply Per-Round Ruleset Logic During Match Progression
Priority: `High Priority`
Area: `API`, `Rulesets`, `Realtime`
Maps to: `RA-11`

Trello checklist:
- Evaluate the selected per-round ruleset when hand results are ready.
- Update points consistently for every player.
- Persist the resulting snapshot or score delta for later review.
- Surface parse or runtime failures without corrupting the match.

#### TR-24 - Apply End-Game Rules and Early Termination Logic
Priority: `Medium Priority`
Area: `API`, `Rulesets`, `Realtime`
Maps to: `RA-11`, `RA-13`

Trello checklist:
- Evaluate end-game rules when the match finishes.
- Support `game_end()` semantics safely.
- Merge end-game scoring into final standings.
- Prevent ruleset failures from crashing the socket flow.

#### TR-25 - Add In-Game Scoreboard and Match Metadata
Priority: `Medium Priority`
Area: `UI`
Maps to: `RA-13`

Trello checklist:
- Show current points and total points where relevant.
- Show active ruleset name and type.
- Show dealer, current turn, and trick status clearly.
- Keep the table readable on smaller screens.

#### TR-26 - Build Post-Game Summary and Replay Timeline
Priority: `Medium Priority`
Area: `UI`, `API`
Maps to: `RA-12`, `RA-13`

Trello checklist:
- Show final standings with scoring breakdown.
- Show hand-by-hand winners and score changes.
- Let players inspect collected hands after the game ends.
- Make the summary reachable from both the game end screen and match history.

#### TR-27 - Close Gameplay Edge Cases and Validation Gaps
Priority: `High Priority`
Area: `API`, `Realtime`, `QA`
Maps to: `RA-18`, `RA-20`

Trello checklist:
- Validate illegal moves, duplicate events, and out-of-turn actions.
- Handle room-not-found, game-already-started, and stale-room cases cleanly.
- Verify card dealing and trick resolution across supported player counts.
- Confirm gameplay still behaves correctly after reconnects and lag spikes.

### Epic E - Ruleset Editor, Library, and Ruleset Rater

#### TR-28 - Expand the Ruleset Preview Simulator UI
Priority: `High Priority`
Area: `UI`, `Rulesets`
Maps to: `RA-06`

Trello checklist:
- Add fields for player count, initial points, hand cards, and non-discarded cards.
- Call `POST /api/rulesets/evaluate-preview`.
- Show evaluation result next to the parser AST.
- Keep the draft intact when parse or evaluation errors occur.

#### TR-29 - Add Backend CRUD Endpoints for Personal Rulesets
Priority: `High Priority`
Area: `API`, `Rulesets`
Maps to: `RA-07`

Trello checklist:
- Add create, update, read, and list endpoints for user-owned rulesets.
- Restrict edit access to the owner.
- Support draft and published states cleanly.
- Return enough metadata for library cards and lobby pickers.

#### TR-30 - Save Drafts and Authored Rulesets to Account Library
Priority: `High Priority`
Area: `UI`, `API`, `Rulesets`
Maps to: `RA-07`

Trello checklist:
- Move beyond device-only local storage drafts.
- Save ruleset drafts to the authenticated account.
- Keep fast local iteration if desired, but sync with backend data.
- Support editing an existing saved ruleset.

#### TR-31 - Replace the Library Placeholder With a Real Library Page
Priority: `High Priority`
Area: `UI`, `Rulesets`
Maps to: `RA-07`

Trello checklist:
- Show authored, saved, and recently used rulesets.
- Add empty, loading, and error states.
- Add actions for open, edit, duplicate, and delete where appropriate.
- Make rulesets saved from the Ruleset Rater easy to distinguish from authored ones.

#### TR-32 - Add Publish and Unpublish Flow for Creator Rulesets
Priority: `Medium Priority`
Area: `UI`, `API`, `Rulesets`
Maps to: `RA-08`

Trello checklist:
- Add title, description, tags, and visibility controls.
- Validate a ruleset before publication.
- Support unpublish or republish without losing ownership history.
- Store author and version metadata needed for Ruleset Rater display.

#### TR-33 - Build Ruleset Rater Browse, Filter, and Sort
Priority: `Medium Priority`
Area: `UI`, `API`, `Rulesets`
Maps to: `RA-09`

Trello checklist:
- Replace the Ruleset Rater placeholder with a real browse screen.
- Fetch public rulesets from the backend.
- Add filters for type, tags, author, and popularity.
- Add sorting for recent, upvoted, and downloaded.

#### TR-34 - Add Upvote, Download, and Save Actions
Priority: `Medium Priority`
Area: `UI`, `API`, `Rulesets`
Maps to: `RA-10`

Trello checklist:
- Add a one-vote-per-user upvote flow.
- Track download counts consistently.
- Let the user save rulesets from the Ruleset Rater into their library.
- Reflect action counts in the Ruleset Rater UI.

#### TR-35 - Add Ruleset Selection From Library or Ruleset Rater Into the Lobby
Priority: `Medium Priority`
Area: `UI`, `API`, `Rulesets`
Maps to: `RA-11`

Trello checklist:
- Open a ruleset picker from the lobby.
- Show personal drafts, saved rulesets, and Ruleset Rater picks.
- Confirm the host selection to all players before start.
- Persist the chosen ruleset with the game record.

#### TR-36 - Improve Ruleset Guide and DSL Documentation
Priority: `Medium Priority`
Area: `UI`, `Rulesets`
Maps to: `RA-06`, `RA-08`

Trello checklist:
- Expand the in-app guide with more examples and edge cases.
- Document the actual variable names and command syntax supported by the engine.
- Add authoring tips for `per_round` versus `end_game`.
- Link validation errors to guide sections where possible.

### Epic F - Frontend Structure, UX, and Product Polish

#### TR-37 - Split the Monolithic Frontend App Into Feature Modules
Priority: `Medium Priority`
Area: `UI`
Maps to: `RA-18`, `RA-22`

Trello checklist:
- Break `frontend/src/App.jsx` into feature components and hooks.
- Separate play, lobby, table, editor, login, and settings concerns.
- Reduce shared state sprawl.
- Make future UI work easier to test and review.

#### TR-38 - Introduce Real Client Routing for Login, Verify, Play, Editor, Library, and Ruleset Rater
Priority: `Medium Priority`
Area: `UI`
Maps to: `RA-01`, `RA-07`, `RA-09`

Trello checklist:
- Add route-based navigation instead of one large tab-state shell.
- Support deep links for auth verification and library pages.
- Preserve protected-route behavior for account-only areas.
- Keep route transitions compatible with the existing app shell design.

#### TR-39 - Replace Placeholder Screens With Production-Ready Page States
Priority: `High Priority`
Area: `UI`
Maps to: `RA-02`, `RA-07`, `RA-09`, `RA-15`

Trello checklist:
- Replace placeholder copy on Friends, Library, and Ruleset Rater pages.
- Add loading skeletons, empty states, and inline error handling.
- Make success feedback and recovery paths clear.
- Remove confusing dead-end interactions.

#### TR-40 - Build an In-App Notification Inbox
Priority: `Low Priority`
Area: `UI`, `API`, `Realtime`, `Social`
Maps to: `RA-15`

Trello checklist:
- Store unread invites and social notifications.
- Add an inbox view and unread badge.
- Let users dismiss or mark notifications as read.
- Include invite, friend activity, and Ruleset Rater-related events.

#### TR-41 - Accessibility Baseline Pass
Priority: `High Priority`
Area: `UI`, `QA`
Maps to: `RA-16`

Trello checklist:
- Verify keyboard navigation through login, lobby, gameplay, and editor flows.
- Add accessible names, labels, and roles to custom controls.
- Improve focus visibility and contrast where needed.
- Validate core flows with screen-reader-friendly semantics.

#### TR-42 - Responsive and Device Quality Pass
Priority: `High Priority`
Area: `UI`, `QA`
Maps to: `RA-17`

Trello checklist:
- Verify phone, tablet, and desktop breakpoints for the lobby and table.
- Fix overflow issues on dense card layouts and side panels.
- Check font scaling and subpage zoom interactions.
- Make sure gameplay remains usable on narrower screens.

### Epic G - Security, Testing, and Operations

#### TR-43 - Harden Validation and Sanitization for User Inputs
Priority: `High Priority`
Area: `API`, `Security`
Maps to: `RA-19`

Trello checklist:
- Validate email, display name, friend code, and ruleset payloads consistently.
- Sanitize user-provided text before persistence or rendering.
- Reject malformed gameplay and room inputs early.
- Standardize backend error shapes for frontend handling.

#### TR-44 - Add Abuse Protection for Auth and Public Endpoints
Priority: `High Priority`
Area: `API`, `Security`, `Ops`
Maps to: `RA-19`

Trello checklist:
- Add rate limiting to authentication request endpoints.
- Protect ruleset publication and Ruleset Rater actions from obvious abuse.
- Consider invite spam protections.
- Document any guest-play abuse limits.

#### TR-45 - Add Structured Logging and Better Runtime Diagnostics
Priority: `Medium Priority`
Area: `API`, `Realtime`, `Ops`
Maps to: `RA-21`

Trello checklist:
- Include request context and room code in backend logs.
- Add meaningful socket lifecycle logging for lobby and gameplay events.
- Avoid logging sensitive auth data.
- Make production issue triage easier for reconnect and gameplay bugs.

#### TR-46 - Expand Automated Backend Coverage
Priority: `High Priority`
Area: `API`, `QA`
Maps to: `RA-18`, `RA-22`

Trello checklist:
- Add tests for auth routes and session behavior.
- Add tests for ruleset CRUD and Ruleset Rater endpoints.
- Add tests for game persistence and history retrieval.
- Add socket-flow coverage for create, join, ready, start, play, and reconnect.

#### TR-47 - Add Frontend or End-to-End Coverage for Core Journeys
Priority: `High Priority`
Area: `UI`, `QA`
Maps to: `RA-18`, `RA-22`

Trello checklist:
- Cover login and session restore.
- Cover create room, join room, ready up, and start match.
- Cover play-card flow and post-game summary.
- Cover ruleset preview and save flow.

#### TR-48 - Add CI Quality Gates for Lint, Test, and Build
Priority: `Medium Priority`
Area: `Ops`, `QA`
Maps to: `RA-22`

Trello checklist:
- Run frontend build automatically in CI.
- Run backend tests and lint checks automatically.
- Require passing checks before merge.
- Document how to run the same checks locally.

#### TR-49 - Document Deployment, Mailer, and Recovery Runbooks
Priority: `Low Priority`
Area: `Ops`
Maps to: `RA-21`, `RA-23`

Trello checklist:
- Document environment variables for backend, frontend, Mongo, and mail delivery.
- Document Docker-based local and shared environment startup.
- Add backup and restore notes for MongoDB data.
- Define basic recovery expectations for auth, rulesets, and game history.

The detailed story backlog below remains unchanged and can be used as the higher-level product view behind the Trello cards.


This backlog is ordered from highest to lower priority and mixes functional and non-functional work. It is based on the current state of the project: multiplayer table play exists, the rules engine and ruleset parsing endpoints exist, while account UI, friends, library, and Ruleset Rater are still partial or placeholder-only.

Priority guide:
- `High Priority`: critical for a usable end-to-end product
- `Medium Priority`: important for retention, creator workflow, and multiplayer quality
- `Low Priority`: valuable polish or scale work after the core loop is stable

## Functional User Stories


### RA-01 - Session Persistence Across Refresh
Priority: `High Priority`
Type: `Functional`

User story:
As a signed-in player, I want my session to survive a refresh, so that I do not have to re-authenticate during normal use.

Acceptance criteria:
- The frontend restores the signed-in player on page reload.
- Expired or invalid sessions are cleared safely and the user is sent back to Login.
- Guest and authenticated flows remain clearly separated in the UI.

### RA-02 - Friend Code Search and Add Friend Flow
Priority: `High Priority`
Type: `Functional`

User story:
As a player, I want to add friends using friend codes, so that I can build a reusable multiplayer network.

Acceptance criteria:
- The Friends page supports searching by friend code and sending a friend request or direct add action.
- The user can see pending, accepted, and rejected states.
- Duplicate friend relationships are prevented.

### RA-03 - Friends List and Presence
Priority: `High Priority`
Type: `Functional`

User story:
As a player, I want to see my friends list and whether friends are online, so that I know whom I can invite to a table.

Acceptance criteria:
- The Friends page lists saved friends with display name, friend code, and current presence.
- Presence updates when a friend comes online, enters a lobby, or starts a game.
- Offline and unavailable states are visually distinct.

### RA-04 - Invite Friends to a Private Table
Priority: `High Priority`
Type: `Functional`

User story:
As a host, I want to invite friends directly into my room, so that I do not have to rely only on sharing a room code out of band.

Acceptance criteria:
- A host can invite one or more friends from the lobby.
- Invited players can accept and join the correct room from the app.
- The lobby shows who was invited and whether they accepted, declined, or timed out.

### RA-05 - Reconnect to an Active Match
Priority: `High Priority`
Type: `Functional`

User story:
As a player with a temporary disconnect, I want to rejoin my in-progress game, so that I do not lose my seat or break the match.

Acceptance criteria:
- A disconnected player can reconnect and recover hand, turn, collected hands, and current trick state.
- The lobby or table reflects player connection state.
- A reconnect timeout policy is defined and enforced.

### RA-06 - Ruleset Preview Simulation in the Editor
Priority: `High Priority`
Type: `Functional`

User story:
As a ruleset author, I want to simulate a ruleset against sample hand data, so that I can validate the behavior before publishing or using it in a game.

Acceptance criteria:
- The editor exposes a preview form for player count, initial points, hand cards, and non-discarded cards.
- The frontend calls the existing evaluate preview endpoint and shows the result clearly.
- Parse or evaluation errors are explained inline without wiping the draft.

### RA-07 - Save Rulesets to Account Library
Priority: `High Priority`
Type: `Functional`

User story:
As a ruleset author, I want my saved drafts and published rulesets tied to my account, so that I can access them across devices.

Acceptance criteria:
- The Library page lists authored, saved, and recently used rulesets for the current user.
- A signed-in user can save or update a ruleset from the editor.
- Rulesets are loaded from the backend, not only local storage.

### RA-08 - Publish Rulesets to the Ruleset Rater
Priority: `Medium Priority`
Type: `Functional`

User story:
As a creator, I want to publish a ruleset with title, description, tags, and visibility, so that other players can discover and use it.

Acceptance criteria:
- A signed-in author can publish or unpublish a ruleset.
- Published rulesets include author, description, type, tags, and code version metadata.
- Invalid or unsafe rulesets are rejected before publication.

### RA-09 - Ruleset Rater Browse, Filter, and Sort
Priority: `Medium Priority`
Type: `Functional`

User story:
As a player, I want to browse and filter public rulesets, so that I can quickly find interesting game variants.

Acceptance criteria:
- The Ruleset Rater page shows public rulesets from the backend.
- Players can filter by type, tags, author, and popularity.
- Sorting supports recent, most upvoted, and most downloaded.

### RA-10 - Upvote, Download, and Save Rulesets
Priority: `Medium Priority`
Type: `Functional`

User story:
As a player, I want to upvote and save useful rulesets, so that high-quality variants rise and I can reuse them later.

Acceptance criteria:
- A player can upvote a ruleset once and remove their vote later.
- Download and save counts are updated consistently.
- Rulesets saved from the Ruleset Rater appear in the player library.

### RA-11 - Select Rulesets Before Starting a Match (!!!)
Priority: `Medium Priority`
Type: `Functional`

User story:
As a host, I want to choose the active rulesets before starting a match, so that the game uses the intended scoring and end-game behavior.

Acceptance criteria:
- A host can pick from personal drafts, saved rulesets, or Ruleset Rater rulesets in the lobby.
- All players see which ruleset is active before the game starts.
- The selected ruleset is persisted with the game record.

### RA-12 - Match History and Final Standings Archive (!!!!!!!)
Priority: `Medium Priority`
Type: `Functional`

User story:
As a player, I want to review previous games and standings, so that I can track outcomes and revisit memorable matches.

Acceptance criteria:
- A player can open a history view of completed games.
- Each record includes room code, date, players, ruleset, and final standings.
- A completed game can be opened from history for a summary view.

### RA-13 - Post-Game Summary and Replay Timeline (legat de tabel, nu joc in sine)
Priority: `Medium Priority`
Type: `Functional`

User story:
As a player, I want a richer post-game breakdown, so that I can understand how the match unfolded and why someone won.

Acceptance criteria:
- The end-of-game screen shows hand-by-hand winners and scoring changes.
- Players can inspect collected hands and round events after the match ends.
- The summary makes it easy to compare player performance.

### RA-14 - Public and Friends-Only Room Visibility
Priority: `Low Priority`
Type: `Functional`

User story:
As a host, I want to choose whether a room is private, friends-only, or public, so that I can control who can discover and join it.

Acceptance criteria:
- Room visibility can be chosen when creating a lobby.
- Friends-only and public rooms respect the selected visibility rules.
- Players can browse joinable public or friends-only rooms from the app.

### RA-15 - In-App Notifications and Activity Inbox
Priority: `Low Priority`
Type: `Functional`

User story:
As a player, I want to see invites, friend activity, and Ruleset Rater updates in one place, so that I stay aware of relevant events without leaving the app.

Acceptance criteria:
- The app records unread invites and social or content notifications.
- The user can review and dismiss notifications from a dedicated inbox.
- Notification badges appear in the shell when unread items exist.

## Non-Functional User Stories

### RA-16 - Accessibility Baseline
Priority: `High Priority`
Type: `Non-Functional`

User story:
As a player with accessibility needs, I want the interface to meet a strong accessibility baseline, so that the game is readable and usable for more people.

Acceptance criteria:
- All major interactive flows are keyboard navigable.
- Theme palettes meet agreed color-contrast targets for primary and secondary text.
- UI controls expose accessible names, focus states, and semantic roles.

### RA-17 - Responsive Quality and Device Support
Priority: `High Priority`
Type: `Non-Functional`

User story:
As a mobile or tablet player, I want consistent responsive behavior across screen sizes, so that matches remain playable and readable on smaller devices.

Acceptance criteria:
- Core flows are verified on common phone, tablet, and desktop breakpoints.
- Overflow behavior is intentional and documented for dense layouts such as card hands.
- Settings-based font scaling and subpage zoom do not make the app unusable.

### RA-18 - Automated Test Coverage for Core Flows
Priority: `High Priority`
Type: `Non-Functional`

User story:
As a developer, I want automated test coverage for game logic and critical user flows, so that new changes do not break multiplayer, auth, or ruleset execution.

Acceptance criteria:
- Rules engine tests cover parsing, evaluation, and failure cases.
- API tests cover auth, rulesets, and game retrieval.
- Frontend or end-to-end tests cover login, lobby join, gameplay, and ruleset preview.

### RA-19 - Security Hardening for Auth and User Input
Priority: `High Priority`
Type: `Non-Functional`

User story:
As a platform owner, I want authentication and user input to be hardened, so that accounts and backend services are protected from abuse.

Acceptance criteria:
- User-entered fields are sanitized and validated consistently.
- Sensitive tokens and secrets are never exposed to the client or logs.

### RA-20 - Performance and Real-Time Reliability Targets
Priority: `Medium Priority`
Type: `Non-Functional`

User story:
As a player in a live match, I want responsive table updates and stable socket behavior, so that the game feels immediate and trustworthy.

Acceptance criteria:
- The team defines latency and render targets for turn updates and hand transitions.
- Socket reconnect and retry behavior is monitored and tested.
- Heavy UI views such as collected hands and history remain responsive on modest devices.

### RA-21 - Observability and Support Diagnostics
Priority: `Medium Priority`
Type: `Non-Functional`

User story:
As a maintainer, I want structured logs and actionable diagnostics, so that multiplayer issues and production failures are easier to investigate.

Acceptance criteria:
- Backend logs include request context, room code, and failure metadata.
- Client-side errors can be correlated to backend events where appropriate.
- Health and readiness checks are sufficient for deployment monitoring.

### RA-22 - CI/CD and Release Quality Gate
Priority: `Medium Priority`
Type: `Non-Functional`

User story:
As a development team, I want a repeatable release pipeline, so that changes are validated before they reach shared environments.

Acceptance criteria:
- Linting, tests, and production builds run automatically in CI.
- Pull requests must pass the agreed quality gate before merge.
- Deployment steps are documented and reproducible.

### RA-23 - Data Retention and Recovery
Priority: `Low Priority`
Type: `Non-Functional`

User story:
As a product owner, I want backup and recovery guidance for user, game, and ruleset data, so that accidental loss or infrastructure failure does not wipe the platform state.

Acceptance criteria:
- The team defines what data must be retained and for how long.
- Backup and restore procedures are documented and tested.
- Recovery objectives are agreed for critical production data.
