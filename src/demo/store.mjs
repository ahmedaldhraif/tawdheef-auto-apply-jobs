/** Browser-only sample records. No transport, credentials, files or domain writes. */
const COUNTRIES = [
  ['uae', 'AE', 'UAE', 'الإمارات', 'Dubai', 'دبي'],
  ['saudi', 'SA', 'Saudi Arabia', 'السعودية', 'Riyadh', 'الرياض'],
  ['qatar', 'QA', 'Qatar', 'قطر', 'Doha', 'الدوحة'],
  ['oman', 'OM', 'Oman', 'عُمان', 'Muscat', 'مسقط'],
  ['kuwait', 'KW', 'Kuwait', 'الكويت', 'Kuwait City', 'مدينة الكويت'],
  ['bahrain', 'BH', 'Bahrain', 'البحرين', 'Manama', 'المنامة'],
];
const NAMES = ['Atlas Studio', 'Palm Labs', 'Harbour Design', 'Cedar Systems', 'Orbit Digital', 'Dune Works', 'Pearl Studio', 'Horizon Labs'];
const NAMES_AR = ['استوديو أطلس', 'مختبرات النخيل', 'تصميم المرفأ', 'أنظمة الأرز', 'مدار الرقمية', 'أعمال الكثبان', 'استوديو اللؤلؤ', 'مختبرات الأفق'];
const AT = '2026-11-20T09:00:00.000Z';
const clone = value => structuredClone(value);

export function createDemoStore({ language = 'en', clock = Date.now } = {}) {
  const lang = language === 'ar' ? 'ar' : 'en';
  const tr = (en, ar) => lang === 'ar' ? ar : en;
  let companies, records, runs, directories;
  function reset() {
    runs = []; records = []; companies = [];
    directories = COUNTRIES.map(([id, flag, en, ar, city, cityAr]) => {
      for (let index = 0; index < NAMES.length; index++) {
        const companyId = `${id}-sample-${index}`;
        const profile = [0, 1, 3].includes(index);
        companies.push({ id: companyId, directoryId: id, name: tr(NAMES[index], NAMES_AR[index]),
          sourceRole: tr('Sample company', 'شركة تجريبية'), companyType: 'private', location: tr(city, cityAr),
          sector: tr('Technology & design', 'التقنية والتصميم'), status: [0, 3].includes(index) ? 'applied' : index === 1 ? 'ready' : 'not_started',
          progress: profile ? { account_created: 1, profile_created: 1, cv_uploaded: 1 } : {}, revision: 1,
          profileSupport: 'available', careersPageStatus: 'available', notes: tr('Fictional company for this demo.', 'شركة افتراضية لهذه التجربة.'),
          nextAction: index === 2 ? tr('Awaiting reply', 'بانتظار الرد') : profile ? tr('Watch for new jobs', 'متابعة الوظائف الجديدة') : tr('Review matching jobs', 'مراجعة الوظائف المناسبة'),
          lastUpdate: index < 4 ? AT : null, website: '', careersUrl: '', email: '', linkedinUrl: '',
        });
        const base = { companyId, companyName: tr(NAMES[index], NAMES_AR[index]), directoryId: id, at: AT, role: tr('Product designer', 'مصمم منتجات'), demo: true };
        if ([0, 3].includes(index)) records.push({ ...base, id: `${companyId}-application`, metric: 'applications', method: index === 3 ? 'email' : 'website' });
        if (profile) records.push({ ...base, id: `${companyId}-profile`, metric: 'profiles', role: tr('Career profile', 'ملف مهني') });
        if ([2, 3].includes(index)) records.push({ ...base, id: `${companyId}-email`, metric: 'emails', recipient: `careers@sample-${index}.example`, role: index === 2 ? tr('CV for future opportunities', 'سيرة ذاتية للفرص المستقبلية') : base.role });
      }
      return { id, flag, name: tr(en, ar), count: NAMES.length, columns: ['name', 'status', 'progress', 'nextAction', 'lastUpdate'] };
    });
  }
  reset();
  function selected(scope = {}, unfinished = false) {
    return companies.filter(c => (!scope.directoryId || c.directoryId === scope.directoryId) &&
      (!Array.isArray(scope.companyIds) || scope.companyIds.includes(c.id)) &&
      (!scope.search || c.name.toLowerCase().includes(scope.search.toLowerCase())) &&
      (!scope.status || c.status === scope.status) && (!scope.attention || c.attention === scope.attention) &&
      (!scope.companyTypes?.length || scope.companyTypes.includes(c.companyType)) &&
      (!scope.locations?.length || scope.locations.includes(`location:${c.location}`)) &&
      (!unfinished || (c.status === 'not_started' && !c.progress.profile_created && !records.some(r => r.companyId === c.id && r.metric === 'emails'))));
  }
  function advance(run) {
    if (run.status !== 'running') return;
    const completed = Math.min(run.total, Math.floor((clock() - run.startedClock) / 1600));
    for (let i = run.completed; i < completed; i++) {
      const target = run.targets[i], c = companies.find(c => c.id === target.companyId);
      const at = new Date(clock()).toISOString();
      const add = (metric, role) => { if (!records.some(r => r.companyId === c.id && r.metric === metric)) records.push({ id: `${run.id}-${c.id}-${metric}`, companyId: c.id, companyName: c.name, directoryId: c.directoryId, at, role, metric, demo: true, ...(metric === 'emails' ? { recipient: 'careers@sample.example' } : {}) }); };
      // Alternate a matching job and a profile-only company; outcomes stay distinct.
      const matched = /sample-(4|6)$/.test(c.id);
      if (run.actions.applyMatchingJobs && matched) { add('applications', tr('Product designer', 'مصمم منتجات')); c.status = 'applied'; }
      if (run.actions.createProfiles) { add('profiles', tr('Career profile', 'ملف مهني')); c.progress = { account_created: 1, profile_created: 1, cv_uploaded: 1 }; }
      if (run.actions.sendCvEmails && (!run.actions.applyMatchingJobs || !matched)) add('emails', tr('CV for future opportunities', 'سيرة ذاتية للفرص المستقبلية'));
      c.lastUpdate = at; c.revision++; c.nextAction = tr('Watch for replies and new jobs', 'متابعة الردود والوظائف الجديدة');
      target.status = run.actions.applyMatchingJobs && matched ? 'applied' : 'checked';
      target.nextStep = tr('Sample outcome recorded. Nothing was sent.', 'سُجلت نتيجة تجريبية. لم يُرسل أي شيء.');
    }
    run.completed = completed;
    if (run.targets[completed]) run.targets[completed].status = 'working';
    run.activeCompanyId = run.targets[completed]?.companyId || null;
    run.currentName = run.targets[completed]?.name || '';
    run.updatedAt = new Date(clock()).toISOString();
    run.outcomes = { applicationsSent: records.filter(r => r.metric === 'applications' && r.id.startsWith(run.id)).length };
    if (completed === run.total) run.status = 'completed';
  }
  function detail(id) {
    const company = companies.find(c => c.id === id);
    if (!company) throw new Error(tr('Sample company not found.', 'لم يتم العثور على الشركة التجريبية.'));
    return { company, applications: records.filter(r => r.companyId === id).map(r => ({ ...r,
      status: r.metric === 'applications' ? 'applied' : r.metric === 'profiles' ? 'profile_created' : 'cv_sent',
      updatedAt: r.at, method: tr('Demo', 'تجربة'), notes: tr('Simulated record. No real application, profile or email.', 'سجل محاكاة. لا يوجد طلب أو ملف أو بريد فعلي.'),
      ...(r.metric === 'emails' ? { providerMessageId: 'DEMO-RECEIPT' } : {}),
    })), activity: [], sharedHistory: false };
  }
  function sampleJobs(scope) {
    return selected(scope).filter(c => /sample-(4|6)$/.test(c.id)).map(c => ({
      id: `${c.id}-job`, title: tr('Product designer', 'مصمم منتجات'), companyNames: [c.name],
      locations: [c.location], matchState: 'current', lastSeenAt: AT,
      description: tr('Fictional opening: design clear web and mobile experiences with a product team.', 'وظيفة افتراضية: تصميم تجارب واضحة للويب والهاتف ضمن فريق منتجات.'),
      evidence: tr('Sample data only. This is not a live vacancy.', 'بيانات تجريبية فقط. ليست وظيفة شاغرة فعلية.'),
      assessment: { isCurrent: true, decision: 'suitable', assistant: 'codex',
        reason: tr('Example match using a fictional designer profile. Your agent checks your real CV in the local app.', 'مثال على المطابقة مع ملف مصمم افتراضي. يراجع مساعدك سيرتك الحقيقية في التطبيق المحلي.') },
    }));
  }
  async function request(path, method = 'GET', body = {}) {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) throw new Error('Demo routes only.');
    const url = new URL(path, 'https://demo.invalid'), route = url.pathname, params = Object.fromEntries(url.searchParams);
    for (const key of ['companyTypes', 'locations', 'companyIds']) if (params[key]) params[key] = JSON.parse(params[key]);
    runs.forEach(advance);
    let value;
    if (route === '/bootstrap' && method === 'GET') value = { directories, settings: { language: lang, timezone: 'Asia/Dubai', preferredAssistant: 'codex' }, connections: [], nativeClient: { assistant: 'codex', capabilities: {} }, statuses: [], runs, reports: [] };
    else if (route === '/companies' && method === 'GET') {
      const items = selected(params).sort((a, b) => a.name.localeCompare(b.name) * (params.direction === 'desc' ? -1 : 1));
      const all = selected({ directoryId: params.directoryId });
      value = { items: items.slice(Number(params.offset || 0), Number(params.offset || 0) + Number(params.limit || 100)), total: items.length,
        statusCounts: all.reduce((s, c) => ({ ...s, [c.status]: (s[c.status] || 0) + 1 }), {}), listScopeVersion: 1,
        facets: { locations: [...new Set(all.map(c => c.location))].map(label => ({ id: `location:${label}`, label, count: all.length })), companyTypes: [{ id: 'private', label: tr('Private company', 'شركة خاصة'), count: all.length }] } };
    }
    else if (/^\/companies\/[^/]+$/.test(route) && method === 'GET') value = detail(route.split('/')[2]);
    else if (/^\/companies\/[^/]+$/.test(route) && method === 'PATCH') {
      const c = detail(route.split('/')[2]).company;
      for (const key of ['status', 'notes', 'nextAction']) if (typeof body[key] === 'string') c[key] = body[key].slice(0, 1000);
      c.revision++; value = c;
    }
    else if (route === '/snapshot' && method === 'GET') {
      const metric = params.metric || null, offset = Number(params.offset || 0), limit = 20;
      const startOfWeek = new Date(clock());
      startOfWeek.setUTCHours(0, 0, 0, 0);
      startOfWeek.setUTCDate(startOfWeek.getUTCDate() - ((startOfWeek.getUTCDay() + 6) % 7));
      const periodRecords = records.filter(r => r.directoryId === params.directoryId && (params.period !== 'this_week' || new Date(r.at) >= startOfWeek));
      const items = periodRecords.filter(r => r.metric === metric);
      const periodCounts = Object.fromEntries(['applications', 'profiles', 'emails'].map(key => [key, periodRecords.filter(r => r.metric === key).length]));
      value = { directoryId: params.directoryId, period: params.period || 'all_time', metric, counts: periodCounts, items: items.slice(offset, offset + limit), total: items.length, offset, limit, timeZone: 'Asia/Dubai', unverifiedEmails: 0 };
    }
    else if (route === '/run-preview') {
      const scope = method === 'GET' ? JSON.parse(params.scope) : body;
      value = { count: selected(scope, true).length, listScopeVersion: 1, runActionsVersion: 1 };
    }
    else if (route === '/native/runs' && method === 'POST') {
      if (runs.some(r => r.status === 'running')) throw new Error(tr('A demo run is already working.', 'هناك تشغيل تجريبي قيد العمل.'));
      if (!body.actions || !Object.values(body.actions).some(v => v === true)) throw new Error('Choose a demo action.');
      const targets = selected(body, true).map(c => ({ companyId: c.id, name: c.name, status: 'pending' }));
      if (!targets.length) throw new Error(tr('Reset the demo to try another run.', 'أعد ضبط التجربة لبدء تشغيل جديد.'));
      const run = { id: `demo-run-${runs.length + 1}`, native: true, directoryId: body.directoryId, directoryName: directories.find(d => d.id === body.directoryId)?.name,
        assistant: 'codex', actions: { ...body.actions }, companyIds: targets.map(t => t.companyId), targets, total: targets.length, completed: 0,
        startedClock: clock(), status: 'running', activeCompanyId: targets[0].companyId, currentName: targets[0].name, outcomes: { applicationsSent: 0 }, notes: tr('Demo complete. Nothing was sent.', 'اكتملت التجربة. لم يُرسل أي شيء.') };
      run.targets[0].status = 'working';
      runs.unshift(run); value = { run };
    }
    else if (/^\/runs\/demo-run-\d+/.test(route)) {
      const run = runs.find(r => r.id === route.split('/')[2]);
      if (!run) throw new Error('Demo run not found.');
      if (route.endsWith('/stop') && method === 'POST') { run.status = 'cancelled'; run.activeCompanyId = null; }
      value = route.endsWith('/targets') ? { runId: run.id, items: run.targets.slice(Number(params.offset || 0), Number(params.offset || 0) + 50), total: run.total, offset: Number(params.offset || 0), limit: 50 } : run;
    }
    else if (route === '/monitoring' && method === 'GET') value = { config: { enabled: false, assistant: 'codex', channels: {}, scope: {}, revision: 1 }, status: {} };
    else if (route === '/discovery/summary' && method === 'GET') value = { new: sampleJobs(params).length, changed: 0, pending: sampleJobs(params).length, sourceProblems: [] };
    else if (route === '/discovery/jobs' && method === 'GET') { const items = params.view === 'needs_you' ? [] : sampleJobs(params); value = { items, total: items.length, nextCursor: null }; }
    else if (route.startsWith('/discovery/jobs/') && method === 'GET') {
      const item = sampleJobs(params).find(job => job.id === route.split('/')[3]);
      if (!item) throw new Error('Sample job not found.');
      value = { job: item, assessment: item.assessment, matchState: 'current' };
    }
    else if (route === '/discovery/preferences' && method === 'GET') value = { roles: [], locations: [], notes: '', revision: 1 };
    else throw new Error(tr('This action is available in the local app. The demo only changes sample records.', 'هذا الإجراء متاح في التطبيق المحلي. التجربة تغيّر السجلات التجريبية فقط.'));
    return clone(value);
  }
  return { request, reset, get language() { return lang; } };
}
