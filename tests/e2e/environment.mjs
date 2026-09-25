// Node-side settings shared by Playwright and its isolated fixture server.
export const port = Number(process.env.TAKE_A_SEAT_E2E_PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('TAKE_A_SEAT_E2E_PORT must be an integer from 1024 to 65535');
}
export const baseURL = `http://127.0.0.1:${port}`;
