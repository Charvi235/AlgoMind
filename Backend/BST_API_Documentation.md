# Binary Search Tree (BST) Module API Documentation

## 1. Overview

The BST module implements the **BST Builder** game in two modes:

| Mode | Transport | Purpose |
|---|---|---|
| Solo | REST over HTTP | Generate a number sequence, validate placements, and submit a score |
| Live | Socket.IO | Run a timed, two-player BST-building match with server-authoritative move validation |

The REST routes are mounted at `/api/games/bst`. Live matches use the application's Socket.IO server and the shared room/matchmaking events.

## 2. Base URL and Requirements

Use the backend origin configured for the deployment. The local development backend defaults to port `5000`.

The backend requires `MONGODB_URI` and `JWT_SECRET`. In production, `CLIENT_URL` must also be set. Socket.IO connections require a valid JWT unless the client explicitly connects as a guest; guest connections are limited to BST room-code matches.

All REST request bodies must be JSON and use `Content-Type: application/json`.

## 3. BST Rules and Data

A valid BST placement follows these rules:

* Values smaller than a node go in its left subtree.
* Values larger than a node go in its right subtree.
* Duplicate values are not accepted.
* Live matches require players to place the generated values in sequence order.
* The server calculates the correct insertion parent and side for every live move.

Question values are distinct multiples of five from `10` through `90`. The default question contains seven values. The first value is used as the root; the remaining values are placed in sequence.

The backend represents a node as:

```ts
interface BSTNode {
  value: number;
  left: BSTNode | null;
  right: BSTNode | null;
}
```

## 4. REST API

### 4.1 Generate a Question

**`GET /api/games/bst/question`**

Generates a new sequence and creates a database match record.

#### Query parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `count` | integer | No | Number of distinct values to generate. Defaults to `7`. The generator has 17 possible values (`10`–`90`, step `5`); use a value from `1` through `17`. The endpoint does not validate this range. |

#### Example request

```http
GET /api/games/bst/question?count=7
```

#### Success response — `200 OK`

```json
{
  "success": true,
  "data": {
    "matchId": "bst_1234abcd",
    "numbers": [50, 20, 80, 30, 70, 10, 90]
  }
}
```

`numbers[0]` is the root. The remaining values are the required insertion sequence.

#### Error response — `500 Internal Server Error`

```json
{
  "success": false,
  "message": "Server Error"
}
```

### 4.2 Validate a Placement

**`POST /api/games/bst/validate`**

Checks whether `value` is on the requested side of `parentValue`.

#### Request body

| Field | Type | Required | Description |
|---|---|---:|---|
| `parentValue` | number | Yes | Value of the proposed parent node |
| `side` | `"left"` or `"right"` | Yes | Proposed child side |
| `value` | number | Yes | Value to place |

#### Example request

```http
POST /api/games/bst/validate
Content-Type: application/json
```

```json
{
  "parentValue": 50,
  "side": "left",
  "value": 30
}
```

#### Success response — `200 OK`

```json
{
  "success": true,
  "valid": true
}
```

An invalid left/right comparison also returns `200 OK`, with `"valid": false`.

#### Error response — `400 Bad Request`

Returned when `parentValue`, `side`, or `value` is missing:

```json
{
  "success": false,
  "message": "Invalid payload parameters"
}
```

#### Validation scope

This REST endpoint checks only the comparison between the submitted value and its immediate parent. It does not receive the current tree or match state, so it cannot verify ancestor constraints, duplicates elsewhere in the tree, or the required sequence order. The live Socket.IO move handler performs those checks against the server's current tree.

### 4.3 Submit a Score

**`POST /api/games/bst/submit`**

Submits a solo-game score. If a truthy `matchId` is supplied and matches a stored record, the backend updates that record's `score` and sets `completed` to `true`.

#### Request body

| Field | Type | Required | Description |
|---|---|---:|---|
| `matchId` | string | No | ID returned by the question endpoint; used to update the stored match |
| `score` | number | No | Score to store |
| `placed` | array | No | Placement list; its length is returned as `placedCount` |

#### Example request

```http
POST /api/games/bst/submit
Content-Type: application/json
```

```json
{
  "matchId": "bst_1234abcd",
  "score": 60,
  "placed": [20, 80, 30, 70, 10, 90]
}
```

#### Success response — `200 OK`

```json
{
  "success": true,
  "message": "BST challenge results recorded successfully",
  "data": {
    "score": 60,
    "placedCount": 6
  }
}
```

The endpoint currently responds successfully even if `matchId` is omitted or does not identify a stored record. In those cases, no match record is updated.

#### Error response — `500 Internal Server Error`

```json
{
  "success": false,
  "message": "Submission Server Error"
}
```

## 5. Live Matches (Socket.IO)

### 5.1 Connection Authentication

Connect to the backend Socket.IO server with one of these authentication payloads:

Authenticated user:

```js
io(API_BASE_URL, {
  auth: { token: "<JWT>" }
});
```

Guest:

```js
io(API_BASE_URL, {
  auth: { guest: true, username: "Guest Player" }
});
```

Guest names are sanitized by the server. Guests may create and join BST room-code matches, but cannot use random matchmaking. A client-provided `userId` is not accepted as a substitute for JWT identity.

### 5.2 Start a Match by Room Code

1. The host emits `create_room`:

   ```js
   socket.emit("create_room", { gameType: "bst" });
   ```

2. The server replies with `room_created`:

   ```json
   {
     "roomId": "room-uuid",
     "code": "ABC234",
     "gameType": "bst"
   }
   ```

3. The second player emits `join_room`:

   ```js
   socket.emit("join_room", {
     "code": "ABC234",
     "gameType": "bst"
   });
   ```

4. On success, the joining socket receives `room_joined`; players receive `matched`. The host also receives `opponent_joined`.
5. Once both players are present, the server emits `bst_match_start` and `bst_progress`.

Room codes are six characters. A room accepts at most two players. A player already in the room cannot join it again.

### 5.3 Random Matchmaking

Authenticated users can enter the BST matchmaking queue:

```js
socket.emit("join_queue", { gameType: "bst" });
```

The server emits `queue_joined` while waiting. When an opponent is found, both clients receive `matched`, followed by the game-start event. To leave a queue:

```js
socket.emit("cancel_queue", { gameType: "bst" });
```

### 5.4 Submit a Move

**Client event: `bst_submit_move`**

```js
socket.emit("bst_submit_move", {
  "value": 30,
  "parentValue": 50,
  "side": "left",
  "roomId": "room-uuid"
});
```

`roomId` is optional, but when supplied must match the player's active room. `parentValue` and `side` are optional together; when supplied, they must match the server-calculated insertion point. The move is accepted only if:

* the match is active and the player belongs to it;
* the submitted value is a finite number and is the next expected sequence value;
* the value is not a duplicate; and
* the parent and side, if supplied, match the correct BST insertion location.

### 5.5 Server-to-Client Events

| Event | Recipient | Payload |
|---|---|---|
| `room_created` | Host | `{ roomId, code, gameType }` |
| `room_joined` | Joining player | `{ roomId, gameType, code }` |
| `matched` | Players in room | `{ roomId, gameType?, code? }` |
| `opponent_joined` | Host | `{ roomId, gameType, code }` |
| `queue_joined` | Queued player | No payload |
| `bst_match_start` | Both players | `{ roomId, gameType, sequence, startedAt, endsAt, timeoutMs }` |
| `bst_move_result` | Submitting player | Move result; see below |
| `bst_progress` | Both players | `{ roomId, gameType, players }` |
| `bst_match_end` | Both players | `{ roomId, gameType, reason, winnerSocketId, results }` |
| `live_unavailable` | Requesting player | `{ message }` |
| `join_room_error` | Requesting player | `{ message }` |
| `opponent_left` | Remaining player | `{ gameType, graceMs }` for BST |

#### Successful move result

```json
{
  "valid": true,
  "socketId": "socket-id",
  "expectedValue": 30,
  "nextExpectedIndex": 2,
  "correctCount": 2,
  "attempts": 1,
  "finished": false
}
```

#### Rejected move result

```json
{
  "valid": false,
  "reason": "out_of_order",
  "detail": "Expected 30 next, received 20.",
  "expectedValue": 30,
  "nextExpectedIndex": 1,
  "attempts": 1
}
```

Possible rejection reasons include `match_not_active`, `not_in_room`, `already_finished`, `malformed_payload`, `wrong_room`, `invalid_value`, `out_of_order`, `invalid_parent`, `invalid_side`, `invalid_position`, `invalid_parent_side`, and `duplicate_value`.

#### Progress payload

Each entry in `players` contains:

```json
{
  "socketId": "socket-id",
  "username": "Player",
  "correctCount": 2,
  "attempts": 3,
  "nextExpectedIndex": 2,
  "finished": false,
  "accuracy": 50
}
```

Accuracy is the percentage of successful non-root placements over all move attempts, rounded to two decimal places. An attempt includes an accepted or rejected move.

#### Match end payload

`reason` is one of `winner`, `timeout`, or `disconnect`. Each `results` entry contains `socketId`, `username`, `correctCount`, `attempts`, `accuracy`, and `completed`. The winner is selected by completion, then number of correct placements, then accuracy; a tie leaves `winnerSocketId` as `null`.

### 5.6 Timing and Disconnects

* Each live BST match has a 120-second time limit.
* If a player disconnects, the other player receives `opponent_left`. After a 15-second grace period, the match ends with reason `disconnect` if the room is still active.
* The server ends completed or timed-out matches, clears the match timer, emits `bst_match_end`, and removes the room.

## 6. Persistence

Solo questions are stored using the `BstMatch` model:

| Field | Type | Description |
|---|---|---|
| `matchId` | string | Required, unique ID returned by the question endpoint |
| `userId` | string | Optional user identifier |
| `numbers` | number array | Generated question sequence |
| `score` | number | Defaults to `0` |
| `completed` | boolean | Defaults to `false` |
| `createdAt` | date | Defaults to the creation time |

The solo submit endpoint updates `score` and `completed`. The current question endpoint does not assign `userId`. Live BST match state is held in memory and is not saved through the `BstMatch` model.

## 7. Implementation and Integration Notes

* REST handlers: `src/routes/bstRoutes.ts` and `src/controllers/bstController.ts`.
* BST generation and insertion helpers: `src/utils/bstGenerator.ts`.
* Live room and Socket.IO behavior: `src/sockets/socketHandlers.ts` and `src/sockets/roomManager.ts`.
* Solo persistence model: `src/models/BstMatch.ts`.
* The live generator and REST controller each generate BST questions; both use values in the `10`–`90` range in steps of five.
* The current frontend question helper sends `round` as a query parameter, while the REST endpoint reads `count`; therefore the endpoint uses its default count of seven.
* The current solo frontend submits `matchId` and `score` without `placed`; because it does not pass its stored `matchId` to the submit helper, the current UI request does not update the generated match record. A direct API client should send the returned `matchId` to persist the score.

## 8. Validation and Tests

From the `Backend` directory:

```bash
npm run build
npm test
```

BST live-match behavior is covered in `src/sockets/stage1.test.ts`.
