/** @type {import('next').NextConfig} */
const preview = process.env.PREVIEW_EXPORT === "1";
const nextConfig = preview
  ? { output: "export", trailingSlash: true, images: { unoptimized: true } }
  : {};
export default nextConfig;
