import type { NextConfig } from "next";

const securityHeaders = [
  // Impede clickjacking — a página não pode ser embutida em iframe externo
  { key: "X-Frame-Options", value: "DENY" },

  // Impede MIME sniffing — browser respeita o Content-Type declarado
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Controla informações enviadas no header Referer
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Desativa funcionalidades sensíveis do browser que o app não usa
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },

  // Força HTTPS por 2 anos e inclui subdomínios (só ativo em produção via HSTS)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },

  // Content Security Policy
  // script-src: 'unsafe-inline' e 'unsafe-eval' são exigidos pelo Next.js em runtime
  // connect-src: Supabase (wss para realtime) + dolarapi (cotação, client-side)
  // img-src: blob/data para next/image e html2canvas
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://dolarapi.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Aplica em todas as rotas
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
