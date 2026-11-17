interface User {
  id: string;
  name: string;
  role: string;
}

const u: User = { id: '1', name: 'DairyAdmin', role: 'admin' };
console.log('TypeScript executes natively on Node 24:', u);
