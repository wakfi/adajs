module.exports = {
  '*.{ts,cjs}': 'yarn lint',
  '*.{ts,cjs,json,md}': 'prettier --write',
  '*.{ts,cjs}': () => 'yarn typecheck',
};
