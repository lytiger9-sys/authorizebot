import crypto from "node:crypto";

import { config } from "../config.js";

function signPayload(payload) {
  return crypto
    .createHmac("sha256", config.stateSecret)
    .update(payload)
    .digest("hex");
}

function timingSafeMatch(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSignedState({ guildId, roleId }) {
  const payload = Buffer.from(
    JSON.stringify({
      guildId,
      roleId,
      issuedAt: Date.now()
    })
  ).toString("base64url");

  return `${payload}.${signPayload(payload)}`;
}

export function parseSignedState(state) {
  const [payload, signature] = String(state).split(".");

  if (!payload || !signature) {
    throw new Error("Invalid OAuth state format.");
  }

  const expectedSignature = signPayload(payload);

  if (!timingSafeMatch(signature, expectedSignature)) {
    throw new Error("OAuth state signature mismatch.");
  }

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

  if (!decoded.guildId || !decoded.roleId || !decoded.issuedAt) {
    throw new Error("OAuth state payload is incomplete.");
  }

  if (Date.now() - decoded.issuedAt > config.oauthStateMaxAgeMs) {
    throw new Error("OAuth state has expired.");
  }

  return decoded;
}
