import { useState, useEffect, useMemo } from 'react';
import type { GetStaticProps, NextPage } from 'next';
import Head from 'next/head';
import fs from 'fs';
import path from 'path';
import { loadStripe } from '@stripe/stripe-js';
import QuestionRenderer from '../components/QuestionRenderer';

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

interface HomeProps {
  modules: { id: string; title: BilingualText }[];
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const Home: NextPage<HomeProps> = ({ modules }) => {
  const [lang, setLang] = useState<Lang>('fa');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<FormModule | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [isPaid, setIsPaid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // State for Benefit Calculator
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState<any[] | null>(null);

  useEffect(() => {
    // Check for payment status on mount
    if (localStorage.getItem('paid') === 'true') {
      setIsPaid(true);
    }
    // Set document direction
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const fetchModuleData = async () => {
      if (!selectedModuleId) {
        setSelectedModule(null);
        return;
      }
      try {
        const response = await fetch(`/content/${selectedModuleId}.json`);
        if (!response.ok) throw new Error('Module not found');
        const data: Omit<FormModule, 'id'> = await response.json();
        setSelectedModule({ ...data, id: selectedModuleId });
        setAnswers({}); // Reset answers when module changes
        setCurrentStep(0); // Reset calculator step
        setResults(null); // Reset calculator results
      } catch (e) {
        console.error('Failed to load module content:', e);
        setSelectedModule(null);
      }
    };
    fetchModuleData();
  }, [selectedModuleId]);

  const handlePayment = async () => {
    setIsLoading(true);
    setError('');
    try {
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe.js has not loaded yet.');

      const response = await fetch('/api/checkout_sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to create checkout session.');
      }
      
      const { sessionId } = await response.json();
      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) throw error;

    } catch (e: any) {
      console.error('Payment failed:', e);
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const visibleQuestions = useMemo(() => {
    if (!selectedModule) return [];
    return selectedModule.questions.filter(q => {
      if (!q.when) return true;
      const [conditionKey, conditionValue] = Object.entries(q.when)[0];
      return answers[conditionKey] === conditionValue;
    });
  }, [answers, selectedModule]);
  
  const isCalculator = selectedModule?.id === 'benefit_calculator';
  
  const handleCalculate = () => {
    const benefits = [];
    const age = parseInt(answers.age, 10) || 0;
    const income = parseFloat(answers.income) || 0;
    const hasPartner = answers.household?.includes('partner');
    const incomeThreshold = hasPartner ? 2500 : 1600;

    // PIP
    if (age >= 16 && answers.disability === 'yes') {
        benefits.push({
            id: 'pip',
            name: { fa: 'کمک‌هزینه استقلال شخصی (PIP)', en: 'Personal Independence Payment (PIP)' },
            reason: { fa: 'به دلیل داشتن بیماری طولانی‌مدت یا معلولیت.', en: 'For having a long-term health condition or disability.' }
        });
    }

    // Universal Credit
    if (income < incomeThreshold) {
         benefits.push({
            id: 'uc',
            name: { fa: 'یونیورسال کردیت (Universal Credit)', en: 'Universal Credit' },
            reason: { fa: 'به دلیل درآمد پایین.', en: 'For having a low income.' }
        });
    }

    // Child Benefit
    if (answers.household?.includes('children')) {
        benefits.push({
            id: 'child_benefit',
            name: { fa: 'چایلد بنفیت (Child Benefit)', en: 'Child Benefit' },
            reason: { fa: 'به دلیل داشتن فرزند.', en: 'For having children.' }
        });
    }
    
    // Housing Benefit
    if (answers.renting === 'yes' && (income < incomeThreshold)) {
         benefits.push({
            id: 'housing',
            name: { fa: 'کمک‌هزینه مسکن (Housing Benefit)', en: 'Housing Benefit' },
            reason: { fa: 'برای کمک به پرداخت اجاره با درآمد پایین.', en: 'To help pay your rent on a low income.' }
        });
    }

    // Carer's Allowance
    if (answers.caring === 'yes') {
         benefits.push({
            id: 'carers',
            name: { fa: 'کمک‌هزینه مراقب (Carer’s Allowance)', en: 'Carer\'s Allowance' },
            reason: { fa: 'به دلیل مراقبت از فردی برای حداقل ۳۵ ساعت در هفته.', en: 'For caring for someone for at least 35 hours a week.' }
        });
    }

    // Council Tax Reduction
    benefits.push({
        id: 'council_tax',
        name: { fa: 'کاهش مالیات شورا (Council Tax Reduction)', en: 'Council Tax Reduction' },
        reason: { fa: 'افراد با درآمد پایین ممکن است واجد شرایط تخفیف باشند.', en: 'People on a low income may be eligible for a discount.' }
    });

    setResults(benefits);
  };

  const setAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };
  
  const renderCalculator = () => {
    if (!selectedModule) return null;

    if (results) {
        return (
            <div className="animate-fade-in">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">{lang === 'fa' ? 'نتایج شما' : 'Your Results'}</h3>
                <p className="text-gray-600 mb-6">{lang === 'fa' ? 'بر اساس پاسخ‌های شما، ممکن است واجد شرایط مزایای زیر باشید:' : 'Based on your answers, you may be eligible for the following benefits:'}</p>
                <div className="space-y-4">
                    {results.map(benefit => (
                        <div key={benefit.id} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="font-bold text-blue-800">{benefit.name[lang]}</h4>
                            <p className="text-sm text-blue-700">{benefit.reason[lang]}</p>
                        </div>
                    ))}
                     {results.length === 0 && (
                        <p className="text-gray-600">{lang === 'fa' ? 'بر اساس اطلاعات وارد شده، به نظر نمی‌رسد واجد شرایط مزایای اصلی باشید. همیشه برای Council Tax Reduction بررسی کنید.' : 'Based on the information provided, you do not appear to be eligible for the main benefits. Always check for Council Tax Reduction.'}</p>
                    )}
                </div>
                <button
                    onClick={() => { setResults(null); setCurrentStep(0); setAnswers({}); }}
                    className="mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                >
                    {lang === 'fa' ? 'محاسبه مجدد' : 'Recalculate'}
                </button>
            </div>
        )
    }

    const currentQuestion = visibleQuestions[currentStep];

    return (
        <div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${((currentStep + 1) / visibleQuestions.length) * 100}%` }}></div>
            </div>
            <p className="text-sm text-gray-500 mb-4 text-center">{lang === 'fa' ? `مرحله ${currentStep + 1} از ${visibleQuestions.length}` : `Step ${currentStep + 1} of ${visibleQuestions.length}`}</p>
            
            {currentQuestion && (
              <QuestionRenderer 
                key={currentQuestion.id}
                question={currentQuestion}
                answer={answers[currentQuestion.id]}
                setAnswer={(value) => setAnswer(currentQuestion.id, value)}
                lang={lang}
              />
            )}

            <div className="flex justify-between items-center mt-8">
                <button onClick={() => setCurrentStep(s => s - 1)} disabled={currentStep === 0} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {lang === 'fa' ? 'قبلی' : 'Back'}
                </button>
                {currentStep === visibleQuestions.length - 1 ? (
                    <button onClick={handleCalculate} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
                        {lang === 'fa' ? 'محاسبه' : 'Calculate'}
                    </button>
                ) : (
                    <button onClick={() => setCurrentStep(s => s + 1)} disabled={currentStep >= visibleQuestions.length - 1} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {lang === 'fa' ? 'بعدی' : 'Next'}
                    </button>
                )}
            </div>
        </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <Head>
        <title>PIP Assist by Manix</title>
      </Head>

      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <label htmlFor="module-select" className="font-semibold text-gray-700">{lang === 'fa' ? 'انتخاب فرم:' : 'Select Form:'}</label>
          <select
            id="module-select"
            value={selectedModuleId || ''}
            onChange={(e) => setSelectedModuleId(e.target.value)}
            className="p-2 border border-gray-300 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{lang === 'fa' ? '-- انتخاب کنید --' : '-- Select --'}</option>
            {modules.map(mod => (
              <option key={mod.id} value={mod.id}>{mod.title[lang]}</option>
            ))}
          </select>
        </div>
        
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className="p-2 border border-gray-300 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="fa">فارسی</option>
          <option value="en">English</option>
        </select>
      </div>

      {selectedModule && (
        <div className="bg-white p-6 rounded-lg shadow-lg animate-fade-in">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">{selectedModule.title[lang]}</h2>
          <p className="text-gray-600 mb-8">{selectedModule.intro[lang]}</p>

          {isCalculator ? (
            renderCalculator()
          ) : (
            <>
              {!isPaid && (
                 <div className="my-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
                    <p className="font-bold">{lang === 'fa' ? 'پیش‌نمایش' : 'Preview Mode'}</p>
                    <p>{lang === 'fa' ? 'پاسخ‌های کامل، راهنمایی و چک‌لیست مدارک پس از پرداخت در دسترس خواهند بود.' : 'Full answers, guidance, and evidence checklists will be available after payment.'}</p>
                 </div>
              )}
    
              <div className="space-y-8">
                {visibleQuestions.map((question, index) => (
                  <QuestionRenderer 
                    key={question.id}
                    question={question}
                    answer={answers[question.id]}
                    setAnswer={(value) => setAnswer(question.id, value)}
                    lang={lang}
                    isLocked={!isPaid && index > 0} // Lock all questions except the first one before payment
                  />
                ))}
              </div>
    
              {!isPaid && (
                <div className="mt-10 text-center">
                  <button
                    onClick={handlePayment}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (lang === 'fa' ? 'در حال انتقال...' : 'Redirecting...') : (lang === 'fa' ? 'پرداخت و نمایش پاسخ کامل' : 'Pay to Unlock Full Answers')}
                  </button>
                  {error && <p className="text-red-500 mt-2">{error}</p>}
                  <p className="text-4xl font-bold text-slate-800 my-4">£19.99</p>
                </div>
              )}
            </>
          )}

        </div>
      )}
    </div>
  );
};

export const getStaticProps: GetStaticProps = async () => {
  // FIX: Use path.resolve() instead of process.cwd() to avoid TypeScript type errors in some environments.
  const contentDir = path.join(path.resolve(), 'content');
  const filenames = fs.readdirSync(contentDir);

  const modulesData = filenames.map(filename => {
    if (!filename.endsWith('.json')) return null;
    try {
        const filePath = path.join(contentDir, filename);
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContents);
        return {
          id: filename.replace(/\.json$/, ''),
          title: data.title,
        };
    } catch (e) {
        console.error(`Error parsing ${filename}:`, e);
        return null;
    }
  }).filter(Boolean); // Filter out nulls from failed reads/parses

  // Ensure Benefit Calculator is first if it exists
  const calculatorIndex = modulesData.findIndex(mod => mod && mod.id === 'benefit_calculator');
  if (calculatorIndex > 0) {
      const calculatorModule = modulesData.splice(calculatorIndex, 1)[0];
      modulesData.unshift(calculatorModule!);
  }

  return {
    props: {
      modules: modulesData,
    },
  };
};

export default Home;
