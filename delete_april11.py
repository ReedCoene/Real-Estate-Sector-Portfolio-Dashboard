import os, requests

SUPABASE_URL     = os.environ['SUPABASE_URL']
SUPABASE_SERVICE = os.environ['SUPABASE_SERVICE_KEY']
headers = {'apikey': SUPABASE_SERVICE, 'Authorization': f'Bearer {SUPABASE_SERVICE}'}

sectors = ['overview','healthcare','housing','industrial','retail','hospitality','netlease','tower','office']

for sector in sectors:
    r = requests.delete(f'{SUPABASE_URL}/storage/v1/object/sector-reports/{sector}/2026-04-11.pdf', headers=headers)
    print(f'{sector}: {r.status_code}')
