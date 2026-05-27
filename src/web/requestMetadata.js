function readHeaderValue(headerValue) {
  if (typeof headerValue === "string") {
    return headerValue;
  }

  if (Array.isArray(headerValue) && headerValue.length > 0) {
    return headerValue[0];
  }

  return null;
}

function normalizeIpAddress(value) {
  if (!value) {
    return "알 수 없음";
  }

  const firstValue = value.split(",")[0]?.trim();

  if (!firstValue) {
    return "알 수 없음";
  }

  if (firstValue.startsWith("::ffff:")) {
    return firstValue.slice(7);
  }

  return firstValue;
}

export function getVerificationRequestMetadata(request) {
  const forwardedFor = readHeaderValue(request.headers["x-forwarded-for"]);
  const realIp = readHeaderValue(request.headers["x-real-ip"]);
  const userAgent = readHeaderValue(request.headers["user-agent"]);
  const remoteAddress = request.socket?.remoteAddress || null;

  return {
    clientIp: normalizeIpAddress(forwardedFor || realIp || remoteAddress),
    browser: userAgent?.trim() || "알 수 없음"
  };
}
