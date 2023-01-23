export const config = {
  disable: true,
};

export default async () => {
  console.log('TEST-BUILTINS');
  console.log(Infinity);
  console.log(NaN);
  console.log(undefined);
  console.log(eval);
  console.log(isFinite);
  console.log(isNaN);
  console.log(parseFloat);
  console.log(parseInt);
  console.log(decodeURI);
  console.log(decodeURIComponent);
  console.log(encodeURI);
  console.log(encodeURIComponent);
  console.log(escape);
  console.log(unescape);
  console.log(Object);
  console.log(Function);
  console.log(Boolean);
  console.log(Symbol);
  console.log(Error);
  console.log(AggregateError);
  console.log(EvalError);
  console.log(RangeError);
  console.log(ReferenceError);
  console.log(SyntaxError);
  console.log(TypeError);
  console.log(URIError);
  console.log(Number);
  console.log(BigInt);
  console.log(Math);
  console.log(Date);
  console.log(String);
  console.log(RegExp);
  console.log(Array);
  console.log(Int8Array);
  console.log(Uint8Array);
  console.log(Uint8ClampedArray);
  console.log(Int16Array);
  console.log(Uint16Array);
  console.log(Int32Array);
  console.log(Uint32Array);
  console.log(BigInt64Array);
  console.log(BigUint64Array);
  console.log(Float32Array);
  console.log(Float64Array);
  console.log(Map);
  console.log(Set);
  console.log(WeakMap);
  console.log(WeakSet);
  console.log(ArrayBuffer);
  console.log(SharedArrayBuffer);
  console.log(DataView);
  console.log(Atomics);
  console.log(JSON);
  console.log(WeakRef);
  console.log(FinalizationRegistry);
  console.log(Promise);
  console.log(Reflect);
  console.log(Proxy);
  console.log(Intl);
  console.log(atob);
  console.log(btoa);
  console.log(require);

  console.log();
  console.log(this);
  console.log(globalThis);
  // console.log(TOKEN);
  console.log(eval('globalThis'));

  let int = setInterval(() => console.log('delayed'), 200);
  let timeout1 = setTimeout(() => console.log('long'), 10_000);
  clearTimeout(timeout1);
  let timeout2 = setTimeout(() => clearInterval(int), 2000);
  console.log(structuredClone);
  console.log(fetch);

  console.log(structuredClone({ a: 'a', b: 1, c: { h: 'h' } }));
  console.log(await fetch('https://example.com'));
  fetch('https://example.com').then((r) => {
    console.log({ status: r.status, ok: r.ok });
  });

  setTimeout(() => console.log(eval('globalThis')), 100);

  console.log('everything is fine');
};
