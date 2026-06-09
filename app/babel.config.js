/** @type {import('@babel/core').TransformOptions} */
module.exports = function (api) {
  api.cache(true)
  // nativewind/babel returns a preset-shaped object ({ plugins: [] }) which is only
  // valid in Metro's Babel fork, not in standard Babel used by Jest. Disable it in
  // test mode to avoid "plugins is not a valid Plugin property" from babel-jest.
  // jest-expo sets caller.name = "metro" so we use NODE_ENV instead.
  const isTest = process.env.NODE_ENV === 'test'
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: isTest ? undefined : 'nativewind' }],
    ],
    plugins: isTest ? [] : ['nativewind/babel'],
  }
}
