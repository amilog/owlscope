import { useState } from 'react';
import { getClient } from 'owlscope';

export default function App() {
  const [count, setCount] = useState(0);

  const fireLogs = () => {
    console.log('Hello from demo', { count, ts: Date.now() });
    console.info('Info message', { tag: 'demo' });
    console.warn('Watch out for', { count });
    console.debug('Debug payload', { random: Math.random() });
  };

  const fireError = () => {
    try {
      throw new Error('Demo error: something blew up');
    } catch (err) {
      console.error('Caught error:', err);
    }
  };

  const fireCustom = () => {
    const owl = getClient();
    owl?.event('user-action', {
      type: 'click',
      target: 'fire-custom',
      meta: { count },
    });
  };

  const fireBurst = () => {
    for (let i = 0; i < 100; i++) {
      console.log(`burst #${i}`, { i });
    }
  };

  const fireFetch = async () => {
    const res = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data = await res.json();
    console.log('GET /posts/1 →', data);
  };

  const firePost = async () => {
    const res = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'OwlScope test', body: 'hello world', userId: 1 }),
    });
    const data = await res.json();
    console.log('POST /posts →', data);
  };

  const fireXhr = () => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://jsonplaceholder.typicode.com/users/1');
    xhr.onload = () => console.log('XHR /users/1 →', xhr.status);
    xhr.send();
  };

  const fire404 = async () => {
    try {
      await fetch('https://jsonplaceholder.typicode.com/does-not-exist');
    } catch (err) {
      console.error('fetch failed', err);
    }
  };

  const fireUncaught = () => {
    setTimeout(() => {
      throw new Error('Demo uncaught error from setTimeout');
    }, 0);
  };

  const fireRejection = () => {
    Promise.reject(new Error('Demo unhandled promise rejection'));
  };

  const fireMeasure = () => {
    performance.mark('demo-start');
    // simulate work
    let n = 0;
    for (let i = 0; i < 1_000_000; i++) n += Math.sqrt(i);
    performance.mark('demo-end');
    performance.measure('demo-work', 'demo-start', 'demo-end');
    console.log('measure done', n);
  };

  const fireStorage = () => {
    localStorage.setItem('demo:user', JSON.stringify({ id: 1, name: 'Amin' }));
    sessionStorage.setItem('demo:token', 'abc-' + Date.now());
    setTimeout(() => {
      localStorage.removeItem('demo:user');
    }, 250);
  };

  return (
    <main>
      <h1>OwlScope Demo</h1>
      <p>
        Open the desktop app first. Console output here is forwarded over
        WebSocket to <code>ws://localhost:9090</code>.
      </p>

      <div className="grid">
        <button onClick={fireLogs}>console.log / info / warn / debug</button>
        <button onClick={fireError}>console.error</button>
        <button onClick={fireCustom}>owl.event('user-action')</button>
        <button onClick={fireBurst}>burst (100 logs)</button>
        <button onClick={fireFetch}>fetch GET /posts/1</button>
        <button onClick={firePost}>fetch POST /posts</button>
        <button onClick={fireXhr}>XHR GET /users/1</button>
        <button onClick={fire404}>fetch 404</button>
        <button onClick={fireUncaught}>uncaught error</button>
        <button onClick={fireRejection}>unhandled rejection</button>
        <button onClick={fireMeasure}>performance.measure</button>
        <button onClick={fireStorage}>localStorage / sessionStorage</button>
      </div>

      <div className="counter">
        <button onClick={() => setCount((c) => c + 1)}>count is {count}</button>
      </div>
    </main>
  );
}
