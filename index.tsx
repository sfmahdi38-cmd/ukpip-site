import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { loadStripe } from '@stripe/stripe-js';
import QuestionRenderer from './components/QuestionRenderer';

// Types
type Lang = 'fa' | 'en';
type BilingualText = { [key in Lang]: string };

interface FormOption {
  value: string;
  label: BilingualText;
}

interface FormQuestion {
  id: string;
  type: 'long-text' | 'single-select' | 'multi-select' | 'short-text' | 'file' | 'currency' | 'number';
  question: BilingualText;
  description?: BilingualText;
  options?: FormOption[];
  placeholder?: BilingualText;
  allowProof?: boolean;
  proof_hint?: BilingualText;
  when?: { [key: string]: string };
}

interface FormModule {
  id: string;
  title: BilingualText;
  intro: BilingualText;
  questions: FormQuestion[];
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

const App = () => {
  const [lang, setLang] = useState<Lang>('fa');
  const [modules, setModules] = useState<{ id: string; title: BilingualText }[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<FormModule | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [isPaid, setIsPaid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState<any[] | null>(null);

  useEffect(() => {
    if (localStorage.getItem('paid') === 'true') {
      setIsPaid(true);
    }
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;

    // بارگذاری لیست ماژول‌ها از content/
    fetch('/content/modules.json')
      .then(res => res.json())
      .then(data => setModules(data))
      .catch(() => setModules([]));
  }, [lang]);

  useEffect(() => {
    if (!selectedModuleId) {
      setSelectedModule(null);
      return;
    }
    fetch(`/content/${selectedModuleId}.json`)
      .then(res => res.json())
      .then(data => {
        setSelectedModule({ ...data, id: selectedModuleId });
        setAnswers({});
        setCurrentStep(0);
        setResults(null);
      })
      .catch(() => setSelectedModule(null));
  }, [selectedModuleId]);

  const visibleQuestions = useMemo(() => {
    if (!selectedModule) return [];
    return selectedModule.questions.filter(q => {
      if (!q.when) return true;
      const [key, val] = Object.entries(q.when)[0];
      return answers[key] === val;
    });
  }, [answers, selectedModule]);

  const handlePayment = async () => {
    setIsLoading(true);
    setError('');
    try {
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js not loaded');

      const response = await fetch('/api/checkout_sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang }),
      });
      if (!response.ok) throw new Error('Failed to create checkout session');
      const { sessionId } = await response.json();
      await stripe.redirectToCheckout({ sessionId });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-4">PIP Assist by Manix</h1>

      <div className="mb-6 flex justify-between items-center">
        <select
          value={selectedModuleId || ''}
          onChange={(e) => setSelectedModuleId(e.target.value)}
          className="p-2 border rounded-md"
        >
          <option value="">{lang === 'fa' ? '-- انتخاب کنید --' : '-- Select --'}</option>
          {modules.map(mod => (
            <option key={mod.id} value={mod.id}>{mod.title[lang]}</option>
          ))}
        </select>

        <select value={lang} onChange={e => setLang(e.target.value as Lang)} className="p-2 border rounded-md">
          <option value="fa">فارسی</option>
          <option value="en">English</option>
        </select>
      </div>

      {selectedModule && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-3xl font-bold mb-2">{selectedModule.title[lang]}</h2>
          <p className="mb-8">{selectedModule.intro[lang]}</p>

          {visibleQuestions.map((q, i) => (
            <QuestionRenderer
              key={q.id}
              question={q}
              answer={answers[q.id]}
              setAnswer={(val) => setAnswers(prev => ({ ...prev, [q.id]: val }))}
              lang={lang}
              isLocked={!isPaid && i > 0}
            />
          ))}

          {!isPaid && (
            <div className="mt-10 text-center">
              <button
                onClick={handlePayment}
                disabled={isLoading}
                className="bg-blue-600 text-white py-3 px-8 rounded-lg"
              >
                {isLoading ? 'Redirecting...' : (lang === 'fa' ? 'پرداخت و نمایش کامل' : 'Pay to Unlock')}
              </button>
              {error && <p className="text-red-500 mt-2">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);
