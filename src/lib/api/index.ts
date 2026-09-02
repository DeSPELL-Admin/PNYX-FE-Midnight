/**
 * API 모듈 통합 export
 *
 * 사용법:
 *   import { api } from '~/lib/api';
 *   const list = await api.user.getUserTournaments(chainId, address);
 */

// 클라이언트 유틸리티
export {
  ApiError,
  apiRequest,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
} from './client';

// 타입 정의
export type {
  ApiResponse,
} from './types';

// 도메인별 API 모듈
import * as user from './user';
import * as tournaments from './tournaments';
import * as categories from './categories';
import * as files from './files';
import * as auth from './auth';
import * as signature from './signature';
import * as market from './market';

export const api = {
  user,
  tournaments,
  categories,
  files,
  auth,
  signature,
  market,
};

export { user, tournaments, categories, files, auth, signature, market };
