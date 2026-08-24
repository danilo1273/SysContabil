const accounts = [
  "3",
  "3.1",
  "3.1.1",
  "3.1.1.1",
  "3.1.1.1.01",
  "3.1.1.1.01.00001",
  "3.1.1.1.01.00002"
];

for (let i = 0; i < accounts.length; i++) {
  const parent = accounts[i];
  
  let isAnaliticaOld = true;
  for (let j = 0; j < accounts.length; j++) {
    if (i !== j && accounts[j].startsWith(parent)) {
      isAnaliticaOld = false;
      break;
    }
  }
  
  let isAnaliticaNew = true;
  for (let j = 0; j < accounts.length; j++) {
    if (i !== j && accounts[j].startsWith(parent + '.')) {
      isAnaliticaNew = false;
      break;
    }
  }
  
  console.log(\`Conta: \${parent} | Old: \${isAnaliticaOld} | New: \${isAnaliticaNew}\`);
}
