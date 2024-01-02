/**
 * Deeply copy an object
 * @param {unknown} obj
 * @returns Deep copy of |obj|
 */
export function deepcopy(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepcopy);
  }
  const copy = {
    __proto__: Object.getPrototypeOf(obj),
  };
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepcopy(obj[key]);
    }
  }
  for (const key of Object.getOwnPropertySymbols(obj)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepcopy(obj[key]);
    }
  }
  return copy;
}

/**
 * Perform an operation on each property of an object, deeply
 * @param {object} obj
 * @param {(value: unknown, key) => any} callback
 */
export function traverseObject(obj, callback, /** @internal */ key = null) {
  if (typeof obj !== 'object' || obj === null) {
    callback(obj, key);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((value, index) => traverseObject(value, callback, index));
    return;
  }
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = traverseObject(obj[key], callback, key);
    }
  }
  for (const key of Object.getOwnPropertySymbols(obj)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj[key] = traverseObject(obj[key], callback, key);
    }
  }
}

/**
 * Deeply compare two values
 * @param {unknown} obj1
 * @param {unknown} obj2
 * @returns {boolean} Whether |obj1| and |obj2| are deeply equal
 */
export function deepEqual(obj1, obj2) {
  if (obj1 === obj2) {
    // Quick check for trivial equality to try to short circuit the rest of the function
    return true;
  }
  if (typeof obj1 !== 'object' || obj1 === null) {
    if (typeof obj1 === 'number') {
      // If both are NaN, because `NaN === NaN` is false, we would need to check them both for NaN
      return (Number.isNaN(obj1) && Number.isNaN(obj2)) || obj1 === obj2;
    }
    return obj1 === obj2;
  }
  if (typeof obj2 !== 'object' || obj2 === null) {
    // obj1 is an object and not null, so if obj2 isn't an object or is null then they're not equal
    return false;
  }
  if (Array.isArray(obj1)) {
    if (!Array.isArray(obj2)) {
      return false;
    }
    if (obj1.length !== obj2.length) {
      return false;
    }
    for (let i = 0, l = obj1.length; i < l; i++) {
      if (!deepEqual(obj1[i], obj2[i])) {
        return false;
      }
    }
    return true;
  }
  if (Array.isArray(obj2)) {
    // obj1 isn't an array so if obj2 is an array then they're not equal
    return false;
  }
  const proto1 = Object.getPrototypeOf(obj1);
  const proto2 = Object.getPrototypeOf(obj2);
  if (!deepEqual(proto1, proto2)) {
    // If the prototypes aren't deeply equal then the objects won't have the same shape by definition
    return false;
  }
  const keys1 = Reflect.ownKeys(obj1);
  const keys2 = Reflect.ownKeys(obj2);
  if (keys1.length !== keys2.length) {
    return false;
  }
  for (const key of keys1) {
    if (!Object.prototype.hasOwnProperty.call(obj2, key)) {
      return false;
    }
    if (!deepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }
  // Since they have the same length, if we reach here then there cannot be any keys
  // in keys2 that are not in keys1 so we don't need to iterate keys2 at all
  return true;
}
