import { ensureDatabase,getD1,runtimeEnv } from '../database';
import { PartyBroker } from './broker';
export async function partyBroker(){await ensureDatabase();return new PartyBroker(getD1(),runtimeEnv());}
