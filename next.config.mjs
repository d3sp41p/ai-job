/** @type {import('next').NextConfig} */
const preview = process.env.PREVIEW_EXPORT === "1";
const nextConfig = preview
  ? { output: "export", trailingSlash: true, images: { unoptimized: true } }
  : {
      // fonts read from disk by the share-card images (/p/<id>)
      outputFileTracingIncludes: { "/p/[id]/*": ["./lib/fonts/*.woff"] },
    };
export default nextConfig;
