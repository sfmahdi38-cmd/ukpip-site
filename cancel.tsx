import Link from 'next/link';
import Head from 'next/head';

const CancelPage = () => {
  return (
    <>
      <Head>
        <title>Payment Cancelled - PIP Assist</title>
      </Head>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 text-red-500 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Cancelled</h1>
          <p className="text-gray-600 mb-6">
            Your payment process was cancelled. You have not been charged.
          </p>
          <Link href="/" legacyBehavior>
            <a className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors">
              Return to Home
            </a>
          </Link>
        </div>
      </div>
    </>
  );
};

export default CancelPage;
