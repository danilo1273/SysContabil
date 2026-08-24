const fs = require('fs');
let css = fs.readFileSync('c:/Users/User/Desktop/Consolidado/src/App.css', 'utf8');

if (!css.includes('Premium Aesthetics Additions')) {
  css += `

/* Premium Aesthetics Additions */
.protheus-module {
  animation: fadeIn 0.5s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.glass-panel {
  background: linear-gradient(145deg, rgba(30,30,30,0.8), rgba(20,20,20,0.6));
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.glass-panel:hover {
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.7);
}

.tab-btn {
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}
.tab-btn::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; width: 0; height: 3px;
  background: var(--color-primary);
  transition: width 0.3s ease;
}
.tab-btn:hover::after, .tab-btn.active::after {
  width: 100%;
}
.tab-btn.active {
  background: rgba(220, 168, 64, 0.1);
}

.action-btn {
  background: linear-gradient(45deg, #dca840, #ffc85a);
  color: #111;
  font-weight: bold;
  box-shadow: 0 4px 15px rgba(220, 168, 64, 0.4);
  transition: all 0.3s ease;
}
.action-btn:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 6px 20px rgba(220, 168, 64, 0.6);
}

.secondary-nav button {
  transition: color 0.2s, border-color 0.2s;
}
.secondary-nav button:hover {
  color: #dca840 !important;
}

.data-table tbody tr {
  transition: background-color 0.2s ease;
}
.data-table tbody tr:hover {
  background-color: rgba(255,255,255,0.05) !important;
}
`;
  fs.writeFileSync('c:/Users/User/Desktop/Consolidado/src/App.css', css, 'utf8');
}
