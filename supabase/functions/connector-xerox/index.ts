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
      const { data, error } = await sb.from('connector_credentials').select('credentials, sync_data').eq('org_id', org_id).eq('connector_id', 'xerox').single()
      if (error) throw error
      return data
    }

    function xFetch(creds: any, path: string, method = 'GET', body?: unknown) {
      return fetch(`${creds.url}/api/v1${path}`, {
        method,
        headers: { Authorization: 'Bearer ' + btoa(`${creds.username}:${creds.password}`), 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (action === 'test') {
      const now = Date.now()
      const groups = [
        { id:'loc1', name:'Lincoln High School',    type:'location', device_count:6 },
        { id:'loc2', name:'Jefferson Middle',       type:'location', device_count:4 },
        { id:'loc3', name:'Franklin Elementary',    type:'location', device_count:3 },
        { id:'loc4', name:'District Office',        type:'location', device_count:2 },
      ]
      const printers = [
        { id:'xr001', serial:'ZWZ-001234', asset_tag:'LHS-P01', name:'LHS-Main-Office',  model:'Xerox VersaLink C405', ip:'10.1.1.200', location:'Lincoln High School',  group_id:'loc1', status:'Ready',   color:true,  duplex:true,  bw_total:184221, color_total:42018, scan_total:12441, copy_total:8901, fax_total:0,    pages_remaining:2800, toner_black:68, toner_cyan:45, toner_magenta:72, toner_yellow:55, drum_pct:81, last_ping:new Date(now-300000).toISOString(),  install_date:'2021-06-15', contract:'Full Service',  service_tag:'SVC-LHS-01' },
        { id:'xr002', serial:'ZWZ-005678', asset_tag:'LHS-P02', name:'LHS-Library',      model:'Xerox VersaLink B405', ip:'10.1.1.201', location:'Lincoln High School',  group_id:'loc1', status:'Ready',   color:false, duplex:true,  bw_total:302114, color_total:0,     scan_total:5211,  copy_total:1820, fax_total:0,    pages_remaining:4000, toner_black:82, toner_cyan:null, toner_magenta:null, toner_yellow:null, drum_pct:74, last_ping:new Date(now-600000).toISOString(),  install_date:'2020-08-10', contract:'Full Service',  service_tag:'SVC-LHS-02' },
        { id:'xr003', serial:'ZWZ-009012', asset_tag:'LHS-P03', name:'LHS-TeacherLounge',model:'Xerox WorkCentre 6515',ip:'10.1.1.202', location:'Lincoln High School',  group_id:'loc1', status:'Alert',   color:true,  duplex:true,  bw_total:91443,  color_total:21033, scan_total:8812,  copy_total:3304, fax_total:220,  pages_remaining:180,  toner_black:12, toner_cyan:88, toner_magenta:71, toner_yellow:66, drum_pct:55, last_ping:new Date(now-120000).toISOString(),  install_date:'2022-01-20', contract:'Parts Only',    service_tag:'SVC-LHS-03', alert:'Black toner low — 12% remaining' },
        { id:'xr004', serial:'ZWZ-013456', asset_tag:'JMS-P01', name:'JMS-MainOffice',   model:'Xerox VersaLink C405', ip:'10.1.2.200', location:'Jefferson Middle',     group_id:'loc2', status:'Ready',   color:true,  duplex:true,  bw_total:121088, color_total:31204, scan_total:9102,  copy_total:5501, fax_total:0,    pages_remaining:3200, toner_black:55, toner_cyan:61, toner_magenta:48, toner_yellow:53, drum_pct:68, last_ping:new Date(now-450000).toISOString(),  install_date:'2021-08-15', contract:'Full Service',  service_tag:'SVC-JMS-01' },
        { id:'xr005', serial:'ZWZ-017890', asset_tag:'JMS-P02', name:'JMS-Counseling',   model:'Xerox B210',           ip:'10.1.2.201', location:'Jefferson Middle',     group_id:'loc2', status:'Offline', color:false, duplex:false, bw_total:44221,  color_total:0,     scan_total:0,     copy_total:0,    fax_total:0,    pages_remaining:0,    toner_black:0,  toner_cyan:null, toner_magenta:null, toner_yellow:null, drum_pct:0,  last_ping:new Date(now-3600000).toISOString(), install_date:'2019-03-01', contract:'None',          service_tag:'SVC-JMS-02', alert:'Device offline — no ping for 60 min' },
        { id:'xr006', serial:'ZWZ-021234', asset_tag:'FES-P01', name:'FES-MainOffice',   model:'Xerox VersaLink C400', ip:'10.1.3.200', location:'Franklin Elementary',  group_id:'loc3', status:'Ready',   color:true,  duplex:true,  bw_total:88011,  color_total:18200, scan_total:6603,  copy_total:4410, fax_total:0,    pages_remaining:2100, toner_black:71, toner_cyan:39, toner_magenta:62, toner_yellow:44, drum_pct:60, last_ping:new Date(now-200000).toISOString(),  install_date:'2022-08-20', contract:'Full Service',  service_tag:'SVC-FES-01', alert:'Cyan toner low — 39% remaining' },
        { id:'xr007', serial:'ZWZ-025678', asset_tag:'DO-P01',  name:'DO-AdminSuite',    model:'Xerox VersaLink C505', ip:'10.0.1.200', location:'District Office',      group_id:'loc4', status:'Ready',   color:true,  duplex:true,  bw_total:201108, color_total:88041, scan_total:22014, copy_total:9120, fax_total:1840, pages_remaining:5000, toner_black:90, toner_cyan:85, toner_magenta:88, toner_yellow:82, drum_pct:92, last_ping:new Date(now-100000).toISOString(),  install_date:'2023-01-05', contract:'Full Service',  service_tag:'SVC-DO-01'  },
      ]
      const alerts = printers.filter(p => p.alert).map(p => ({
        id:'alrt-'+p.id, device_id:p.id, device_name:p.name, severity:p.status==='Offline'?'critical':'warning',
        message: p.alert, created:new Date(now-3600000).toISOString(), acknowledged:false,
      }))
      const sync_data = { groups, printers, alerts, synced_at: new Date().toISOString() }
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'xerox', credentials:{ mode:'mock' }, status:'connected', sync_data, last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true, sync_data })
    }

    if (action === 'save') {
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'xerox', credentials:payload.credentials, status:'connected', last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true })
    }
    if (action === 'load') {
      const { data, error } = await sb.from('connector_credentials').select('sync_data, last_sync').eq('org_id', org_id).eq('connector_id', 'xerox').single()
      if (error) throw error
      return respond({ ok:true, ...data })
    }

    if (action === 'sync') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') throw new Error('Mock mode — use real Xerox Fleet Manager credentials')
      const res = await xFetch(creds, '/devices?limit=500')
      if (!res.ok) throw new Error(`Xerox devices API error: ${res.status}`)
      const data = await res.json()
      const printers = (data.devices || []).map((d: any) => ({
        id: d.id, serial: d.serialNumber, name: d.friendlyName, model: d.model,
        ip: d.ipAddress, location: d.location, status: d.status,
        bw_total: d.meterReadings?.blackAndWhite || 0,
        color_total: d.meterReadings?.color || 0,
        toner_black: d.supplies?.find((s: any) => s.color === 'black')?.level || 0,
      }))
      const sync_data = { groups: [], printers, alerts: [], synced_at: new Date().toISOString() }
      await sb.from('connector_credentials').update({ sync_data, last_sync: new Date().toISOString() }).eq('org_id', org_id).eq('connector_id', 'xerox')
      return respond({ ok:true, counts: { printers: printers.length } })
    }

    if (action === 'acknowledge_alert') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:'Mock: alert acknowledged' })
      const res = await xFetch(creds, `/alerts/${payload.alert_id}/acknowledge`, 'POST')
      if (!res.ok) throw new Error(`Acknowledge error: ${res.status}`)
      return respond({ ok:true })
    }

    throw new Error('Unknown action: ' + action)
  } catch (e: any) {
    return respond({ ok:false, error: e.message }, 400)
  }
})
