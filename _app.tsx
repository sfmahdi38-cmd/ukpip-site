import '../styles/globals.css';
// FIX: Changed import to a named import for AppProps
import type { AppProps } from 'next/app';
import { Vazirmatn } from 'next/font/google';
import Layout from '../components/Layout';

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  variable: '--font-vazirmatn',
});

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <main className={`${vazirmatn.variable} font-sans`}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </main>
  );
}

export default MyApp;