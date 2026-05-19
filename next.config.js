/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  output: "export",
  images: {
    unoptimized: true
  },
  basePath: isGitHubPages ? "/Confidential-Credit-Vault" : "",
  assetPrefix: isGitHubPages ? "/Confidential-Credit-Vault/" : ""
};

module.exports = nextConfig;
