import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const payload = await req.json()
    const { action, org_id, device_id } = payload

    async function getCreds() {
      const { data, error } = await sb.from('connector_credentials').select('credentials, sync_data').eq('org_id', org_id).eq('connector_id', 'defender').single()
      if (error) throw error
      return data
    }

    async function getMSToken(creds: any): Promise<string> {
      const res = await fetch(`https://login.microsoftonline.com/${creds.tenant_id}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type:'client_credentials', client_id:creds.client_id, client_secret:creds.client_secret, scope:'https://api.securitycenter.microsoft.com/.default' }),
      })
      if (!res.ok) throw new Error(`MS Defender token error: ${res.status}`)
      return (await res.json()).access_token
    }

    function defFetch(token: string, path: string, method = 'GET', body?: unknown) {
      return fetch(`https://api.securitycenter.microsoft.com/api${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (action === 'test') {
      const now = Date.now()
      const groups = [
        { id:'grp1', name:'Domain Controllers', endpoint_count:3  },
        { id:'grp2', name:'Workstations',       endpoint_count:178 },
        { id:'grp3', name:'Servers',            endpoint_count:12  },
        { id:'grp4', name:'Unassigned',         endpoint_count:7   },
      ]
      const endpoints = [
        { id:'def001', name:'DISTRICT-ADMIN-01', serial:'PF1234ABC', group_id:'grp2', group_name:'Workstations', os:'Windows 11', os_version:'10.0.22621', risk_score:'None',   exposure_score:'Low',    health:'Active',   last_seen:new Date(now-300000).toISOString(),   onboarded:new Date('2023-01-10').toISOString(), ip:'10.0.1.10', user:'admin@district.edu',      alert_count:0, av_status:'Updated',  firewall:true,  tamper:false },
        { id:'def002', name:'LHS-STAFF-DLEE',    serial:'PF5678DEF', group_id:'grp2', group_name:'Workstations', os:'Windows 11', os_version:'10.0.22621', risk_score:'None',   exposure_score:'Low',    health:'Active',   last_seen:new Date(now-600000).toISOString(),   onboarded:new Date('2022-08-01').toISOString(), ip:'10.1.1.45', user:'dlee@district.edu',       alert_count:0, av_status:'Updated',  firewall:true,  tamper:false },
        { id:'def003', name:'JMS-STAFF-SBROWN',  serial:'MXL2001GHI', group_id:'grp2', group_name:'Workstations', os:'Windows 10', os_version:'10.0.19045', risk_score:'Medium', exposure_score:'Medium', health:'Active',   last_seen:new Date(now-900000).toISOString(),   onboarded:new Date('2021-09-15').toISOString(), ip:'10.1.2.18', user:'sbrown@district.edu',     alert_count:1, av_status:'Updated',  firewall:true,  tamper:false },
        { id:'def004', name:'SRV-PRINT-01',      serial:'SRV000001',  group_id:'grp3', group_name:'Servers',       os:'Windows Server 2019', os_version:'10.0.17763', risk_score:'None', exposure_score:'Low', health:'Active', last_seen:new Date(now-120000).toISOString(), onboarded:new Date('2022-01-01').toISOString(), ip:'10.0.0.10', user:'', alert_count:0, av_status:'Updated', firewall:true, tamper:false },
        { id:'def005', name:'WIN11-PILOT-01',    serial:'PF9012MNO',  group_id:'grp2', group_name:'Workstations', os:'Windows 11', os_version:'10.0.22631', risk_score:'None',   exposure_score:'Low',    health:'Inactive', last_seen:new Date(now-86400000).toISOString(), onboarded:new Date('2023-06-01').toISOString(), ip:'',          user:'mrodriguez@district.edu', alert_count:0, av_status:'Updated',  firewall:true,  tamper:false },
      ]
      const alerts = [
        { id:'alt001', title:'Suspicious PowerShell command detected', severity:'Medium', category:'SuspiciousActivity', endpoint_id:'def003', endpoint_name:'JMS-STAFF-SBROWN', status:'InProgress', assigned_to:'admin@district.edu', created:new Date(now-86400000).toISOString(), description:'PowerShell executed with encoded command via scheduled task. Investigate if this is authorized admin activity.' },
      ]
      const recommendations = [
        { id:'rec001', title:'Update Microsoft Defender Antivirus definitions', severity:'Medium', category:'Antivirus', remediation_type:'Update', affected_machines:6,  exposure:'Medium' },
        { id:'rec002', title:'Enable Tamper Protection on all devices',         severity:'High',   category:'Security',   remediation_type:'Config',  affected_machines:3,  exposure:'High'   },
        { id:'rec003', title:'Resolve security alerts promptly',                severity:'Medium', category:'Alerts',     remediation_type:'Review',  affected_machines:1,  exposure:'Medium' },
      ]
      const scores = { secure_score:62, exposure_score:28, secure_score_max:100, devices_onboarded:180, devices_at_risk:3, critical_cves:2 }
      const sync_data = { groups, endpoints, alerts, recommendations, scores, synced_at: new Date().toISOString() }
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'defender', credentials:{ mode:'mock' }, status:'connected', sync_data, last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true, sync_data })
    }

    if (action === 'save') {
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'defender', credentials:payload.credentials, status:'connected', last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true })
    }
    if (action === 'load') {
      const { data, error } = await sb.from('connector_credentials').select('sync_data, last_sync').eq('org_id', org_id).eq('connector_id', 'defender').single()
      if (error) throw error
      return respond({ ok:true, ...data })
    }

    if (action === 'sync') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') throw new Error('Mock mode — use real Azure app credentials')
      const token = await getMSToken(creds)
      const [devRes, altRes] = await Promise.all([
        defFetch(token, '/machines?$top=500&$select=id,computerDnsName,osPlatform,osVersion,riskScore,exposureLevel,healthStatus,lastSeen,firstSeen,lastIpAddress,osBuild,aadDeviceId'),
        defFetch(token, '/alerts?$top=200&$filter=status ne \'Resolved\''),
      ])
      const [devData, altData] = await Promise.all([devRes.json(), altRes.json()])
      const endpoints = (devData.value || []).map((d: any) => ({
        id: d.id, name: d.computerDnsName, os: d.osPlatform, os_version: d.osVersion,
        risk_score: d.riskScore, exposure_score: d.exposureLevel, health: d.healthStatus,
        last_seen: d.lastSeen, ip: d.lastIpAddress, alert_count: 0,
      }))
      const alerts = (altData.value || []).map((a: any) => ({
        id: a.id, title: a.title, severity: a.severity, category: a.category,
        endpoint_id: a.machineId, status: a.status, created: a.alertCreationTime, description: a.description,
      }))
      const sync_data = { groups: [], endpoints, alerts, recommendations: [], scores: {}, synced_at: new Date().toISOString() }
      await sb.from('connector_credentials').update({ sync_data, last_sync: new Date().toISOString() }).eq('org_id', org_id).eq('connector_id', 'defender')
      return respond({ ok:true, counts: { endpoints: endpoints.length, alerts: alerts.length } })
    }

    if (action === 'isolate' || action === 'unisolate') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:`Mock: device ${action}d` })
      const token = await getMSToken(creds)
      const res = await defFetch(token, `/machines/${device_id}/${action === 'isolate' ? 'isolate' : 'unisolate'}`, 'POST', { Comment: `${action} from Lakeview`, IsolationType: 'Full' })
      if (!res.ok) throw new Error(`Defender ${action} error: ${res.status}`)
      return respond({ ok:true })
    }

    if (action === 'run_scan') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: scan initiated' })
      const token = await getMSToken(creds)
      const res = await defFetch(token, `/machines/${device_id}/runAntiVirusScan`, 'POST', { Comment: 'Scan from Lakeview', ScanType: 'Full' })
      if (!res.ok) throw new Error(`Run scan error: ${res.status}`)
      return respond({ ok:true })
    }

    throw new Error('Unknown action: ' + action)
  } catch (e: any) {
    return respond({ ok:false, error: e.message }, 400)
  }
})
