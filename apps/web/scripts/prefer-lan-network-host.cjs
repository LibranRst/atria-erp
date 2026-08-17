// eslint-disable-next-line @typescript-eslint/no-require-imports
const os = require("node:os");

const originalNetworkInterfaces = os.networkInterfaces.bind(os);

function scoreAddress(item) {
  if (!item || item.family !== "IPv4" || item.internal) return 0;
  if (item.address.startsWith("192.168.")) return 4;
  if (item.address.startsWith("10.")) return 3;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(item.address)) return 2;
  return 1;
}

os.networkInterfaces = function patchedNetworkInterfaces() {
  const interfaces = originalNetworkInterfaces();
  const entries = Object.entries(interfaces);

  entries.sort(([, leftItems], [, rightItems]) => {
    const leftScore = Math.max(0, ...(leftItems ?? []).map(scoreAddress));
    const rightScore = Math.max(0, ...(rightItems ?? []).map(scoreAddress));
    return rightScore - leftScore;
  });

  return Object.fromEntries(entries);
};
