# Testing Strategy

## 1. Unit Tests
- **Backend**: Jest + Supertest for isolated controller and service testing.
- **Frontend**: Vitest + React Testing Library for component rendering and Zustand store logic.
- **Coverage Goal**: >80% on core logic (Auth, File operations).

## 2. Integration Tests
- Testing the interaction between the Node.js API and the PostgreSQL database (using a dedicated Test DB).
- Simulating Tencent COS using a mock module or local MinIO container.

## 3. E2E Tests (Playwright)
- Full browser automation testing the critical user paths:
  - Login
  - Upload a file (mocked network request)
  - Create a folder
  - Share a file
  - Search

## 4. Accessibility Tests
- `eslint-plugin-jsx-a11y` enforced in CI.
- Lighthouse CI checks on the frontend build to ensure WCAG AA compliance.

## 5. Performance & Load Tests
- **Artillery.io**: Stress testing the Node.js upload session generator and WebSocket connections.
- Ensure the API handles 1000 concurrent websocket connections smoothly.

## 6. CI Pipeline (GitHub Actions)
1. Code Checkout.
2. Setup Node.js.
3. Run `npm run lint`.
4. Run `npm test` (Unit/Integration).
5. Build Docker Image (Backend) / Vite Build (Frontend).
