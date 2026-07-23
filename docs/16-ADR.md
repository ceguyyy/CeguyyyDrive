# Architecture Decision Records (ADR)

## ADR 1: Use Node.js for Background Processing instead of Redis/BullMQ
**Date**: [Current Date]
**Status**: Accepted
**Context**: The constraints strictly forbid Redis and BullMQ, which are standard for task queues.
**Decision**: We will use Node.js core modules (`worker_threads` and `child_process`) in combination with PostgreSQL to manage state and queueing. The `upload_sessions` table acts as our state machine.
**Consequences**: Increases DB load but simplifies infrastructure.

## ADR 2: Direct-to-COS Uploads
**Date**: [Current Date]
**Status**: Accepted
**Context**: Routing large files through the Node.js API creates a massive bottleneck.
**Decision**: The Frontend will request Pre-signed URLs or Temporary STS Credentials from the API, and then upload chunks directly to Tencent COS.
**Consequences**: Offloads bandwidth from Render to Tencent COS. Requires careful CORS and STS policy configuration.

## ADR 3: No TypeScript
**Date**: [Current Date]
**Status**: Accepted
**Context**: Specified by constraints.
**Decision**: The entire stack will be pure JavaScript. We will rely on Zod for runtime validation and JSDoc for any necessary inline typing.
**Consequences**: Faster initial compile/build times but requires strict test coverage to catch type-related bugs.
