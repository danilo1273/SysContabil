import fs from 'fs';
const paths = [
    'c:/Users/User/Desktop/Consolidado/src/App.jsx', 
    'c:/Users/User/Desktop/Consolidado/src/components/GestaoContabilModule.jsx', 
    'c:/Users/User/Desktop/Consolidado/src/components/ProtheusModule.jsx'
];
paths.forEach(p => {
    let txt = fs.readFileSync(p, 'utf8');
    txt = txt.replace(/`http:\/\/(localhost|\\\$\{window\.location\.hostname\}|\$\{window\.location\.hostname\}):3001([^`]*)`/g, '`http://${window.location.hostname}:3001$2`');
    fs.writeFileSync(p, txt);
});
