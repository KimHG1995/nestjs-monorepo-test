const { TsconfigPathsPlugin } = require('tsconfig-paths-webpack-plugin');

/**
 * Nest CLI 10 은 baseUrl 없는 상속 paths를 앱 tsconfig 디렉터리 기준으로 해석합니다.
 * TypeScript 설정은 TS 7 형식을 유지하고 Webpack resolver에만 저장소 루트를 지정합니다.
 *
 * @param {import('webpack').Configuration} defaultConfig Nest CLI 기본 Webpack 설정
 * @returns {import('webpack').Configuration} 경로 별칭 기준점을 교정한 설정
 */
module.exports = (defaultConfig) => ({
  resolve: {
    ...defaultConfig.resolve,
    plugins: [
      new TsconfigPathsPlugin({
        baseUrl: '.',
        configFile: 'tsconfig.json',
      }),
    ],
  },
});
