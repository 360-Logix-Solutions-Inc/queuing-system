/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module — keep it out of the webpack/server bundle
  // so its .node binary is required at runtime from node_modules, not traced.
  //
  // firebase is here for a different reason: bundled into the server, the
  // browser build gets resolved and Firestore WRITES never complete (reads are
  // fine, which is what made it so quiet — SMS went out, smsLogs stayed empty).
  // Required at runtime instead, writes land in under a second.
  serverExternalPackages: ["better-sqlite3", "firebase", "@firebase/firestore"],
};

export default nextConfig;
