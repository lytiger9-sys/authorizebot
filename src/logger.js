function write(level, message, meta) {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} [${level}]`;

  if (meta === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }

  const output = typeof meta === "string" ? meta : JSON.stringify(meta);
  console.log(`${prefix} ${message} | ${output}`);
}

export const logger = {
  info(message, meta) {
    write("INFO", message, meta);
  },
  warn(message, meta) {
    write("WARN", message, meta);
  },
  error(message, meta) {
    write("ERROR", message, meta);
  }
};
