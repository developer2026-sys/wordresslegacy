#!/usr/bin/env node
/**
 * apply-llc-connect.mjs
 * Re-applies the Lasting Legacy "Connect" integration to the static HTML export.
 * Safe to run more than once (idempotent). No dependencies.
 *
 *   node tools/apply-llc-connect.mjs          # from the repo root
 *
 * What it does (no visible copy is changed):
 *   1. Every page: adds /llc/llc-connect.css in <head> and /llc/llc-connect.js before </body>.
 *   2. Home page (index.html):
 *      - Adds the Funeral Home ZIP Locator into the "Find a Memorial Care Plan Provider" section (#funreal),
 *        where the WordPress plugin widget used to render.
 *      - Points the "Memorial Service Request" form at Formspree (https://formspree.io/f/mdeanrnv),
 *        renames its fields to readable names, makes Full Name / Phone / Terms required,
 *        and fixes the "Select a Service" options that had empty values.
 *      - Adds id="request" to the Get Started section so the "Contact Us" menu link (/#request) lands on the form.
 *   3. Our Work page: adds the locator under the "Search for a Provider here" heading.
 *   5. Typo fixes (approved by the owner): "Serach" -> "Search" (Our Work), "Memorial  Refinsh" -> "Memorial Refinish" (home),
 *      and the stray quotation mark at the end of the SMS consent text (home).
 *   4. vercel.json: adds a pass-through for /api/llc-funeral-homes ahead of the /api/* backend rewrite.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VERSION = '1.0.0';
const FORMSPREE = 'https://formspree.io/f/mdeanrnv';

const CSS_TAG = `<link rel="stylesheet" id="llc-connect-css" href="/llc/llc-connect.css?v=${VERSION}" media="all">`;
const JS_TAG = `<script src="/llc/llc-connect.js?v=${VERSION}" id="llc-connect-js" defer></script>`;

const SLOT = (label) =>
  `\n\t\t\t\t<!-- LLC Funeral Home ZIP Locator (${label}) -->` +
  `<div class="llc-locator-slot" style="width:100%;max-width:100%;">` +
  `<div data-llc-locator="inline"></div>` +
  `<noscript><p style="text-align:center;font-size:22px;font-weight:700;"><a href="tel:+13179703904">Call 317-970-3904</a></p></noscript>` +
  `</div>`;

const log = (...a) => console.log('[llc]', ...a);
const fail = (msg) => { console.error('[llc] ERROR:', msg); process.exitCode = 1; };

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules' || name === 'wp-content' || name === 'wp-includes') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

function replaceOnce(html, find, repl, label) {
  const i = html.indexOf(find);
  if (i === -1) { fail(`could not find ${label}`); return html; }
  if (html.indexOf(find, i + find.length) !== -1) { fail(`${label} is not unique`); return html; }
  return html.slice(0, i) + repl + html.slice(i + find.length);
}

/* 1. includes on every page */
const pages = walk(ROOT);
for (const file of pages) {
  let h = fs.readFileSync(file, 'utf8');
  const before = h;
  if (!h.includes('id="llc-connect-css"')) {
    const i = h.lastIndexOf('</head>');
    if (i === -1) { fail(`no </head> in ${file}`); continue; }
    h = h.slice(0, i) + CSS_TAG + '\n' + h.slice(i);
  }
  if (!h.includes('id="llc-connect-js"')) {
    const i = h.lastIndexOf('</body>');
    if (i === -1) { fail(`no </body> in ${file}`); continue; }
    h = h.slice(0, i) + JS_TAG + '\n' + h.slice(i);
  }
  if (h !== before) { fs.writeFileSync(file, h); log('includes ->', path.relative(ROOT, file)); }
}

/* 2. home page */
{
  const file = path.join(ROOT, 'index.html');
  let h = fs.readFileSync(file, 'utf8');
  const before = h;

  // 2a. locator inside #funreal, right after the "Top 3 Questions" list
  if (!h.includes('LLC Funeral Home ZIP Locator (home)')) {
    const sec = h.indexOf('id="funreal"');
    const ol = h.indexOf('</ol>', sec);
    if (sec === -1 || ol === -1) fail('home #funreal section not found');
    else {
      const m = /^(\s*<\/div>\s*<\/div>)/.exec(h.slice(ol + 5));
      if (!m) fail('could not find end of the Top 3 Questions widget');
      else {
        const at = ol + 5 + m[1].length;
        h = h.slice(0, at) + SLOT('home') + h.slice(at);
      }
    }
  }

  // 2b. Get Started section anchor for the "Contact Us" menu link (/#request)
  if (!h.includes('id="request"')) {
    h = replaceOnce(h,
      'data-id="1c598ef" data-element_type="container"',
      'data-id="1c598ef" id="request" data-element_type="container"',
      'Get Started section (1c598ef)');
  }

  // 2c. Memorial Service Request form -> Formspree
  if (!h.includes('data-llc-formspree="service-request"')) {
    h = replaceOnce(h,
      '<form class="elementor-form" method="post" name="New Form" aria-label="New Form">',
      `<form class="elementor-form" method="post" action="${FORMSPREE}" accept-charset="UTF-8" name="New Form" aria-label="New Form" data-llc-formspree="service-request">` +
      '\n\t\t\t<input type="hidden" name="_subject" value="Memorial Service Request - Lasting Legacy Website">' +
      '\n\t\t\t<input type="hidden" name="form_type" value="Memorial Service Request">' +
      '\n\t\t\t<div aria-hidden="true" style="position:absolute!important;left:-10000px!important;width:1px;height:1px;overflow:hidden;"><input type="text" name="_gotcha" tabindex="-1" autocomplete="off"></div>',
      'service request <form> tag');

    const fields = [
      ['name="form_fields[name]" id="form-field-name" class="elementor-field elementor-size-sm  elementor-field-textual"',
       'name="name" id="form-field-name" autocomplete="name" required aria-required="true" class="elementor-field elementor-size-sm  elementor-field-textual"', 'Full Name'],
      ['type="text" name="form_fields[field_23dd9ab]"', 'type="email" autocomplete="email" name="email"', 'Email Address'],
      ['type="text" name="form_fields[field_0edf283]" id="form-field-field_0edf283" class=',
       'type="tel" inputmode="tel" autocomplete="tel" name="phone" id="form-field-field_0edf283" required aria-required="true" class=', 'Phone Number'],
      ['name="form_fields[field_7e7a68f]"', 'name="service"', 'Select a Service'],
      ['name="form_fields[field_ab9ac2b]"', 'name="memorial_name"', 'Name of Person on Memorial'],
      ['name="form_fields[optionbox]"', 'name="message"', 'Message'],
      ['name="form_fields[field_46a6602]"', 'name="sms_consent"', 'SMS consent'],
      ['name="form_fields[field_bd83c9f]"', 'name="terms_agreed" required aria-required="true"', 'Terms checkbox'],
    ];
    for (const [find, repl, label] of fields) h = replaceOnce(h, find, repl, label);

    // Terms checkbox value contained raw HTML; send a clean value instead (label text is untouched).
    h = h.replace(
      /(<input type="checkbox" value=")I agree to the &lt;a href=&quot;https:\/\/lastinglegacycleaners\.com\/terms-conditions\/&quot;&gt; Terms and Conditions &lt;\/a&gt; and &lt;a href=&quot;https:\/\/lastinglegacycleaners\.com\/privacy-policy\/&quot;&gt; Privacy Policy&lt;\/a&gt;\.(")/,
      '$1Agreed to the Terms and Conditions and Privacy Policy$2');

    // "Select a Service": three options were submitting an empty value. Use their visible text.
    const fixOpt = (label) => {
      const find = `<option value="">${label} </option>`;
      h = replaceOnce(h, find, `<option value="${label}">${label} </option>`, `option "${label}"`);
    };
    fixOpt('Basic Annual Plan — $549 / annually (1 visits)');
    fixOpt('Family Plan — Multiple Markers (Call for Pricing)');
    fixOpt('Partnership Discussion');
  }

  if (h !== before) { fs.writeFileSync(file, h); log('home page patched'); }
}

/* 3. Our Work page */
{
  const file = path.join(ROOT, 'our-work', 'index.html');
  if (fs.existsSync(file)) {
    let h = fs.readFileSync(file, 'utf8');
    if (!h.includes('LLC Funeral Home ZIP Locator (our-work)')) {
      let i = h.indexOf('Search for a Provider here</h2>');
      if (i === -1) i = h.indexOf('Serach for a Provider here</h2>');
      if (i === -1) fail('Our Work provider heading not found');
      else {
        const m = /^(Se(?:ar|ra)ch for a Provider here<\/h2>\s*<\/div>\s*<\/div>)/.exec(h.slice(i));
        const at = i + m[1].length;
        h = h.slice(0, at) + SLOT('our-work') + h.slice(at);
        fs.writeFileSync(file, h);
        log('our-work patched');
      }
    }
  }
}

/* 4. vercel.json pass-through for the locator function */
{
  const file = path.join(ROOT, 'vercel.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.rewrites = cfg.rewrites || [];
  if (!cfg.rewrites.some((r) => r.source === '/api/llc-funeral-homes')) {
    cfg.rewrites.unshift({ source: '/api/llc-funeral-homes', destination: '/api/llc-funeral-homes' });
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
    log('vercel.json updated');
  }
}

/* 5. Typo fixes approved by the owner */
{
  const fixes = [
    ['our-work/index.html', '>Serach for a Provider here</h2>', '>Search for a Provider here</h2>'],
    ['index.html', '>Memorial  Refinsh</p>', '>Memorial Refinish</p>'],
    ['index.html', 'Message frequency may vary.&quot;" id="form-field-field_46a6602-0"', 'Message frequency may vary." id="form-field-field_46a6602-0"'],
    ['index.html', 'Message frequency may vary."</label>', 'Message frequency may vary.</label>'],
  ];
  for (const [rel, find, repl] of fixes) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    const h = fs.readFileSync(file, 'utf8');
    if (h.includes(find)) { fs.writeFileSync(file, h.split(find).join(repl)); log('typo fixed in', rel + ':', repl.replace(/<[^>]+>/g, '').slice(0, 60)); }
  }
}

log(process.exitCode ? 'finished WITH ERRORS (see above)' : 'done');
