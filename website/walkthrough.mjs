import { escapeHtml as esc } from './markdown.mjs';

// Every public entry point uses the working React app with a browser-only API.
export function appPreview(locale='en',{eager=false}={}) {
 const ar=locale==='ar';
 const href=`/demo/?lang=${ar?'ar':'en'}`;
 const title=ar?'جرّب توظيف ببيانات تجريبية':'Try Tawdheef with sample data';
 const caption=ar?'واجهة التطبيق الفعلية. بيانات افتراضية، دون إرسال طلبات أو رسائل.':'The actual app interface. Fictional data. No real applications or emails.';
 return `<figure class="native-app-preview native-app-demo"><div class="demo-preview-heading"><span>${esc(ar?'جرّب التطبيق':'Try the app')}</span><a href="${href}">${esc(ar?'فتح التجربة':'Open demo')} <span aria-hidden="true">↗</span></a></div><div class="tour-frame"><iframe src="${href}&amp;embed=1" title="${esc(title)}" width="1100" height="700" loading="${eager?'eager':'lazy'}" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"></iframe></div><a class="demo-mobile-open button" href="${href}">${esc(ar?'جرّب التطبيق':'Try the app')}</a><figcaption>${esc(caption)}</figcaption></figure><script type="module" src="/site-assets/app-demo.js"></script>`;
}
export function walkthrough(locale='en'){return `<section class="product-tour" id="walkthrough" aria-label="${locale==='ar'?'تجربة توظيف':'Tawdheef interactive demo'}">${appPreview(locale,{eager:true})}</section>`;}
export function previewDisclosure(locale='en'){return `<details class="native-preview-disclosure"><summary>${locale==='ar'?'جرّب التطبيق ببيانات تجريبية':'Try the app with sample data'}</summary>${appPreview(locale)}</details>`;}
