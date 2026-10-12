from common import *
def main():
    ok = True
    with sync_playwright() as p:
        g = Game(p, 'autostart=1&map=keep&fighters=4&seed=11')
        g.wait(2500)
        st = g.ev('RoyalSumo.getState()')
        ok &= check('api alive', st is not None and st['n'] == 4, st and (st['phase'], st['seed']))
        ok &= check('seed from url reaches sim', st and st['seed'] == 11, st and st['seed'])
        g.wait(3500)
        g.shot('smoke_keep')
        ok &= check('console clean', not g.errors, g.errors[:3])
        g.close()
    print('SMOKE', 'OK' if ok else 'FAILED'); sys.exit(0 if ok else 1)
main()
