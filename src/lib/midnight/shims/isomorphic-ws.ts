/**
 * 브라우저용 `isomorphic-ws` 대체. midnight-js indexer provider 는 `import { WebSocket } from 'isomorphic-ws'`
 * 를 쓰는데 isomorphic-ws 의 browser 엔트리는 default export 뿐이라 webpack 이 실패한다.
 * next.config 의 alias 로 클라이언트 번들에서만 이 파일로 바꿔 끼운다.
 */
const BrowserWebSocket = globalThis.WebSocket;
export { BrowserWebSocket as WebSocket };
export default BrowserWebSocket;
