/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module — keep it out of the webpack/server bundle
  // so its .node binary is required at runtime from node_modules, not traced.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
