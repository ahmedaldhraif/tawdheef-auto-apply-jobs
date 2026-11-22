import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../main.jsx';
import { demoStore } from './api.js';
import './demo.css';

const ar = demoStore.language === 'ar';
document.documentElement.lang = ar ? 'ar' : 'en';
document.documentElement.dir = ar ? 'rtl' : 'ltr';
document.documentElement.dataset.demo = '';
const embedded = new URLSearchParams(location.search).get('embed') === '1';
document.documentElement.dataset.embedded = String(embedded);

// Keep demo view preferences away from the local app's browser storage too.
const preferences = new Map();
const storage = { getItem: key => preferences.get(key) ?? null, setItem: (key, value) => preferences.set(key, String(value)) };
function Demo() {
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState('');
  const reset = () => { demoStore.reset(); preferences.clear(); setVersion(v => v + 1); setNotice(ar ? 'أُعيد ضبط البيانات التجريبية.' : 'Sample data reset.'); };
  return <>
    <div className="demo-toolbar" role="region" aria-label={ar ? 'التجربة التفاعلية' : 'Interactive demo'}>
      <p><strong>{ar ? 'بيانات تجريبية' : 'Sample data'}</strong><span>{ar ? 'لا تُرسل طلبات أو رسائل فعلية.' : 'No real applications or emails.'}</span></p>
      <div><button type="button" onClick={reset}>{ar ? 'إعادة الضبط' : 'Reset demo'}</button>{!embedded && <a href={ar ? '/ar/' : '/'}>{ar ? 'العودة للموقع' : 'Back to website'}</a>}</div>
    </div>
    <p className="demo-instruction">{ar ? 'ابحث عن شركة، جرّب تشغيلًا، ثم افتح الأرقام للاطلاع على النتائج.' : 'Explore the companies, try a run, then open the totals to see the records.'}</p>
    <span className="sr-only" role="status">{notice}</span>
    <div onClickCapture={event => {
      // Sample career links, downloads and provider destinations never navigate.
      if (event.target.closest('a')) { event.preventDefault(); setNotice(ar ? 'الرابط متاح في التطبيق المحلي.' : 'This link is available in the local app.'); }
    }}><App key={version} demo storage={storage} /></div>
    <p className="demo-boundary">{ar ? 'هذه واجهة التطبيق الفعلية ببيانات افتراضية. في التطبيق المحلي، يستخدم مساعدك اتصالاته الخاصة لتنفيذ العمل وتسجيل النتائج الحقيقية.' : 'The actual app interface with fictional records. In the local app, your agent uses its own connections to do the work and record real outcomes.'}</p>
    {!embedded && <nav className="demo-next" aria-label={ar ? 'الخطوة التالية' : 'Next step'}><a className="primary" href={ar ? '/ar/skills/#get-started' : '/skills/#get-started'}>{ar ? 'احصل على التطبيق مجانًا' : 'Get the free app'}</a><a href={ar ? '/ar/' : '/'}>{ar ? 'العودة للموقع' : 'Back to website'}</a></nav>}
  </>;
}
createRoot(document.getElementById('demo-root')).render(<Demo />);
