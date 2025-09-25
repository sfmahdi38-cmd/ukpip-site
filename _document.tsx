import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png"></link>
        <meta name="theme-color" content="#1e3a8a" />
      </Head>
      <body className="bg-slate-100 text-slate-800">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
