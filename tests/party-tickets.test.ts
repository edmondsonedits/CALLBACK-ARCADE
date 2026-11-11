import assert from "node:assert/strict";
import test from "node:test";
import { signPartyTicket, verifyPartyTicket, type PartyClaims } from "../lib/party/security";

const claims:PartyClaims={v:1,partyId:"party-1",roomCode:"ABCD",matchId:"match-1",role:"player",seatId:"00",memberId:"member-1",name:"Ada",expiresAt:30_000,nonce:"abcdefghijklmnop"};

test("party socket ticket signs exact claims and rejects expiry, tampering and unexpected fields", async () => {
  const token=await signPartyTicket(claims,"test-secret");
  assert.deepEqual(await verifyPartyTicket(token,"test-secret",29_999),claims);
  await assert.rejects(()=>verifyPartyTicket(token,"wrong-secret",1),/PARTY_TICKET_SIGNATURE/);
  await assert.rejects(()=>verifyPartyTicket(token,"test-secret",30_000),/PARTY_TICKET_EXPIRED/);
  const bad=await signPartyTicket({...claims,extra:"ignored"} as PartyClaims,"test-secret").catch(()=>"");
  assert.equal(bad,"");
});
