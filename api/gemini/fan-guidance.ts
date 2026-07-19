import { makeGeminiHandler } from '../_lib/handler';
import { ENDPOINT_TASKS } from '../../src/ai/endpoints';

export default makeGeminiHandler(ENDPOINT_TASKS['fan-guidance']);
