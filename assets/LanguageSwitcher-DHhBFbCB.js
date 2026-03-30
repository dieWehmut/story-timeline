import{o as p,u as h,j as t}from"./index-B6BNjVC8.js";import{a as r,z as x}from"./vendor-ui-BmwYIqOs.js";function v({className:l=""}){const{language:i,setLanguage:c}=p(),{t:e}=h(),[n,s]=r.useState(!1),o=r.useRef(null),d=[{code:"zh-CN",name:e("languages.zh-CN")},{code:"zh-TW",name:e("languages.zh-TW")},{code:"en",name:e("languages.en")},{code:"ja",name:e("languages.ja")},{code:"de",name:e("languages.de")},{code:"fr",name:e("languages.fr")},{code:"es",name:e("languages.es")},{code:"la",name:e("languages.la")}];r.useEffect(()=>{const a=u=>{o.current&&!o.current.contains(u.target)&&s(!1)};if(n)return document.addEventListener("mousedown",a),()=>document.removeEventListener("mousedown",a)},[n]);const m=a=>{c(a),s(!1)},g=()=>{s(!n)};return t.jsxs(t.Fragment,{children:[t.jsx("style",{dangerouslySetInnerHTML:{__html:`
          .language-dropdown {
            opacity: 0;
            transform: scale(0.95) translateY(-8px);
            pointer-events: none;
            transition: opacity 0.15s ease-out, transform 0.15s ease-out;
          }

          .language-dropdown.open {
            opacity: 1;
            transform: scale(1) translateY(0);
            pointer-events: auto;
          }

          .language-item {
            opacity: 0;
            transform: translateX(-10px);
          }

          .language-dropdown.open .language-item {
            animation: slideInItem 0.2s ease-out forwards;
          }

          @keyframes slideInItem {
            from {
              opacity: 0;
              transform: translateX(-10px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          .language-item:nth-child(1) { animation-delay: 0.02s; }
          .language-item:nth-child(2) { animation-delay: 0.04s; }
          .language-item:nth-child(3) { animation-delay: 0.06s; }
          .language-item:nth-child(4) { animation-delay: 0.08s; }
          .language-item:nth-child(5) { animation-delay: 0.10s; }
          .language-item:nth-child(6) { animation-delay: 0.12s; }
          .language-item:nth-child(7) { animation-delay: 0.14s; }
          .language-item:nth-child(8) { animation-delay: 0.16s; }

          @keyframes checkmarkPop {
            0% {
              opacity: 0;
              transform: scale(0.5);
            }
            50% {
              transform: scale(1.1);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }

          .checkmark-icon {
            animation: checkmarkPop 0.3s ease-out;
          }
        `}}),t.jsxs("div",{className:`relative ${l}`,ref:o,children:[t.jsx("button",{"aria-label":e("tooltips.languageSwitcher"),className:`inline-flex h-9 w-9 items-center justify-center text-[var(--text-main)] transition-all duration-300 hover:scale-110 hover:text-[var(--text-accent)] active:scale-95 ${n?"text-[var(--text-accent)] scale-110":""}`,onClick:g,title:e("tooltips.languageSwitcher"),type:"button",children:t.jsx(x,{size:18,style:{transition:"transform 0.25s ease-out",transform:n?"rotate(180deg)":"rotate(0deg)"}})}),t.jsx("div",{className:`language-dropdown ${n?"open":""} absolute right-0 top-full mt-2 w-40 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] py-2 backdrop-blur-xl z-50 origin-top-right`,style:{boxShadow:"0 10px 40px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)"},children:d.map(a=>t.jsxs("button",{className:`language-item flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-all duration-150 hover:bg-white/10 active:scale-[0.98] relative overflow-hidden ${i===a.code?"text-[var(--text-accent)] bg-white/5":"text-[var(--text-main)]"}`,onClick:()=>m(a.code),type:"button",children:[t.jsx("span",{className:"font-medium relative z-10",children:a.name}),i===a.code&&t.jsx("span",{className:"checkmark-icon text-[var(--text-accent)] font-bold relative z-10",children:"✓"})]},a.code))})]})]})}export{v as L};
