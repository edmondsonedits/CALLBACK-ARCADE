import {ensureDatabase,getD1} from '../../database';import {getOnlineEngine} from '../../../lib/arcade/online/engines';import {OnlineArcadeService} from './service';
import {reserveCallbackCode} from '../../sessions/codes';
import {runtimeEnv} from '../../database';import {OnlineSocketBroker} from './socket-broker';
export async function onlineService(){await ensureDatabase();return new OnlineArcadeService(getD1(),getOnlineEngine,Date.now,code=>reserveCallbackCode(getD1(),code,'online',Date.now()+86400000))}
export async function onlineSocketBroker(){await ensureDatabase();return new OnlineSocketBroker(getD1(),runtimeEnv())}
