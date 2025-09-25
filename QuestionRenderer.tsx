import React, { ChangeEvent, useRef } from 'react';

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
}

interface QuestionRendererProps {
  question: FormQuestion;
  answer: any;
  setAnswer: (value: any) => void;
  lang: Lang;
  isLocked?: boolean;
}

const QuestionRenderer: React.FC<QuestionRendererProps> = ({ question, answer, setAnswer, lang, isLocked }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMultiSelectChange = (optionValue: string) => {
    const currentValue = answer || [];
    const newValue = currentValue.includes(optionValue)
      ? currentValue.filter((v: string) => v !== optionValue)
      : [...currentValue, optionValue];
    setAnswer(newValue);
  };
  
  const renderInput = () => {
    switch (question.type) {
      case 'single-select':
        return (
          <div className="space-y-3">
            {question.options?.map(option => (
              <label key={option.value} className="flex items-center p-3 bg-white rounded-lg border border-gray-300 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500 transition-colors">
                <input type="radio" name={question.id} value={option.value} checked={answer === option.value} onChange={(e) => setAnswer(e.target.value)} className="form-radio h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300" />
                <span className={`font-medium text-gray-800 ${lang === 'fa' ? "mr-3" : "ml-3"}`}>{option.label[lang]}</span>
              </label>
            ))}
          </div>
        );
      case 'multi-select':
        return (
          <div className="space-y-3">
            {question.options?.map(option => (
              <label key={option.value} className="flex items-center p-3 bg-white rounded-lg border border-gray-300 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500 transition-colors">
                <input type="checkbox" name={question.id} value={option.value} checked={(answer || []).includes(option.value)} onChange={() => handleMultiSelectChange(option.value)} className="form-checkbox h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                <span className={`font-medium text-gray-800 ${lang === 'fa' ? "mr-3" : "ml-3"}`}>{option.label[lang]}</span>
              </label>
            ))}
          </div>
        );
      case 'short-text':
        return <input type="text" value={answer || ''} onChange={(e) => setAnswer(e.target.value)} placeholder={question.placeholder?.[lang]} className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />;
      case 'long-text':
        return <textarea value={answer || ''} onChange={(e) => setAnswer(e.target.value)} placeholder={question.placeholder?.[lang]} rows={4} className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />;
      case 'currency':
      case 'number':
        return (
          <div className="relative">
            {question.type === 'currency' && <span className={`absolute ${lang === 'fa' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400`}>£</span>}
            <input
              type={question.type === 'number' ? 'number' : 'text'}
              value={answer || ''}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={question.placeholder?.[lang]}
              className={`w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 ${question.type === 'currency' ? (lang === 'fa' ? 'pr-7' : 'pl-7') : ''}`}
            />
          </div>
        );
      case 'file':
         return (
             <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 border-2 border-dashed border-gray-300">
                <input type="file" multiple ref={fileInputRef} onChange={(e: ChangeEvent<HTMLInputElement>) => setAnswer(e.target.files)} className="hidden" />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${lang === 'fa' ? 'ml-2' : 'mr-2'}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5A2.25 2.25 0 0118.75 19.5H5.25A2.25 2.25 0 013 17.25z" />
                </svg>
                {lang === 'fa' ? 'انتخاب فایل‌ها' : 'Select files'}
             </button>
         );
      default:
        return null;
    }
  };

  return (
    <div className={`p-4 border border-gray-200 rounded-md ${isLocked ? 'bg-gray-50 opacity-60' : 'bg-transparent'}`}>
       <fieldset disabled={isLocked} className="space-y-2">
         <label className="block text-lg font-semibold text-gray-700">{question.question[lang]}</label>
         {question.description && <p className="text-sm text-gray-500 mb-4">{question.description[lang]}</p>}
         {renderInput()}
         {question.allowProof && (
             <p className="text-xs text-gray-500 mt-2">{question.proof_hint?.[lang]}</p>
         )}
       </fieldset>
       {isLocked && (
         <div className="absolute inset-0 flex items-center justify-center bg-gray-200/50 rounded-md">
            <span className="flex items-center text-gray-600 font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                {lang === 'fa' ? 'برای مشاهده قفل را باز کنید' : 'Unlock to view'}
            </span>
         </div>
       )}
    </div>
  );
};

export default QuestionRenderer;
