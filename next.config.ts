import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google https://*.google.com https://*.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://vitals.vercel-insights.com https://va.vercel-scripts.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google https://*.google.com https://*.gstatic.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google https://*.google.com",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pwxppfazbyourjrsutgx.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
