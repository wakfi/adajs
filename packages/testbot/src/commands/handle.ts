let a = 5;
export const handler = () => {
  console.log('HANDLER', a, q, myObj.val);
  myObj.val = 20;
  console.log('HANDLER', a, q, myObj.val);
};

var q = 'haha';

const myObj = {
  val: 6,
};

myObj.val = 7;
