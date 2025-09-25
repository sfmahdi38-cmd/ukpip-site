import { useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';

const SuccessPage = () => {
  const router = useRouter();
  const { session_id } = router.query;

  useEffect(() => {
    if (session_id) {
      // In a real app, you might verify the session_id with your backend
      // For this demo, we'll just set the paid flag
      localStorage.setItem('paid', 'true');
    }
  }, [session_id]);

  return (
    <>
      <Head>
        <title>Payment Successful - PIP Assist</title>
      </Head>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 text-green-500 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for your payment. You now have full access to all features.
          </p>
          <Link href="/" legacyBehavior>
            <a className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors">
              Start Exploring
            </a>
          </Link>
        </div>
      </div>
    </>
  );
};

export default SuccessPage;
