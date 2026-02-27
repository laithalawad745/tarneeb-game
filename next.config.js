/** @type {import('next').NextConfig} */
const nextConfig = {
  // تفعيل ضغط الملفات الكبيرة
  compress: true,
  // السماح بتحميل ملفات 3D
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(glb|gltf)$/,
      type: 'asset/resource',
    });
    return config;
  },
};

module.exports = nextConfig;
