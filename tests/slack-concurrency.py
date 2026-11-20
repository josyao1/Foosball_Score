"""Run against a disposable PostgreSQL database after slack-check.sql.
Usage: python3 tests/slack-concurrency.py postgresql://localhost:55439/foos_slack
Never pass a production database: this creates and removes test fixtures.
"""
import json
import subprocess
import sys
import uuid
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor

url = sys.argv[1]
parsed = urlparse(url)
if parsed.hostname not in ('localhost', '127.0.0.1') or not parsed.path.startswith('/foos_slack'):
    raise SystemExit('Only a local disposable foos_slack database is permitted')

def sql(query, check=True):
    result = subprocess.run(['psql', url, '-XAt', '-v', 'ON_ERROR_STOP=1', '-c', query], universal_newlines=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        raise RuntimeError(result.stderr)
    return result

rid, gid = str(uuid.uuid4()), str(uuid.uuid4())
try:
    sql(f"""insert into public.foos_rivalries(id,player_a,player_b) values('{rid}','Slack concurrent A','Slack concurrent B');
    update public.foos_slack_settings set notifications_enabled=true,activation_timestamp=clock_timestamp()-interval '1 minute',last_dispatch_at=null;
    select public.foos_save_game('{gid}','{rid}','2026-11-19T00:00:00Z',null,0,'[]');""")
    goals = json.dumps([dict(id=str(uuid.uuid4()),actor_side='a',rung='middle',flags=[],elapsed_ms=1,occurred_at='2026-11-19T00:00:01Z')])
    finish = f"begin; select public.foos_save_game('{gid}','{rid}','2026-11-19T00:00:00Z',clock_timestamp(),1,'{goals}'::jsonb); select pg_sleep(0.2); commit;"
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: sql(finish,False), range(2)))
    assert sorted(r.returncode == 0 for r in results) == [False,True], results
    assert 'changed on another device' in next(r.stderr for r in results if r.returncode)
    assert sql(f"select count(*) from public.foos_slack_outbox where game_id='{gid}';").stdout.strip() == '1'
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: sql('select public.foos_slack_claim();'), range(2)))
    claims = [json.loads(r.stdout) for r in results if r.stdout.strip()]
    assert len(claims) == 1, claims
    item = claims[0]
    begin = f"select public.foos_slack_begin('{item['id']}','{item['claim_token']}');"
    with ThreadPoolExecutor(max_workers=2) as pool:
        starts = list(pool.map(lambda _: sql(begin).stdout.strip(), range(2)))
    assert sorted(starts) == ['f','t'], starts
    print('PASS: simultaneous finish has one winner/job; competing workers have one claim/send authorization')
finally:
    sql(f"""delete from public.foos_games where rivalry_id='{rid}';
    delete from public.foos_rivalries where id='{rid}';
    delete from public.foos_players where name in ('Slack concurrent A','Slack concurrent B');
    delete from public.foos_slack_outbox where game_id='{gid}';
    update public.foos_slack_settings set notifications_enabled=false,activation_timestamp=null,last_dispatch_at=null;""")
