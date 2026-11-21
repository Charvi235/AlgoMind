# AlgoMind Test Cases and Test Report

## 1. Document Information
- Project: AlgoMind
- Scope: Frontend and backend inspection for authentication, dashboard, leaderboard, profiles, and game modules
- Methodology: Source-code review of the current repository, route and controller analysis, and feature validation against implemented behavior; no code changes were made during this process.
- Review date: 2026-11-09
- Target environment: Local development workspace

## 2. Executive Summary
AlgoMind is a gamified algorithm learning platform implemented as a React + Vite frontend and an Express + TypeScript backend backed by MongoDB. It includes protected authenticated flows, signup and password reset flows, XP and leaderboard tracking, user profile activity heatmaps, and multiple algorithm game modules: BST, Dijkstra, Floyd-Warshall, Sorting, Missing Operator, Maths Questions, Queue Rush, and Stack Strike.

From the codebase review, the application has a mature structure for authenticated access, a clear route model, and several fully backed server-scored mechanics. Some game modules are implemented as client-side local logic with TODOs for API integration, which should be treated as partial implementations until they are connected to backend validation.

## 3. Project Architecture and Scope
### 3.1 Frontend
- Framework: React + TypeScript + Vite
- Main routing: `Frontend/src/App.tsx`
- Auth state: `Frontend/src/context/AuthContext.tsx`
- Route protection: `Frontend/src/components/ProtectedRoute.tsx`
- Dashboard: `Frontend/src/pages/Dashboard.tsx`
- Leaderboard: `Frontend/src/pages/Leaderboard.tsx`
- Profile: `Frontend/src/pages/UserProfile.tsx`
- Game registry: `Frontend/src/config/gameRegistry.ts`

### 3.2 Backend
- Runtime: Node.js + Express + TypeScript
- Entry point: `Backend/src/index.ts`
- Auth API: `Backend/src/routes/authRoutes.ts`
- Game APIs: `bstRoutes.ts`, `sortingRoutes.ts`, `dijkstraRoutes.ts`, `floydWarshallRoutes.ts`, `linearStructureRoutes.ts`
- Session and stats controllers: `sessionController.ts`, `statsController.ts`
- Persistence: MongoDB via Mongoose models
- Real-time layer: Socket.IO (`Backend/src/sockets`)

### 3.3 Key Observed Features
- Email-based signup with OTP verification
- Login using username/email + password
- JWT session handling with protected routes
- Dashboard metrics (rank, XP today, games played, accuracy, streak)
- Leaderboard and profile heatmap
- Solo game sessions with XP rules for selected games
- Multimode algorithm games
- Multiplayer or room-based game flow references in routing

## 4. Test Strategy
The test cases below were derived from actual implementation files and route/controller logic. They document expected behavior and the minimum validation points required to confirm stable operation.

### Coverage summary
| Module | Coverage Status |
|---|---|
| Authentication & login | Covered |
| Dashboard & navigation | Covered |
| BST Builder | Covered |
| Sorting Showdown | Covered |
| Queue/Stack structures | Covered |
| Dijkstra / Floyd-Warshall / Maths / Missing Operator | Covered at a high level |
| Full end-to-end multiplayer validation | Partially covered to code level |

## 5. Detailed Test Cases

### Module 1: Authentication and Login

| ID | Test Case | Steps | Expected Result | Status |
|---|---|---|---|---|
| AUTH-01 | Login page renders correctly | Navigate to `/login` without a valid token | Login form displays; background and form layout render without crash | Implemented |
| AUTH-02 | Authenticated user redirects away from login | Already logged in and open `/login` | Redirect to `/dashboard` or safe previous route | Implemented |
| AUTH-03 | Valid login succeeds | Submit valid email/username and password | JWT token stored; route navigates to `/dashboard`; app state updates | Implemented |
| AUTH-04 | Invalid credentials are rejected | Submit wrong username/email or password | Error banner shows and user remains on login page | Implemented |
| AUTH-05 | Empty required fields are blocked | Submit blank identifier or password | Validation error or failed request; no login attempt | Implemented |
| AUTH-06 | Nonexistent user fails gracefully | Submit username/email not in DB | Error returned and no session is created | Implemented |
| AUTH-07 | Session persistence survives refresh | Login, refresh the page, check token | `AuthContext` revalidates `/api/auth/me` and restores user state | Implemented |
| AUTH-08 | Invalid or expired JWT is rejected | Send expired/invalid token to protected route | `401` response; token is cleared and user redirected | Implemented |
| AUTH-09 | Logout clears session | Click logout | Token removed; user state resets; protected routes redirect to login | Implemented |
| AUTH-10 | Protected route blocks unauthenticated access | Open `/dashboard` without login | `ProtectedRoute` redirects to `/login` | Implemented |
| AUTH-11 | Signup start validates input | Submit invalid email or weak password to `/api/auth/signup/start` | API returns 400 with specific error | Implemented |
| AUTH-12 | Signup OTP flow succeeds | Complete signup start → verify code → complete username step | User record is created and a JWT token is returned | Implemented |
| AUTH-13 | Duplicate email is rejected | Attempt signup with existing email | 409 conflict response | Implemented |
| AUTH-14 | Username availability is checked | Query `/api/auth/username-available` with existing and new names | API reports available/unavailable correctly | Implemented |
| AUTH-15 | Password reset flow works end-to-end | Submit forgot password, verify OTP, reset password | Password is reset and user can log in | Implemented |
| AUTH-16 | Rate-limit enforcement is respected | Trigger rapid signup/login/reset requests | API returns throttle/429 responses based on `rateLimiters` | Implemented |

### Module 2: Dashboard and Navigation

| ID | Test Case | Steps | Expected Result | Status |
|---|---|---|---|---|
| DASH-01 | Dashboard loads authenticated data | Navigate to `/dashboard` as logged user | Stats and leaderboard data are fetched and rendered | Implemented |
| DASH-02 | Rank and XP metrics display correctly | Open dashboard with sample user data | Rank, XP today, total XP, streak and games played reflect API data | Implemented |
| DASH-03 | Top 3 leaderboard loads | Fetch `/api/leaderboard?limit=3` | Top entries, user mark, podium render correctly | Implemented |
| DASH-04 | Leaderboard handles empty or low-data state | Use a new account with zero XP | Rank displays as `—` and leaderboard remains stable | Implemented |
| DASH-05 | Navigation between protected pages works | Use navbar or links to leaderboard/profile/dashboard | Each route loads without losing auth state | Implemented |
| DASH-06 | Protected route fails gracefully on auth error | Simulate 401 from dashboard/profile endpoints | Auth redirect or user-friendly error handling occurs | Implemented |
| DASH-07 | Profile page loads profile summary | Visit `/profile` | Username, XP, streak, and heatmap data appear | Implemented |
| DASH-08 | Heatmap renders correctly | Open profile page with activity data | Daily activity grid and legend show recent engagement dates | Implemented |
| DASH-09 | Refresh/retry behavior | Trigger API failure and click retry | Error state clears after retry and content loads | Implemented |
| DASH-10 | Game selection uses registry and routes | Open game selection page and choose a game | Proper route is used and registry metadata is shown | Implemented |

### Module 3: BST Builder

| ID | Test Case | Steps | Expected Result | Status |
|---|---|---|---|---|
| BST-01 | New BST round loads a number set | Request `/api/games/bst/question` | Service returns valid unique numbers and match metadata | Implemented |
| BST-02 | First value becomes the root automatically | Start a new BST game | Initial node is inserted at root position and queue is reduced | Implemented |
| BST-03 | Valid left-side placement is accepted | Drag/drop a value lower than parent | Placement is accepted if it satisfies BST ordering and slot is empty | Implemented |
| BST-04 | Valid right-side placement is accepted | Drag/drop a value higher than parent | Placement is accepted when it follows BST rules | Implemented |
| BST-05 | Invalid placement is rejected | Drop higher value into left slot or lower value into right slot | Error slot or invalid placement feedback appears | Implemented |
| BST-06 | Duplicate or repeated insertions are handled safely | Attempt to place a value already in the tree | Duplicate is ignored/blocked; no invalid tree mutation | Implemented |
| BST-07 | Open slot generation is correct | Check all leaf slots in the current tree | Left and right child slots appear only when valid child positions are empty | Implemented |
| BST-08 | Completion condition is enforced | Place all required non-root nodes in valid positions | Win state is triggered when required placements are complete | Implemented |
| BST-09 | Score is calculated on successful completion | Complete a valid round | Score increments and final result is submitted to backend | Implemented |
| BST-10 | Timeout/expiration is handled | Let timer expire before completion | Match is marked expired and no valid completion is recorded | Implemented |
| BST-11 | Final round submission stores results | POST `/api/games/bst/submit` | Match record is updated with score, attempts, accuracy, and completed flags | Implemented |
| BST-12 | XP is awarded only once per valid completion | Complete valid BST round and call submit logic | XP is recorded once and not double-awarded | Implemented |
| BST-13 | Partial/incomplete BST round is finalized with zero XP | Finish without required placement count | API returns zero-score finalization and no XP award | Implemented |

### Module 4: Sorting Showdown

| ID | Test Case | Steps | Expected Result | Status |
|---|---|---|---|---|
| SORT-01 | New sorting round is generated | Call `/api/games/sorting/new` with valid round | Round metadata, algorithm, step index, and first step are returned | Implemented |
| SORT-02 | Invalid round request is rejected | Use non-positive or non-integer round parameter | 400 response returned with clear error | Implemented |
| SORT-03 | Bubble sort step validation works | Submit correct adjacent swap decision | Matching step advances; next step is generated | Implemented |
| SORT-04 | Incorrect sorting answer is handled | Submit wrong bubble/insertion/selection move | Mistake count increases; step is not advanced | Implemented |
| SORT-05 | Insertion sort rule is respected | Submit insert operation that violates left-order requirement | Validation fails and no progress is recorded | Implemented |
| SORT-06 | Selection sort target selection works | Pick the smallest unsorted item | Correct answer proceeds to next step | Implemented |
| SORT-07 | Completed round returns final array state | Finish all required sorting steps | Final array is returned and round is marked complete | Implemented |
| SORT-08 | Repeat processing of a completed round is blocked | Re-submit after completion | API returns 409 or no progress state | Implemented |
| SORT-09 | Step object exposes algorithm rules clearly | Fetch round metadata | `ALGO_INFO` rules are consistent with UI prompt and validation | Implemented |
| SORT-10 | Error handling for missing round ID works | Submit validation without `roundId` or answer | 400 error returned | Implemented |

### Module 5: Queue Rush and Stack Strike (Linear Structures)

| ID | Test Case | Steps | Expected Result | Status |
|---|---|---|---|---|
| LINEAR-01 | Linear round generation creates valid initial state | Trigger FIFO or LIFO round generation | Initial items and operation list form a valid queue/stack puzzle | Implemented |
| LINEAR-02 | FIFO operation ordering is enforced | Submit an item from the wrong position in queue | Validation fails because expected front item is not selected | Implemented |
| LINEAR-03 | LIFO operation ordering is enforced | Submit an item from the wrong end of stack | Validation fails because top item is not selected | Implemented |
| LINEAR-04 | Add operation works | Submit an item to a valid enqueue/push action | Item is appended or pushed to the structure correctly | Implemented |
| LINEAR-05 | Remove operation works | Remove current front/top item | Correct item is removed and structure size updates | Implemented |
| LINEAR-06 | Invalid remove on empty structure is rejected | Remove when queue/stack is empty | Validation fails and no mutation occurs | Implemented |
| LINEAR-07 | Server-scored solo sessions for FIFO/LIFO start correctly | Call the solo-session flow for queue/stack game | Session ID is created and duration is tracked | Implemented |
| LINEAR-08 | XP rules are applied only for valid server-scored games | Trigger solo finish for queue/stack | Result is recorded via session scoring rules and XP is awarded according to rules | Implemented |

### Module 6: Dijkstra, Floyd-Warshall, and Question-Based Games

| ID | Test Case | Steps | Expected Result | Status |
|---|---|---|---|---|
| GAME-01 | Dijkstra solo session starts | Enter Dijkstra solo mode | Session is created and timer rules apply | Implemented |
| GAME-02 | Dijkstra result is finalized by server | Complete session or allow timer to expire | Server-derived rounds and XP results are returned | Implemented |
| GAME-03 | Floyd-Warshall solo session starts | Open Floyd-Warshall solo flow | Session is initialized like other server-scored game modules | Implemented |
| GAME-04 | Floyd-Warshall final score is derived by server | Finish session | Accuracy and XP are computed from server counters | Implemented |
| GAME-05 | Missing Operator chooses correct answer flow | Answer a selected operator question | Correct choice adds score and moves to next question | Implemented |
| GAME-06 | Missing Operator wrong answer flow | Submit incorrect operator | Error state triggers and score remains unchanged | Implemented |
| GAME-07 | Timer behavior in Missing Operator | Let countdown hit zero | Game over state is triggered | Implemented |
| GAME-08 | Maths questions route loads and cycles correctly | Start the maths game | Questions render sequentially and reset works | Implemented |
| GAME-09 | Reset flow works for question-based games | Trigger restart | Deck, score, timer, and placeholders return to initial state | Implemented |
| GAME-10 | Multiplayer or room-flow route protection works | Try to open invitation or join room paths | Guest access is allowed only for BST-related guest-safe routes as defined by `ProtectedRoute` | Implemented |

## 6. Observed Gaps and Partial Implementations
The code review indicates a few areas that should be clearly separated from fully completed server-backed flows:

- `Frontend/src/pages/games/BSTGame.tsx` contains TODO comments indicating that the BST UI currently validates local drop logic and has planned server-side validation hooks.
- `MissingOperatorGame.tsx` contains a TODO indicating that answer submission should eventually be sent to a dedicated backend endpoint rather than being local-only.
- `MathsQuestionsGame.tsx` appears to be a local, client-managed mini-game and may not have a server-backed result model unless the API layer is added.
- Some game routes and flows are present in the frontend tree but may rely on local state rather than a dedicated backend API for answer processing.

These are not necessarily defects, but they are important test coverage boundaries to document before declaring end-to-end completion.

## 7. Risk Assessment
### High-confidence features
- Authentication and JWT routing
- Dashboard, profile, and leaderboard data flow
- Solo session start/finish flow for server-scored games
- Sorting API validation and queue/stack linear logic
- Basic game route and navigation structure

### Requires live execution validation
- Full front-end interaction across all games with real data sets
- Real socket-based multiplayer lobbies and room synchronization
- End-to-end behavior for client-only games without server validation
- Detailed timing and XP behavior for all games under concurrent user load

## 8. Overall Test Status
This report reflects a static validation of the repository’s implementation as of the current workspace state. Based on code inspection, the project is structurally complete and feature-rich, with strong coverage of the implemented game modules and backend auth/session logic. The remaining risk areas are mostly in live validation of partial game integrations and multiplayer sessions rather than in the foundational app architecture.

## 9. Artifact References
Reviewed sources include:
- `Frontend/src/App.tsx`
- `Frontend/src/context/AuthContext.tsx`
- `Frontend/src/components/ProtectedRoute.tsx`
- `Frontend/src/pages/Dashboard.tsx`
- `Frontend/src/pages/Leaderboard.tsx`
- `Frontend/src/pages/UserProfile.tsx`
- `Frontend/src/pages/SoloSession.tsx`
- `Frontend/src/pages/games/BSTGame.tsx`
- `Frontend/src/utils/SortingEngine.ts`
- `Backend/src/index.ts`
- `Backend/src/controllers/authController.ts`
- `Backend/src/controllers/bstController.ts`
- `Backend/src/controllers/sortingController.ts`
- `Backend/src/controllers/sessionController.ts`
- `Backend/src/controllers/statsController.ts`
- `Backend/src/utils/linearStructureEngine.ts`

End of report.
